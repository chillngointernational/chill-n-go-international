import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=denonext";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFICATION_FLOW_ID = "vf_1TI1VhClWFP3vlIVQjUBTF7X";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let email;

  try {
    const body = await req.json();
    email = body.email?.trim()?.toLowerCase();
    const return_url = body.return_url;

    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up existing profile to potentially reuse its verification session
    const { data: profile } = await supabase
      .from("identity_profiles")
      .select("stripe_verification_session_id, identity_verification_status")
      .eq("email", email)
      .maybeSingle();

    // Reuse an existing session if the user already started one and it's still active
    if (
      profile?.stripe_verification_session_id &&
      (profile.identity_verification_status === "pending" ||
        profile.identity_verification_status === "processing")
    ) {
      try {
        const existingSession = await stripe.identity.verificationSessions.retrieve(
          profile.stripe_verification_session_id
        );
        if (
          existingSession &&
          (existingSession.status === "requires_input" ||
            existingSession.status === "processing")
        ) {
          return new Response(
            JSON.stringify({
              client_secret: existingSession.client_secret,
              session_id: existingSession.id,
              url: existingSession.url,
              reused: true,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      } catch (err) {
        // If retrieve fails (session not found, permission denied, etc), fall through and create a new one
        console.error(
          "[cng-create-verification] Failed to retrieve existing verification session",
          {
            email,
            session_id: profile.stripe_verification_session_id,
            error: err,
          }
        );
      }
    }

    // Create a new verification session
    const params = new URLSearchParams();
    params.append("type", "document");
    params.append("verification_flow", VERIFICATION_FLOW_ID);
    params.append("provided_details[email]", email);
    params.append("metadata[email]", email);
    params.append("return_url", return_url || "https://chillngointernational.com/verification-complete");

    const response = await fetch("https://api.stripe.com/v1/identity/verification_sessions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + STRIPE_SECRET_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await response.json();

    if (session.error) {
      console.error("[cng-create-verification] Stripe returned error", {
        email,
        stripe_error: session.error,
      });
      return new Response(JSON.stringify({ error: session.error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist the new session on the profile and mark status as pending
    await supabase
      .from("identity_profiles")
      .update({
        stripe_verification_session_id: session.id,
        identity_verification_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("email", email);

    return new Response(
      JSON.stringify({
        client_secret: session.client_secret,
        session_id: session.id,
        url: session.url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[cng-create-verification] Unexpected error", { email, error });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
