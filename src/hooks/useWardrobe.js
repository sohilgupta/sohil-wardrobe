/* ─── useWardrobe hook ──────────────────────────────────────────────────────
   Single source of truth for wardrobe items.

   Data flow:
     Google Sheets (multi-tab)
       → normalized items
       → localStorage cache  ("wdb_cache_v2")
       → local overrides     ("wdb_overrides_v2")  ← edits / deletes / additions
       → merged items array  ← what components consume

   Polling: re-fetches every POLL_MS ms.  On failure it keeps the last good set.
   Fallback: if no cache AND fetch fails → seeds from local wardrobe.js so the
             UI is never completely blank.
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useRef, useCallback } from "react";
import { fetchAllTabs } from "../services/SheetSyncService";
import { enrichWithDriveImages } from "../services/DriveImageService";
import LOCAL_W from "../data/wardrobe";

const CACHE_KEY     = "wdb_cache_v3"; // bumped: forces re-fetch with fixed Drive thumbnail URLs
const OVERRIDES_KEY = "wdb_overrides_v2";
const POLL_MS       = 5 * 60 * 1000; // 5 min

/* ─── localStorage helpers ───────────────────────────────────────────────── */
const tryParse = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const trySave = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota */ }
};

const emptyOverrides = () => ({ edits: {}, deletes: [], additions: [] });

function loadOverrides() {
  const o = tryParse(OVERRIDES_KEY, emptyOverrides());
  // Defensive normalisation
  return {
    edits:     o.edits     || {},
    deletes:   Array.isArray(o.deletes)   ? o.deletes   : [],
    additions: Array.isArray(o.additions) ? o.additions : [],
  };
}

function saveOverrides(o) { trySave(OVERRIDES_KEY, o); }

/* ─── Outfit ID remap: old index-based IDs → new stable IDs ──────────────── */
// Matches old items to new items by tab name + item name, returns a map of
// old_id → new_id for any pairs where the ID changed.
function buildIdRemap(oldItems, newItems) {
  const newByKey = new Map(newItems.map((i) => [`${i._tab}|${i.n}`, i]));
  const remap    = {};
  oldItems.forEach((old) => {
    const matched = newByKey.get(`${old._tab}|${old.n}`);
    if (matched && matched.id !== old.id) remap[old.id] = matched.id;
  });
  return remap;
}

// Scans localStorage outfitIds, replaces any IDs found in remap, bumps
// updatedAt for affected days so the local version beats a stale backend.
// Returns true if anything changed (so caller can dispatch an event).
function applyRemapToOutfitStorage(remap) {
  if (!Object.keys(remap).length) return false;
  try {
    const raw = JSON.parse(localStorage.getItem("wdb_outfits_v3"));
    if (!raw?.outfitIds) return false;

    const now   = new Date().toISOString();
    const mapId = (id) => (id && id !== "REMOVED" && remap[id]) ? remap[id] : id;
    const mapSlot = (slot) => slot
      ? { base: mapId(slot.base), mid: mapId(slot.mid), outer: mapId(slot.outer), bottom: mapId(slot.bottom), shoes: mapId(slot.shoes) }
      : slot;

    let anyChanged = false;
    const newOutfitIds = {};
    const newUpdatedAt = { ...(raw.updatedAt || {}) };

    Object.entries(raw.outfitIds).forEach(([dayId, dayData]) => {
      if (!dayData) { newOutfitIds[dayId] = dayData; return; }
      const newDt = mapSlot(dayData.daytime);
      const newEv = mapSlot(dayData.evening);
      newOutfitIds[dayId] = { ...dayData, daytime: newDt, evening: newEv };
      if (JSON.stringify(newDt) !== JSON.stringify(dayData.daytime) ||
          JSON.stringify(newEv) !== JSON.stringify(dayData.evening)) {
        newUpdatedAt[dayId] = now; // bump so local beats stale backend
        anyChanged = true;
      }
    });

    if (anyChanged) {
      localStorage.setItem("wdb_outfits_v3", JSON.stringify({ ...raw, outfitIds: newOutfitIds, updatedAt: newUpdatedAt }));
    }
    return anyChanged;
  } catch { return false; }
}

