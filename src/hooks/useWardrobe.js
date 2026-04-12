/* ─── useWardrobe hook ──────────────────────────────────────────────────────
   Single source of truth for wardrobe items, scoped per authenticated user.

   Data flow:
     Google Sheets (multi-tab, optional import)
       → normalized items
       → localStorage cache  (namespaced by userId)
       → local overrides     (namespaced by userId)
       → merged items array  ← what components consume

   Freemium:
     Free tier is limited to MAX_FREE_ITEMS. Attempts to exceed are silently
     capped — the caller should show a PaywallModal before calling addItem.

   Polling: re-fetches every POLL_MS ms on failure keeps the last good set.
   Fallback: if no cache AND fetch fails → seeds from local wardrobe.js so
             the UI is never completely blank.
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useRef, useCallback } from "react";
import { fetchAllTabs } from "../services/SheetSyncService";
import { enrichWithDriveImages } from "../services/DriveImageService";
import LOCAL_W from "../data/wardrobe";
import { useAuth } from "../contexts/AuthContext";
import { OWNER_EMAIL } from "../utils/tiers";
import { supabase } from "../lib/supabase";

export const MAX_FREE_ITEMS = 10;

const POLL_MS = 5 * 60 * 1000; // 5 min

/* ─── Per-user storage keys ─────────────────────────────────────────────── */
function cacheKey(userId)     { return userId ? `vesti_${userId}_cache_v1`     : "vesti_cache_v1"; }
function overridesKey(userId) { return userId ? `vesti_${userId}_overrides_v1` : "vesti_overrides_v1"; }

/* ─── localStorage helpers ───────────────────────────────────────────────── */
const tryParse = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const trySave = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota */ }
};

const emptyOverrides = () => ({ edits: {}, deletes: [], additions: [] });

function loadOverrides(userId) {
  // Try namespaced key first, then fall back to legacy key for migration
  let raw = tryParse(overridesKey(userId), null);
  if (!raw) raw = tryParse("wdb_overrides_v2", null); // legacy fallback
  const o = raw || emptyOverrides();
  return {
    edits:     o.edits     || {},
    deletes:   Array.isArray(o.deletes)   ? o.deletes   : [],
    additions: Array.isArray(o.additions) ? o.additions : [],
  };
}

function saveOverrides(userId, o) { trySave(overridesKey(userId), o); }

/* ─── Outfit ID remap: old index-based IDs → new stable IDs ──────────────── */
function buildIdRemap(oldItems, newItems) {
  const newByKey = new Map(newItems.map((i) => [`${i._tab}|${i.n}`, i]));
  const remap    = {};
  oldItems.forEach((old) => {
    const matched = newByKey.get(`${old._tab}|${old.n}`);
    if (matched && matched.id !== old.id) remap[old.id] = matched.id;
  });
  return remap;
}

function applyRemapToOutfitStorage(remap, outfitsKey) {
  if (!Object.keys(remap).length) return false;
  try {
    const raw = JSON.parse(localStorage.getItem(outfitsKey));
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
        newUpdatedAt[dayId] = now;
        anyChanged = true;
      }
    });

    if (anyChanged) {
      localStorage.setItem(outfitsKey, JSON.stringify({ ...raw, outfitIds: newOutfitIds, updatedAt: newUpdatedAt }));
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

  const localAdded = additions.filter((a) => !deleteSet.has(a.id));
  return [...base, ...localAdded];
}

