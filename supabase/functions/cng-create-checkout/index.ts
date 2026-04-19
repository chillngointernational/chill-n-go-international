import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const CNG_PRICE_ID = Deno.env.get("CNG_PRICE_ID")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, ref_code, success_url, cancel_url } = await req.json();

    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append("payment_method_types[]", "card");
    params.append("line_items[0][price]", CNG_PRICE_ID);
    params.append("line_items[0][quantity]", "1");
    params.append("subscription_data[trial_period_days]", "30");
    params.append("subscription_data[metadata][ref_code]", ref_code || "");
    params.append("success_url", success_url || "https://chillngointernational.com/join?step=register&ref=" + (ref_code || ""));
    params.append("cancel_url", cancel_url || "https://chillngointernational.com/join?ref=" + (ref_code || ""));
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});