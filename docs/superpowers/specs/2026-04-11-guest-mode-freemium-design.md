# Guest Mode & Freemium Tiers — Design Spec
**Date:** 2026-04-11  
**Status:** Approved  
**Scope:** Guest access, three-tier limits, multi-trip support, guest→login data migration

---

## Goal

Allow any user to start the app immediately without signing in. As they hit usage limits, prompt them to log in (free tier) or upgrade (pro tier). All data created as a guest migrates seamlessly on login — no data loss, no friction.

---

## 1. Tier System

### Three tiers

| Tier | Identity | Wardrobe Items | Trips | Outfit Days | AI | Sync |
|---|---|---|---|---|---|---|
| **Guest** | guestId (localStorage UUID) | 10 | 1 | 3 | ✗ | ✗ |
| **Free** | Supabase user, no subscription | 50 | 3 | Unlimited | Basic | ✓ |
| **Pro** | Supabase user, active subscription | Unlimited | Unlimited | Unlimited | Full | ✓ |

### Owner override

`sohilgupta@gmail.com` always resolves to Pro regardless of Supabase plan or subscription status. This is enforced as a hardcoded check before any plan lookup — no DB query can override it.

```js
const OWNER_EMAIL = "sohilgupta@gmail.com";
if (user?.email === OWNER_EMAIL) return { tier: "pro", limits: LIMITS.pro, isPro: true };
```

### Limits constant

```js
export const LIMITS = {
  guest: { wardrobe: 10,       trips: 1,         outfitDays: 3         },
  free:  { wardrobe: 50,       trips: 3,         outfitDays: Infinity  },
  pro:   { wardrobe: Infinity, trips: Infinity,  outfitDays: Infinity  },
};
```

---

## 2. Guest Identity

### guestId lifecycle

- On first app load, if no Supabase session exists: generate a UUID v4, store as `localStorage['vesti_guest_id']`
- All subsequent loads: read from `localStorage['vesti_guest_id']`
- On successful login + migration: cleared (see Section 4)

### `useGuestSession` hook (new)

Single responsibility: manage the guestId.

```
useGuestSession() → { guestId, isGuest, clearGuestSession }
```

- Called once inside `AuthProvider`
- `clearGuestSession()` removes `vesti_guest_id` and all `vesti_guest_<guestId>_*` keys from localStorage

### `AuthContext` additions

```js
// New exports alongside existing user, session, profile, loading, signOut
guestId      // string | null
isGuest      // boolean
tier         // "guest" | "free" | "pro"
limits       // LIMITS[tier]
```

### `useTier()` hook (replaces `usePlan()`)

```js
useTier() → { tier, limits, isGuest, isPro }
```

- Resolves owner override first
- Then checks Supabase profile plan + subscription_status
- Falls back to "guest" if no user
- `usePlan()` kept as a thin alias for backward compatibility during migration

---

## 3. Multi-Trip Architecture

### Trip data model

```js
{
  id:          "trip_<uuidv4>",       // stable key
  name:        "Australia & NZ 2026",
  destination: "Sydney, Melbourne, Queenstown",  // optional display text
  createdAt:   "2026-04-11T10:00:00Z",
  days: [
    {
      id:    "d01",             // stable key used for outfit linking
      date:  "Wed Apr 1",
      city:  "Delhi → Sydney",
      day:   "Overnight Flight",
      night: "Flight",
      occ:   "Flight",
      w:     "Cold",
      e:     "✈️"
    }
    // ...one entry per trip day
  ]
}
```

### `useTripStore` hook (new)

```
useTripStore() → {
  trips,           // Trip[]  sorted by createdAt desc (newest first)
  activeTrip,      // Trip | null  (the currently selected trip)
  activeTripId,    // string | null
  createTrip(name, startDate, endDate),  // enforces tier limit; throws LimitError if exceeded
  deleteTrip(id),                         // removes trip + its outfits
  setActiveTrip(id),
  updateTripDay(tripId, dayId, fields),   // edit day details inline
  renameTrip(id, name),
}
```

**Persistence:**
- Guest: `localStorage['vesti_guest_<guestId>_trips']` = JSON array of Trip objects
- Logged-in: Supabase `profiles.trips_data` JSONB column (array of Trip objects)
- Debounced 500ms push to Supabase on every mutation (same pattern as `useOutfits`)

**Active trip:**
- `localStorage['vesti_<effectiveId>_active_trip']` = tripId
- Initialises to `trips[0].id` if no saved preference

