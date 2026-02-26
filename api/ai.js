/* ─── POST /api/ai ───────────────────────────────────────────────────────────
   Server-side proxy for the Anthropic Claude API.
   Keeps the API key server-side only — never exposed to the browser.
   Requires a valid session cookie.
   ─────────────────────────────────────────────────────────────────────────── */

import { requireAuth } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireAuth(req, res)) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY environment variable is not set" });
  }

  const { model, max_tokens, messages, system } = req.body || {};

  if (!model || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Missing required fields: model, messages" });
  }

  const body = { model, max_tokens, messages };
  if (system) body.system = system;

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    console.error("AI proxy error:", err.message);
    return res.status(500).json({ error: "AI request failed" });
  }
}
