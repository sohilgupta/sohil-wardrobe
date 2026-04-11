/* ─── Tier system — single source of truth for limits ────────────────────── */

export const OWNER_EMAIL = "sohilgupta@gmail.com";

export const LIMITS = {
  guest: { wardrobe: 10,       trips: 1,        outfitDays: 3        },
  free:  { wardrobe: 50,       trips: 3,        outfitDays: Infinity },
  pro:   { wardrobe: Infinity, trips: Infinity, outfitDays: Infinity },
};

/**
 * Pure function — no React, no side effects.
 * Returns { tier, limits, isPro } given the current auth state.
 *
 * @param {object|null} user    — Supabase User object
 * @param {string|null} guestId — from localStorage
 * @param {object|null} profile — { plan, subscription_status } from Supabase
 */
export function resolveTier(user, guestId, profile) {
  if (!user) {
    return { tier: "guest", limits: LIMITS.guest, isPro: false };
  }
  if (user.email === OWNER_EMAIL) {
    return { tier: "pro", limits: LIMITS.pro, isPro: true };
  }
  if (profile?.plan === "pro" && profile?.subscription_status === "active") {
    return { tier: "pro", limits: LIMITS.pro, isPro: true };
  }
  return { tier: "free", limits: LIMITS.free, isPro: false };
}
