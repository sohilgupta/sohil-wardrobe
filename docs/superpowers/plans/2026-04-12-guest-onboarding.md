# Guest Onboarding — Empty Wardrobe Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blank empty-wardrobe state for guests with a guided onboarding experience: hero copy, static demo preview, "Try demo →" that loads real data and navigates to Daily, a subtle DEMO header badge, and a behavior-triggered save CTA.

**Architecture:** A new `GuestLanding` component swaps into `WardrobeTab`'s hero slot (add-item modal stays mounted outside the swap). A `demoData.js` utility writes 12 items + Australia trip + 3 pre-built outfit days to guest localStorage, then dispatches `vesti-demo-loaded` so existing hooks re-read without architectural change. Demo mode is tracked by a single `isDemoMode` boolean in `AuthenticatedApp`, passed as a prop where needed.

**Tech Stack:** React 19, Vite, Supabase JS v2, localStorage, Vitest

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `src/utils/demoData.js` | 12 demo items, 3-day outfits, `loadDemo()`, `clearDemo()`, constants |
| `src/components/GuestLanding.jsx` | Onboarding hero for empty guest wardrobe |
| `tests/demoData.test.js` | Tests for `loadDemo()` / `clearDemo()` localStorage side-effects |

### Modified files
| File | Change |
|---|---|
| `src/App.jsx` | `isDemoMode` state, DEMO badge in header, `handleTryDemo`, `handleClearDemo`, new props to children |
| `src/components/WardrobeTab.jsx` | Accept `isDemoMode` + `onTryDemo` props; swap hero for `GuestLanding` when empty guest |
| `src/hooks/useWardrobe.js` | Listen for `vesti-demo-loaded` / `vesti-demo-cleared` → call `sync()` |
| `src/hooks/useTripStore.js` | Listen for `vesti-demo-loaded` / `vesti-demo-cleared` → reload trips |
| `src/components/OutfitsTab.jsx` | `saveCtaVisible` state + 4 behavior triggers + animated Save CTA card |

---

## Task 1: `src/utils/demoData.js` — demo items, outfits, load/clear helpers

**Files:**
- Create: `src/utils/demoData.js`
- Create: `tests/demoData.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/demoData.test.js
import { describe, it, expect, beforeEach, vi } from "vitest";

// Minimal localStorage mock (jsdom provides it; just spy on key calls)
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// Import after clearing so module constants are stable
let loadDemo, clearDemo, DEMO_ITEMS, DEMO_TRIP_ID;
beforeEach(async () => {
  const m = await import("../src/utils/demoData.js");
  loadDemo    = m.loadDemo;
  clearDemo   = m.clearDemo;
  DEMO_ITEMS  = m.DEMO_ITEMS;
  DEMO_TRIP_ID = m.DEMO_TRIP_ID;
});

describe("DEMO_ITEMS", () => {
  it("exports exactly 12 items", () => expect(DEMO_ITEMS).toHaveLength(12));
  it("every item has _demo: true", () =>
    DEMO_ITEMS.forEach((i) => expect(i._demo).toBe(true)));
  it("every item has a stable string id", () =>
    DEMO_ITEMS.forEach((i) => expect(typeof i.id).toBe("string")));
  it("layers cover Base, Mid, Outer, Bottom, Footwear", () => {
    const layers = new Set(DEMO_ITEMS.map((i) => i.l));
    ["Base", "Mid", "Outer", "Bottom", "Footwear"].forEach((l) =>
      expect(layers.has(l)).toBe(true));
  });
});

describe("loadDemo", () => {
  it("writes 12 items to guest wardrobe key", () => {
    loadDemo("test-guest-id");
    const raw = JSON.parse(localStorage.getItem("vesti_guest_test-guest-id_wardrobe"));
    expect(raw).toHaveLength(12);
  });
  it("writes demo trip to guest trips key", () => {
    loadDemo("test-guest-id");
    const raw = JSON.parse(localStorage.getItem("vesti_guest_test-guest-id_trips"));
    expect(raw).toHaveLength(1);
    expect(raw[0].id).toBe(DEMO_TRIP_ID);
  });
  it("writes pre-built outfits to correct key", () => {
    loadDemo("test-guest-id");
    const key = `vesti_outfits_${DEMO_TRIP_ID}_v1`;
    const raw = JSON.parse(localStorage.getItem(key));
    expect(raw.outfitIds).toBeDefined();
    expect(Object.keys(raw.outfitIds)).toHaveLength(3); // d01–d03
  });
  it("sets demo mode flag", () => {
    loadDemo("test-guest-id");
    expect(localStorage.getItem("vesti_guest_test-guest-id_demo_mode")).toBe("1");
  });
});

describe("clearDemo", () => {
  it("removes all demo keys", () => {
    loadDemo("test-guest-id");
    clearDemo("test-guest-id");
    expect(localStorage.getItem("vesti_guest_test-guest-id_wardrobe")).toBeNull();
    expect(localStorage.getItem("vesti_guest_test-guest-id_trips")).toBeNull();
    expect(localStorage.getItem(`vesti_outfits_${DEMO_TRIP_ID}_v1`)).toBeNull();
    expect(localStorage.getItem("vesti_guest_test-guest-id_demo_mode")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd /Users/sohilgupta/Documents/sohil-wardrobe
npm test -- tests/demoData.test.js
```
Expected: `Cannot find module '../src/utils/demoData.js'`

