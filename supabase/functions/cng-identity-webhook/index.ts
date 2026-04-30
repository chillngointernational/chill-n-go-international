import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=denonext";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_IDENTITY_WEBHOOK_SECRET = Deno.env.get("STRIPE_IDENTITY_WEBHOOK_SECRET");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() })
  : null;

serve(async (req) => {
  try {
    if (!stripe || !STRIPE_IDENTITY_WEBHOOK_SECRET) {
      console.error(
        "[cng-identity-webhook] Misconfigured: missing STRIPE_SECRET_KEY or STRIPE_IDENTITY_WEBHOOK_SECRET"
      );
      return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500 });
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing signature" }), { status: 400 });
    }

    const body = await req.text();

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        STRIPE_IDENTITY_WEBHOOK_SECRET
      );
    } catch (_err) {
      console.error("[cng-identity-webhook] Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }

    if (event.type === "identity.verification_session.verified") {
      const session = event.data.object;
      const email = session.metadata?.email;
      if (email) {
        await supabase
          .from("identity_profiles")
          .update({
            identity_verification_status: "verified",
            stripe_verification_session_id: session.id,
            verified_at: new Date().toISOString(),
            last_kyc_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("email", email);
      }
      return new Response(
        JSON.stringify({ received: true, status: "verified" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (event.type === "identity.verification_session.requires_input") {
      const session = event.data.object;
      const email = session.metadata?.email;
      if (email) {
        await supabase
          .from("identity_profiles")
          .update({
            identity_verification_status: "failed",
            stripe_verification_session_id: session.id,
            last_kyc_error: session.last_error?.code || "unknown",
            updated_at: new Date().toISOString(),
          })
          .eq("email", email);
      }
      return new Response(
        JSON.stringify({ received: true, status: "failed" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ received: true, status: "ignored" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[cng-identity-webhook] Unexpected error", { error });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
