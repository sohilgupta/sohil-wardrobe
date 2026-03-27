/* ─── useOutfits hook ─────────────────────────────────────────────────────────
   Manages outfit-per-day state with dual persistence, scoped per user.
   1. localStorage (namespaced by userId) — instant local cache
   2. Supabase profiles.outfits_data      — cross-device backend sync

   Freemium:
     Free tier is limited to MAX_FREE_DAYS per trip. Callers should check
     canEditDay(dayIndex) and show PaywallModal if it returns false.
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

export const MAX_FREE_DAYS = 3;

/* ── Per-user storage key ──────────────────────────────────────────────────── */
function lsKey(userId) {
  return userId ? `vesti_${userId}_outfits_v1` : "vesti_outfits_v1";
}

/* ── localStorage helpers ──────────────────────────────────────────────────── */
const loadLocal = (userId) => {
  try {
    const raw = JSON.parse(localStorage.getItem(lsKey(userId)));
    if (raw?.outfitIds) {
      return {
        outfitIds:  raw.outfitIds  || {},
        frozenDays: raw.frozenDays || {},
        updatedAt:  raw.updatedAt  || {},
      };
    }
    // Migrate legacy keys (wdb_outfits_v3 → new namespaced key)
    const legacy = JSON.parse(localStorage.getItem("wdb_outfits_v3"));
    if (legacy?.outfitIds) {
      return {
        outfitIds:  legacy.outfitIds  || {},
        frozenDays: legacy.frozenDays || {},
        updatedAt:  legacy.updatedAt  || {},
      };
    }
    return { outfitIds: {}, frozenDays: {}, updatedAt: {} };
  } catch {
    return { outfitIds: {}, frozenDays: {}, updatedAt: {} };
  }
};

const saveLocal = (userId, outfitIds, frozenDays, updatedAt) => {
  try {
    localStorage.setItem(lsKey(userId), JSON.stringify({ outfitIds, frozenDays, updatedAt }));
  } catch {}
};

/* ── Backend ↔ App format converters ─────────────────────────────────────── */
const fromBackend = (data) => {
  const outfitIds  = {};
  const frozenDays = {};
  const updatedAt  = {};
  if (!data || typeof data !== "object") return { outfitIds, frozenDays, updatedAt };

  Object.entries(data).forEach(([dayId, val]) => {
    if (!val) return;
    if (val.base !== undefined || val.bottom !== undefined || val.shoes !== undefined) {
      outfitIds[dayId]  = { daytime: val, evening: null };
      frozenDays[dayId] = false;
      updatedAt[dayId]  = "0";
    } else if (val.outfit) {
      outfitIds[dayId]  = { daytime: val.outfit, evening: null };
      frozenDays[dayId] = val.isFrozen  || false;
      updatedAt[dayId]  = val.updatedAt || "0";
    } else {
      outfitIds[dayId] = {
        daytime:   val.daytime   || null,
        evening:   val.evening   || null,
        breakfast: val.breakfast || null,
        sleepwear: val.sleepwear || null,
        flight:    val.flight    || null,
        activity:  val.activity  || null,
      };
      frozenDays[dayId] = val.isFrozen  || false;
      updatedAt[dayId]  = val.updatedAt || "0";
    }
  });
  return { outfitIds, frozenDays, updatedAt };
};

const toBackend = (outfitIds, frozenDays, updatedAt) => {
  const result  = {};
  const allDays = new Set([...Object.keys(outfitIds), ...Object.keys(frozenDays)]);
  allDays.forEach((dayId) => {
    result[dayId] = {
      daytime:   outfitIds[dayId]?.daytime   || null,
      evening:   outfitIds[dayId]?.evening   || null,
      breakfast: outfitIds[dayId]?.breakfast || null,
      sleepwear: outfitIds[dayId]?.sleepwear || null,
      flight:    outfitIds[dayId]?.flight    || null,
      activity:  outfitIds[dayId]?.activity  || null,
      isFrozen:  frozenDays[dayId] || false,
      updatedAt: updatedAt[dayId]  || new Date().toISOString(),
    };
  });
  return result;
};

