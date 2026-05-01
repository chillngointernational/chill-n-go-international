import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=denonext";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() })
  : null;

const MEMBERSHIP_PRICE = 7.00;
const STRIPE_FEE = 0.50;
const CNG_FEE = 1.00;
const DISTRIBUTABLE = MEMBERSHIP_PRICE - STRIPE_FEE - CNG_FEE;

async function generateUniqueRefCode(): Promise<string> {
  const MAX_ATTEMPTS = 10;
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let code = "CNG-";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const { data: collision } = await supabase
      .from("identity_profiles")
      .select("id")
      .eq("ref_code", code)
      .maybeSingle();
    if (!collision) return code;
  }
  throw new Error("Failed to generate unique ref_code after " + MAX_ATTEMPTS + " attempts");
}

serve(async (req) => {
  try {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      console.error("Webhook misconfigured: missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
      return new Response(JSON.stringify({ error: "Server misconfigured", code: "server_misconfigured" }), { status: 500 });
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing signature", code: "missing_signature" }), { status: 400 });
    }

    const body = await req.text();

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (_err) {
      console.error("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature", code: "invalid_signature" }), { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      // Idempotency: skip if this event was already processed
      const { data: dupCheck } = await supabase
        .from("transactions")
        .select("id")
        .eq("metadata->>stripe_event_id", event.id)
        .maybeSingle();
      if (dupCheck) {
        return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
      }

      const session = event.data.object;
      const email = (session.customer_email || session.customer_details?.email)?.trim()?.toLowerCase();
      const customerId = typeof session.customer === "string" ? session.customer : null;

      if (!email) {
        return new Response(JSON.stringify({ error: "No email found on session", code: "no_email" }), { status: 400 });
      }

      let { data: existing } = await supabase
        .from("identity_profiles")
        .select("user_id, ref_code, account_type, referred_by")
        .eq("email", email)
        .maybeSingle();

      if (!existing || !existing.user_id) {
        // Payment-first flow: profile is created on the fly from this webhook.
        const refCodeFromMetadata = session.metadata?.ref_code;
        let referredBy = null;
        if (refCodeFromMetadata) {
          const { data: referrer } = await supabase
            .from("identity_profiles")
            .select("user_id")
            .eq("ref_code", refCodeFromMetadata)
            .eq("payment_status", "active")
            .eq("registration_completed", true)
            .maybeSingle();
          referredBy = referrer?.user_id || null;
        }

        const { data: authData, error: authError } =
          await supabase.auth.admin.createUser({
            email,
            email_confirm: true,
          });

        let authUserId = authData?.user?.id || null;

        if (!authUserId) {
          // Orphan auth.users from a prior failed attempt: look up and reuse.
          const { data: list } = await supabase.auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          });
          const lowered = email.toLowerCase();
          authUserId =
            list?.users?.find((u) => u.email?.toLowerCase() === lowered)?.id ||
            null;
        }

        if (!authUserId) {
          console.error("[cng-stripe-webhook] failed to create or find auth user", {
            email,
            event_id: event.id,
            authError,
          });
          return new Response(
            JSON.stringify({ received: true, error: "Could not create or find auth user", code: "auth_user_unavailable", email }),
            { status: 200 }
          );
        }

        if (referredBy === authUserId || existing?.referred_by === authUserId) {
          console.error("[cng-stripe-webhook] self-referral attempt blocked", {
            email,
            event_id: event.id,
            ref_code: refCodeFromMetadata,
            authUserId,
            metadata_ref: referredBy,
            orphan_ref: existing?.referred_by ?? null,
          });
          return new Response(
            JSON.stringify({ received: true, error: "Self-referral attempt blocked", code: "self_referral", email }),
            { status: 200 }
          );
        }

        let resolvedProfile;
        if (existing) {
          // Orphan profile (email exists but user_id is null): UPDATE link
          // instead of INSERT to avoid violating the unique email constraint.
          const { data: updated, error: updateErr } = await supabase
            .from("identity_profiles")
            .update({
              user_id: authUserId,
              ref_code: existing.ref_code || await generateUniqueRefCode(),
              referred_by: existing.referred_by || referredBy,
              payment_status: "active",
              account_type: "member",
              stripe_customer_id: customerId,
              updated_at: new Date().toISOString(),
            })
            .eq("email", email)
            .select("user_id, ref_code, account_type, referred_by")
            .single();

          if (updateErr || !updated) {
            console.error("[cng-stripe-webhook] orphan profile UPDATE failed", {
              email,
              event_id: event.id,
              updateErr,
            });
            return new Response(
              JSON.stringify({ received: true, error: "Failed to update orphan profile", code: "profile_update_failed", email }),
              { status: 200 }
            );
          }

          resolvedProfile = updated;
        } else {
          const { data: newProfile, error: insertError } = await supabase
            .from("identity_profiles")
            .insert({
              user_id: authUserId,
              email,
              ref_code: await generateUniqueRefCode(),
              referred_by: referredBy,
              payment_status: "active",
              account_type: "member",
              stripe_customer_id: customerId,
            })
            .select("user_id, ref_code, account_type, referred_by")
            .single();

          if (insertError || !newProfile) {
            console.error("[cng-stripe-webhook] identity_profiles insert failed", {
              email,
              event_id: event.id,
              insertError,
            });
            return new Response(
              JSON.stringify({ received: true, error: "Failed to insert profile", code: "profile_insert_failed", email }),
              { status: 200 }
            );
          }

          resolvedProfile = newProfile;
        }

        existing = resolvedProfile;
      } else {
        await supabase
          .from("identity_profiles")
          .update({
            payment_status: "active",
            account_type: "member",
            ref_code: existing.ref_code || await generateUniqueRefCode(),
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", existing.user_id);
      }

      const { data: existingRole } = await supabase
        .from("platform_roles")
        .select("id")
        .eq("user_id", existing.user_id)
        .eq("platform", "cng_app")
        .eq("role", "member")
        .maybeSingle();

      if (!existingRole) {
        await supabase.from("platform_roles").insert({
          user_id: existing.user_id,
          platform: "cng_app",
          role: "member",
        });
      }

      // Build referral_tree entry if referred_by is set and not already present
      if (existing.referred_by) {
        const { data: existingTree } = await supabase
          .from("referral_tree")
          .select("id")
          .eq("member_id", existing.user_id)
          .maybeSingle();

        if (!existingTree) {
          const { data: referrerTree } = await supabase
            .from("referral_tree")
            .select("path, depth")
            .eq("member_id", existing.referred_by)
            .single();

          const parentPath = referrerTree?.path || [existing.referred_by];
          const newPath = [...parentPath, existing.user_id];
          const newDepth = (referrerTree?.depth || 0) + 1;

          await supabase.from("referral_tree").insert({
            member_id: existing.user_id,
            referred_by: existing.referred_by,
            depth: newDepth,
            path: newPath,
          });

          await supabase
            .from("identity_profiles")
            .update({
              direct_referrals_count: (await supabase
                .from("referral_tree")
                .select("id", { count: "exact", head: true })
                .eq("referred_by", existing.referred_by)
              ).count || 0,
            })
            .eq("user_id", existing.referred_by);

          await supabase
            .from("identity_profiles")
            .update({ referral_depth: newDepth })
            .eq("user_id", existing.user_id);
        }
      }

      // Resolve L1 and L2 profile IDs (RPC needs identity_profiles.id, not auth.users.id)
      let l1ProfileId = null;
      let l2ProfileId = null;
      if (existing.referred_by) {
        const { data: l1 } = await supabase
          .from("identity_profiles")
          .select("id, referred_by")
          .eq("user_id", existing.referred_by)
          .maybeSingle();
        if (l1) {
          l1ProfileId = l1.id;
          if (l1.referred_by) {
            const { data: l2 } = await supabase
              .from("identity_profiles")
              .select("id")
              .eq("user_id", l1.referred_by)
              .maybeSingle();
            if (l2) l2ProfileId = l2.id;
          }
        }
      }

      // Atomic: INSERT transactions + 3× apply_chilliums in a single Postgres transaction
      const { error: rpcErr } = await supabase.rpc("process_membership_payment", {
        p_user_id: existing.user_id,
        p_stripe_event_id: event.id,
        p_base_centi: Math.floor(DISTRIBUTABLE * 100),
        p_l1_profile_id: l1ProfileId,
        p_l2_profile_id: l2ProfileId,
        p_description: "Membresia CNG+ - activacion",
      });

      if (rpcErr) {
        console.error("[cng-stripe-webhook] process_membership_payment failed", {
          event_id: event.id,
          user_id: existing.user_id,
          rpcErr,
        });
        return new Response(
          JSON.stringify({ error: "Failed to process payment", code: "process_failed", event_id: event.id }),
          { status: 500 }
        );
      }

      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    if (event.type === "customer.subscription.deleted" || event.type === "invoice.payment_failed") {
      const subscription = event.data.object;
      const customerId = subscription.customer;

      const { data: member } = await supabase
        .from("identity_profiles")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (member) {
        await supabase
          .from("identity_profiles")
          .update({
            payment_status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", member.user_id);
      }

      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    if (event.type === "invoice.payment_succeeded") {
      // Idempotency: skip if this event was already processed
      const { data: dupCheck } = await supabase
        .from("transactions")
        .select("id")
        .eq("metadata->>stripe_event_id", event.id)
        .maybeSingle();
      if (dupCheck) {
        return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
      }

      const invoice = event.data.object;
      const customerId = invoice.customer;

      const { data: member } = await supabase
        .from("identity_profiles")
        .select("user_id, email, referred_by")
        .eq("stripe_customer_id", customerId)
        .single();

      if (member) {
        await supabase
          .from("identity_profiles")
          .update({
            payment_status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", member.user_id);

        // Resolve L1 and L2 profile IDs
        let l1ProfileId = null;
        let l2ProfileId = null;
        if (member.referred_by) {
          const { data: l1 } = await supabase
            .from("identity_profiles")
            .select("id, referred_by")
            .eq("user_id", member.referred_by)
            .maybeSingle();
          if (l1) {
            l1ProfileId = l1.id;
            if (l1.referred_by) {
              const { data: l2 } = await supabase
                .from("identity_profiles")
                .select("id")
                .eq("user_id", l1.referred_by)
                .maybeSingle();
              if (l2) l2ProfileId = l2.id;
            }
          }
        }

        // Atomic: INSERT transactions + 3× apply_chilliums in single Postgres tx
        const { error: rpcErr } = await supabase.rpc("process_membership_payment", {
          p_user_id: member.user_id,
          p_stripe_event_id: event.id,
          p_base_centi: Math.floor(DISTRIBUTABLE * 100),
          p_l1_profile_id: l1ProfileId,
          p_l2_profile_id: l2ProfileId,
          p_description: "Renovacion CNG+",
        });

        if (rpcErr) {
          console.error("[cng-stripe-webhook] renewal process_membership_payment failed", {
            event_id: event.id,
            user_id: member.user_id,
            rpcErr,
          });
          return new Response(
            JSON.stringify({ error: "Failed to process renewal", code: "process_failed", event_id: event.id }),
            { status: 500 }
          );
        }
      }

      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message, code: "internal_error" }), { status: 500 });
  }
});
