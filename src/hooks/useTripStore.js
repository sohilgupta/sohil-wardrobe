// src/hooks/useTripStore.js
/* ─── useTripStore ────────────────────────────────────────────────────────────
   Multi-trip CRUD with per-tier limit enforcement.
   Persistence:
     Guest  → localStorage['vesti_guest_<guestId>_trips']
     Logged → Supabase profiles.trips_data (debounced 500ms)
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { guestKey } from "./useGuestSession";
import { OWNER_EMAIL } from "../utils/tiers";
import SEED_TRIP from "../data/trip";

/* ── Exported pure helpers (tested in tripStore.test.js) ─────────────────── */

export function dedupTripId() {
  return `trip_${crypto.randomUUID()}`;
}

export function buildDayStubs(startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  const end   = new Date(endDateStr);
  if (isNaN(start) || isNaN(end) || end < start) return [];
  const stubs = [];
  const cur   = new Date(start);
  let   idx   = 1;
  while (cur <= end) {
    const dateStr = cur.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    stubs.push({
      id:    `d${String(idx).padStart(2, "0")}`,
      date:  dateStr,
      city:  "",
      day:   "",
      night: "",
      occ:   "Casual",
      w:     "Mild",
      e:     "📅",
    });
    cur.setDate(cur.getDate() + 1);
    idx++;
  }
  return stubs;
}

const OWNER_SEED_ID = "trip_aus_nz_2026";

function seedFromStatic() {
  return [{
    id:          OWNER_SEED_ID,
    name:        "Australia & NZ 2026",
    destination: "Sydney, Melbourne, Queenstown",
    createdAt:   "2026-04-01T00:00:00Z",
    days:        SEED_TRIP,
  }];
}

/* ── Storage helpers ─────────────────────────────────────────────────────── */

function activeKey(effectiveId) {
  return `vesti_${effectiveId}_active_trip`;
}

/** Fallback localStorage key for logged-in users when Supabase column missing */
function localFallbackKey(userId) {
  return `vesti_${userId}_trips_local`;
}

function readLocalTrips(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}

function saveLocalTrips(key, trips) {
  try { localStorage.setItem(key, JSON.stringify(trips)); } catch {}
}

/* ── Hook ─────────────────────────────────────────────────────────────────── */