/* ── Hook ─────────────────────────────────────────────────────────────────── */
export default function useOutfits() {
  const user   = useUser();
  const userId = user?.id ?? null;

  const initial = loadLocal(userId);

  const [outfitIds,  _setOutfitIds]  = useState(initial.outfitIds);
  const [frozenDays, _setFrozenDays] = useState(initial.frozenDays);

  const outfitRef    = useRef(initial.outfitIds);
  const frozenRef    = useRef(initial.frozenDays);
  const updatedAtRef = useRef(initial.updatedAt);

  const syncTimer = useRef(null);

  /* ── Push to Supabase (debounced 500ms) ── */
  const pushToBackend = useCallback((outfits, frozen, updAt) => {
    if (!userId) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      try {
        await supabase
          .from("profiles")
          .update({ outfits_data: toBackend(outfits, frozen, updAt) })
          .eq("id", userId);
      } catch {}
    }, 500);
  }, [userId]);

  /* ── Fetch from Supabase and merge (last-write-wins per day) ── */
  const fetchFromBackend = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("outfits_data")
        .eq("id", userId)
        .single();

      if (!data?.outfits_data || Object.keys(data.outfits_data).length === 0) return;

      const { outfitIds: remO, frozenDays: remF, updatedAt: remAt } = fromBackend(data.outfits_data);

      const newO  = { ...outfitRef.current };
      const newF  = { ...frozenRef.current };
      const newAt = { ...updatedAtRef.current };

      Object.keys(remO).forEach((dayId) => {
        const remTime = remAt[dayId] || "0";
        const locTime = newAt[dayId] || "0";
        if (remTime >= locTime) {
          newO[dayId]  = remO[dayId];
          newF[dayId]  = remF[dayId] ?? false;
          newAt[dayId] = remTime;
        }
      });

      outfitRef.current    = newO;
      frozenRef.current    = newF;
      updatedAtRef.current = newAt;
      saveLocal(userId, newO, newF, newAt);
      _setOutfitIds(newO);
      _setFrozenDays(newF);
    } catch {}
  }, [userId]);

  /* ── Reload state when userId changes; push local data to Supabase ── */
  useEffect(() => {
    const local = loadLocal(userId);
    outfitRef.current    = local.outfitIds;
    frozenRef.current    = local.frozenDays;
    updatedAtRef.current = local.updatedAt;
    _setOutfitIds(local.outfitIds);
    _setFrozenDays(local.frozenDays);

    // Fetch remote first; if remote is empty and local has data, push local up
    if (userId) {
      (async () => {
        try {
          const { data } = await supabase
            .from("profiles")
            .select("outfits_data")
            .eq("id", userId)
            .single();

          if (!data?.outfits_data || Object.keys(data.outfits_data).length === 0) {
            // Remote empty — push local data up if we have any
            if (Object.keys(local.outfitIds).length > 0) {
              await supabase
                .from("profiles")
                .update({ outfits_data: toBackend(local.outfitIds, local.frozenDays, local.updatedAt) })
                .eq("id", userId);
            }
          } else {
            // Remote has data — merge it
            const { outfitIds: remO, frozenDays: remF, updatedAt: remAt } = fromBackend(data.outfits_data);
            const newO  = { ...local.outfitIds };
            const newF  = { ...local.frozenDays };
            const newAt = { ...local.updatedAt };
            Object.keys(remO).forEach((dayId) => {
              const remTime = remAt[dayId] || "0";
              const locTime = newAt[dayId] || "0";
              if (remTime >= locTime) {
                newO[dayId]  = remO[dayId];
                newF[dayId]  = remF[dayId] ?? false;
                newAt[dayId] = remTime;
              }
            });
            outfitRef.current    = newO;
            frozenRef.current    = newF;
            updatedAtRef.current = newAt;
            saveLocal(userId, newO, newF, newAt);
            _setOutfitIds(newO);
            _setFrozenDays(newF);
          }
        } catch {}
      })();
    }
  }, [userId]);

  useEffect(() => {
    window.addEventListener("focus", fetchFromBackend);
    return () => window.removeEventListener("focus", fetchFromBackend);
  }, [fetchFromBackend]);

  useEffect(() => {
    const interval = setInterval(fetchFromBackend, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchFromBackend]);

  useEffect(() => {
    function handleRemap() {
      const local = loadLocal(userId);
      outfitRef.current    = local.outfitIds;
      frozenRef.current    = local.frozenDays;
      updatedAtRef.current = local.updatedAt;
      _setOutfitIds(local.outfitIds);
      _setFrozenDays(local.frozenDays);
      pushToBackend(local.outfitIds, local.frozenDays, local.updatedAt);
    }
    window.addEventListener("wardrobe-outfit-ids-remapped", handleRemap);
    window.addEventListener("vesti-data-migrated", handleRemap);
    return () => {
      window.removeEventListener("wardrobe-outfit-ids-remapped", handleRemap);
      window.removeEventListener("vesti-data-migrated", handleRemap);
    };
  }, [pushToBackend, userId]);

  const setOutfitIds = useCallback((updater) => {
    _setOutfitIds((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const now   = new Date().toISOString();
      const newAt = { ...updatedAtRef.current };
      Object.keys(next).forEach((dayId) => {
        if (JSON.stringify(next[dayId]) !== JSON.stringify(prev[dayId])) {
          newAt[dayId] = now;
        }
      });
      outfitRef.current    = next;
      updatedAtRef.current = newAt;
      saveLocal(userId, next, frozenRef.current, newAt);
      pushToBackend(next, frozenRef.current, newAt);
      return next;
    });
  }, [pushToBackend, userId]);

  const toggleFreeze = useCallback((dayId) => {
    _setFrozenDays((prev) => {
      const next  = { ...prev, [dayId]: !prev[dayId] };
      const newAt = { ...updatedAtRef.current, [dayId]: new Date().toISOString() };
      frozenRef.current    = next;
      updatedAtRef.current = newAt;
      saveLocal(userId, outfitRef.current, next, newAt);
      pushToBackend(outfitRef.current, next, newAt);
      return next;
    });
  }, [pushToBackend, userId]);

  return { outfitIds, setOutfitIds, frozenDays, toggleFreeze, maxFreeDays: MAX_FREE_DAYS };
}
