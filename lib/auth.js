/* ─── AUTH UTILITIES ─────────────────────────────────────────────────────────
   Shared between all API routes. Runs in Node.js serverless runtime.
   ─────────────────────────────────────────────────────────────────────────── */

/* ─── Supabase auth — validate the caller's access token ──────────────────────
   The client sends the signed-in user's Supabase JWT as
   `Authorization: Bearer <token>`; we validate it by asking Supabase who it
   belongs to. No JWT secret needed — the anon key + the user's own token are
   enough. Reads env vars that Vercel also injects into functions (the VITE_
   copies work here too).

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