- [ ] **Step 3: Create `src/utils/demoData.js`**

```js
// src/utils/demoData.js
/* ─── Demo Mode — data and helpers ────────────────────────────────────────────
   Loads a pre-built wardrobe, trip, and 3 outfit days into guest localStorage
   so first-time visitors can explore the full app without adding items.
   ─────────────────────────────────────────────────────────────────────────── */

import SEED_TRIP from "../data/trip";

export const DEMO_TRIP_ID = "trip_aus_nz_2026";

/* ── 12 demo wardrobe items ─────────────────────────────────────────────── */
export const DEMO_ITEMS = [
  // Base layers (3)
  { id: "demo_base_01", n: "White Linen Shirt",     c: "Shirts",   col: "White",     b: "Demo", l: "Base",     occ: "Casual", w: "Warm", t: "Yes", img: "", _demo: true },
  { id: "demo_base_02", n: "Black Merino Tee",      c: "Shirts",   col: "Black",     b: "Demo", l: "Base",     occ: "Casual", w: "Mild", t: "Yes", img: "", _demo: true },
  { id: "demo_base_03", n: "Cream Knit Sweater",    c: "Knitwear", col: "Cream",     b: "Demo", l: "Base",     occ: "Casual", w: "Mild", t: "Yes", img: "", _demo: true },
  // Mid layer (1)
  { id: "demo_mid_01",  n: "Grey Cashmere Roll-Neck", c: "Knitwear", col: "Grey",    b: "Demo", l: "Mid",      occ: "Casual", w: "Cold", t: "Yes", img: "", _demo: true },
  // Outer layers (2)
  { id: "demo_outer_01", n: "Black Bomber Jacket",  c: "Jackets",  col: "Black",     b: "Demo", l: "Outer",    occ: "Casual", w: "Mild", t: "Yes", img: "", _demo: true },
  { id: "demo_outer_02", n: "Navy Trench Coat",     c: "Jackets",  col: "Navy Blue", b: "Demo", l: "Outer",    occ: "Dinner", w: "Cold", t: "Yes", img: "", _demo: true },
  // Bottoms (3)
  { id: "demo_bottom_01", n: "Navy Slim Trousers",  c: "Trousers", col: "Navy Blue", b: "Demo", l: "Bottom",   occ: "Dinner", w: "Mild", t: "Yes", img: "", _demo: true },
  { id: "demo_bottom_02", n: "Khaki Chinos",        c: "Trousers", col: "Khaki",     b: "Demo", l: "Bottom",   occ: "Casual", w: "Warm", t: "Yes", img: "", _demo: true },
  { id: "demo_bottom_03", n: "Black Slim Jeans",    c: "Jeans",    col: "Black",     b: "Demo", l: "Bottom",   occ: "Casual", w: "Mild", t: "Yes", img: "", _demo: true },
  // Footwear (3)
  { id: "demo_shoes_01", n: "White Leather Sneakers", c: "Footwear", col: "White",   b: "Demo", l: "Footwear", occ: "Casual", w: "Warm", t: "Yes", img: "", _demo: true },
  { id: "demo_shoes_02", n: "Brown Leather Boots",  c: "Footwear", col: "Brown",     b: "Demo", l: "Footwear", occ: "Dinner", w: "Cold", t: "Yes", img: "", _demo: true },
  { id: "demo_shoes_03", n: "Black Derby Shoes",    c: "Footwear", col: "Black",     b: "Demo", l: "Footwear", occ: "Formal", w: "Mild", t: "Yes", img: "", _demo: true },
];

/* ── 3-day pre-built outfits (references DEMO_ITEMS ids) ───────────────── */
const DEMO_OUTFITS = {
  d01: {
    daytime: { base: "demo_base_01", bottom: "demo_bottom_02", shoes: "demo_shoes_01" },
    evening: { base: "demo_base_02", bottom: "demo_bottom_01", shoes: "demo_shoes_02" },
  },
  d02: {
    daytime: { base: "demo_base_03", bottom: "demo_bottom_03", shoes: "demo_shoes_01" },
    evening: { base: "demo_base_02", mid: "demo_mid_01", bottom: "demo_bottom_01", shoes: "demo_shoes_02" },
  },
  d03: {
    daytime: { base: "demo_base_02", outer: "demo_outer_01", bottom: "demo_bottom_03", shoes: "demo_shoes_01" },
    evening: { base: "demo_base_01", outer: "demo_outer_02", bottom: "demo_bottom_01", shoes: "demo_shoes_03" },
  },
};

/* ── Demo trip (wraps the existing static Australia trip) ───────────────── */
const DEMO_TRIP = {
  id:          DEMO_TRIP_ID,
  name:        "Australia & NZ 2026",
  destination: "Sydney, Melbourne, Queenstown",
  createdAt:   "2026-04-01T00:00:00Z",
  days:        SEED_TRIP,
};

/* ── localStorage key helpers ───────────────────────────────────────────── */
function wardrobeKey(guestId) { return `vesti_guest_${guestId}_wardrobe`; }
function tripsKey(guestId)    { return `vesti_guest_${guestId}_trips`; }
function outfitKey()          { return `vesti_outfits_${DEMO_TRIP_ID}_v1`; }
function demoFlagKey(guestId) { return `vesti_guest_${guestId}_demo_mode`; }

function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Write all demo data to guest localStorage and signal hooks to reload.
 * Call setTab("daily") after this to navigate the user.
 */
export function loadDemo(guestId) {
  if (!guestId) return;
  save(wardrobeKey(guestId), DEMO_ITEMS);
  save(tripsKey(guestId), [DEMO_TRIP]);
  save(outfitKey(), { outfitIds: DEMO_OUTFITS, frozenDays: {}, updatedAt: {} });
  localStorage.setItem(demoFlagKey(guestId), "1");
  window.dispatchEvent(new CustomEvent("vesti-demo-loaded", { detail: { guestId } }));
}

/**
 * Remove all demo data from guest localStorage and signal hooks to reset.
 * Call setTab("wardrobe") after this to return the user to the landing.
 */
export function clearDemo(guestId) {
  if (!guestId) return;
  localStorage.removeItem(wardrobeKey(guestId));
  localStorage.removeItem(tripsKey(guestId));
  localStorage.removeItem(outfitKey());
  localStorage.removeItem(demoFlagKey(guestId));
  window.dispatchEvent(new CustomEvent("vesti-demo-cleared", { detail: { guestId } }));
}

/** Returns true if demo mode is currently active for this guest. */
export function isDemoActive(guestId) {
  return !!guestId && localStorage.getItem(demoFlagKey(guestId)) === "1";
}
```

