/* ─── POST /api/stripe/portal ─────────────────────────────────────────────────
   Creates a Stripe Customer Portal session so users can manage billing.
   Returns { url } — redirect the user to this URL.

   Body: { userId }
   ─────────────────────────────────────────────────────────────────────────── */

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-11-20.acacia",
});

const supabase = createClient(
  process.env.SUPABASE_URL         || "",
  process.env.SUPABASE_SERVICE_KEY || ""
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId is required" });

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    if (!profile?.stripe_customer_id) {
      return res.status(404).json({ error: "No billing account found. Please subscribe first." });
    }

    const origin = req.headers.origin || process.env.NEXT_PUBLIC_APP_URL || "https://vesti.app";

    const session = await stripe.billingPortal.sessions.create({
      customer:   profile.stripe_customer_id,
      return_url: origin,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("[Stripe portal]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
