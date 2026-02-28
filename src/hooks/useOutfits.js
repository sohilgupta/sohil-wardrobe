/* ─── useOutfits hook ─────────────────────────────────────────────────────────
   Manages outfit-per-day state with dual persistence:
   1. localStorage (wdb_outfits_v3) — instant local cache
   2. /api/outfits — cross-device backend sync (when KV is configured)

   Data format (per day):
   {
     [dayId]: {
       daytime:   { base, mid, outer, bottom, shoes },  // null = no outfit
       evening:   { base, mid, outer, bottom, shoes },  // null = no outfit
       isFrozen:  boolean,
       updatedAt: ISO string,
     }
   }

   App-facing API:
   - outfitIds:    { [dayId]: { daytime: {...}|null, evening: {...}|null } }
   - frozenDays:   { [dayId]: boolean }
   - setOutfitIds(updater): updates outfit slots + syncs backend
   - toggleFreeze(dayId):  flips frozen state + syncs backend

   Migration:
   - v2 → v3: wraps old flat single-outfit as { daytime: oldOutfit, evening: null }
   - v1 → v3: same migration path via v2 check

   Conflict resolution: last-write-wins per day (based on updatedAt timestamp).
   On page focus + every 5 min: re-fetch from backend.
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useRef, useCallback } from "react";

const LS_KEY = "wdb_outfits_v3";

/* ── localStorage helpers ──────────────────────────────────────────────────── */
const loadLocal = () => {
  try {
    // Try v3 first (new daytime/evening format)
    const raw3 = JSON.parse(localStorage.getItem("wdb_outfits_v3"));
    if (raw3?.outfitIds) {
      return {
        outfitIds:  raw3.outfitIds  || {},
        frozenDays: raw3.frozenDays || {},
        updatedAt:  raw3.updatedAt  || {},
      };
    }
    // Migrate from v2 (old single-outfit format)
    const raw2 = JSON.parse(localStorage.getItem("wdb_outfits_v2"));
    if (raw2?.outfitIds && typeof raw2.outfitIds === "object") {
      const migrated = {};
      Object.entries(raw2.outfitIds).forEach(([dayId, old]) => {
        if (old && typeof old === "object" && !old.daytime) {
          migrated[dayId] = { daytime: old, evening: null };
        } else if (old?.daytime !== undefined) {
          migrated[dayId] = old; // already new format somehow
        }
      });
      return {
        outfitIds:  migrated,
        frozenDays: raw2.frozenDays || {},
        updatedAt:  raw2.updatedAt  || {},
      };
    }
    // Migrate from v1 (flat { [dayId]: outfitSlots })
    const old = JSON.parse(localStorage.getItem("wdb_outfits_v1"));
    if (old && typeof old === "object") {
      const migrated = {};
      Object.entries(old).forEach(([dayId, slots]) => {
        if (slots && typeof slots === "object" && !slots.daytime) {
          migrated[dayId] = { daytime: slots, evening: null };
        }
      });
      return { outfitIds: migrated, frozenDays: {}, updatedAt: {} };
    }
    return { outfitIds: {}, frozenDays: {}, updatedAt: {} };
  } catch {
    return { outfitIds: {}, frozenDays: {}, updatedAt: {} };
  }
};

const saveLocal = (outfitIds, frozenDays, updatedAt) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ outfitIds, frozenDays, updatedAt }));
  } catch {}
};

/* ── Backend ↔ App format converters ─────────────────────────────────────── */

// Backend → app state
// Handles three legacy formats + new daytime/evening format
const fromBackend = (data) => {
  const outfitIds  = {};
  const frozenDays = {};
  const updatedAt  = {};
  if (!data || typeof data !== "object") return { outfitIds, frozenDays, updatedAt };

  Object.entries(data).forEach(([dayId, val]) => {
    if (!val) return;

    // Very old flat format: { base, bottom, shoes } directly in val
    if (val.base !== undefined || val.bottom !== undefined || val.shoes !== undefined) {
      outfitIds[dayId]  = { daytime: val, evening: null };
      frozenDays[dayId] = false;
      updatedAt[dayId]  = "0";
    }
    // Old wrapped format: { outfit: {...}, isFrozen, updatedAt }
    else if (val.outfit) {
      outfitIds[dayId]  = { daytime: val.outfit, evening: null };
      frozenDays[dayId] = val.isFrozen  || false;
      updatedAt[dayId]  = val.updatedAt || "0";
    }
    // New format: { daytime: {...}|null, evening: {...}|null, isFrozen, updatedAt }
    else {
      outfitIds[dayId] = {
        daytime: val.daytime || null,
        evening: val.evening || null,
      };
      frozenDays[dayId] = val.isFrozen  || false;
      updatedAt[dayId]  = val.updatedAt || "0";
    }
  });
  return { outfitIds, frozenDays, updatedAt };
};

