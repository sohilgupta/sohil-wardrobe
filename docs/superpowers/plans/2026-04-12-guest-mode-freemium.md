# Guest Mode & Freemium Tiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow any visitor to use the app without signing in, enforcing per-tier usage limits, with seamless data migration when they log in.

**Architecture:** Three-tier system (guest/free/pro) built on a `LIMITS` constant + `useTier()` hook as single source of truth. Guest state lives in guestId-namespaced localStorage; logged-in state syncs to Supabase. A one-time `migrateGuestData()` utility runs atomically on first login and transfers all guest data into the user's Supabase profile. Multi-trip support is implemented via a new `useTripStore` hook; `useOutfits` scopes all reads/writes to the active trip transparently.

**Tech Stack:** React 19, Vite, Supabase JS v2, Vitest, localStorage, `crypto.randomUUID()`

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `src/utils/tiers.js` | `LIMITS` constant, `OWNER_EMAIL`, `resolveTier()` pure function |
| `src/hooks/useGuestSession.js` | guestId UUID lifecycle (create, read, clear) |
| `src/hooks/useTripStore.js` | Multi-trip CRUD + Supabase/localStorage persistence |
| `src/utils/guestMigration.js` | Atomic guest→user data migration |
| `src/components/UpgradePrompt.jsx` | Context-aware limit modal (auth form for guests, Stripe CTA for free) |
| `src/components/TripCreator.jsx` | Modal to create a new trip |
| `tests/tiers.test.js` | Tests for `resolveTier()` and `LIMITS` |
| `tests/guestMigration.test.js` | Tests for merge logic in `migrateGuestData()` |
| `tests/tripStore.test.js` | Tests for day stub generation and limit enforcement |

### Modified files
| File | Change |
|---|---|
| `src/contexts/AuthContext.jsx` | Add `guestId`, `isGuest`, `tier`, `limits`; call `migrateGuestData` on login; export `useTier()` |
| `src/hooks/useOutfits.js` | Read `activeTripId` from `useTripStore`; scope all storage to `outfitIds[tripId]` |
| `src/hooks/useCapsule.js` | Fall back to `guestId`-keyed localStorage when no `userId` |
| `src/hooks/useWardrobe.js` | Owner-only Google Sheets fetch; enforce wardrobe item limit |
| `src/App.jsx` | Remove `!user → <AuthPage/>` gate; show app for guests too |
| `src/components/AuthPage.jsx` | Extract auth form into `<AuthForm compact />` reusable component |
| `src/components/TripTab.jsx` | Trip switcher, `TripCreator` trigger, dynamic trip data, inline day editing |
| `src/components/OutfitsTab.jsx` | Lock days beyond guest limit; use active trip days |
| `src/components/PackTab.jsx` | Filter to active trip's frozen days |
| `src/components/ProfileTab.jsx` | Replace `usePlan` → `useTier` |
| `src/data/trip.js` | Unchanged — kept as seed data only |

---

## Task 1: Tier constants and `resolveTier()` pure function

**Files:**
- Create: `src/utils/tiers.js`
- Create: `tests/tiers.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/tiers.test.js
import { describe, it, expect } from "vitest";
import { LIMITS, resolveTier } from "../src/utils/tiers";

describe("LIMITS", () => {
  it("guest wardrobe limit is 10", () => expect(LIMITS.guest.wardrobe).toBe(10));
  it("free wardrobe limit is 50",  () => expect(LIMITS.free.wardrobe).toBe(50));
  it("pro wardrobe limit is Infinity", () => expect(LIMITS.pro.wardrobe).toBe(Infinity));
  it("guest outfitDays limit is 3", () => expect(LIMITS.guest.outfitDays).toBe(3));
  it("free outfitDays is Infinity", () => expect(LIMITS.free.outfitDays).toBe(Infinity));
  it("guest trips limit is 1", () => expect(LIMITS.guest.trips).toBe(1));
  it("free trips limit is 3",  () => expect(LIMITS.free.trips).toBe(3));
});

describe("resolveTier", () => {
  it("returns guest when no user and no guestId", () => {
    expect(resolveTier(null, null, null)).toEqual({ tier: "guest", limits: LIMITS.guest, isPro: false });
  });
  it("returns guest when guestId but no user", () => {
    expect(resolveTier(null, "guest-uuid", null).tier).toBe("guest");
  });
  it("returns pro for owner email regardless of profile", () => {
    const u = { email: "sohilgupta@gmail.com" };
    expect(resolveTier(u, null, { plan: "free", subscription_status: null }).tier).toBe("pro");
    expect(resolveTier(u, null, null).tier).toBe("pro");
  });
  it("returns pro for active subscription", () => {
    const u = { email: "other@example.com" };
    expect(resolveTier(u, null, { plan: "pro", subscription_status: "active" }).tier).toBe("pro");
  });
  it("returns free for logged-in user with no active subscription", () => {
    const u = { email: "other@example.com" };
    expect(resolveTier(u, null, { plan: "free", subscription_status: null }).tier).toBe("free");
  });
  it("returns free even if plan=pro but subscription_status is not active", () => {
    const u = { email: "other@example.com" };
    expect(resolveTier(u, null, { plan: "pro", subscription_status: "canceled" }).tier).toBe("free");
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd /Users/sohilgupta/Documents/sohil-wardrobe
npm test -- tests/tiers.test.js
```
Expected: `Cannot find module '../src/utils/tiers'`

- [ ] **Step 3: Create `src/utils/tiers.js`**

```js
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
  // Owner override — always Pro, no DB check needed
  if (user.email === OWNER_EMAIL) {
    return { tier: "pro", limits: LIMITS.pro, isPro: true };
  }
  // Active subscription
  if (profile?.plan === "pro" && profile?.subscription_status === "active") {
    return { tier: "pro", limits: LIMITS.pro, isPro: true };
  }
  // Logged-in free
  return { tier: "free", limits: LIMITS.free, isPro: false };
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test -- tests/tiers.test.js
```
Expected: all 12 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/tiers.js tests/tiers.test.js
git commit -m "feat: add tier constants and resolveTier() pure function"
```

---

## Task 2: `useGuestSession` hook

**Files:**
- Create: `src/hooks/useGuestSession.js`

- [ ] **Step 1: Create the hook**

```js
// src/hooks/useGuestSession.js
/* ─── useGuestSession ─────────────────────────────────────────────────────────
   Manages the anonymous guest identity stored in localStorage.
   Called once inside AuthProvider — not by components directly.
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useCallback } from "react";

const GUEST_ID_KEY = "vesti_guest_id";

function guestPrefix(guestId) {
  return `vesti_guest_${guestId}_`;
}

/** Read or create the guestId. Only creates if no Supabase user exists. */
export function initGuestId(hasUser) {
  if (hasUser) return null;
  const existing = localStorage.getItem(GUEST_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(GUEST_ID_KEY, id);
  return id;
}

export default function useGuestSession(user) {
  const [guestId, setGuestId] = useState(() => {
    if (user) return null;
    return localStorage.getItem(GUEST_ID_KEY) || null;
  });

  /** Removes vesti_guest_id and all vesti_guest_<id>_* keys. */
  const clearGuestSession = useCallback(() => {
    const id = localStorage.getItem(GUEST_ID_KEY);
    if (!id) return;
    const prefix = guestPrefix(id);
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k === GUEST_ID_KEY || k.startsWith(prefix))) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    setGuestId(null);
  }, []);

  /** Called when no user is present — ensures a guestId exists. */
  const ensureGuestId = useCallback(() => {
    const existing = localStorage.getItem(GUEST_ID_KEY);
    if (existing) { setGuestId(existing); return existing; }
    const id = crypto.randomUUID();
    localStorage.setItem(GUEST_ID_KEY, id);
    setGuestId(id);
    return id;
  }, []);

  return { guestId, isGuest: !user && !!guestId, clearGuestSession, ensureGuestId };
}

