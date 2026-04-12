// src/utils/guestMigration.js
/* ─── Guest → User data migration ────────────────────────────────────────────
   Runs once when a guest logs in. Reads all guestId-keyed localStorage data,
   merges with existing Supabase profile data, writes back in one update call.
   Idempotent: guarded by localStorage['vesti_migrated_to_<userId>'].
   ─────────────────────────────────────────────────────────────────────────── */

import { supabase } from "../lib/supabase";
import { guestKey } from "../hooks/useGuestSession";

/* ── Pure merge helpers (exported for testing) ─────────────────────────────── */

export function mergeTrips(existing = [], guest = []) {
  const key = (t) => `${t.name}|${t.createdAt?.slice(0, 10)}`;
  const existingKeys = new Set(existing.map(key));
  const toAdd = guest.filter((t) => !existingKeys.has(key(t)));
  return [...existing, ...toAdd];
}

export function mergeOutfits(existing = {}, guest = {}) {
  const result = { ...existing };
  Object.entries(guest).forEach(([tripId, days]) => {
    result[tripId] = { ...(result[tripId] || {}), ...days };
  });
  return result;
}

export function mergeCapsule(existing = [], guest = []) {
  return [...new Set([...existing, ...guest])];
}

/* ── Main migration function ────────────────────────────────────────────────── */

export async function migrateGuestData(guestId, userId, clearGuestSession) {
  if (!guestId || !userId) return;

  const guardKey = `vesti_migrated_to_${userId}`;
  if (localStorage.getItem(guardKey)) return;

  try {
    const guestTrips   = JSON.parse(localStorage.getItem(guestKey(guestId, "trips"))   || "[]");
    const guestOutfits = JSON.parse(localStorage.getItem(guestKey(guestId, "outfits"))  || "{}");
    const guestCapsule = JSON.parse(localStorage.getItem(guestKey(guestId, "capsule"))  || "[]");

    const { data: profile } = await supabase
      .from("profiles")
      .select("trips_data, outfits_data, capsule_ids")
      .eq("id", userId)
      .single();

    const existingTrips   = profile?.trips_data   || [];
    const existingOutfits = profile?.outfits_data  || {};
    const existingCapsule = profile?.capsule_ids   || [];

    const mergedTrips   = mergeTrips(existingTrips, guestTrips);
    const mergedOutfits = mergeOutfits(existingOutfits, guestOutfits);
    const mergedCapsule = mergeCapsule(existingCapsule, guestCapsule);

    await supabase
      .from("profiles")
      .update({
        trips_data:   mergedTrips,
        outfits_data: mergedOutfits,
        capsule_ids:  mergedCapsule,
      })
      .eq("id", userId);

    localStorage.setItem(guardKey, new Date().toISOString());
    clearGuestSession();
    window.dispatchEvent(new CustomEvent("vesti-data-migrated", { detail: { userId } }));
  } catch (err) {
    console.warn("[guestMigration] Migration failed, will retry on next login:", err.message);
  }
}
