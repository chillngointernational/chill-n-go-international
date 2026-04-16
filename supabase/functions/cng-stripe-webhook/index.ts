import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CNG_FEE = 1.00;
const MEMBERSHIP_PRICE = 7.00;
const DISTRIBUTABLE = MEMBERSHIP_PRICE - CNG_FEE;

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
  const l1Amount = baseAmount * SPLIT_L1;
  await creditChilliums(
    memberId, l1Amount, "cashback_direct",
    description + " - cashback propio",
    memberId, 1, transactionId
  );

  const { data: member } = await supabase
    .from("identity_profiles")
    .select("referred_by")
    .eq("user_id", memberId)
    .single();

  if (!member?.referred_by) return;

  const l2UserId = member.referred_by;
  const l2Amount = baseAmount * SPLIT_L2;
  await creditChilliums(
    l2UserId, l2Amount, "cashback_network",
    description + " - referido L2: " + memberEmail,
    memberId, 2, transactionId
  );

  const { data: l2Member } = await supabase
    .from("identity_profiles")
    .select("referred_by")
    .eq("user_id", l2UserId)
    .single();

  if (!l2Member?.referred_by) return;

  const l3UserId = l2Member.referred_by;
  const l3Amount = baseAmount * SPLIT_L3;
  await creditChilliums(
    l3UserId, l3Amount, "cashback_network",
    description + " - referido L3: " + memberEmail,
    memberId, 3, transactionId
  );
}

serve(async (req) => {
  try {
    const body = await req.text();
    const event = JSON.parse(body);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const email = session.customer_email || session.customer_details?.email;
      const refCode = session.metadata?.ref_code || "";
      const customerId = session.customer;

      if (!email) {
        return new Response(JSON.stringify({ error: "No email found" }), { status: 400 });
      }

      const { data: existing } = await supabase
        .from("identity_profiles")
        .select("user_id, ref_code, account_type")
        .eq("email", email)
        .single();

      if (existing && existing.user_id) {
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
          })
          .select("id")
          .single();

        await distributeChilliums(
          existing.user_id, email, DISTRIBUTABLE,
          "Membresia CNG+", txn?.id || null
        );

      } else {
        const newRefCode = generateRefCode();

        let referredByUserId = null;
        if (refCode) {
          const { data: referrer } = await supabase
            .from("identity_profiles")
            .select("user_id")
            .eq("ref_code", refCode)
            .single();
          if (referrer) referredByUserId = referrer.user_id;
        }

        const { data: authUsers } = await supabase.auth.admin.listUsers();
        const authUser = authUsers?.users?.find((u: any) => u.email === email);

        const { data: newProfile, error: insertError } = await supabase
          .from("identity_profiles")
          .insert({
            email,
            user_id: authUser?.id || null,
            first_name: email.split("@")[0],
            last_name: "",
            account_type: "member",
            ref_code: newRefCode,
            referred_by: referredByUserId,
            payment_status: "active",
            stripe_customer_id: customerId,
            chilliums_balance: 0,
            chilliums_total_earned: 0,
            chilliums_total_spent: 0,
          })
          .select("user_id")
          .single();

        if (insertError) {
          console.error("Insert error:", insertError);
          return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });
        }

        const newUserId = newProfile?.user_id || authUser?.id;

        if (newUserId) {
          await supabase.from("platform_roles").insert({
            user_id: newUserId,
            platform: "cng_app",
            role: "member",
          });

          if (referredByUserId) {
            const { data: referrerTree } = await supabase
              .from("referral_tree")
              .select("path, depth")
              .eq("member_id", referredByUserId)
              .single();

            const parentPath = referrerTree?.path || [referredByUserId];
            const newPath = [...parentPath, newUserId];
            const newDepth = (referrerTree?.depth || 0) + 1;

            await supabase.from("referral_tree").insert({
              member_id: newUserId,
              referred_by: referredByUserId,
              depth: newDepth,
              path: newPath,
            });

            await supabase
              .from("identity_profiles")
              .update({
                direct_referrals_count: (await supabase
                  .from("referral_tree")
                  .select("id", { count: "exact", head: true })
                  .eq("referred_by", referredByUserId)
                ).count || 0,
              })
              .eq("user_id", referredByUserId);

            await supabase
              .from("identity_profiles")
              .update({
                referred_by: referredByUserId,
                referral_depth: newDepth,
              })
              .eq("user_id", newUserId);
          }

          const { data: txn } = await supabase
            .from("transactions")
            .insert({
              user_id: newUserId,
              lob: "cng_plus",
              type: "subscription",
              description: "Membresia CNG+ - primer pago",
              gross_amount: MEMBERSHIP_PRICE,
              currency: "USD",
              operating_cost: CNG_FEE,
              net_profit: DISTRIBUTABLE,
              status: "completed",
            })
            .select("id")
            .single();

          await distributeChilliums(
            newUserId, email, DISTRIBUTABLE,
            "Membresia CNG+", txn?.id || null
          );
        }
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
