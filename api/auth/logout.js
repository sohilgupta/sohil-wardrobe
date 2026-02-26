/* ─── POST /api/auth/logout ──────────────────────────────────────────────────
   Clears the session cookie.
   ─────────────────────────────────────────────────────────────────────────── */

import { buildCookieHeader } from "../../lib/auth.js";

export default function handler(req, res) {
  // Expire the cookie immediately (Max-Age=0)
  res.setHeader("Set-Cookie", buildCookieHeader("", 0));
  return res.status(200).json({ ok: true });
}
