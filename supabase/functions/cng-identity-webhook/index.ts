import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  try {
    const body = await req.text();
    const event = JSON.parse(body);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (event.type === "identity.verification_session.verified") {
      const session = event.data.object;
      const email = session.metadata?.email;
      if (email) {
        await supabase.from("cng_members").update({ identity_verification_status: "verified", stripe_verification_session_id: session.id, updated_at: new Date().toISOString() }).eq("email", email);
      }
      return new Response(JSON.stringify({ received: true, status: "verified" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (event.type === "identity.verification_session.requires_input") {
      const session = event.data.object;
      const email = session.metadata?.email;
      if (email) {
        await supabase.from("cng_members").update({ identity_verification_status: "failed", stripe_verification_session_id: session.id, updated_at: new Date().toISOString() }).eq("email", email);
      }
      return new Response(JSON.stringify({ received: true, status: "failed" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ received: true, status: "ignored" }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
