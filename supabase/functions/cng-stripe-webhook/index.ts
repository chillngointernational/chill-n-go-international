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

const SPLIT_L1 = 0.50;
const SPLIT_L2 = 0.35;
const SPLIT_L3 = 0.15;

function generateRefCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "CNG-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function creditChilliums(
  userId: string,
  amount: number,
  type: string,
  description: string,
  sourceUserId: string | null,
  referralLevel: number | null,
  sourceTransactionId: string | null
) {
  const { data: profile } = await supabase
    .from("identity_profiles")
    .select("chilliums_balance, chilliums_total_earned")
    .eq("user_id", userId)
    .single();

  if (!profile) {
    console.error("creditChilliums: profile not found for user " + userId);
    return;
  }

  const newBalance = (profile.chilliums_balance || 0) + amount;
  const newTotalEarned = (profile.chilliums_total_earned || 0) + amount;

  await supabase.from("chilliums_ledger").insert({
    user_id: userId,
    type,
    amount,
    balance_after: newBalance,
    source_user_id: sourceUserId,
    source_transaction_id: sourceTransactionId,
    referral_level: referralLevel,
    description,
  });

  await supabase
    .from("identity_profiles")
    .update({
      chilliums_balance: newBalance,
      chilliums_total_earned: newTotalEarned,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

async function distributeChilliums(
  memberId: string,
  memberEmail: string,
  baseAmount: number,
  description: string,
  transactionId: string | null
) {
  // Level 0: the paying member (50%)
  const l0Amount = baseAmount * SPLIT_L1;
  await creditChilliums(
    memberId, l0Amount, "earn_referral_level_0",
    description + " - cashback propio",
    memberId, 0, transactionId
  );

  const { data: member } = await supabase
    .from("identity_profiles")
    .select("referred_by")
    .eq("user_id", memberId)
    .single();

  if (!member?.referred_by) return;

  // Level 1: direct referrer (35%)
  const l1UserId = member.referred_by;
  const l1Amount = baseAmount * SPLIT_L2;
  await creditChilliums(
    l1UserId, l1Amount, "earn_referral_level_1",
    description + " - referido nivel 1: " + memberEmail,
    memberId, 1, transactionId
  );

  const { data: l1Member } = await supabase
    .from("identity_profiles")
    .select("referred_by")
    .eq("user_id", l1UserId)
    .single();

  if (!l1Member?.referred_by) return;

  // Level 2: grandparent referrer (15%)
  const l2UserId = l1Member.referred_by;
  const l2Amount = baseAmount * SPLIT_L3;
  await creditChilliums(
    l2UserId, l2Amount, "earn_referral_level_2",
    description + " - referido nivel 2: " + memberEmail,
    memberId, 2, transactionId
  );
}

serve(async (req) => {
  try {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      console.error("Webhook misconfigured: missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500 });
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing signature" }), { status: 400 });
    }

    const body = await req.text();

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (_err) {
      console.error("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
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
      const email = session.customer_email || session.customer_details?.email;
      const customerId = session.customer;

      if (!email) {
        return new Response(JSON.stringify({ error: "No email found" }), { status: 400 });
      }

      // The wizard must have created the profile before payment.
      // We no longer create profiles with fabricated data here.
      const { data: existing } = await supabase
        .from("identity_profiles")
        .select("user_id, ref_code, account_type, referred_by")
        .eq("email", email)
        .single();

      if (!existing || !existing.user_id) {
        console.error(
          "[cng-stripe-webhook] checkout.session.completed but no identity_profile found for email=" +
          email +
          ". Expected the wizard to create the profile before payment. Event id=" +
          event.id +
          ". Returning 200 to prevent retries; this event will NOT be processed."
        );
        return new Response(
          JSON.stringify({ received: true, error: "no_profile", email }),
          { status: 200 }
        );
      }

      await supabase
        .from("identity_profiles")
        .update({
          payment_status: "active",
          account_type: "member",
          ref_code: existing.ref_code || generateRefCode(),
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", existing.user_id);

      const { data: existingRole } = await supabase
        .from("platform_roles")
        .select("id")
        .eq("user_id", existing.user_id)
        .eq("platform", "cng_app")
        .eq("role", "member")
        .single();

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

      const { data: txn } = await supabase
        .from("transactions")
        .insert({
          user_id: existing.user_id,
          lob: "cng_plus",
          type: "subscription",
          description: "Membresia CNG+ - activacion",
          gross_amount: MEMBERSHIP_PRICE,
          currency: "USD",
          operating_cost: CNG_FEE,
          net_profit: DISTRIBUTABLE,
          status: "completed",
          metadata: { stripe_event_id: event.id },
        })
        .select("id")
        .single();

      await distributeChilliums(
        existing.user_id, email, DISTRIBUTABLE,
        "Membresia CNG+", txn?.id || null
      );

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

        const { data: txn } = await supabase
          .from("transactions")
          .insert({
            user_id: member.user_id,
            lob: "cng_plus",
            type: "subscription",
            description: "Membresia CNG+ - renovacion mensual",
            gross_amount: MEMBERSHIP_PRICE,
            currency: "USD",
            operating_cost: CNG_FEE,
            net_profit: DISTRIBUTABLE,
            status: "completed",
            metadata: { stripe_event_id: event.id },
          })
          .select("id")
          .single();

        await distributeChilliums(
          member.user_id, member.email, DISTRIBUTABLE,
          "Renovacion CNG+", txn?.id || null
        );
      }

      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
