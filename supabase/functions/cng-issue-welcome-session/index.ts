import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=denonext";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() })
  : null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!stripe) {
      console.error("[cng-issue-welcome-session] Misconfigured: missing STRIPE_SECRET_KEY");
      return new Response(JSON.stringify({ error: "Server misconfigured", code: "server_misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const session_id = body.session_id;

    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id is required", code: "session_id_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.status !== "complete") {
      return new Response(JSON.stringify({ error: "Payment not completed", code: "payment_not_completed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerId = session.customer;
    if (!customerId || typeof customerId !== "string") {
      return new Response(JSON.stringify({ error: "No customer on checkout session", code: "no_customer" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Replay guard: don't issue a session if the user already completed onboarding.
    const { data: profile } = await supabase
      .from("identity_profiles")
      .select("email, registration_completed")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    if (!profile) {
      console.error("[cng-issue-welcome-session] no profile for stripe_customer_id", { customerId, session_id });
      return new Response(JSON.stringify({ error: "Profile not found", code: "profile_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (profile.registration_completed === true) {
      return new Response(JSON.stringify({ error: "Registration already complete", code: "registration_complete" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
    });

    if (error || !data?.properties?.hashed_token) {
      console.error("[cng-issue-welcome-session] generateLink failed", { email: profile.email, error });
      return new Response(JSON.stringify({ error: "Failed to issue session", code: "session_issue_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ hashed_token: data.properties.hashed_token, email: profile.email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[cng-issue-welcome-session] unexpected error", err);
    return new Response(JSON.stringify({ error: err.message, code: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