- [ ] **Step 4: Run tests — confirm they all pass**

```bash
npm test -- tests/demoData.test.js
```
Expected: 9 tests, all pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/demoData.js tests/demoData.test.js
git commit -m "feat: demoData — 12 demo items, Australia trip, 3-day outfits, loadDemo/clearDemo helpers"
```

---

## Task 2: `src/components/GuestLanding.jsx` — onboarding hero component

**Files:**
- Create: `src/components/GuestLanding.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/GuestLanding.jsx
/* ─── GuestLanding ────────────────────────────────────────────────────────────
   Shown in WardrobeTab when: isGuest && wardrobe.length === 0 && !isDemoMode
   Props: onAddItem (opens add form), onTryDemo (loads demo + navigates)
   ─────────────────────────────────────────────────────────────────────────── */

import { T } from "../theme";
import { LIMITS } from "../utils/tiers";

/* ── Static demo preview data (decorative only) ─────────────────────────── */
const PREVIEW_DAYS = [
  {
    city:    "Day 1 · Sydney",
    swatches: ["#F0EBE1", "#1B2A4A", "#BDB592", "#7B4F2E"],
    occ:     "Casual",
    weather: "Warm",
    occColor:  ["rgba(10,132,255,0.15)", "#60A5FA", "rgba(10,132,255,0.25)"],
    wColor:    ["rgba(251,191,36,0.1)",  "#FBBF24", "rgba(251,191,36,0.25)"],
  },
  {
    city:    "Day 2 · Melbourne",
    swatches: ["#1C1C1C", "#374151", "#C19A6B", "#4A2C17"],
    occ:     "Dinner",
    weather: "Mild",
    occColor:  ["rgba(10,132,255,0.15)", "#60A5FA", "rgba(10,132,255,0.25)"],
    wColor:    ["rgba(74,222,128,0.1)",  "#4ADE80", "rgba(74,222,128,0.25)"],
  },
];

