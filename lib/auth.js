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

/* ─── Cookie string builder ───────────────────────────────────────────────── */
export function buildCookieHeader(token, maxAge = 604800) {
  // Omit 'Secure' in development so localhost works over HTTP
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `session=${token}; HttpOnly${secure}; SameSite=Strict; Max-Age=${maxAge}; Path=/`;
}
