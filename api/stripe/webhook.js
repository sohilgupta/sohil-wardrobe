/* ─── POST /api/stripe/webhook ────────────────────────────────────────────────
   Handles Stripe webhook events to keep subscription status in sync.

   Events handled:
   - checkout.session.completed
   - customer.subscription.updated
   - customer.subscription.deleted

   Requires raw body for signature verification — configure vercel.json
   to pass raw body to this route (bodyParser: false).
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

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end",  () => resolve(Buffer.from(data)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sig     = req.headers["stripe-signature"];
  const secret  = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("[Stripe webhook] Signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  async function upsertProfile(userId, plan, subscriptionId, status) {
    await supabase.from("profiles").upsert({
      id:                     userId,
      plan,
      stripe_subscription_id: subscriptionId,
      subscription_status:    status,
    });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId  = session.metadata?.supabase_user_id;
      if (userId && session.subscription) {
        await upsertProfile(userId, "pro", session.subscription, "active");
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub    = event.data.object;
      const userId = sub.metadata?.supabase_user_id;
      if (userId) {
        const plan   = sub.status === "active" ? "pro" : "free";
        await upsertProfile(userId, plan, sub.id, sub.status);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub    = event.data.object;
      const userId = sub.metadata?.supabase_user_id;
      if (userId) {
        await upsertProfile(userId, "free", null, "canceled");
      }
      break;
    }

    default:
      // Ignore unhandled event types
      break;
  }

  return res.status(200).json({ received: true });
}
