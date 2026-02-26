/* ─── POST /api/auth/login ───────────────────────────────────────────────────
   Verifies the submitted password against the bcrypt hash stored in
   APP_PASSWORD_HASH (env var). The plain-text password never appears in code.
   On success, issues a signed HTTP-only session cookie.
   ─────────────────────────────────────────────────────────────────────────── */

import bcrypt from "bcryptjs";
import { getSessionToken, buildCookieHeader } from "../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password } = req.body || {};

  if (!password) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const hash = (process.env.APP_PASSWORD_HASH || "").trim();
  if (!hash) {
    console.error("APP_PASSWORD_HASH environment variable is not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  // bcrypt.compare is constant-time — safe against timing attacks
  const valid = await bcrypt.compare(password, hash);

  if (!valid) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const token = getSessionToken();
  res.setHeader("Set-Cookie", buildCookieHeader(token));
  return res.status(200).json({ ok: true });
}
