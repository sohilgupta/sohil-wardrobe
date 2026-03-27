/* ─── Supabase Client ─────────────────────────────────────────────────────────
   Single shared client instance — import this everywhere.
   Reads from Vite env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).

   When env vars are missing (local dev without config) a no-op stub is
   returned so the app renders and shows the auth page with a setup notice.
   ─────────────────────────────────────────────────────────────────────────── */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isConfigured) {
  console.warn(
    "[Vesti] Supabase env vars not set. Auth features will be unavailable.\n" +
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file."
  );
}

/* ── No-op stub used when Supabase is not configured ───────────────────── */
const noopClient = {
  auth: {
    getSession:        () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithOAuth:   () => Promise.resolve({ error: new Error("Supabase not configured") }),
    signInWithOtp:     () => Promise.resolve({ error: new Error("Supabase not configured") }),
    signOut:           () => Promise.resolve({ error: null }),
  },
  from: () => ({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    upsert: () => Promise.resolve({ error: null }),
  }),
};

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken:   true,
        persistSession:     true,
        detectSessionInUrl: true,
      },
    })
  : noopClient;

export { isConfigured as supabaseConfigured };
