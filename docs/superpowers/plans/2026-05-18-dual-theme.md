# Dual Theme (Light + Dark) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a parchment-toned light theme (default) and a refined dark theme to the Vesti wardrobe app, with a one-click toggle in the header that persists via localStorage.

**Architecture:** Convert `src/theme.js` so every token in `T` resolves to a CSS custom property (e.g. `T.bg = "var(--bg)"`). Define both palettes as CSS variables in a new `src/styles/themes.css`, scoped by `:root` (light) and `[data-theme="dark"]` on `<html>`. A small `useThemeMode` hook reads/writes `wdb_theme` localStorage and sets `document.documentElement.dataset.theme`. Theme flips happen via CSS cascade — zero React re-renders, all ~639 existing `T.*` call sites untouched.

**Tech Stack:** React 19, Vite, Vitest (jsdom), plain CSS variables. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-05-18-dual-theme-design.md](../specs/2026-05-18-dual-theme-design.md)

---

## File Structure

- **Create** `src/styles/themes.css` — CSS variable definitions for both palettes
- **Create** `src/hooks/useThemeMode.js` — toggle hook with localStorage persistence
- **Create** `src/hooks/useThemeMode.test.js` — unit tests for the hook
- **Modify** `src/theme.js` — replace static color values with `var(--*)` strings
- **Modify** `src/main.jsx` — import `themes.css`
- **Modify** `src/App.jsx` — add theme toggle button in header, use hook

---

## Task 1: Define CSS variable palettes

**Files:**
- Create: `src/styles/themes.css`

- [ ] **Step 1: Create the stylesheet**

```css
/* src/styles/themes.css
 * Design tokens for light (default) and dark themes.
 * Toggled via document.documentElement.dataset.theme = "dark" | "light".
 */

:root {
  /* Surfaces — parchment cream */
  --bg: #F5EFE4;
  --surface: #FAF5EA;
  --alt: #EDE6D6;
  --border: #D9CFB8;
  --border-light: #E5DCC6;

  /* Text — warm brown */
  --text: #3A2F22;
  --mid: #6B5E4A;
  --light: #9C8E76;

  /* Accent — warm rust (shared across themes for brand continuity) */
  --accent: #B5532A;
  --accent-dim: rgba(181, 83, 42, 0.10);
  --accent-border: rgba(181, 83, 42, 0.30);
  --green: #3F7A4A;

  /* Shadows */
  --shadow-card-hover: 0 12px 32px rgba(58, 47, 34, 0.18);

  /* Weather tuples [bg, fg] */
  --weather-cold-bg: #DDE7F2;  --weather-cold-fg: #2C4A6E;
  --weather-mild-bg: #DDEAD8;  --weather-mild-fg: #2F5A3A;
  --weather-warm-bg: #F3E1C8;  --weather-warm-fg: #7A4A1C;

  /* Occasion tuples [bg, fg] */
  --occ-casual-bg: #E5DECC;    --occ-casual-fg: #5A4E3A;
  --occ-dinner-bg: #F0DDE6;    --occ-dinner-fg: #7A2C5A;
  --occ-flight-bg: #DDE7F2;    --occ-flight-fg: #2C4A6E;
  --occ-hiking-bg: #DDEAD8;    --occ-hiking-fg: #2F5A3A;
  --occ-gym-bg:    #F3DEC8;    --occ-gym-fg:    #8A4318;
  --occ-formal-bg: #E0D5EC;    --occ-formal-fg: #4A2E7A;
  --occ-show-bg:   #E5D5EC;    --occ-show-fg:   #5A2E7A;
}

[data-theme="dark"] {
  --bg: #141210;
  --surface: #1C1A18;
  --alt: #26241F;
  --border: #34322C;
  --border-light: #2A2825;

  --text: #E8E6E1;
  --mid: #8A8780;
  --light: #5C5A55;

  --accent: #B5532A;
  --accent-dim: rgba(181, 83, 42, 0.16);
  --accent-border: rgba(181, 83, 42, 0.32);
  --green: #4ADE80;

  --shadow-card-hover: 0 12px 32px rgba(0, 0, 0, 0.5);

  --weather-cold-bg: #1E3A5F;  --weather-cold-fg: #93C5FD;
  --weather-mild-bg: #14532D;  --weather-mild-fg: #4ADE80;
  --weather-warm-bg: #78350F;  --weather-warm-fg: #FBBF24;

  --occ-casual-bg: #27272A;    --occ-casual-fg: #A1A1AA;
  --occ-dinner-bg: #4A1942;    --occ-dinner-fg: #F9A8D4;
  --occ-flight-bg: #1E3A5F;    --occ-flight-fg: #93C5FD;
  --occ-hiking-bg: #14532D;    --occ-hiking-fg: #4ADE80;
  --occ-gym-bg:    #431407;    --occ-gym-fg:    #FB923C;
  --occ-formal-bg: #2E1065;    --occ-formal-fg: #A78BFA;
  --occ-show-bg:   #3B1A5A;    --occ-show-fg:   #C084FC;
}

html, body {
  background: var(--bg);
  color: var(--text);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/themes.css
git commit -m "feat(theme): add light + dark CSS variable palettes"
```