function Chip({ label, bg, color, border }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
      background: bg, color, border: `1px solid ${border}`, display: "inline-block" }}>
      {label}
    </span>
  );
}

export default function GuestLanding({ onAddItem, onTryDemo }) {
  return (
    <div style={{ animation: "fadeUp 0.4s ease both" }}>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
        textTransform: "uppercase", color: T.accent, marginBottom: 8 }}>
        Your Wardrobe
      </p>
      <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.8,
        color: T.text, lineHeight: 1.1, marginBottom: 10 }}>
        Plan outfits from<br />your wardrobe
      </p>
      <p style={{ fontSize: 14, color: T.mid, lineHeight: 1.6, marginBottom: 22 }}>
        Add a few items — Vesti builds your outfits automatically.
      </p>

      {/* ── CTAs ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 32 }}>
        <button onClick={onAddItem}
          style={{ flex: 1, background: T.accent, color: "#fff", border: "none",
            borderRadius: 12, padding: "12px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + Add your first item
        </button>
        <button onClick={onTryDemo}
          style={{ flex: 1, background: "transparent", color: T.accent,
            border: `1.5px solid rgba(10,132,255,0.35)`, borderRadius: 12,
            padding: "12px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Try demo →
        </button>
      </div>

      {/* ── Demo preview ─────────────────────────────────────────────────── */}
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
        textTransform: "uppercase", color: T.light, marginBottom: 10 }}>
        Demo preview
      </p>

      {/* 2-column day cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        {PREVIEW_DAYS.map((d) => (
          <div key={d.city} style={{ background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 12, padding: 12 }}>
            <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em",
              textTransform: "uppercase", color: T.light, marginBottom: 8 }}>
              {d.city}
            </p>
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              {d.swatches.map((hex) => (
                <div key={hex} style={{ width: 22, height: 22, borderRadius: 4, background: hex }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <Chip label={d.occ} bg={d.occColor[0]} color={d.occColor[1]} border={d.occColor[2]} />
              <Chip label={d.weather} bg={d.wColor[0]} color={d.wColor[1]} border={d.wColor[2]} />
            </div>
          </div>
        ))}
      </div>

      {/* Outfit strip */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 12, padding: 12, display: "flex", alignItems: "center",
        gap: 10, marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {["#1C1C1C", "#1B2A4A", "#4A2C17"].map((hex) => (
            <div key={hex} style={{ width: 20, height: 28, borderRadius: 4, background: hex }} />
          ))}
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: T.text, marginBottom: 2 }}>
            Evening · Day 3 · Queenstown
          </p>
          <p style={{ fontSize: 10, color: T.mid }}>
            Black top · Navy trousers · Brown boots
          </p>
        </div>
      </div>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
        textTransform: "uppercase", color: T.light, marginBottom: 10 }}>
        How it works
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { icon: "👔", label: "Add\nclothes" },
          { icon: "✈️", label: "Plan\ntrip" },
          { icon: "✨", label: "AI\noutfits" },
        ].map((s) => (
          <div key={s.label} style={{ flex: 1, textAlign: "center",
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 12, padding: "10px 6px" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 10, color: T.mid, lineHeight: 1.4,
              whiteSpace: "pre-line" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Limit hint ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8,
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 10, padding: "8px 12px" }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%",
          background: T.green, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: T.light }}>
          Free · {LIMITS.guest.wardrobe} items · {LIMITS.guest.trips} trip · No account needed
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to confirm no syntax errors**

```bash
cd /Users/sohilgupta/Documents/sohil-wardrobe && npm run build 2>&1 | grep -iE "error" | head -10
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/GuestLanding.jsx
git commit -m "feat: GuestLanding — onboarding hero, demo preview cards, how-it-works, limit hint"
```

---

## Task 3: `src/App.jsx` — `isDemoMode` state, DEMO badge, handlers, prop threading

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Read the file**

```bash
cat src/App.jsx
```

- [ ] **Step 2: Add import for `demoData` helpers at top of file**

Find the existing import block at the top of `src/App.jsx`. Add after the existing imports:

```js
import { loadDemo, clearDemo, isDemoActive } from "./utils/demoData";
```

- [ ] **Step 3: Add `isDemoMode` state and demo handlers to `AuthenticatedApp`**

Find this line inside `AuthenticatedApp`:
```js
const { isPro, tier, isGuest } = useTier();
```

Add after it:
```js
const { guestId } = useAuth();

// Demo mode: read from localStorage on mount, update on demo events
const [isDemoMode, setIsDemoMode] = React.useState(() =>
  isDemoActive(guestId)
);

// Keep isDemoMode in sync when demo loads/clears (even from another tab)
React.useEffect(() => {
  function onDemoLoaded() { setIsDemoMode(true); }
  function onDemoCleared() { setIsDemoMode(false); }
  window.addEventListener("vesti-demo-loaded",  onDemoLoaded);
  window.addEventListener("vesti-demo-cleared", onDemoCleared);
  return () => {
    window.removeEventListener("vesti-demo-loaded",  onDemoLoaded);
    window.removeEventListener("vesti-demo-cleared", onDemoCleared);
  };
}, []);

function handleTryDemo() {
  if (guestId) {
    loadDemo(guestId);
    setTab("daily");
  }
}

function handleClearDemo() {
  if (guestId) {
    clearDemo(guestId);
    setTab("wardrobe");
  }
}
```

> **Note:** `React` must be imported. Add `import React from "react";` at the top if not already present, or use named imports (`useState`, `useEffect`) from the existing `import { useState } from "react"` — just add them to that import.

- [ ] **Step 4: Add DEMO badge in the header wordmark area**

Find the header wordmark block:
```jsx
{isPro && (
  <span style={{ fontSize: 9, color: T.accent, letterSpacing: 1.5, fontWeight: 700, background: T.accentDim, border: `1px solid ${T.accentBorder}`, padding: "2px 7px", borderRadius: 20 }}>
    PRO
  </span>
)}
```

Add the DEMO badge immediately after it:
```jsx
{isGuest && isDemoMode && (
  <span
    onClick={handleClearDemo}
    title="You're in demo mode — click to clear"
    style={{
      fontSize: 8, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
      color: "#FBBF24",
      background: "rgba(251,191,36,0.12)",
      border: "1px solid rgba(251,191,36,0.25)",
      borderRadius: 20, padding: "2px 7px",
    }}
  >
    DEMO
  </span>
)}
```

- [ ] **Step 5: Add `slideUpFade` keyframe to the global `<style>` block**

Find the `<style>` block inside `AuthenticatedApp`'s return. It already has `@keyframes slideUp` and `@keyframes fadeUp`. Add after them:

```
@keyframes slideUpFade{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
```

- [ ] **Step 6: Pass `isDemoMode` and `onTryDemo` to `WardrobeTab`**

Find where `<WardrobeTab` is rendered in the content section. Add two props:

```jsx
<WardrobeTab
  wardrobe={wardrobe}
  loading={wLoading}
  syncStatus={syncStatus}
  lastSync={lastSync}
  onSync={sync}
  onEdit={editItem}
  onDelete={deleteItem}
  onAdd={addItem}
  capsuleIds={capsuleIds}
  onToggleCapsule={toggleCapsule}
  isDemoMode={isDemoMode}
  onTryDemo={handleTryDemo}
/>
```

- [ ] **Step 7: Pass `isDemoMode` to `OutfitsTab`**

Find where `<OutfitsTab` is rendered. Add:
```jsx
isDemoMode={isDemoMode}
```

- [ ] **Step 8: Build and verify**

```bash
npm run build 2>&1 | grep -iE "error" | head -10
```
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/App.jsx
git commit -m "feat: App — isDemoMode state, DEMO header badge, handleTryDemo/handleClearDemo, slideUpFade keyframe"
```

---

## Task 4: `src/components/WardrobeTab.jsx` — conditional `GuestLanding` swap

**Files:**
- Modify: `src/components/WardrobeTab.jsx`

- [ ] **Step 1: Read the file**

```bash
head -100 src/components/WardrobeTab.jsx
```

- [ ] **Step 2: Add imports for `GuestLanding` and `useAuth`**

Find the import block at the top. Add:

```js
import GuestLanding from "./GuestLanding";
import { useAuth } from "../contexts/AuthContext";
```

- [ ] **Step 3: Add new props to the function signature**

Find:
```js
export default function WardrobeTab({
  wardrobe = [],
  onEdit,
  onDelete,
  onAdd,
  loading,
  syncStatus,
  lastSync,
  onSync,
}) {
```

Replace with:
```js
export default function WardrobeTab({
  wardrobe = [],
  onEdit,
  onDelete,
  onAdd,
  loading,
  syncStatus,
  lastSync,
  onSync,
  isDemoMode = false,
  onTryDemo,
}) {
```

- [ ] **Step 4: Read `isGuest` inside the component**

After the existing `const { limits, isPro } = useTier();` line, add:

```js
const { isGuest } = useAuth();
const showLanding = isGuest && wardrobe.length === 0 && !isDemoMode;
```

- [ ] **Step 5: Swap the hero section for `GuestLanding` when empty guest**

Find the hero block that starts with:
```jsx
{/* ── Apple Marketing Hero ── */}
<div style={{ marginBottom: 28 }}>
```

Replace the entire hero `<div>` (through its closing tag, just before the search+sync row) with:

```jsx
{/* ── Hero / Guest Landing ── */}
{showLanding ? (
  <GuestLanding
    onAddItem={() => setAdding(true)}
    onTryDemo={onTryDemo}
  />
) : (
  <div style={{ marginBottom: 28 }}>
    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: T.accent, marginBottom: 6 }}>
      Your Collection
    </p>
    <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.8, color: T.text, lineHeight: 1.1, marginBottom: 6 }}>
      {wardrobe.length} Pieces.
      {!isPro && (
        <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 8 }}>
          ({wardrobe.length}/{limits.wardrobe === Infinity ? "∞" : limits.wardrobe})
        </span>
      )}
    </p>
    <p style={{ fontSize: 14, color: T.mid, fontWeight: 400 }}>
      {wardrobe.filter(i => i.t === "Yes").length} travel-ready · {[...new Set(wardrobe.map(i => i.c))].length} categories
    </p>
  </div>
)}
```

- [ ] **Step 6: Hide search/filters/grid when `showLanding` is true**

Find the search+sync row (starts with `{/* ── Search + sync ── */}`). Wrap from that comment through the end of the item grid in:

```jsx
{!showLanding && (
  <>
    {/* ── Search + sync ── */}
    ...existing search, filters, and grid JSX...
  </>
)}
```

The add-item modal (`{adding && ...}`) must remain OUTSIDE this conditional so it still renders when `GuestLanding` triggers `setAdding(true)`.

- [ ] **Step 7: Build and verify**

```bash
npm run build 2>&1 | grep -iE "error" | head -10
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/WardrobeTab.jsx
git commit -m "feat: WardrobeTab — swap hero for GuestLanding when empty guest, hide filters/grid"
```

---

## Task 5: Hook listeners — re-read demo data on `vesti-demo-loaded` / `vesti-demo-cleared`

**Files:**
- Modify: `src/hooks/useWardrobe.js`
- Modify: `src/hooks/useTripStore.js`

> **Note:** `useOutfits` does NOT need a listener — it already watches `activeTripId` from `useTripStore`. When `useTripStore` reloads and sets `activeTripId` to `"trip_aus_nz_2026"`, `useOutfits` re-reads automatically.

- [ ] **Step 1: Add demo event listeners to `useWardrobe`**

In `src/hooks/useWardrobe.js`, find the existing `useEffect` that starts polling (`POLL_MS`). Add a new `useEffect` after it (before the `return` at the bottom of the hook body):

```js
/* ── Reload on demo load/clear ── */
useEffect(() => {
  const handler = () => sync();
  window.addEventListener("vesti-demo-loaded",  handler);
  window.addEventListener("vesti-demo-cleared", handler);
  return () => {
    window.removeEventListener("vesti-demo-loaded",  handler);
    window.removeEventListener("vesti-demo-cleared", handler);
  };
}, [sync]);
```

- [ ] **Step 2: Add demo event listeners to `useTripStore`**

In `src/hooks/useTripStore.js`, there is already a `useEffect` that listens for `"vesti-data-migrated"`. Add a new `useEffect` after it (before the `/* ── API ──` comment):

```js
/* ── Reload on demo load/clear ── */
useEffect(() => {
  async function reload() {
    if (localKey) {
      // Guest: re-read from the guest trips localStorage key
      const local = readLocalTrips(localKey);
      setTrips(local);
      setActiveTripId(local[0]?.id || null);
    }
  }
  window.addEventListener("vesti-demo-loaded",  reload);
  window.addEventListener("vesti-demo-cleared", reload);
  return () => {
    window.removeEventListener("vesti-demo-loaded",  reload);
    window.removeEventListener("vesti-demo-cleared", reload);
  };
}, [localKey]);
```

- [ ] **Step 3: Build and verify**

```bash
npm run build 2>&1 | grep -iE "error" | head -10
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useWardrobe.js src/hooks/useTripStore.js
git commit -m "feat: useWardrobe + useTripStore — reload on vesti-demo-loaded/cleared events"
```

---

## Task 6: `src/components/OutfitsTab.jsx` — Save CTA + behavior triggers

**Files:**
- Modify: `src/components/OutfitsTab.jsx`

- [ ] **Step 1: Read the file top to understand props**

```bash
grep -n "export default function\|isDemoMode\|isGuest\|saveCtaVisible\|onTryDemo" src/components/OutfitsTab.jsx | head -20
```

- [ ] **Step 2: Add `isDemoMode` prop to the `OutfitsTab` function signature**

Find the `OutfitsTab` function signature (it's a large destructured props list). Add `isDemoMode = false` to it:

```js
export default function OutfitsTab({
  // ... existing props ...
  isDemoMode = false,
}) {
```

- [ ] **Step 3: Add `isGuest` and `saveCtaVisible` state inside the component**

After the existing hook calls at the top of `OutfitsTab`, add:

```js
const { isGuest } = useTier();  // useTier is already imported
const [saveCtaVisible, setSaveCtaVisible] = useState(false);

function triggerSaveCta() {
  setSaveCtaVisible(true);
}
```

- [ ] **Step 4: Add the 22-second timer trigger**

After the `triggerSaveCta` function, add:

```js
// Timer trigger: 22s after entering demo mode
useEffect(() => {
  if (!isDemoMode || !isGuest) return;
  const t = setTimeout(triggerSaveCta, 22000);
  return () => clearTimeout(t);
}, [isDemoMode, isGuest]);
```

- [ ] **Step 5: Add regen trigger**

Find the regen/regenerate handler inside `OutfitsTab`. It will be something like `handleRegen` or a function called when the ↺ button is clicked. Add `triggerSaveCta()` as the first line inside that handler:

```js
function handleRegen(slot, ...) {
  if (isDemoMode && isGuest) triggerSaveCta();
  // ... existing regen logic ...
}
```

If regen is inline (an arrow passed to a child), extract it or add the call before the existing logic.

- [ ] **Step 6: Add day-navigation trigger**

Find where `setSelectedDay` is called (the function that changes the active day). This is called when the user clicks a day in the list. Add the trigger call:

```js
// Before or after the existing setSelectedDay call:
if (isDemoMode && isGuest && idx >= 1) triggerSaveCta();
setSelectedDay(day.id);
```

`idx` is the map index when rendering the day list. Ensure you have access to it at the call site (it's already used for `isLocked` logic in the desktop day list).

- [ ] **Step 7: Add item-click trigger**

Find where outfit card items are clicked (the `OutfitCard` or item swatch onClick handlers). Add a wrapper call:

```js
// In the outfit card click / item card onClick, before existing logic:
if (isDemoMode && isGuest) triggerSaveCta();
```

If the click goes through `OutfitCard`'s `onItemClick` prop, add the trigger in the `OutfitsTab` function that creates/handles that callback.

- [ ] **Step 8: Add the Save CTA card JSX**

Find the bottom of the Daily tab's main content area — after the last outfit slot card, before any closing `</div>` tags. Add:

```jsx
{/* ── Save CTA — demo mode, behavior-triggered ── */}
{isGuest && isDemoMode && saveCtaVisible && (
  <div
    style={{
      marginTop: 16,
      background: T.surface,
      border: "1px solid rgba(10,132,255,0.22)",
      borderRadius: 12,
      padding: "16px 16px",
      animation: "slideUpFade 0.35s cubic-bezier(0.16,1,0.3,1) both",
    }}
  >
    <p style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>
      Your trip is ready to save
    </p>
    <p style={{ fontSize: 12, color: T.mid, marginBottom: 14, lineHeight: 1.6 }}>
      Sign in to keep it across devices
    </p>
    <button
      onClick={async () => {
        const { createClient } = await import("@supabase/supabase-js");
        const { supabase } = await import("../lib/supabase");
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: window.location.origin },
        });
      }}
      style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        gap: 10, background: "#fff", color: "#1a1a1a",
        border: "none", borderRadius: 10, padding: "11px 0",
        fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 10,
      }}
    >
      {/* Google G icon */}
      <svg width="16" height="16" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.5-1.45-.79-3-.79-4.59s.29-3.14.79-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      </svg>
      Continue with Google
    </button>
    <p style={{ fontSize: 11, color: T.light, textAlign: "center" }}>
      Free forever · No credit card
    </p>
  </div>
)}
```

- [ ] **Step 9: Build and verify**

```bash
npm run build 2>&1 | grep -iE "error" | head -10
```
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/OutfitsTab.jsx
git commit -m "feat: OutfitsTab — behavior-triggered Save CTA with slideUpFade, 4 trigger conditions"
```

