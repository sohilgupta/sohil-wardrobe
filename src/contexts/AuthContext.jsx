/* ─── Auth Context ────────────────────────────────────────────────────────────
   Provides:
   - user, session, profile, loading
   - guestId, isGuest
   - tier, limits, isPro  (from resolveTier — single source of truth)
   - signOut, refreshProfile
   ─────────────────────────────────────────────────────────────────────────── */

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { clearAllAICaches } from "../utils/aiCache";
import { migrateLocalData } from "../utils/dataMigration";
import { migrateGuestData } from "../utils/guestMigration";
import { resolveTier, LIMITS } from "../utils/tiers";
import useGuestSession from "../hooks/useGuestSession";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const { guestId, isGuest, clearGuestSession, ensureGuestId } = useGuestSession(user);

  /* ── Resolve tier from current auth state ── */
  const { tier, limits, isPro } = resolveTier(user, guestId, profile);

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

  /* ── One-time localStorage migration for existing users ── */
  useEffect(() => {
    if (user?.id) migrateLocalData(user.id);
  }, [user?.id]);

  /* ── Listen to auth state changes ── */
  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      // Dev mode: treat as owner Pro account
      setUser({ id: "local-dev", email: "sohilgupta@gmail.com" });
      setProfile({ plan: "pro", subscription_status: "active" });
      setLoading(false);
      return;
    }

    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setUser(s?.user ?? null);
        fetchProfile(s?.user?.id ?? null);
        if (!s?.user) ensureGuestId();
        setLoading(false);
      })
      .catch(() => {
        ensureGuestId();
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        // Capture guestId BEFORE clearing it
        const prevGuestId = localStorage.getItem("vesti_guest_id");

        setSession(s);
        setUser(s?.user ?? null);
        fetchProfile(s?.user?.id ?? null);
        setLoading(false);

        // Trigger guest → user migration when a guest logs in
        if (s?.user && prevGuestId) {
          migrateGuestData(prevGuestId, s.user.id, clearGuestSession);
        }
        if (!s?.user) ensureGuestId();
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile, ensureGuestId, clearGuestSession]);

  /* ── Sign out + clear all local caches ── */
  const signOut = useCallback(async () => {
    clearAllAICaches();
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
    ensureGuestId(); // become a guest after sign-out
  }, [user, ensureGuestId]);

  const value = {
    user, session, profile, loading,
    signOut, refreshProfile,
    guestId, isGuest,
    tier, limits, isPro,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useUser() {
  return useAuth().user;
}

/** useTier — single source of truth for tier/limits. Replaces usePlan(). */
export function useTier() {
  const { tier, limits, isGuest, isPro } = useAuth();
  return { tier, limits, isGuest, isPro };
}

/** usePlan — backward-compat alias for useTier */
export function usePlan() {
  const { isPro } = useAuth();
  return { isPro, plan: isPro ? "pro" : "free" };
}