**Trip creation:**
1. Check `trips.length >= limits.trips` — if true, emit `"trip-limit-reached"` custom event, return without creating
2. Otherwise generate UUID, build day stubs from date range, append to trips array, save, push to Supabase

**Day stubs:** When creating a trip from a date range, each day is initialised with `{ date, city: "", day: "", night: "", occ: "Casual", w: "Mild", e: "📅" }`. Users edit inline in TripTab.

**Seeding Sohil's existing trip:** On first load for `sohilgupta@gmail.com`, if `trips_data` is empty, auto-import `src/data/trip.js` as "Australia & NZ 2026" with id `trip_aus_nz_2026`. This preserves all existing outfit assignments.

### Outfit storage — trip-scoped

**Current shape:**
```js
outfitIds[dayId] = { daytime, evening }
```

**New shape:**
```js
outfitIds[tripId][dayId] = { daytime, evening }
```

`useOutfits` calls `useTripStore` internally to read `activeTripId` and scopes all reads/writes to `outfitIds[activeTripId]`. No API change for existing consumers — the scoping is transparent.

**Supabase column:** `profiles.outfits_data` (already exists) — structure extended to be trip-keyed. Existing flat data (single trip) is migrated on first load: wrapped as `{ trip_aus_nz_2026: <existingData> }`.

**Frozen days** follow the same trip-scoped shape:
```js
frozenDays[tripId][dayId] = true | false
```

### Capsule — remains global

`useCapsule` is unchanged in scope. Capsule = personal travel item shortlist, shared across all trips.

### Wardrobe items limit

The "10/50/unlimited" limit applies to **user-added items** stored in a new `profiles.wardrobe_items` JSONB column (array of item objects) for logged-in users, or `localStorage['vesti_guest_<guestId>_wardrobe']` for guests.

The Google Sheets feed (`/api/wardrobe`) is **owner-only** (`sohilgupta@gmail.com`): it populates the wardrobe directly and is not subject to limits. All other users manage items entirely through the `profiles.wardrobe_items` column. The `useWardrobe` hook detects the owner account and merges Sheets data; for all other accounts it reads only from `wardrobe_items`.

---

## 4. Guest → Login Migration

### Trigger

`supabase.auth.onAuthStateChange` fires with a new authenticated user AND `localStorage['vesti_guest_id']` is non-null.

### `migrateGuestData(guestId, userId)` utility (new, in `src/utils/guestMigration.js`)

```
Step 1: Check localStorage['vesti_migrated_to_<userId>']
        → if set: skip entirely (duplicate-run guard)

Step 2: Read all guest localStorage data
        - trips:   localStorage['vesti_guest_<guestId>_trips']    → Trip[]
        - outfits: localStorage['vesti_guest_<guestId>_outfits']  → { [tripId]: { [dayId]: outfit } }
        - capsule: localStorage['vesti_guest_<guestId>_capsule']  → string[]

Step 3: Fetch existing Supabase profile data (trips_data, outfits_data, capsule_ids)

Step 4: Merge
        - trips:   append guest trips; dedup by (name + createdAt day)
        - outfits: merge per-trip; guest data wins on any day conflict
        - capsule: union of guest capsule IDs + existing capsule IDs

Step 5: Write merged data to Supabase profiles in a single .update() call

Step 6: Set localStorage['vesti_migrated_to_<userId>'] = ISO timestamp

Step 7: Call clearGuestSession() — removes vesti_guest_id + all vesti_guest_<guestId>_* keys

Step 8: Dispatch CustomEvent('vesti-data-migrated', { detail: { userId } })
        (existing hooks already listen for this and reload their state)
```

**Error handling:** If Step 5 (Supabase write) throws, Steps 6–8 are skipped. Migration is not marked complete. It will retry on the user's next login.

**No data is ever deleted before a successful Supabase write.**

---

## 5. UI/UX

### App entry

`App.jsx` no longer renders `<AuthPage />` as a fullscreen gate. On load, `AuthContext` resolves to either a Supabase user or a guest user. Both proceed into the main app immediately.

Loading state: show the same loading screen as today. Once resolved (user or guest), render app.

### `UpgradePrompt` modal (new — replaces `PaywallModal`)

Context-aware modal shown when any limit is hit.

**For guests (hitting any limit):**
```
"You've reached your [wardrobe / trip / outfit day] limit"
Guest: X  ·  Free: Y  ·  Pro: ∞

[Continue with Google]
[Continue with Email OTP]
```
Login triggers automatic data migration then closes the modal.

**For free-tier users (hitting a limit):**
```
"Unlock unlimited [items / trips / days]"

[Go Pro →]   (→ Stripe checkout)
```