/** Helper: namespaced localStorage key for a given guest data type */
export function guestKey(guestId, type) {
  return `vesti_guest_${guestId}_${type}`;
}
```

- [ ] **Step 2: Run build to confirm no syntax errors**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -10
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGuestSession.js
git commit -m "feat: add useGuestSession hook for anonymous identity management"
```

---

## Task 3: `guestMigration` utility

**Files:**
- Create: `src/utils/guestMigration.js`
- Create: `tests/guestMigration.test.js`

- [ ] **Step 1: Write failing tests for merge logic**

```js
// tests/guestMigration.test.js
import { describe, it, expect } from "vitest";
import { mergeTrips, mergeOutfits, mergeCapsule } from "../src/utils/guestMigration";

describe("mergeTrips", () => {
  const existing = [{ id: "trip_1", name: "Paris", createdAt: "2026-01-01T00:00:00Z", days: [] }];
  const guest    = [
    { id: "trip_g1", name: "Berlin", createdAt: "2026-02-01T00:00:00Z", days: [] },
    { id: "trip_g2", name: "Paris",  createdAt: "2026-01-01T00:00:00Z", days: [] }, // dup by name+day
  ];

  it("appends non-duplicate guest trips", () => {
    const result = mergeTrips(existing, guest);
    expect(result.some((t) => t.name === "Berlin")).toBe(true);
  });
  it("deduplicates by name + createdAt date", () => {
    const result = mergeTrips(existing, guest);
    const paris = result.filter((t) => t.name === "Paris");
    expect(paris.length).toBe(1);
  });
  it("returns existing trips unchanged when guest is empty", () => {
    expect(mergeTrips(existing, [])).toEqual(existing);
  });
});

describe("mergeOutfits", () => {
  const existing = { trip_1: { d01: { daytime: { base: "item_a" } } } };
  const guest    = {
    trip_g1: { d01: { daytime: { base: "item_b" } } },
    trip_1:  { d01: { daytime: { base: "item_guest" } }, d02: { daytime: { base: "item_c" } } },
  };

  it("adds new guest trips", () => {
    const result = mergeOutfits(existing, guest);
    expect(result.trip_g1).toBeDefined();
  });
  it("guest data wins on matching tripId+dayId", () => {
    const result = mergeOutfits(existing, guest);
    expect(result.trip_1.d01.daytime.base).toBe("item_guest");
  });
  it("preserves existing days not in guest", () => {
    const onlyExisting = { trip_1: { d01: { daytime: { base: "item_a" } } } };
    const result = mergeOutfits(onlyExisting, {});
    expect(result.trip_1.d01.daytime.base).toBe("item_a");
  });
});

describe("mergeCapsule", () => {
  it("returns union of both arrays", () => {
    expect(mergeCapsule(["a","b"], ["b","c"])).toEqual(expect.arrayContaining(["a","b","c"]));
    expect(mergeCapsule(["a","b"], ["b","c"]).length).toBe(3);
  });
  it("handles empty arrays", () => {
    expect(mergeCapsule([], ["a"])).toEqual(["a"]);
    expect(mergeCapsule(["a"], [])).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
npm test -- tests/guestMigration.test.js
```
Expected: `Cannot find module '../src/utils/guestMigration'`

- [ ] **Step 3: Create `src/utils/guestMigration.js`**

```js
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

  // Duplicate-run guard
  const guardKey = `vesti_migrated_to_${userId}`;
  if (localStorage.getItem(guardKey)) return;

  try {
    // Step 1: Read guest localStorage data
    const guestTrips   = JSON.parse(localStorage.getItem(guestKey(guestId, "trips"))   || "[]");
    const guestOutfits = JSON.parse(localStorage.getItem(guestKey(guestId, "outfits"))  || "{}");
    const guestCapsule = JSON.parse(localStorage.getItem(guestKey(guestId, "capsule"))  || "[]");

    // Step 2: Fetch existing Supabase profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("trips_data, outfits_data, capsule_ids")
      .eq("id", userId)
      .single();

    const existingTrips   = profile?.trips_data   || [];
    const existingOutfits = profile?.outfits_data  || {};
    const existingCapsule = profile?.capsule_ids   || [];

    // Step 3: Merge
    const mergedTrips   = mergeTrips(existingTrips, guestTrips);
    const mergedOutfits = mergeOutfits(existingOutfits, guestOutfits);
    const mergedCapsule = mergeCapsule(existingCapsule, guestCapsule);

    // Step 4: Write to Supabase (single update call)
    await supabase
      .from("profiles")
      .update({
        trips_data:  mergedTrips,
        outfits_data: mergedOutfits,
        capsule_ids:  mergedCapsule,
      })
      .eq("id", userId);

    // Step 5: Mark migration complete
    localStorage.setItem(guardKey, new Date().toISOString());

    // Step 6: Clear guest session
    clearGuestSession();

    // Step 7: Signal hooks to reload
    window.dispatchEvent(
      new CustomEvent("vesti-data-migrated", { detail: { userId } })
    );
  } catch (err) {
    // Do NOT set guard — migration will retry on next login
    console.warn("[guestMigration] Migration failed, will retry on next login:", err.message);
  }
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test -- tests/guestMigration.test.js
```
Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/guestMigration.js tests/guestMigration.test.js
git commit -m "feat: add guestMigration utility with merge helpers and idempotency guard"
```

---

## Task 4: Update `AuthContext` — add guest identity, tier, migration trigger

**Files:**
- Modify: `src/contexts/AuthContext.jsx`

- [ ] **Step 1: Read the file**

```bash
cat src/contexts/AuthContext.jsx
```

- [ ] **Step 2: Replace the file contents**

```js
// src/contexts/AuthContext.jsx
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

  /* ── Fetch profile ── */
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

  /* ── One-time localStorage migration (existing Supabase user data) ── */
  useEffect(() => {
    if (user?.id) migrateLocalData(user.id);
  }, [user?.id]);

  /* ── Auth state listener ── */
  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
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

  /* ── Sign out ── */
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

export function useUser() { return useAuth().user; }

/** useTier — replaces usePlan(). Returns { tier, limits, isGuest, isPro }. */
export function useTier() {
  const { tier, limits, isGuest, isPro } = useAuth();
  return { tier, limits, isGuest, isPro };
}

