/* ─── AUTH UTILITIES ─────────────────────────────────────────────────────────
   Shared between all API routes. Runs in Node.js serverless runtime.
   ─────────────────────────────────────────────────────────────────────────── */

import { createHmac, timingSafeEqual } from "node:crypto";

/* ─── Cookie parser ───────────────────────────────────────────────────────── */
export function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((cookie) => {
    const eqIdx = cookie.indexOf("=");
    if (eqIdx < 0) return;
    const name = cookie.slice(0, eqIdx).trim();
    const value = cookie.slice(eqIdx + 1).trim();
    if (name) cookies[name] = value;
  });
  return cookies;
}

/* ─── Session token (deterministic HMAC — no DB needed) ──────────────────── */
export function getSessionToken() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET environment variable is not set");
  return createHmac("sha256", secret).update("authenticated").digest("hex");
}

/* ─── Constant-time session verification ─────────────────────────────────── */
export function verifySession(token) {
  if (!token || !process.env.SESSION_SECRET) return false;
  try {
    const expected = getSessionToken();
    if (token.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

/* ─── Middleware helper — call at top of each handler ────────────────────── */
// Returns true if authenticated, false + sends 401 if not.
export function requireAuth(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  if (!verifySession(cookies.session)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

/* ─── Supabase auth — validate the caller's access token ──────────────────────
   Replaces the legacy HMAC password gate. The client sends the signed-in
   user's Supabase JWT as `Authorization: Bearer <token>`; we validate it by
   asking Supabase who it belongs to. No JWT secret needed — the anon key +
   the user's own token are enough. Reads env vars that Vercel also injects
   into functions (the VITE_ copies work here too).

   Returns the user object on success, or null after sending a 401/500. */
export async function requireSupabaseAuth(req, res) {
  const url  = process.env.SUPABASE_URL      || process.env.VITE_SUPABASE_URL      || "";
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !anon) {
    res.status(500).json({ error: "Auth not configured" });
    return null;
  }

  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }
    const user = await r.json();
    if (!user?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }
    return user;
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
}

/* ─── Cookie string builder ───────────────────────────────────────────────── */
export function buildCookieHeader(token, maxAge = 604800) {
  // Omit 'Secure' in development so localhost works over HTTP
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `session=${token}; HttpOnly${secure}; SameSite=Strict; Max-Age=${maxAge}; Path=/`;
}