**Heading copy by limit type:**
- Wardrobe limit → "You've reached your wardrobe limit"
- Trip limit → "Save your trip & plan more"
- Outfit day limit → "Unlock full trip planning"

**`AuthPage.jsx`** is repurposed: no longer a fullscreen gate; becomes the auth form content rendered *inside* `UpgradePrompt`. Same Google OAuth + Email OTP logic, smaller form factor.

### Limit indicators (non-blocking, always visible)

- **Wardrobe tab hero:** "8 / 10 items" for guests, "42 / 50 items" for free users
- **Trip tab header:** "2 / 3 trips" chip for free users; hidden for pro
- **Outfit day planner:** Days beyond the guest limit (day 4+) shown with a lock overlay; clicking a locked day opens UpgradePrompt

### Trip switcher

In the TripTab header: a dropdown (or horizontal chip row for ≤3 trips) showing all trip names. Switching trips updates `activeTripId`, which cascades to `useOutfits`, OutfitsTab, PackTab, CapsuleTab.

**"+ New Trip" button:** opens `TripCreator` modal. Disabled with tooltip "Upgrade to add more trips" when at limit — clicking opens UpgradePrompt instead.

### `TripCreator` modal (new)

```
Trip name:     [ Paris Summer 2026     ]
Start date:    [ 2026-07-10            ]
End date:      [ 2026-07-18            ]

Days are created as stubs. Add city and activity
details in the Trip tab after creating.

               [ Create Trip ]
```

### Day editing (inline in TripTab)

Existing read-only day cards become editable. Each day card has an edit icon → inline form for city, day activity, evening activity, occasion, weather, emoji. Saves immediately via `updateTripDay`.

---

## 6. Data Persistence Summary

| Data | Guest storage | Logged-in storage |
|---|---|---|
| Trips | `vesti_guest_<guestId>_trips` (localStorage) | `profiles.trips_data` (Supabase JSONB) |
| Outfits (trip-scoped) | `vesti_guest_<guestId>_outfits` (localStorage) | `profiles.outfits_data` (Supabase JSONB) |
| Frozen days | Inside outfits payload | Inside outfits payload |
| Capsule | `vesti_guest_<guestId>_capsule` (localStorage) | `profiles.capsule_ids` (Supabase array) |
| Active trip | `vesti_guest_<guestId>_active_trip` (localStorage) | `vesti_<userId>_active_trip` (localStorage) |
| guestId | `vesti_guest_id` (localStorage) | Cleared after migration |

---

## 7. Supabase Schema Changes

```sql
-- New columns on profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trips_data    JSONB DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wardrobe_items JSONB DEFAULT '[]';

-- outfits_data already exists — format extended to trip-keyed (backward-compatible migration in app)
-- capsule_ids already exists — no change
```

No new tables. All data lives in `profiles` alongside existing columns.

---

## 8. Files Changed

### New files
| File | Purpose |
|---|---|
| `src/hooks/useGuestSession.js` | guestId UUID lifecycle |
| `src/hooks/useTripStore.js` | Multi-trip CRUD + persistence |
| `src/utils/guestMigration.js` | Atomic guest→user data migration |
| `src/components/UpgradePrompt.jsx` | Context-aware limit modal |
| `src/components/TripCreator.jsx` | Create/name new trip modal |

### Modified files
| File | Change |
|---|---|
| `src/contexts/AuthContext.jsx` | Add guestId, isGuest, tier, limits; call guestMigration on login |
| `src/hooks/useOutfits.js` | Accept tripId param; trip-scope all reads/writes |
| `src/hooks/useCapsule.js` | Guest-aware (use guestId key when no userId) |
| `src/hooks/useWardrobe.js` | Enforce wardrobe item limit by tier |
| `src/App.jsx` | Remove fullscreen auth gate; pass activeTripId to useOutfits |
| `src/components/AuthPage.jsx` | Repurpose as inline auth form for UpgradePrompt |
| `src/components/ProfileTab.jsx` | Replace usePlan with useTier |
| `src/components/TripTab.jsx` | Add trip switcher, inline day editing, TripCreator trigger |
| `src/components/OutfitsTab.jsx` | Consume trip-scoped outfits; lock days beyond guest limit |
| `src/components/PackTab.jsx` | Filter packing list to activeTrip frozen days |
| `src/data/trip.js` | Kept as seed data only; not imported directly by components |

---

## 9. Out of Scope

- Sharing trips between users
- Trip templates / AI trip generation
- Offline-first PWA caching beyond localStorage
- Multi-device sync for guests (guests are localStorage-only by design)