/** usePlan — backward-compat alias for useTier */
export function usePlan() {
  const { isPro } = useAuth();
  return { isPro, plan: isPro ? "pro" : "free" };
}
```

- [ ] **Step 3: Build to verify**

```bash
npm run build 2>&1 | grep -E "^.*error" | head -10
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/contexts/AuthContext.jsx
git commit -m "feat: AuthContext — guest identity, tier resolution, migration trigger on login"
```

---

## Task 5: Remove auth gate from `App.jsx`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Replace the `AppInner` function**

In `src/App.jsx`, find and replace the `AppInner` function:

```js
// FIND:
function AppInner() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter','Helvetica Neue',sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "'Inter','Helvetica Neue',sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: -0.8, color: T.text, marginBottom: 10 }}>Vesti</p>
          <p style={{ fontSize: 10, color: T.accent, letterSpacing: 3, fontWeight: 600 }}>LOADING…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <AuthenticatedApp onLogout={signOut} />;
}
```

```js
// REPLACE WITH:
function AppInner() {
  const { loading, signOut } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter','Helvetica Neue',sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "'Inter','Helvetica Neue',sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: -0.8, color: T.text, marginBottom: 10 }}>Vesti</p>
          <p style={{ fontSize: 10, color: T.accent, letterSpacing: 3, fontWeight: 600 }}>LOADING…</p>
        </div>
      </div>
    );
  }

  // Guests and logged-in users both proceed into the app.
  // UpgradePrompt handles auth/upgrade flow when limits are hit.
  return <AuthenticatedApp onLogout={signOut} />;
}
```

- [ ] **Step 2: Remove the `AuthPage` import from `App.jsx`** (it's no longer used directly here)

Find:
```js
import AuthPage from "./components/AuthPage";
```
Remove that line.

- [ ] **Step 3: Update `AuthenticatedApp` to read from `useTier` instead of `usePlan`**

Find:
```js
  const { isPro } = usePlan();
```
Replace with:
```js
  const { isPro, tier } = useTier();
```

- [ ] **Step 4: Add `useTier` to the import from AuthContext**

Find:
```js
import { AuthProvider, useAuth, usePlan } from "./contexts/AuthContext";
```
Replace with:
```js
import { AuthProvider, useAuth, useTier } from "./contexts/AuthContext";
```

- [ ] **Step 5: Build and verify**

```bash
npm run build 2>&1 | grep -E "error" | head -10
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: remove auth gate — app now loads for guests and logged-in users alike"
```

---

## Task 6: `useTripStore` hook

**Files:**
- Create: `src/hooks/useTripStore.js`
- Create: `tests/tripStore.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/tripStore.test.js
import { describe, it, expect } from "vitest";
import { buildDayStubs, dedupTripId } from "../src/hooks/useTripStore";

describe("buildDayStubs", () => {
  it("generates correct number of day stubs for a date range", () => {
    const stubs = buildDayStubs("2026-07-10", "2026-07-12");
    expect(stubs.length).toBe(3);
  });
  it("each stub has a stable id", () => {
    const stubs = buildDayStubs("2026-07-10", "2026-07-11");
    expect(stubs[0].id).toBe("d01");
    expect(stubs[1].id).toBe("d02");
  });
  it("each stub has default occ and weather", () => {
    const [stub] = buildDayStubs("2026-07-10", "2026-07-10");
    expect(stub.occ).toBe("Casual");
    expect(stub.w).toBe("Mild");
    expect(stub.e).toBe("📅");
  });
  it("returns empty array when end is before start", () => {
    expect(buildDayStubs("2026-07-12", "2026-07-10")).toEqual([]);
  });
});

