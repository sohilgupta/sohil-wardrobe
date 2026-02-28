/* ─── POST /api/ai ───────────────────────────────────────────────────────────
   Server-side proxy for the Google Gemini API.
   Keeps the API key server-side only — never exposed to the browser.
   Accepts Anthropic-style { model, max_tokens, messages, system } body and
   normalises the Gemini response back to { content: [{ text }] } so the
   client doesn't need to know which model provider is in use.
   Requires a valid session cookie.
   ─────────────────────────────────────────────────────────────────────────── */

import { requireAuth } from "../lib/auth.js";

export const maxDuration = 60; // seconds — Gemini can take 20-30s for a full trip

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireAuth(req, res)) return;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY environment variable is not set" });
  }

  const { model, max_tokens, messages, system } = req.body || {};

  if (!model || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Missing required fields: model, messages" });
  }

  // Transform Anthropic-style messages → Gemini contents array
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const geminiBody = {
    contents,
    generationConfig: {
      maxOutputTokens: max_tokens || 8000,
      // Disable thinking tokens — we need pure JSON output, not reasoning text
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  if (system) {
    geminiBody.systemInstruction = { parts: [{ text: system }] };
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(geminiBody),
      }
    );

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: data?.error?.message || `Gemini API error ${upstream.status}`,
      });
    }

    // Normalise to Anthropic-like shape: { content: [{ text }] }
    // Gemini 2.5 Flash may return thinking parts (thought: true) before the
    // actual response — skip those and take the first non-thinking part.
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const responsePart = parts.find((p) => !p.thought) || parts[0] || {};
    const text = responsePart.text || "";
    return res.status(200).json({ content: [{ text }] });
  } catch (err) {
    console.error("AI proxy error:", err.message);
    return res.status(500).json({ error: "AI request failed" });
  }
}