/* ─── Hook ───────────────────────────────────────────────────────────────── */
export default function useWardrobe() {
  const { user, session, guestId } = useAuth();
  const userId  = user?.id ?? null;
  const isOwner = user?.email === OWNER_EMAIL;

  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [syncStatus, setSyncStatus] = useState("idle");
  const [lastSync,   setLastSync]   = useState(null);

  const overridesRef = useRef(loadOverrides(userId));
  const remoteRef    = useRef([]);

  /* ── sync: fetch all tabs, update cache & state ── */
  const sync = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      if (isOwner) {
        // Owner: fetch from Google Sheets (existing logic unchanged)
        const fresh = await fetchAllTabs(session?.access_token);

        const outfitsStorageKey = userId ? `vesti_${userId}_outfits_v1` : "vesti_outfits_v1";
        if (remoteRef.current.length) {
          const remap    = buildIdRemap(remoteRef.current, fresh);
          const migrated = applyRemapToOutfitStorage(remap, outfitsStorageKey);
          if (migrated) window.dispatchEvent(new Event("wardrobe-outfit-ids-remapped"));
        }

        remoteRef.current = fresh;
        trySave(cacheKey(userId), { items: fresh, fetchedAt: Date.now() });
        const merged = applyOverrides(fresh, overridesRef.current);
        setItems(merged);
        setLastSync(Date.now());
        setSyncStatus("ok");

        enrichWithDriveImages(merged, setItems).catch(() => {});
      } else if (userId) {
        // Non-owner logged-in: read from Supabase wardrobe_items
        const { data } = await supabase
          .from("profiles")
          .select("wardrobe_items")
          .eq("id", userId)
          .single();
        const fresh = data?.wardrobe_items || [];
        remoteRef.current = fresh;
        const merged = applyOverrides(fresh, overridesRef.current);
        setItems(merged);
        setLastSync(Date.now());
        setSyncStatus("ok");
        setLoading(false);
      } else {
        // Guest: read from localStorage
        const guestWardrobeKey = guestId ? `vesti_guest_${guestId}_wardrobe` : null;
        const local = guestWardrobeKey ? tryParse(guestWardrobeKey, []) : [];
        remoteRef.current = local;
        setItems(applyOverrides(local, overridesRef.current));
        setSyncStatus("ok");
        setLoading(false);
      }
    } catch {
      setSyncStatus("offline");
    } finally {
      setLoading(false);
    }
  }, [userId, isOwner, guestId, session]);

  /* ── Re-apply overrides after one-time data migration fires ── */
  useEffect(() => {
    function handleMigration(e) {
      if (e.detail?.userId !== userId) return;
      overridesRef.current = loadOverrides(userId);
      setItems(applyOverrides(remoteRef.current, overridesRef.current));
    }
    window.addEventListener("vesti-data-migrated", handleMigration);
    return () => window.removeEventListener("vesti-data-migrated", handleMigration);
  }, [userId]);

  /* ── on mount / userId change: seed from cache, then fetch fresh ── */
  useEffect(() => {
    overridesRef.current = loadOverrides(userId);
    const cached = tryParse(cacheKey(userId), null);

    if (cached?.items?.length) {
      remoteRef.current = cached.items;
      setItems(applyOverrides(cached.items, overridesRef.current));
      setLastSync(cached.fetchedAt);
      setLoading(false);
    } else {
      // Try legacy unscoped cache (wdb_cache_v3) before falling back to bundled data
      const legacyCache = tryParse("wdb_cache_v3", null);
      if (legacyCache?.items?.length) {
        remoteRef.current = legacyCache.items;
        setItems(applyOverrides(legacyCache.items, overridesRef.current));
        setLastSync(legacyCache.fetchedAt);
        setLoading(false);
      } else {
        setItems(LOCAL_W);
      }
    }

    sync();
    const timer = setInterval(sync, POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* ─── Mutation helpers ─────────────────────────────────────────────────── */

  const editItem = useCallback((id, updates) => {
    const o = loadOverrides(userId);
    o.edits[id] = { ...o.edits[id], ...updates };
    overridesRef.current = o;
    saveOverrides(userId, o);
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, [userId]);

  const deleteItem = useCallback((id) => {
    const o = loadOverrides(userId);
    o.deletes = [...new Set([...o.deletes, id])];
    overridesRef.current = o;
    saveOverrides(userId, o);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, [userId]);

  const addItem = useCallback(async (item) => {
    const newItem = {
      ...item,
      id:      item.id || `local_${Date.now()}`,
      _source: "local",
      t:       item.t ?? "Yes",
      selected: item.selected !== undefined ? item.selected : true,
    };

    if (isOwner) {
      // Owner: use localStorage overrides (existing logic)
      const o = loadOverrides(userId);
      o.additions = [...o.additions, newItem];
      overridesRef.current = o;
      saveOverrides(userId, o);
      setItems((prev) => [...prev, newItem]);
    } else if (userId) {
      // Non-owner logged-in: persist to Supabase wardrobe_items
      const updated = [...remoteRef.current, newItem];
      remoteRef.current = updated;
      setItems(updated);
      try {
        await supabase.from("profiles").update({ wardrobe_items: updated }).eq("id", userId);
      } catch { /* silently ignore */ }
    } else if (guestId) {
      // Guest: localStorage
      const guestWardrobeKey = `vesti_guest_${guestId}_wardrobe`;
      const existing = tryParse(guestWardrobeKey, []);
      const updated  = [...existing, newItem];
      trySave(guestWardrobeKey, updated);
      remoteRef.current = updated;
      setItems(updated);
    }
    return newItem;
  }, [userId, isOwner, guestId]);

  return {
    items,
    loading,
    syncStatus,
    lastSync,
    sync,
    editItem,
    deleteItem,
    addItem,
    maxFreeItems: MAX_FREE_ITEMS,
  };
}
