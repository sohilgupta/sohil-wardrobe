/* ─── GET /api/auth/check ────────────────────────────────────────────────────
   Returns 200 if the session cookie is valid, 401 otherwise.
   Used by the React app on mount to determine auth state.
   ─────────────────────────────────────────────────────────────────────────── */

import { requireAuth } from "../../lib/auth.js";

export default function handler(req, res) {
  if (!requireAuth(req, res)) return;
  return res.status(200).json({ authenticated: true });
}
