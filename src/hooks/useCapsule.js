/* ─── useCapsule hook ────────────────────────────────────────────────────────
   Manages the Trip Capsule — a curated subset of wardrobe items.
   Scoped per authenticated user.

   Persistence:
   - Primary:   Supabase profiles.capsule_ids (cross-device, linked to account)
   - Secondary: localStorage (instant cache, namespaced by userId)
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

/* ── Per-user storage key ──────────────────────────────────────────────────── */
function lsKey(userId) {
  return userId ? `vesti_${userId}_capsule_v1` : "vesti_capsule_v1";
}

function loadLocal(userId) {
  try {
    const raw = JSON.parse(localStorage.getItem(lsKey(userId)));
    if (Array.isArray(raw)) return new Set(raw);
    // Migrate from legacy key
    const legacy = JSON.parse(localStorage.getItem("wdb_capsule_v1"));
    return Array.isArray(legacy) ? new Set(legacy) : new Set();
  } catch {
    return new Set();
  }
}

function saveLocal(userId, ids) {
  try {
    localStorage.setItem(lsKey(userId), JSON.stringify([...ids]));
  } catch {}
}

/* ── Hook ─────────────────────────────────────────────────────────────────── */
export default function useCapsule() {
  const user   = useUser();
  const userId = user?.id ?? null;

  const [capsuleIds, _setCapsuleIds] = useState(() => loadLocal(userId));
  const capsuleRef  = useRef(loadLocal(userId));
  const syncTimer   = useRef(null);

  /* ── Push to Supabase (debounced 500ms) ── */
  const pushToBackend = useCallback((ids) => {
    if (!userId) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      try {
        await supabase
          .from("profiles")
          .update({ capsule_ids: [...ids] })
          .eq("id", userId);
      } catch {}
    }, 500);
  }, [userId]);

  /* ── Fetch from Supabase ── */
  const fetchFromBackend = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("capsule_ids")
        .eq("id", userId)
        .single();

      if (!data || !Array.isArray(data.capsule_ids)) return;
      const next = new Set(data.capsule_ids);
      capsuleRef.current = next;
      saveLocal(userId, next);
      _setCapsuleIds(next);
    } catch {}
  }, [userId]);

  /* ── On userId change: load local, sync with remote ── */
  useEffect(() => {
    const local = loadLocal(userId);
    capsuleRef.current = local;
    _setCapsuleIds(local);

    if (!userId) return;

    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("capsule_ids")
          .eq("id", userId)
          .single();

        if (!data || !Array.isArray(data.capsule_ids) || data.capsule_ids.length === 0) {
          // Remote empty — push local up if we have items
          if (local.size > 0) {
            await supabase
              .from("profiles")
              .update({ capsule_ids: [...local] })
              .eq("id", userId);
          }
        } else {
          // Remote has data — use it (remote wins)
          const next = new Set(data.capsule_ids);
          capsuleRef.current = next;
          saveLocal(userId, next);
          _setCapsuleIds(next);
        }
      } catch {}
    })();
  }, [userId]);

  /* ── Reload after one-time data migration ── */
  useEffect(() => {
    function handleMigration(e) {
      if (e.detail?.userId !== userId) return;
      const local = loadLocal(userId);
      capsuleRef.current = local;
      _setCapsuleIds(local);
      pushToBackend(local);
    }
    window.addEventListener("vesti-data-migrated", handleMigration);
    return () => window.removeEventListener("vesti-data-migrated", handleMigration);
  }, [userId, pushToBackend]);

  useEffect(() => {
    window.addEventListener("focus", fetchFromBackend);
    return () => window.removeEventListener("focus", fetchFromBackend);
  }, [fetchFromBackend]);

  useEffect(() => {
    const interval = setInterval(fetchFromBackend, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchFromBackend]);

  const toggleCapsule = useCallback((id) => {
    _setCapsuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      capsuleRef.current = next;
      saveLocal(userId, next);
      pushToBackend(next);
      return next;
    });
  }, [pushToBackend, userId]);

  const setManyCapsule = useCallback((ids) => {
    const next = new Set(ids);
    capsuleRef.current = next;
    saveLocal(userId, next);
    pushToBackend(next);
    _setCapsuleIds(next);
  }, [pushToBackend, userId]);

  const clearCapsule = useCallback(() => {
    const next = new Set();
    capsuleRef.current = next;
    saveLocal(userId, next);
    pushToBackend(next);
    _setCapsuleIds(next);
  }, [pushToBackend, userId]);

  return { capsuleIds, toggleCapsule, setManyCapsule, clearCapsule };
}