export default function useTripStore() {
  const { user, guestId, limits } = useAuth();
  const userId  = user?.id ?? null;
  const isOwner = user?.email === OWNER_EMAIL;

  const effectiveId = userId || guestId || "anon";
  const localKey = guestId && !userId ? guestKey(guestId, "trips") : null;

  const [trips,        setTrips]        = useState([]);
  const [activeTripId, setActiveTripId] = useState(null);
  const syncTimer = useRef(null);

  const activeTrip = trips.find((t) => t.id === activeTripId) || trips[0] || null;

  /* ── Push to Supabase (debounced 500ms) + local mirror ── */
  const pushToBackend = useCallback((updatedTrips) => {
    if (!userId) return;
    // Always write to localStorage mirror — guard against DB column missing
    saveLocalTrips(localFallbackKey(userId), updatedTrips);
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      try {
        await supabase
          .from("profiles")
          .update({ trips_data: updatedTrips })
          .eq("id", userId);
      } catch {}
    }, 500);
  }, [userId]);

  /* ── Save trips (local + remote) ── */
  const persist = useCallback((updatedTrips) => {
    if (localKey) saveLocalTrips(localKey, updatedTrips);
    setTrips(updatedTrips);
    pushToBackend(updatedTrips);
  }, [localKey, pushToBackend]);

  /* ── Load on mount / user change ── */
  useEffect(() => {
    async function load() {
      if (userId) {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("trips_data")
            .eq("id", userId)
            .single();

          // If column doesn't exist yet (migration pending), fall back to localStorage mirror
          let loaded = (!error && data?.trips_data) || null;

          if (loaded === null) {
            // trips_data column unavailable — use localStorage mirror
            loaded = readLocalTrips(localFallbackKey(userId));
          }

          if (loaded.length === 0 && isOwner) {
            loaded = seedFromStatic();
            // Persist to both localStorage mirror and Supabase (Supabase may fail if column missing)
            saveLocalTrips(localFallbackKey(userId), loaded);
            supabase.from("profiles").update({ trips_data: loaded }).eq("id", userId).catch(() => {});
          }

          setTrips(loaded);
          const saved = localStorage.getItem(activeKey(userId));
          setActiveTripId(saved || loaded[0]?.id || null);
        } catch {
          // Network/parse error — seed owner from localStorage mirror or static data
          if (isOwner) {
            const fallback = readLocalTrips(localFallbackKey(userId));
            const seeded   = fallback.length > 0 ? fallback : seedFromStatic();
            if (fallback.length === 0) saveLocalTrips(localFallbackKey(userId), seeded);
            setTrips(seeded);
            setActiveTripId(seeded[0]?.id || null);
          }
        }
      } else if (localKey) {
        const local = readLocalTrips(localKey);
        setTrips(local);
        const saved = localStorage.getItem(activeKey(effectiveId));
        setActiveTripId(saved || local[0]?.id || null);
      }
    }
    load();
  }, [userId, localKey, isOwner, effectiveId]);

  /* ── Reload on migration event ── */
  useEffect(() => {
    async function handleMigration(e) {
      if (e.detail?.userId !== userId) return;
      try {
        const { data } = await supabase
          .from("profiles")
          .select("trips_data")
          .eq("id", userId)
          .single();
        const loaded = data?.trips_data || [];
        setTrips(loaded);
      } catch {}
    }
    window.addEventListener("vesti-data-migrated", handleMigration);
    return () => window.removeEventListener("vesti-data-migrated", handleMigration);
  }, [userId]);

  /* ── API ── */

  const createTrip = useCallback((name, startDate, endDate) => {
    if (trips.length >= limits.trips) {
      window.dispatchEvent(new CustomEvent("vesti-limit-reached", { detail: { type: "trips" } }));
      return null;
    }
    const trip = {
      id:          dedupTripId(),
      name:        name.trim(),
      destination: "",
      createdAt:   new Date().toISOString(),
      days:        buildDayStubs(startDate, endDate),
    };
    const updated = [...trips, trip].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    persist(updated);
    setActiveTripId(trip.id);
    localStorage.setItem(activeKey(effectiveId), trip.id);
    return trip;
  }, [trips, limits.trips, persist, effectiveId]);

  const deleteTrip = useCallback((id) => {
    const updated = trips.filter((t) => t.id !== id);
    persist(updated);
    if (activeTripId === id) {
      const next = updated[0]?.id || null;
      setActiveTripId(next);
      if (next) localStorage.setItem(activeKey(effectiveId), next);
    }
    window.dispatchEvent(new CustomEvent("vesti-trip-deleted", { detail: { tripId: id } }));
  }, [trips, activeTripId, persist, effectiveId]);

  const setActiveTrip = useCallback((id) => {
    setActiveTripId(id);
    localStorage.setItem(activeKey(effectiveId), id);
  }, [effectiveId]);

  const updateTripDay = useCallback((tripId, dayId, fields) => {
    const updated = trips.map((t) => {
      if (t.id !== tripId) return t;
      return { ...t, days: t.days.map((d) => d.id === dayId ? { ...d, ...fields } : d) };
    });
    persist(updated);
  }, [trips, persist]);

  const renameTrip = useCallback((id, name) => {
    const updated = trips.map((t) => t.id === id ? { ...t, name: name.trim() } : t);
    persist(updated);
  }, [trips, persist]);

  return {
    trips,
    activeTrip,
    activeTripId,
    createTrip,
    deleteTrip,
    setActiveTrip,
    updateTripDay,
    renameTrip,
  };
}