/* ─── Merge remote items with local overrides ────────────────────────────── */
function applyOverrides(remoteItems, overrides) {
  const { edits, deletes, additions } = overrides;
  const deleteSet = new Set(deletes);

  const base = remoteItems
    .filter((i) => !deleteSet.has(i.id))
    .map((i) => (edits[i.id] ? { ...i, ...edits[i.id] } : i));

  // Local additions that haven't been deleted
  const localAdded = additions.filter((a) => !deleteSet.has(a.id));

  return [...base, ...localAdded];
}

/* ─── Hook ───────────────────────────────────────────────────────────────── */
export default function useWardrobe() {
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [syncStatus, setSyncStatus] = useState("idle"); // "syncing"|"ok"|"offline"
  const [lastSync,   setLastSync]   = useState(null);

  // Keep a stable ref to current overrides so callbacks don't need to re-read
  const overridesRef = useRef(loadOverrides());
  // Track the raw remote items separately so we can re-apply overrides on edits
  const remoteRef    = useRef([]);

  /* ── sync: fetch all tabs, update cache & state ── */
  const sync = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const fresh = await fetchAllTabs();

      // Remap outfit IDs in localStorage from old index-based format to new
      // stable format (matched by tab + item name). Dispatches an event so
      // useOutfits can reload its state and push corrected IDs to the backend.
      if (remoteRef.current.length) {
        const remap    = buildIdRemap(remoteRef.current, fresh);
        const migrated = applyRemapToOutfitStorage(remap);
        if (migrated) window.dispatchEvent(new Event("wardrobe-outfit-ids-remapped"));
      }

      remoteRef.current = fresh;
      trySave(CACHE_KEY, { items: fresh, fetchedAt: Date.now() });
      const merged = applyOverrides(fresh, overridesRef.current);
      setItems(merged);
      setLastSync(Date.now());
      setSyncStatus("ok");

      // Non-blocking Drive image enrichment — fills in missing images via Claude
      // Only calls setItems again if new image matches are found
      enrichWithDriveImages(merged, setItems).catch(() => {});
    } catch {
      setSyncStatus("offline");
      // Keep whatever is already displayed — don't blank the UI
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── on mount: seed from cache, then fetch fresh data ── */
  useEffect(() => {
    const cached = tryParse(CACHE_KEY, null);

    if (cached?.items?.length) {
      remoteRef.current = cached.items;
      setItems(applyOverrides(cached.items, overridesRef.current));
      setLastSync(cached.fetchedAt);
      setLoading(false);
    } else {
      // Seed with local wardrobe.js so the UI isn't blank on first load
      setItems(LOCAL_W);
    }

    sync();
    const timer = setInterval(sync, POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Mutation helpers ─────────────────────────────────────────────────── */

  const editItem = useCallback((id, updates) => {
    const o = loadOverrides();
    o.edits[id] = { ...o.edits[id], ...updates };
    overridesRef.current = o;
    saveOverrides(o);
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  const deleteItem = useCallback((id) => {
    const o = loadOverrides();
    o.deletes = [...new Set([...o.deletes, id])];
    overridesRef.current = o;
    saveOverrides(o);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addItem = useCallback((item) => {
    const newItem = {
      ...item,
      id:      item.id || `local_${Date.now()}`,
      _source: "local",
      t:       item.t ?? "Yes",
      selected: true,
    };
    const o = loadOverrides();
    o.additions = [...o.additions, newItem];
    overridesRef.current = o;
    saveOverrides(o);
    setItems((prev) => [...prev, newItem]);
    return newItem;
  }, []);

  return {
    items,
    loading,
    syncStatus,  // "syncing" | "ok" | "offline" | "idle"
    lastSync,
    sync,        // manual re-sync trigger
    editItem,
    deleteItem,
    addItem,
  };
}