---

## Task 2: Wire the stylesheet into the app

**Files:**
- Modify: `src/main.jsx`

- [ ] **Step 1: Import the stylesheet at app entry**

Replace the contents of `src/main.jsx` with:

```js
import { createRoot } from "react-dom/client";
import "./styles/themes.css";
import App from "./App";

createRoot(document.getElementById("root")).render(<App />);
```

- [ ] **Step 2: Verify the app still loads**

Run: `npm run dev`
Open the browser. Expected: app renders (will look broken-dark because `T.*` still returns dark hex values — that's fixed in Task 3). The CSS variables are now defined but unused.

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "feat(theme): import themes.css at app entry"
```

---

## Task 3: Convert `T` to CSS variable references

**Files:**
- Modify: `src/theme.js`

- [ ] **Step 1: Replace the `T` object's color values with `var(--*)` strings**

Open `src/theme.js`. Replace the `T` export (lines starting at `export const T = {` through the closing `};` before `SWATCHES`) with:

```js
/* ─── THEME TOKENS — resolve to CSS variables defined in styles/themes.css ──── */
export const T = {
  bg:           "var(--bg)",
  surface:      "var(--surface)",
  alt:          "var(--alt)",
  border:       "var(--border)",
  borderLight:  "var(--border-light)",
  text:         "var(--text)",
  mid:          "var(--mid)",
  light:        "var(--light)",
  green:        "var(--green)",
  accent:       "var(--accent)",
  accentDim:    "var(--accent-dim)",
  accentBorder: "var(--accent-border)",
  weather: {
    Cold: ["var(--weather-cold-bg)", "var(--weather-cold-fg)"],
    Mild: ["var(--weather-mild-bg)", "var(--weather-mild-fg)"],
    Warm: ["var(--weather-warm-bg)", "var(--weather-warm-fg)"],
  },
  occ: {
    Casual: ["var(--occ-casual-bg)", "var(--occ-casual-fg)"],
    Dinner: ["var(--occ-dinner-bg)", "var(--occ-dinner-fg)"],
    Flight: ["var(--occ-flight-bg)", "var(--occ-flight-fg)"],
    Hiking: ["var(--occ-hiking-bg)", "var(--occ-hiking-fg)"],
    Gym:    ["var(--occ-gym-bg)",    "var(--occ-gym-fg)"],
    Formal: ["var(--occ-formal-bg)", "var(--occ-formal-fg)"],
    Show:   ["var(--occ-show-bg)",   "var(--occ-show-fg)"],
  },
};
```

Leave `SWATCHES`, `swatch()`, `CAT_EMOJI`, and `driveImg()` untouched — those are real garment colors, not theme tokens.

- [ ] **Step 2: Verify in the browser**

Run: `npm run dev` (or refresh existing dev server).
Expected: app renders in the **light parchment palette**. All surfaces, text, badges, and accents resolve to the `:root` variables. Layout/structure unchanged.

Manually click through all tabs (Wardrobe, Capsule, Trip, Daily, Outfit AI, Packing, Profile) and modals. Note any spots that look broken — most likely candidates:
- Inline styles using hardcoded hex (e.g. the `#FBBF24` DEMO badge in App.jsx) — these are fine, leave them.
- The `.wardrobe-card:hover` shadow in `App.jsx:148` is hardcoded `rgba(0,0,0,0.5)` — too heavy for light mode. Fix in Task 6.

- [ ] **Step 3: Run unit tests**

Run: `npm test`
Expected: all existing tests pass. (Tests don't render colors, so they're unaffected.)

- [ ] **Step 4: Commit**

```bash
git add src/theme.js
git commit -m "feat(theme): convert T tokens to CSS variable references"
```

---

## Task 4: Create the `useThemeMode` hook with tests

**Files:**
- Create: `src/hooks/useThemeMode.js`
- Create: `src/hooks/useThemeMode.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useThemeMode.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useThemeMode from "./useThemeMode";

describe("useThemeMode", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to light when localStorage is empty", () => {
    const { result } = renderHook(() => useThemeMode());
    expect(result.current.mode).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("restores persisted dark mode from localStorage", () => {
    localStorage.setItem("wdb_theme", "dark");
    const { result } = renderHook(() => useThemeMode());
    expect(result.current.mode).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("toggle() flips light → dark and persists", () => {
    const { result } = renderHook(() => useThemeMode());
    act(() => result.current.toggle());
    expect(result.current.mode).toBe("dark");
    expect(localStorage.getItem("wdb_theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("toggle() flips dark → light and persists", () => {
    localStorage.setItem("wdb_theme", "dark");
    const { result } = renderHook(() => useThemeMode());
    act(() => result.current.toggle());
    expect(result.current.mode).toBe("light");
    expect(localStorage.getItem("wdb_theme")).toBe("light");
  });

  it("ignores invalid localStorage values and defaults to light", () => {
    localStorage.setItem("wdb_theme", "neon");
    const { result } = renderHook(() => useThemeMode());
    expect(result.current.mode).toBe("light");
  });
});
```

- [ ] **Step 2: Check whether @testing-library/react is installed**

Run: `grep -q "@testing-library/react" package.json && echo INSTALLED || echo MISSING`

If `MISSING`, install it as a dev dependency:

```bash
npm install --save-dev @testing-library/react
```

- [ ] **Step 3: Run the tests — verify they fail**

Run: `npm test -- src/hooks/useThemeMode.test.js`
Expected: FAIL — module `./useThemeMode` not found.

- [ ] **Step 4: Implement the hook**

Create `src/hooks/useThemeMode.js`:

```js
import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "wdb_theme";
const VALID = ["light", "dark"];

function readInitial() {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return VALID.includes(stored) ? stored : "light";
}

export default function useThemeMode() {
  const [mode, setMode] = useState(readInitial);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((m) => (m === "light" ? "dark" : "light"));
  }, []);

  return { mode, toggle };
}
```

- [ ] **Step 5: Run the tests — verify they pass**

Run: `npm test -- src/hooks/useThemeMode.test.js`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useThemeMode.js src/hooks/useThemeMode.test.js package.json package-lock.json
git commit -m "feat(theme): add useThemeMode hook with persistence"
```

---

## Task 5: Add theme toggle button to header

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Import the hook**

In `src/App.jsx`, add to the imports near the top (after the `useProfile` import on line 7):

```js
import useThemeMode from "./hooks/useThemeMode";
```

- [ ] **Step 2: Call the hook inside `AppInner`**

In `AppInner()` (starts at line 38), add this line immediately after `const { loading, signOut } = useAuth();`:

```js
  const { mode, toggle } = useThemeMode();
```

- [ ] **Step 3: Add the toggle button in the header**

In the header's right-side action group (the `<div style={{ display: "flex", gap: 12, alignItems: "center" }}>` starting around line 182), add the toggle button as the **first** child (before the wardrobe count div), so it sits left-most in the action cluster:

```jsx
              <button
                onClick={toggle}
                title={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
                aria-label="Toggle theme"
                style={{
                  background: "none",
                  border: `1px solid ${T.border}`,
                  borderRadius: "50%",
                  width: 30,
                  height: 30,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: T.mid,
                  fontSize: 14,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {mode === "light" ? "🌙" : "☀"}
              </button>
```

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`
- App loads in light mode by default.
- Click the moon icon in the top-right of the header → app flips to dark, icon becomes a sun.
- Refresh the page → still dark, icon still sun.
- Click the sun → back to light. Refresh → still light.
- Clear localStorage in DevTools → refresh → back to light default.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat(theme): add light/dark toggle button in header"
```

---

## Task 6: Theme-aware hover shadow and minor polish

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Replace the hardcoded card hover shadow with the new token**

In `src/App.jsx`, find the `<style>` block (around line 131-150). Locate this line (around line 148):

```css
        .wardrobe-card:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(0,0,0,0.5);}
```

Replace it with:

```css
        .wardrobe-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-card-hover);}
```

- [ ] **Step 2: Verify both themes**

Run: `npm run dev`
- In light mode, hover over a wardrobe card → soft warm-brown shadow.
- Toggle to dark → hover shows the heavier dark shadow.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(theme): use theme-aware shadow token for card hover"
```

---

## Task 7: Full visual sweep + final commit

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Manual sweep of every tab in both themes**

Run: `npm run dev`

For each tab below, view in **light mode**, then click the toggle and view in **dark mode**. Look for unreadable text, invisible borders, or jarring color clashes.

- [ ] Wardrobe (grid, search, filters, item cards)
- [ ] Capsule (shortlist view, toggle items)
- [ ] Trip (trip creator, day list, weather inputs)
- [ ] Daily (day list, outfit panels, slot pickers, AI generate button)
- [ ] Outfit AI
- [ ] Packing (frozen days view, capsule section)
- [ ] Profile (photo upload area)
- [ ] Add Item modal (open from Wardrobe)
- [ ] Outfit Preview modal (open from Daily)
- [ ] Day Export modal (open from Daily — note: canvas export PNG remains dark-only by design, see spec §non-goals)
- [ ] Upgrade prompt modal (if accessible)

- [ ] **Step 3: Record any issues**

For any spot that looks wrong in either theme, capture:
- File + approximate line
- Description (e.g. "Trip day card border invisible in light mode")

If issues found, fix each one in a small follow-up commit using the appropriate `T.*` token or a new CSS variable if needed. Recommit per fix.

- [ ] **Step 4: Final verification**

Run: `npm test && npm run build`
Expected: tests pass, build succeeds with no errors.

- [ ] **Step 5: Final commit if any sweep fixes were made**

```bash
git status
# If any files modified, commit:
git add -A
git commit -m "fix(theme): visual sweep polish for light + dark themes"
```

---

## Notes

- **Canvas exports are intentionally not theme-aware.** `DayExportModal.jsx` uses hardcoded hex colors for canvas-rendered PNG exports (`#0F0F12`, `#E8E6E1`, etc.). These produce a dark-themed export image regardless of UI theme. This is per spec §non-goals.
- **String concatenation safety:** Template-literal usage like `` `1px solid ${T.border}` `` resolves to `"1px solid var(--border)"`, which is valid CSS. The `<style>` block in `App.jsx` that interpolates `${T.bg}` etc. also produces valid CSS. No concatenation-resolution edge cases exist in the current codebase.
- **The `#2DD4BF` capsule badge color and `#FBBF24` DEMO badge** are intentional hardcoded brand/state colors and remain unchanged. They read acceptably on both palettes.