// App state → backend format
const toBackend = (outfitIds, frozenDays, updatedAt) => {
  const result  = {};
  const allDays = new Set([...Object.keys(outfitIds), ...Object.keys(frozenDays)]);
  allDays.forEach((dayId) => {
    result[dayId] = {
      daytime:   outfitIds[dayId]?.daytime || null,
      evening:   outfitIds[dayId]?.evening || null,
      isFrozen:  frozenDays[dayId] || false,
      updatedAt: updatedAt[dayId]  || new Date().toISOString(),
    };
  });
  return result;
};

/* ── Hook ─────────────────────────────────────────────────────────────────── */
export default function useOutfits() {
  const initial = loadLocal();

  const [outfitIds,  _setOutfitIds]  = useState(initial.outfitIds);
  const [frozenDays, _setFrozenDays] = useState(initial.frozenDays);

  // Refs always reflect latest state — avoids stale closures in callbacks
  const outfitRef    = useRef(initial.outfitIds);
  const frozenRef    = useRef(initial.frozenDays);
  const updatedAtRef = useRef(initial.updatedAt);

  const syncTimer = useRef(null);

  /* ── Push current state to backend (debounced 300ms) ── */
  const pushToBackend = useCallback((outfits, frozen, updAt) => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      fetch("/api/outfits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfits: toBackend(outfits, frozen, updAt) }),
      }).catch(() => {}); // silently fail if backend unavailable
    }, 300);
  }, []);

  /* ── Fetch from backend and merge (last-write-wins per day) ── */
  const fetchFromBackend = useCallback(() => {
    fetch("/api/outfits")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.outfits || Object.keys(data.outfits).length === 0) return;
        const { outfitIds: remO, frozenDays: remF, updatedAt: remAt } = fromBackend(data.outfits);

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
        Object.keys(remF).forEach((dayId) => {
          if (!(dayId in remO)) {
            const remTime = remAt[dayId] || "0";
            const locTime = newAt[dayId] || "0";
            if (remTime >= locTime) {
              newF[dayId]  = remF[dayId];
              newAt[dayId] = remTime;
            }
          }
        });

        outfitRef.current    = newO;
        frozenRef.current    = newF;
        updatedAtRef.current = newAt;
        saveLocal(newO, newF, newAt);
        _setOutfitIds(newO);
        _setFrozenDays(newF);
      })
      .catch(() => {}); // silently fall back to local-only
  }, []);

  /* ── On mount: fetch from backend ── */
  useEffect(() => { fetchFromBackend(); }, [fetchFromBackend]);

  /* ── On page focus: re-sync (cross-device awareness) ── */
  useEffect(() => {
    window.addEventListener("focus", fetchFromBackend);
    return () => window.removeEventListener("focus", fetchFromBackend);
  }, [fetchFromBackend]);

  /* ── Background refresh every 5 minutes ── */
  useEffect(() => {
    const interval = setInterval(fetchFromBackend, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchFromBackend]);

  /* ── setOutfitIds: update outfit slots + detect changed days for updatedAt ── */
  const setOutfitIds = useCallback((updater) => {
    _setOutfitIds((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;

      // Stamp updatedAt only for days that actually changed
      const now   = new Date().toISOString();
      const newAt = { ...updatedAtRef.current };
      Object.keys(next).forEach((dayId) => {
        if (JSON.stringify(next[dayId]) !== JSON.stringify(prev[dayId])) {
          newAt[dayId] = now;
        }
      });

      outfitRef.current    = next;
      updatedAtRef.current = newAt;
      saveLocal(next, frozenRef.current, newAt);
      pushToBackend(next, frozenRef.current, newAt);
      return next;
    });
  }, [pushToBackend]);

  /* ── toggleFreeze: flip frozen state for a day ── */
  const toggleFreeze = useCallback((dayId) => {
    _setFrozenDays((prev) => {
      const next  = { ...prev, [dayId]: !prev[dayId] };
      const newAt = { ...updatedAtRef.current, [dayId]: new Date().toISOString() };
      frozenRef.current    = next;
      updatedAtRef.current = newAt;
      saveLocal(outfitRef.current, next, newAt);
      pushToBackend(outfitRef.current, next, newAt);
      return next;
    });
  }, [pushToBackend]);

  return { outfitIds, setOutfitIds, frozenDays, toggleFreeze };
}