---

## Task 7: Full build, all tests, push

- [ ] **Step 1: Run all tests**

```bash
npm test 2>&1
```
Expected: all 6 test files pass (including new `demoData.test.js`).

- [ ] **Step 2: Full build**

```bash
npm run build 2>&1
```
Expected: ✓ built, no errors (chunk size warning is acceptable).

- [ ] **Step 3: Smoke test on localhost**

```bash
npm run dev
```
Visit `http://localhost:3000` **without being logged in**:
1. ✅ Wardrobe tab shows hero "Plan outfits from your wardrobe"
2. ✅ Filters, search, and item grid are hidden
3. ✅ Static demo preview cards visible
4. ✅ "+ Add your first item" opens the add-item form
5. ✅ "Try demo →" loads 12 items, navigates to Daily tab, shows DEMO badge in header
6. ✅ After 22 seconds (or regen / Day 2 click), Save CTA slides in with animation
7. ✅ Clicking DEMO badge in header clears demo and returns to landing

- [ ] **Step 4: Push**

```bash
git push origin main
```

---

## Self-Review Notes

- **Spec Section 1 (GuestLanding layout):** Covered by Task 2 with exact JSX.
- **Spec Section 2 (DEMO badge):** Covered by Task 3 Step 4.
- **Spec Section 3 (demo data, loadDemo, clearDemo):** Covered by Task 1 with tested code.
- **Spec Section 4 (Save CTA + animation + triggers):** Covered by Task 6 Steps 4–8.
- **Spec Section 5 (hook re-reads):** Covered by Task 5. useOutfits omitted intentionally — it reacts via activeTripId change.
- **Spec Section 6 (WardrobeTab swap):** Covered by Task 4. Add-item modal remains outside the conditional (Step 6 note).
- **Type consistency:** `loadDemo(guestId)` / `clearDemo(guestId)` / `isDemoActive(guestId)` all use the same signature throughout. `DEMO_TRIP_ID` is a single export referenced in both `demoData.js` and the clearDemo key — no duplication risk.
- **Key format verified:** `vesti_outfits_${DEMO_TRIP_ID}_v1` matches `lsKey(null, tripId)` in `useOutfits.js` exactly.
