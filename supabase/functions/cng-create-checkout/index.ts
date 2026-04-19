import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const CNG_PRICE_ID = Deno.env.get("CNG_PRICE_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let email;
  let ref_code;

  try {
    const body = await req.json();
    email = body.email?.trim()?.toLowerCase();
    ref_code = body.ref_code;
    const success_url = body.success_url;
    const cancel_url = body.cancel_url;

    if (!success_url) {
      return new Response(JSON.stringify({ error: "success_url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!cancel_url) {
      return new Response(JSON.stringify({ error: "cancel_url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate the wizard already created the profile with payment_status='pending'
    const { data: profile } = await supabase
      .from("identity_profiles")
      .select("user_id, payment_status")
      .eq("email", email)
      .maybeSingle();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "No registration found. Please complete the wizard first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (profile.payment_status === "active") {
      return new Response(
        JSON.stringify({ error: "This account is already active." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (profile.payment_status !== "pending") {
      return new Response(
        JSON.stringify({ error: "Invalid registration state." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append("payment_method_types[]", "card");
    params.append("line_items[0][price]", CNG_PRICE_ID);
    params.append("line_items[0][quantity]", "1");
    params.append("subscription_data[trial_period_days]", "30");
    params.append("subscription_data[metadata][ref_code]", ref_code || "");
    params.append("success_url", success_url);
    params.append("cancel_url", cancel_url);
    params.append("customer_email", email);
    params.append("metadata[ref_code]", ref_code || "");
    params.append("line_items[1][price_data][currency]", "usd");
    params.append("line_items[1][price_data][product_data][name]", "CNG+ Activacion (primer mes)");
    params.append("line_items[1][price_data][unit_amount]", "1000");
    params.append("line_items[1][quantity]", "1");

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + STRIPE_SECRET_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await response.json();

    if (session.error) {
      console.error("[cng-create-checkout] Stripe returned error", {
        email,
        ref_code,
        stripe_error: session.error,
      });
      return new Response(JSON.stringify({ error: session.error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[cng-create-checkout] Unexpected error", {
      email,
      ref_code,
      error,
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});