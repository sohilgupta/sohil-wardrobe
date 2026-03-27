/* ─── POST /api/stripe/checkout ───────────────────────────────────────────────
   Creates a Stripe Checkout session for a Pro subscription.
   Returns { url } — redirect the user to this URL.

   Body: { userId, email, billing: "monthly" | "yearly" }
   ─────────────────────────────────────────────────────────────────────────── */

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-11-20.acacia",
});

const supabase = createClient(
  process.env.SUPABASE_URL      || "",
  process.env.SUPABASE_SERVICE_KEY || ""
);

const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || "",
  yearly:  process.env.STRIPE_PRICE_YEARLY  || "",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, email, billing = "monthly" } = req.body || {};

  if (!userId || !email) {
    return res.status(400).json({ error: "userId and email are required" });
  }

  const priceId = PRICE_IDS[billing];
  if (!priceId) {
    return res.status(500).json({ error: "Stripe price ID not configured" });
  }

  try {
    // Look up or create a Stripe customer
    let customerId;
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;

      // Persist new customer ID
      await supabase
        .from("profiles")
        .upsert({ id: userId, email, stripe_customer_id: customerId });
    }

    const origin = req.headers.origin || process.env.NEXT_PUBLIC_APP_URL || "https://vesti.app";

    const session = await stripe.checkout.sessions.create({
      customer:   customerId,
      mode:       "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}?checkout=success`,
      cancel_url:  `${origin}?checkout=canceled`,
      metadata:    { supabase_user_id: userId },
      subscription_data: {
        metadata: { supabase_user_id: userId },
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("[Stripe checkout]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