describe("dedupTripId", () => {
  it("returns a string starting with trip_", () => {
    expect(dedupTripId()).toMatch(/^trip_/);
  });
  it("returns unique ids on each call", () => {
    expect(dedupTripId()).not.toBe(dedupTripId());
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
npm test -- tests/tripStore.test.js
```

- [ ] **Step 3: Create `src/hooks/useTripStore.js`**

```js
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

function readLocalTrips(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}

function saveLocalTrips(key, trips) {
  try { localStorage.setItem(key, JSON.stringify(trips)); } catch {}
}

/* ── Hook ─────────────────────────────────────────────────────────────────── */

export default function useTripStore() {
  const { user, guestId, tier, limits } = useAuth();
  const userId = user?.id ?? null;
  const isOwner = user?.email === "sohilgupta@gmail.com";

  // effectiveId for localStorage keys
  const effectiveId = userId || guestId || "anon";
  const localKey = userId
    ? null // logged-in: use Supabase only
    : guestId ? guestKey(guestId, "trips") : null;

  const [trips,       setTrips]       = useState([]);
  const [activeTripId, setActiveTripId] = useState(null);
  const syncTimer = useRef(null);

  /* ── Derived ── */
  const activeTrip = trips.find((t) => t.id === activeTripId) || trips[0] || null;

  /* ── Push to Supabase (debounced) ── */
  const pushToBackend = useCallback((updatedTrips) => {
    if (!userId) return;
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

  /* ── Save trips (both local + remote) ── */
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
          const { data } = await supabase
            .from("profiles")
            .select("trips_data")
            .eq("id", userId)
            .single();

          let loaded = data?.trips_data || [];

          // Seed owner's hardcoded trip on first load
          if (loaded.length === 0 && isOwner) {
            loaded = seedFromStatic();
            await supabase.from("profiles").update({ trips_data: loaded }).eq("id", userId);
          }

          setTrips(loaded);
          const saved = localStorage.getItem(activeKey(userId));
          setActiveTripId(saved || loaded[0]?.id || null);
        } catch {}
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
      const { data } = await supabase
        .from("profiles")
        .select("trips_data")
        .eq("id", userId)
        .single();
      const loaded = data?.trips_data || [];
      setTrips(loaded);
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
    // Signal useOutfits to drop this trip's data
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
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/tripStore.test.js
```
Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTripStore.js tests/tripStore.test.js
git commit -m "feat: useTripStore — multi-trip CRUD with tier limit enforcement and Supabase sync"
```

---

## Task 7: Update `useOutfits` for trip-scoped storage

**Files:**
- Modify: `src/hooks/useOutfits.js`

The hook must scope all reads/writes to `outfitIds[activeTripId]` transparently. Consumers keep the same API (`outfitIds`, `setOutfitIds`, `frozenDays`, `toggleFreeze`).

- [ ] **Step 1: Read the current file before editing**

```bash
wc -l src/hooks/useOutfits.js
```

- [ ] **Step 2: Add `useTripStore` import and trip-scoping logic**

At the top of `src/hooks/useOutfits.js`, add after existing imports:

```js
import useTripStore from "./useTripStore";
```

- [ ] **Step 3: Inside `useOutfits`, read activeTripId and scope storage keys**

Find the line:
```js
export default function useOutfits() {
  const user   = useUser();
  const userId = user?.id ?? null;
```

Replace with:
```js
export default function useOutfits() {
  const user   = useUser();
  const userId = user?.id ?? null;
  const { activeTripId } = useTripStore();
  const tripId = activeTripId || "trip_default";
```

- [ ] **Step 4: Update `lsKey` usage to be trip-scoped**

Find:
```js
function lsKey(userId) {
  return userId ? `vesti_${userId}_outfits_v1` : "vesti_outfits_v1";
}
```
Replace with:
```js
function lsKey(userId, tripId) {
  const base = userId ? `vesti_${userId}` : "vesti";
  return `${base}_outfits_${tripId}_v1`;
}
```

- [ ] **Step 5: Update all `lsKey(userId)` call sites inside the hook to `lsKey(userId, tripId)`**

There are four occurrences inside `loadLocal`, `saveLocal`, and `useEffect`. Find each:
```js
lsKey(userId)
```
Replace all four with:
```js
lsKey(userId, tripId)
```

**Important:** Also update the `loadLocal` and `saveLocal` function signatures:

```js
// FIND:
const loadLocal = (userId) => {
// REPLACE:
const loadLocal = (userId, tripId) => {

// FIND:
const saveLocal = (userId, outfitIds, frozenDays, updatedAt) => {
// REPLACE:
const saveLocal = (userId, tripId, outfitIds, frozenDays, updatedAt) => {
```

And inside `saveLocal`:
```js
// FIND:
  localStorage.setItem(lsKey(userId), JSON.stringify({ outfitIds, frozenDays, updatedAt }));
// REPLACE:
  localStorage.setItem(lsKey(userId, tripId), JSON.stringify({ outfitIds, frozenDays, updatedAt }));
```

- [ ] **Step 6: Update all `loadLocal(userId)` and `saveLocal(userId, ...)` call sites in the hook to pass `tripId`**

Every `loadLocal(userId)` → `loadLocal(userId, tripId)`
Every `saveLocal(userId, ...)` → `saveLocal(userId, tripId, ...)`

There are approximately 8 call sites. Use your editor's find-in-file to catch them all.

- [ ] **Step 7: Also update Supabase outfits_data to be trip-keyed**

In `fromBackend` and `toBackend`, the data will now be stored at `profiles.outfits_data[tripId]`. Update the Supabase fetch/push to wrap/unwrap by tripId:

In `fetchFromBackend` and the initial `useEffect`, the Supabase column stores `{ [tripId]: { [dayId]: outfitObj } }`. After fetching:

```js
// After: const { data } = await supabase.from("profiles").select("outfits_data")...
// Add trip-scoping:
const rawAll = data?.outfits_data || {};
const raw    = rawAll[tripId] || {};  // scope to active trip
```

In `pushToBackend`, wrap the outfits in the tripId namespace:

```js
// Instead of:
await supabase.from("profiles").update({ outfits_data: toBackend(outfits, frozen, updAt) }).eq("id", userId);

// Use:
const { data: existing } = await supabase.from("profiles").select("outfits_data").eq("id", userId).single();
const allOutfits = { ...(existing?.outfits_data || {}), [tripId]: toBackend(outfits, frozen, updAt) };
await supabase.from("profiles").update({ outfits_data: allOutfits }).eq("id", userId);
```

- [ ] **Step 8: Build**

```bash
npm run build 2>&1 | grep -E "error" | head -20
```
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useOutfits.js
git commit -m "feat: useOutfits — trip-scoped storage, transparent to consumers"
```

---

## Task 8: Supabase schema migration

**Files:**
- Create: `docs/supabase-migration.sql`

- [ ] **Step 1: Create the SQL file**

```sql
-- docs/supabase-migration.sql
-- Run this in Supabase Dashboard → SQL Editor

-- Add trips_data column (stores array of Trip objects per user)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trips_data JSONB DEFAULT '[]'::jsonb;

-- Add wardrobe_items column (stores user-added wardrobe items for non-owner accounts)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS wardrobe_items JSONB DEFAULT '[]'::jsonb;

-- outfits_data column already exists.
-- Its format is extended in-app from flat { [dayId]: outfit }
-- to trip-keyed { [tripId]: { [dayId]: outfit } }
-- Migration happens automatically on first load in useOutfits.js.
```

- [ ] **Step 2: Run the SQL in Supabase Dashboard**

Go to **Supabase Dashboard → SQL Editor**, paste and run the above SQL.

- [ ] **Step 3: Verify columns exist**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('trips_data', 'wardrobe_items', 'outfits_data');
```
Expected: 3 rows returned.

- [ ] **Step 4: Commit the SQL file**

```bash
git add docs/supabase-migration.sql
git commit -m "docs: add Supabase schema migration SQL for trips_data and wardrobe_items"
```

---

## Task 9: `UpgradePrompt` modal

**Files:**
- Create: `src/components/UpgradePrompt.jsx`
- Modify: `src/components/AuthPage.jsx` (extract `<AuthForm>`)

- [ ] **Step 1: Extract `AuthForm` from `AuthPage.jsx`**

In `src/components/AuthPage.jsx`, extract the inner form content into a named export `AuthForm`:

```js
// Add this export at the bottom of AuthPage.jsx, before the GoogleIcon function:
export function AuthForm({ compact = false }) {
  const [mode,    setMode]    = useState("landing");
  const [email,   setEmail]   = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    if (!supabaseConfigured) { setError("Supabase not configured."); return; }
    setError(""); setLoading(true);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google", options: { redirectTo: window.location.origin },
    });
    if (err) { setError(err.message); setLoading(false); }
  }

  async function handleEmailOTP(e) {
    e.preventDefault();
    if (!email || !supabaseConfigured) return;
    setError(""); setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email, options: { emailRedirectTo: window.location.origin },
      });
      if (err) throw err;
      setMode("otp_sent");
    } catch (err) {
      setError(err.message || "Failed to send login link.");
    } finally { setLoading(false); }
  }

  const btnSize = compact ? "11px 14px" : "14px 16px";
  const btnFontSize = compact ? 13 : 14;

  if (mode === "otp_sent") {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 28, marginBottom: 12 }}>✉️</p>
        <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Check your inbox</p>
        <p style={{ fontSize: 12, color: T.mid, lineHeight: 1.7, marginBottom: 20 }}>
          Magic link sent to <strong style={{ color: T.text }}>{email}</strong>
        </p>
        <button onClick={() => { setMode("email"); setError(""); }}
          style={{ background: "none", border: "none", color: T.mid, fontSize: 12, cursor: "pointer" }}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <>
      <button onClick={handleGoogle} disabled={loading}
        style={{ width: "100%", padding: btnSize, background: T.text, color: T.bg, border: "none",
          borderRadius: 10, fontSize: btnFontSize, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10,
          opacity: loading ? 0.6 : 1, fontFamily: "inherit" }}>
        <GoogleIcon /> Continue with Google
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, height: 1, background: T.border }} />
        <span style={{ fontSize: 10, color: T.light, letterSpacing: 1.5 }}>OR</span>
        <div style={{ flex: 1, height: 1, background: T.border }} />
      </div>

      {mode === "email" ? (
        <form onSubmit={handleEmailOTP}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com" autoFocus autoComplete="email"
            style={{ width: "100%", padding: "11px 14px", background: T.alt,
              border: `1px solid ${error ? "#EF4444" : T.border}`, borderRadius: 8,
              color: T.text, fontSize: 14, marginBottom: 8, fontFamily: "inherit" }} />
          {error && <p style={{ color: "#EF4444", fontSize: 11, marginBottom: 8 }}>{error}</p>}
          <button type="submit" disabled={loading || !email}
            style={{ width: "100%", padding: btnSize, background: T.accentDim, color: T.accent,
              border: `1px solid ${T.accentBorder}`, borderRadius: 8, fontSize: btnFontSize,
              fontWeight: 600, cursor: loading || !email ? "not-allowed" : "pointer",
              opacity: loading || !email ? 0.5 : 1, marginBottom: 6, fontFamily: "inherit" }}>
            {loading ? "Sending…" : "Send magic link"}
          </button>
          <button type="button" onClick={() => { setMode("landing"); setError(""); }}
            style={{ background: "none", border: "none", color: T.light, fontSize: 11,
              cursor: "pointer", width: "100%", textAlign: "center" }}>
            Back
          </button>
        </form>
      ) : (
        <>
          <button onClick={() => setMode("email")}
            style={{ width: "100%", padding: btnSize, background: "none", color: T.mid,
              border: `1px solid ${T.border}`, borderRadius: 10, fontSize: btnFontSize,
              fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
            Continue with Email
          </button>
          {error && <p style={{ color: "#EF4444", fontSize: 11, marginTop: 8, textAlign: "center" }}>{error}</p>}
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2: Create `src/components/UpgradePrompt.jsx`**

```js
// src/components/UpgradePrompt.jsx
/* ─── UpgradePrompt ───────────────────────────────────────────────────────────
   Context-aware limit modal.
   - Guest hitting limit → shows auth form (Google + Email)
   - Free user hitting limit → shows Stripe upgrade CTA
   Listens for 'vesti-limit-reached' custom events globally.
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect } from "react";
import { T } from "../theme";
import { useTier, useAuth } from "../contexts/AuthContext";
import { AuthForm } from "./AuthPage";
import { LIMITS } from "../utils/tiers";

const COPY = {
  wardrobe: {
    heading:  "You've reached your wardrobe limit",
    sub:      (tier) => `Guest: ${LIMITS.guest.wardrobe}  ·  Free: ${LIMITS.free.wardrobe}  ·  Pro: ∞`,
    proHeading: "Unlock unlimited wardrobe items",
  },
  trips: {
    heading:  "Save your trip & plan more",
    sub:      (tier) => `Guest: ${LIMITS.guest.trips} trip  ·  Free: ${LIMITS.free.trips} trips  ·  Pro: ∞`,
    proHeading: "Unlock unlimited trips",
  },
  outfitDays: {
    heading:  "Unlock full trip planning",
    sub:      (tier) => `Guest: ${LIMITS.guest.outfitDays} days  ·  Free: unlimited  ·  Pro: unlimited`,
    proHeading: "You've reached your outfit days limit",
  },
};

export default function UpgradePrompt() {
  const { tier, isGuest } = useTier();
  const { user } = useAuth();
  const [open,    setOpen]    = useState(false);
  const [limitType, setLimitType] = useState("wardrobe");
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    function handleLimit(e) {
      setLimitType(e.detail?.type || "wardrobe");
      setOpen(true);
    }
    window.addEventListener("vesti-limit-reached", handleLimit);
    return () => window.removeEventListener("vesti-limit-reached", handleLimit);
  }, []);

  async function handleGoPro() {
    setUpgrading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, email: user?.email }),
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      alert("Could not start checkout. Please try again.");
    } finally {
      setUpgrading(false);
    }
  }

  if (!open) return null;

  const copy = COPY[limitType] || COPY.wardrobe;

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 380,
        position: "relative",
      }}>
        {/* Close */}
        <button onClick={() => setOpen(false)}
          style={{ position: "absolute", top: 14, right: 16, background: "none",
            border: "none", color: T.light, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>
          ×
        </button>

        {/* Heading */}
        <p style={{ fontSize: 11, color: T.accent, fontWeight: 700, letterSpacing: 1.5,
          textTransform: "uppercase", marginBottom: 8 }}>
          {isGuest ? "Create Free Account" : "Upgrade to Pro"}
        </p>
        <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, color: T.text, marginBottom: 6 }}>
          {isGuest ? copy.heading : copy.proHeading}
        </p>
        {isGuest && (
          <p style={{ fontSize: 12, color: T.mid, marginBottom: 20, lineHeight: 1.6 }}>
            {copy.sub(tier)}
          </p>
        )}

        {/* Auth form for guests */}
        {isGuest && (
          <AuthForm compact />
        )}

        {/* Pro CTA for free users */}
        {!isGuest && (
          <>
            <p style={{ fontSize: 13, color: T.mid, marginBottom: 20, lineHeight: 1.7 }}>
              Upgrade to Pro for unlimited wardrobe, trips, AI generation, and clean exports.
            </p>
            <button onClick={handleGoPro} disabled={upgrading}
              style={{ width: "100%", padding: "13px", background: T.accent, color: "#fff",
                border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: upgrading ? "not-allowed" : "pointer", opacity: upgrading ? 0.7 : 1 }}>
              {upgrading ? "Redirecting…" : "Go Pro →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Mount `UpgradePrompt` in `App.jsx`**

In `src/App.jsx`, add the import:
```js
import UpgradePrompt from "./components/UpgradePrompt";
```

Inside `AuthenticatedApp`, just before the closing `</div>` of the root div (after `<AppFooter />`):
```jsx
<UpgradePrompt />
```

- [ ] **Step 4: Build**

```bash
npm run build 2>&1 | grep -E "error" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add src/components/UpgradePrompt.jsx src/components/AuthPage.jsx src/App.jsx
git commit -m "feat: UpgradePrompt modal — auth form for guests, Stripe CTA for free users"
```

---

## Task 10: `TripCreator` modal

**Files:**
- Create: `src/components/TripCreator.jsx`

- [ ] **Step 1: Create the component**

```js
// src/components/TripCreator.jsx
import { useState } from "react";
import { T } from "../theme";

export default function TripCreator({ onClose, onCreateTrip }) {
  const [name,      setName]      = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [error,     setError]     = useState("");

  function handleCreate() {
    if (!name.trim())  { setError("Trip name is required."); return; }
    if (!startDate)    { setError("Start date is required."); return; }
    if (!endDate)      { setError("End date is required."); return; }
    if (endDate < startDate) { setError("End date must be on or after start date."); return; }
    const trip = onCreateTrip(name.trim(), startDate, endDate);
    if (trip) onClose();
  }

  const inputStyle = {
    width: "100%", padding: "11px 14px",
    background: T.alt, border: `1px solid ${T.border}`,
    borderRadius: 8, color: T.text, fontSize: 14,
    fontFamily: "inherit", marginBottom: 12,
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 360,
        position: "relative",
      }}>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 14,
          background: "none", border: "none", color: T.light, fontSize: 18, cursor: "pointer" }}>
          ×
        </button>

        <p style={{ fontSize: 11, color: T.accent, fontWeight: 700, letterSpacing: 1.5,
          textTransform: "uppercase", marginBottom: 6 }}>New Trip</p>
        <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, color: T.text, marginBottom: 20 }}>
          Plan a Trip
        </p>

        <label style={{ fontSize: 11, color: T.light, letterSpacing: 0.5, fontWeight: 600, display: "block", marginBottom: 5 }}>
          TRIP NAME
        </label>
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Paris Summer 2026"
          style={inputStyle} />

        <label style={{ fontSize: 11, color: T.light, letterSpacing: 0.5, fontWeight: 600, display: "block", marginBottom: 5 }}>
          START DATE
        </label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
          style={{ ...inputStyle, colorScheme: "dark" }} />

        <label style={{ fontSize: 11, color: T.light, letterSpacing: 0.5, fontWeight: 600, display: "block", marginBottom: 5 }}>
          END DATE
        </label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
          style={{ ...inputStyle, colorScheme: "dark" }} />

        {error && <p style={{ color: "#EF4444", fontSize: 12, marginBottom: 10 }}>{error}</p>}

        <p style={{ fontSize: 11, color: T.light, lineHeight: 1.6, marginBottom: 16 }}>
          Days are created as stubs. Add city and activity details in the Trip tab after creating.
        </p>

        <button onClick={handleCreate}
          style={{ width: "100%", padding: "13px", background: T.accent, color: "#fff",
            border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Create Trip
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TripCreator.jsx
git commit -m "feat: TripCreator modal — name, date range, generates day stubs"
```

---

## Task 11: Update `TripTab` — trip switcher, dynamic data, day editing

**Files:**
- Modify: `src/components/TripTab.jsx`

- [ ] **Step 1: Replace the static `TRIP` import with dynamic `useTripStore`**

In `src/components/TripTab.jsx`:

Remove:
```js
import TRIP from "../data/trip";
```

Add:
```js
import { useState } from "react";
import useTripStore from "../hooks/useTripStore";
import { useTier } from "../contexts/AuthContext";
import TripCreator from "./TripCreator";
```

(`useState` is already imported — just add the new hooks/components.)

- [ ] **Step 2: Replace the component body**

Replace `export default function TripTab({...})` entirely:

```js
export default function TripTab({
  wardrobe = [],
  outfitIds = {},
  setOutfitIds,
  frozenDays = {},
  onNavigateToDay,
  capsuleIds,
}) {
  const { trips, activeTrip, activeTripId, setActiveTrip, createTrip, updateTripDay } = useTripStore();
  const { limits, isGuest } = useTier();
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiDone,       setAiDone]       = useState(false);
  const [aiError,      setAiError]      = useState(null);
  const [showCreator,  setShowCreator]  = useState(false);
  const [editingDay,   setEditingDay]   = useState(null); // dayId being edited

  const TRIP = activeTrip?.days || [];

  const planned = TRIP.filter((d) => isPlanned(d.id, outfitIds)).length;
  const frozen  = TRIP.filter((d) => frozenDays[d.id]).length;

  async function handlePlanAll() {
    if (aiLoading || wardrobe.length === 0) return;
    setAiLoading(true); setAiError(null); setAiDone(false);
    try {
      await generateTripOutfits({ wardrobe, frozenDays, outfitIds, setOutfitIds, capsuleIds });
      setAiDone(true);
      setTimeout(() => setAiDone(false), 3000);
    } catch (err) {
      setAiError(err.message || "Generation failed.");
    } finally { setAiLoading(false); }
  }

  function handleCreateTrip(name, startDate, endDate) {
    if (trips.length >= limits.trips) {
      window.dispatchEvent(new CustomEvent("vesti-limit-reached", { detail: { type: "trips" } }));
      return null;
    }
    return createTrip(name, startDate, endDate);
  }

  return (
    <div>
      {/* Hero */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: T.accent, marginBottom: 6 }}>
          Trip Overview
        </p>
        <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.8, color: T.text, lineHeight: 1.1, marginBottom: 6 }}>
          {activeTrip?.name || "No Trip"}
        </p>
        <p style={{ fontSize: 14, color: T.mid }}>
          {TRIP.length} days{activeTrip?.destination ? ` · ${activeTrip.destination}` : ""}
        </p>
      </div>

      {/* Trip switcher + New Trip */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {trips.map((t) => (
          <button key={t.id} onClick={() => setActiveTrip(t.id)}
            style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              cursor: "pointer", border: `1px solid ${t.id === activeTripId ? T.accent : T.border}`,
              background: t.id === activeTripId ? T.accentDim : "none",
              color: t.id === activeTripId ? T.accent : T.mid,
            }}>
            {t.name}
          </button>
        ))}
        <button
          onClick={() => {
            if (trips.length >= limits.trips) {
              window.dispatchEvent(new CustomEvent("vesti-limit-reached", { detail: { type: "trips" } }));
            } else {
              setShowCreator(true);
            }
          }}
          style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
            cursor: "pointer", border: `1px solid ${T.border}`, background: "none", color: T.light }}>
          + New Trip
          {!isGuest && trips.length >= limits.trips ? "" : ""}
        </button>
        {!isGuest && (
          <span style={{ fontSize: 10, color: T.light, marginLeft: 4 }}>
            {trips.length}/{limits.trips === Infinity ? "∞" : limits.trips} trips
          </span>
        )}
      </div>

      {/* Header card */}
      <div style={{ background: T.surface, border: `1.5px solid ${T.borderLight}`, borderRadius: 16, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{activeTrip?.name || "—"}</p>
            <p style={{ fontSize: 12, color: T.mid, marginTop: 3 }}>
              {planned}/{TRIP.length} days planned · {frozen} frozen
            </p>
          </div>
          <button onClick={handlePlanAll} disabled={aiLoading || wardrobe.length === 0}
            style={{ padding: "9px 18px", background: aiDone ? "#0C2010" : aiLoading ? T.alt : T.text,
              color: aiDone ? "#4ADE80" : aiLoading ? T.light : T.bg, border: aiDone ? "1.5px solid #4ADE80" : "none",
              borderRadius: 10, fontSize: 12, fontWeight: 700,
              cursor: aiLoading || wardrobe.length === 0 ? "not-allowed" : "pointer",
              opacity: aiLoading ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
            {aiLoading ? (<><span style={{ animation: "spin 1.2s linear infinite", display: "inline-block" }}>◌</span>Generating…<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></>) : aiDone ? "✓ Done!" : "✨ Plan All →"}
          </button>
        </div>
        {planned > 0 && (
          <div style={{ marginTop: 12, background: T.alt, borderRadius: 4, height: 4 }}>
            <div style={{ height: "100%", background: T.text, width: `${(planned / TRIP.length) * 100}%`, borderRadius: 4, transition: "width 0.4s ease" }} />
          </div>
        )}
        {frozen > 0 && !aiLoading && !aiDone && (
          <p style={{ fontSize: 10, color: T.light, marginTop: 8 }}>{frozen} frozen day{frozen !== 1 ? "s" : ""} will be skipped</p>
        )}
        {aiError && (
          <div style={{ marginTop: 10, background: "#2D0A0A", border: "1.5px solid #7F1D1D", borderRadius: 10, padding: "9px 12px", fontSize: 11, color: "#FCA5A5", display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span>⚠</span><span>{aiError}</span>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 20, top: 0, bottom: 0, width: 1.5, background: T.borderLight }} />
        {TRIP.map((day) => {
          const done   = isPlanned(day.id, outfitIds);
          const isFrozen = frozenDays[day.id];
          const items  = getDayItems(day.id, outfitIds, wardrobe);
          const isEditing = editingDay === day.id;

          return (
            <div key={day.id} style={{ display: "flex", gap: 0, marginBottom: 10 }}>
              <div style={{ width: 42, flexShrink: 0, display: "flex", justifyContent: "center", paddingTop: 18 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", zIndex: 1,
                  background: isFrozen ? "#60A5FA" : done ? T.text : T.surface,
                  border: `2px solid ${isFrozen ? "#60A5FA" : done ? T.text : T.border}`,
                  transition: "all 0.2s" }} />
              </div>
              <div style={{ flex: 1, background: T.surface, border: `1px solid ${T.borderLight}`,
                borderRadius: 16, padding: "16px 18px", overflow: "hidden" }}>
                {isEditing ? (
                  /* Inline edit form */
                  <div onClick={(e) => e.stopPropagation()}>
                    {[
                      { label: "City / Route", field: "city",  value: day.city },
                      { label: "Day activity", field: "day",   value: day.day },
                      { label: "Evening",      field: "night", value: day.night },
                    ].map(({ label, field, value }) => (
                      <div key={field} style={{ marginBottom: 8 }}>
                        <p style={{ fontSize: 10, color: T.light, marginBottom: 3 }}>{label}</p>
                        <input defaultValue={value}
                          onBlur={(e) => updateTripDay(activeTripId, day.id, { [field]: e.target.value })}
                          style={{ width: "100%", background: T.alt, border: `1px solid ${T.border}`,
                            borderRadius: 6, color: T.text, fontSize: 13, padding: "6px 10px", fontFamily: "inherit" }} />
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                      {[
                        { label: "Occasion", field: "occ", options: ["Casual","Dinner","Flight","Hiking","Beach","Smart Casual"] },
                        { label: "Weather",  field: "w",   options: ["Cold","Mild","Warm"] },
                      ].map(({ label, field, options }) => (
                        <div key={field} style={{ flex: 1 }}>
                          <p style={{ fontSize: 10, color: T.light, marginBottom: 3 }}>{label}</p>
                          <select defaultValue={day[field]}
                            onChange={(e) => updateTripDay(activeTripId, day.id, { [field]: e.target.value })}
                            style={{ width: "100%", background: T.alt, border: `1px solid ${T.border}`,
                              borderRadius: 6, color: T.text, fontSize: 12, padding: "6px 8px", fontFamily: "inherit" }}>
                            {options.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setEditingDay(null)}
                      style={{ fontSize: 11, color: T.accent, background: "none", border: "none",
                        cursor: "pointer", fontWeight: 600, marginTop: 4 }}>
                      Done editing
                    </button>
                  </div>
                ) : (
                  /* Read-only card */
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                    cursor: "pointer" }} onClick={() => onNavigateToDay && onNavigateToDay(day.id)}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                        <span style={{ fontSize: 15 }}>{day.e}</span>
                        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3, color: T.text }}>
                          {day.city || day.date}
                        </span>
                        {isFrozen && <span title="Frozen" style={{ fontSize: 11 }}>🔒</span>}
                      </div>
                      <p style={{ fontSize: 12, color: T.mid, marginBottom: 6 }}>{day.date}</p>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {day.day   && <Chip text={day.day} />}
                        {day.night && <Chip text={day.night} colors={["#4A1942","#F9A8D4"]} />}
                        <Chip text={day.w}   colors={T.weather[day.w]} />
                        <Chip text={day.occ} colors={T.occ[day.occ]} />
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 7, marginLeft: 10, flexShrink: 0 }}>
                      {items.length > 0 && (
                        <div style={{ display: "flex" }}>
                          {items.map((item, i) => {
                            const [bg, ac] = swatch(item.col);
                            return (
                              <div key={item.id} style={{ width: 26, height: 26, borderRadius: 7, overflow: "hidden",
                                border: `2px solid ${T.surface}`, marginLeft: i > 0 ? -6 : 0,
                                background: `linear-gradient(145deg,${bg},${ac})`, flexShrink: 0 }}>
                                {item.img && <img src={item.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => (e.target.style.display = "none")} />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button onClick={(e) => { e.stopPropagation(); setEditingDay(day.id); }}
                          style={{ fontSize: 9, color: T.light, background: "none", border: "none",
                            cursor: "pointer", letterSpacing: 0.5, fontWeight: 600 }}>
                          ✎
                        </button>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.8, color: T.light, opacity: 0.7 }}>
                          {done ? "Edit →" : "Plan →"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 9, color: T.light, textAlign: "center", marginTop: 12, letterSpacing: 0.5 }}>
        CLICK ANY DAY TO EDIT IN DAILY TAB · ✎ TO EDIT DAY DETAILS · FREEZE TO ADD TO PACKING
      </p>

      {showCreator && (
        <TripCreator
          onClose={() => setShowCreator(false)}
          onCreateTrip={handleCreateTrip}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build**

```bash
npm run build 2>&1 | grep -E "error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TripTab.jsx
git commit -m "feat: TripTab — trip switcher, dynamic trip data, inline day editing, TripCreator"
```

---

## Task 12: Update `OutfitsTab` — lock days beyond guest limit

**Files:**
- Modify: `src/components/OutfitsTab.jsx`

- [ ] **Step 1: Import `useTier` and `useTripStore` in `OutfitsTab.jsx`**

```js
import { useTier } from "../contexts/AuthContext";
import useTripStore from "../hooks/useTripStore";
```

- [ ] **Step 2: Inside the component, read tier info and active trip days**

Add at the top of the component function:
```js
const { limits, isGuest } = useTier();
const { activeTrip } = useTripStore();
const TRIP = activeTrip?.days || [];
```

Replace any references to `import TRIP from "../data/trip"` / hardcoded `TRIP` with the dynamic variable.

- [ ] **Step 3: Lock day list items beyond guest `outfitDays` limit**

In the day list rendering, where each day button is rendered, wrap days at index >= `limits.outfitDays` with a lock overlay:

```js
// When rendering day buttons in the list:
{TRIP.map((day, idx) => {
  const isLocked = isGuest && idx >= limits.outfitDays;
  return (
    <button
      key={day.id}
      onClick={() => {
        if (isLocked) {
          window.dispatchEvent(new CustomEvent("vesti-limit-reached", { detail: { type: "outfitDays" } }));
          return;
        }
        setSelectedDay(day.id);
      }}
      style={{
        // ... existing styles ...
        opacity: isLocked ? 0.45 : 1,
        position: "relative",
      }}
    >
      {/* existing day content */}
      {isLocked && (
        <span style={{ position: "absolute", top: 4, right: 4, fontSize: 10 }}>🔒</span>
      )}
    </button>
  );
})}
```

- [ ] **Step 4: Build**

```bash
npm run build 2>&1 | grep -E "error" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add src/components/OutfitsTab.jsx
git commit -m "feat: OutfitsTab — lock days beyond guest outfitDays limit, dynamic trip days"
```

---

## Task 13: Update `PackTab` — filter to active trip

**Files:**
- Modify: `src/components/PackTab.jsx`

- [ ] **Step 1: Add `useTripStore` import**

```js
import useTripStore from "../hooks/useTripStore";
```

- [ ] **Step 2: Replace any static `TRIP` import with dynamic data**

```js
// Remove: import TRIP from "../data/trip";
// Add inside component:
const { activeTrip } = useTripStore();
const TRIP = activeTrip?.days || [];
```

- [ ] **Step 3: Build and commit**

```bash
npm run build 2>&1 | grep -E "error" | head -10
git add src/components/PackTab.jsx
git commit -m "feat: PackTab — filter packing list to active trip days"
```

---

## Task 14: Update `useCapsule` — guest-aware storage key

**Files:**
- Modify: `src/hooks/useCapsule.js`

- [ ] **Step 1: Import `guestKey` and read `guestId` from AuthContext**

In `src/hooks/useCapsule.js`:

```js
// Add import:
import { guestKey } from "./useGuestSession";
import { useAuth } from "../contexts/AuthContext";
```

- [ ] **Step 2: Read `guestId` and use it when no `userId`**

Inside the hook:
```js
const { user, guestId } = useAuth();
const userId = user?.id ?? null;
```

Update `lsKey` usage: when no `userId`, use `guestKey(guestId, "capsule")`:
```js
function effectiveLsKey(userId, guestId) {
  if (userId) return `vesti_${userId}_capsule_v1`;
  if (guestId) return guestKey(guestId, "capsule");
  return "vesti_capsule_v1";
}
```

Replace all `lsKey(userId)` calls with `effectiveLsKey(userId, guestId)`.

- [ ] **Step 3: Skip Supabase sync when guest**

Wrap `pushToBackend` and `fetchFromBackend` to no-op when `!userId`:
```js
const pushToBackend = useCallback((ids) => {
  if (!userId) return; // guests: localStorage only
  // ... existing debounced supabase logic
}, [userId]);
```

- [ ] **Step 4: Build and commit**

```bash
npm run build 2>&1 | grep -E "error" | head -10
git add src/hooks/useCapsule.js
git commit -m "feat: useCapsule — guest-aware storage key, skip Supabase sync for guests"
```

---

## Task 15: Update `useWardrobe` — owner-only Google Sheets, `wardrobe_items` for others

**Files:**
- Modify: `src/hooks/useWardrobe.js`

Non-owner users have no Google Sheet. They manage items via `profiles.wardrobe_items` (Supabase JSONB array). Owner (`sohilgupta@gmail.com`) continues to use Google Sheets as before.

- [ ] **Step 1: Import `useAuth` and read owner status**

In `src/hooks/useWardrobe.js`, find:
```js
const { user, session } = useAuth();
const userId = user?.id ?? null;
```
Replace with:
```js
import { OWNER_EMAIL } from "../utils/tiers";
// ...
const { user, session, guestId } = useAuth();
const userId  = user?.id ?? null;
const isOwner = user?.email === OWNER_EMAIL;
```

- [ ] **Step 2: Short-circuit Google Sheets fetch for non-owner users**

In the `sync` callback, wrap the `fetchAllTabs` call:

```js
const sync = useCallback(async () => {
  setSyncStatus("syncing");
  try {
    if (isOwner) {
      // Owner: fetch from Google Sheets as before
      const fresh = await fetchAllTabs(session?.access_token);
      // ... existing remap + cache + merge logic unchanged ...
      remoteRef.current = fresh;
      trySave(cacheKey(userId), { items: fresh, fetchedAt: Date.now() });
      const merged = applyOverrides(fresh, overridesRef.current);
      setItems(merged);
      setLastSync(Date.now());
      setSyncStatus("ok");
      enrichWithDriveImages(merged, setItems).catch(() => {});
    } else {
      // Non-owner: read from Supabase wardrobe_items column
      if (userId) {
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
      } else {
        // Guest: read from localStorage
        const guestWardrobeKey = guestId ? `vesti_guest_${guestId}_wardrobe` : null;
        const local = guestWardrobeKey ? tryParse(guestWardrobeKey, []) : [];
        remoteRef.current = local;
        setItems(applyOverrides(local, overridesRef.current));
        setSyncStatus("ok");
      }
      setLoading(false);
    }
  } catch {
    setSyncStatus("offline");
  } finally {
    setLoading(false);
  }
}, [userId, isOwner, guestId, session]);
```

- [ ] **Step 3: Update `addItem` to persist to Supabase for non-owner logged-in users**

```js
const addItem = useCallback(async (item) => {
  const newItem = {
    ...item,
    id:      item.id || `local_${Date.now()}`,
    _source: "local",
    t:       item.t ?? "Yes",
    selected: true,
  };

  if (isOwner) {
    // Owner: keep existing localStorage overrides approach
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
    } catch {}
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
```

- [ ] **Step 4: Build**

```bash
npm run build 2>&1 | grep -E "error" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useWardrobe.js
git commit -m "feat: useWardrobe — owner uses Google Sheets, others use Supabase wardrobe_items or localStorage"
```

---

## Task 16: Update `ProfileTab` — `useTier` + limit display

**Files:**
- Modify: `src/components/ProfileTab.jsx`

- [ ] **Step 1: Replace `usePlan` with `useTier`**

```js
// FIND:
import { useAuth, usePlan } from "../contexts/AuthContext";
// ...
const { isPro } = usePlan();

// REPLACE WITH:
import { useAuth, useTier } from "../contexts/AuthContext";
// ...
const { isPro, tier, limits } = useTier();
```

- [ ] **Step 2: Update the "FREE TIER LIMITS" section to show dynamic limits**

Replace the hardcoded list with:
```jsx
{!isPro && (
  <div style={{ background: "#1A1520", border: "1px solid #3B1A5A", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
    <p style={{ fontSize: 11, color: "#C084FC", fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
      {tier === "guest" ? "GUEST LIMITS" : "FREE TIER LIMITS"}
    </p>
    <ul style={{ fontSize: 12, color: T.mid, lineHeight: 1.8, paddingLeft: 14 }}>
      <li>{limits.trips === Infinity ? "Unlimited" : limits.trips} trip{limits.trips !== 1 ? "s" : ""}</li>
      <li>{limits.wardrobe === Infinity ? "Unlimited" : limits.wardrobe} wardrobe items</li>
      <li>{limits.outfitDays === Infinity ? "Unlimited" : limits.outfitDays} days of outfit planning</li>
      {tier === "guest" && <li>No cross-device sync</li>}
      {tier === "free"  && <li>Basic AI generation</li>}
    </ul>
    <p style={{ fontSize: 12, color: T.light, marginTop: 10 }}>
      {tier === "guest" ? "Create a free account to sync across devices." : "Upgrade to Pro for unlimited everything."}
    </p>
  </div>
)}
```

- [ ] **Step 3: Build and commit**

```bash
npm run build 2>&1 | grep -E "error" | head -10
git add src/components/ProfileTab.jsx
git commit -m "feat: ProfileTab — replace usePlan with useTier, dynamic limits display"
```

---

## Task 16: Wardrobe limit indicator in `WardrobeTab`

**Files:**
- Modify: `src/components/WardrobeTab.jsx`

- [ ] **Step 1: Import `useTier`**

```js
import { useTier } from "../contexts/AuthContext";
```

- [ ] **Step 2: Read tier info and show limit in hero**

Inside the component:
```js
const { limits, isGuest, isPro } = useTier();
```

In the hero section where item count is displayed, add a limit badge for guests/free:
```jsx
{/* After the item count heading */}
{!isPro && (
  <span style={{ fontSize: 11, color: T.light, marginLeft: 8 }}>
    {wardrobe.length}/{limits.wardrobe === Infinity ? "∞" : limits.wardrobe} items
  </span>
)}
```

- [ ] **Step 3: Enforce limit in the add item flow**

Find where `onAdd` is called (the "Add item" button). Wrap with a limit check:
```js
function handleAdd(item) {
  if (wardrobe.length >= limits.wardrobe) {
    window.dispatchEvent(new CustomEvent("vesti-limit-reached", { detail: { type: "wardrobe" } }));
    return;
  }
  onAdd(item);
}
```
Replace direct `onAdd` calls with `handleAdd`.

- [ ] **Step 4: Build and commit**

```bash
npm run build 2>&1 | grep -E "error" | head -10
git add src/components/WardrobeTab.jsx
git commit -m "feat: WardrobeTab — show item limit indicator, enforce wardrobe limit"
```

---

## Task 17: Full build, test, and deploy

- [ ] **Step 1: Run all tests**

```bash
npm test
```
Expected: all test suites pass.

- [ ] **Step 2: Full build**

```bash
npm run build
```
Expected: built in under 30s, no errors.

- [ ] **Step 3: Smoke-test locally**

```bash
npm run dev
```

Open `http://localhost:5173`. Verify:
- [ ] App loads without login prompt
- [ ] Guest can add items up to 10; on 11th attempt UpgradePrompt appears
- [ ] Guest can create 1 trip; on 2nd attempt UpgradePrompt appears
- [ ] Days 4+ in OutfitsTab show 🔒 for guests
- [ ] Signing in via Google/Email migrates guest data and clears guestId
- [ ] `sohilgupta@gmail.com` shows PRO badge with no limits
- [ ] Trip switcher shows "Australia & NZ 2026" for owner account
- [ ] TripCreator modal creates a new trip with stub days

- [ ] **Step 4: Deploy**

```bash
vercel --prod
vercel alias set <deployment-url> vesti-sohil.vercel.app
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: guest mode, freemium tiers, multi-trip — full implementation"
```
