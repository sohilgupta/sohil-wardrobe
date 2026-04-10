/* ─── Auth Context ────────────────────────────────────────────────────────────
   Provides:
   - user          — Supabase User object (null if unauthenticated)
   - session       — Supabase Session (null if unauthenticated)
   - profile       — { plan, stripeCustomerId, subscriptionStatus }
   - loading       — true while initial session is being resolved
   - signOut       — sign out and clear local data
   - refreshProfile — re-fetch subscription status from DB
   ─────────────────────────────────────────────────────────────────────────── */

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { clearAllAICaches } from "../utils/aiCache";
import { migrateLocalData } from "../utils/dataMigration";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ── Fetch profile (plan + subscription) from Supabase ── */
  const fetchProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return; }
    try {
      const { data } = await supabase
        .from("profiles")
        .select("plan, stripe_customer_id, subscription_status")
        .eq("id", userId)
        .single();
      setProfile(data || { plan: "free", subscription_status: null });
    } catch {
      setProfile({ plan: "free", subscription_status: null });
    }
  }, []);

  const refreshProfile = useCallback(() => {
    if (user?.id) fetchProfile(user.id);
  }, [user, fetchProfile]);

  /* ── Run one-time localStorage migration when userId becomes available ── */
  useEffect(() => {
    if (user?.id) migrateLocalData(user.id);
  }, [user?.id]);

  /* ── Listen to auth state changes ── */
  useEffect(() => {
    // If Supabase is not configured, use a local dev session so the app renders
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      setUser({ id: "local-dev", email: "dev@local" });
      setProfile({ plan: "pro", subscription_status: "active" });
      setLoading(false);
      return;
    }

    // Initial session check — wrapped in try/catch so a bad config doesn't hang
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setUser(s?.user ?? null);
        fetchProfile(s?.user?.id ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Subscribe to auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        fetchProfile(s?.user?.id ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  /* ── Sign out + clear all local caches ── */
  const signOut = useCallback(async () => {
    clearAllAICaches();
    // Clear user-namespaced keys
    if (user?.id) {
      const prefix = `vesti_${user.id}_`;
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(prefix)) toRemove.push(k);
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    }
    await supabase.auth.signOut();
  }, [user]);

  const value = { user, session, profile, loading, signOut, refreshProfile };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ── useAuth: typed hook to consume the context ── */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/* ── Derived helpers ── */
export function useUser() {
  return useAuth().user;
}

export function usePlan() {
  const { profile } = useAuth();
  const plan = profile?.plan ?? "free";
  const isPro = plan === "pro" && profile?.subscription_status === "active";
  return { plan: isPro ? "pro" : "free", isPro };
}
