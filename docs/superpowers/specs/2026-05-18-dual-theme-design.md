# Dual Theme (Light + Dark) Redesign

**Date:** 2026-05-18
**Status:** Design approved, ready for plan

## Goal

Introduce a parchment-toned light theme as the default, refine the existing dark theme, and add a one-click toggle in the app header. Inspired by https://www.fereai.xyz/app.

## Non-goals

- No layout/navigation changes. Tabs, modals, and component structures stay as they are.
- No system-preference auto-detection.
- No per-page or per-component theme overrides.
- No user-customizable accents.

## Strategy

Rewrite `src/theme.js` so each token on the `T` object resolves to a CSS variable string (e.g. `T.bg = "var(--bg)"`). Define both palettes as CSS variables in a new stylesheet, scoped by `:root` (light) and `[data-theme="dark"]`. Flipping `document.documentElement.dataset.theme` instantly re-themes the whole app with zero React re-renders. The ~639 existing `T.*` references in components require no changes.

## Components

### 1. `src/styles/themes.css` (new)

All design tokens as CSS variables. Two declaration blocks:

- `:root` — light parchment palette (default)
- `[data-theme="dark"]` — refined dark palette

Tokens to define for both themes:

- Surfaces: `--bg`, `--surface`, `--alt`, `--border`, `--border-light`
- Text: `--text`, `--mid`, `--light`
- Accent: `--accent`, `--accent-dim`, `--accent-border`, `--green`
- Weather tuples: `--weather-cold-bg/fg`, `--weather-mild-bg/fg`, `--weather-warm-bg/fg`
- Occasion tuples: `--occ-casual-bg/fg`, `--occ-dinner-bg/fg`, `--occ-flight-bg/fg`, `--occ-hiking-bg/fg`, `--occ-gym-bg/fg`, `--occ-formal-bg/fg`, `--occ-show-bg/fg`

Imported once in `src/main.jsx`.

### 2. `src/theme.js` (rewrite)

Replace the static `T` object's color values with `var(--token)` strings. Same shape:

```js
export const T = {
  bg: "var(--bg)",
  surface: "var(--surface)",
  // ...
  weather: {
    Cold: ["var(--weather-cold-bg)", "var(--weather-cold-fg)"],
    // ...
  },
  occ: { /* same pattern */ },
};
```

`SWATCHES`, `swatch()`, `CAT_EMOJI`, and `driveImg()` are unchanged — those are real garment colors, not theme-dependent.

### 3. `src/hooks/useThemeMode.js` (new)

```js
useThemeMode() → { mode: "light" | "dark", toggle: () => void }
```

- Reads `wdb_theme` from localStorage; defaults to `"light"`.
- Writes `document.documentElement.dataset.theme = mode` in a `useEffect`.
- `toggle()` flips state and persists to localStorage.

### 4. Theme toggle button (App header)

Small icon button in `App.jsx` header, top-right, adjacent to the existing capsule badge. Sun icon when in dark mode (click → light), moon icon when in light mode (click → dark). Inline SVG, no new dependencies. Uses existing button styles.

### 5. Light palette (parchment, Fere AI-inspired)

- `--bg` `#F5EFE4` (parchment cream)
- `--surface` `#FAF5EA` (warmer cream cards)
- `--alt` `#EDE6D6` (muted sand)
- `--border` `#D9CFB8`
- `--border-light` `#E5DCC6`
- `--text` `#3A2F22` (deep warm brown)
- `--mid` `#6B5E4A`
- `--light` `#9C8E76`
- `--accent` `#B5532A` (warm rust/terracotta) — same hue across themes for brand continuity
- `--accent-dim` `rgba(181, 83, 42, 0.10)`
- `--accent-border` `rgba(181, 83, 42, 0.30)`
- `--green` `#3F7A4A` (muted forest)

Weather/occasion tuples get softer, lower-saturation versions of the existing dark-theme colors, tinted to sit on parchment without clashing.

### 6. Dark palette (refined)

Keep current values as a starting point, with minor warmth adjustments so the toggle feels coherent (e.g. shift `#0F0F12` toward `#141210` for a touch more warmth). Accent stays `#B5532A` for cross-theme consistency, replacing the current `#0A84FF`.

### 7. Edge cases — computed token usage

A few call sites may concatenate `T.*` strings (e.g. `${T.bg}AA` for alpha overlays, or pass to canvas drawing). CSS variables don't survive string concatenation. During implementation:

- Grep for ``${T.`` and ``T.[a-z]+\s*\+`` to find these.
- For alpha overlays: add pre-defined alpha variants as separate tokens (e.g. `T.bgAlpha80 = "var(--bg-alpha-80)"`).
- For canvas/2D context fills (which can't use CSS vars): resolve via `getComputedStyle(document.documentElement).getPropertyValue('--bg')` inside the drawing function.

## Data flow

```
User clicks toggle
   ↓
useThemeMode.toggle() → setState("dark") → localStorage.setItem("wdb_theme", "dark")
   ↓ (useEffect)
document.documentElement.dataset.theme = "dark"
   ↓ (CSS cascade)
[data-theme="dark"] variables override :root variables
   ↓
Every element using var(--*) repaints instantly. No React re-render required.
```

## Testing

- Manual: load app → confirms light theme. Toggle → dark. Refresh → persists. Clear localStorage → light again.
- Visual sweep of every tab (Wardrobe, Capsule, Trip, Daily, Outfit AI, Packing) in both themes.
- Verify modals (Add Item, Export, Preview) render correctly in both themes.
- Verify badges (weather, occasion) are legible in both themes.
- Verify canvas-rendered exports still produce correct colors (likely uses real RGB values from elsewhere, not theme tokens — to confirm during implementation).

## Risks

- **Canvas/inline-style edge cases** (see §7). Likely small, fixable per site.
- **Color regressions in low-contrast spots** — text on `--alt` surfaces, hover states. Mitigated by manual visual sweep.

## Out of scope / future

- System preference (`prefers-color-scheme`) auto-detection.
- Smooth color transition animation between themes.
- High-contrast / accessibility-focused variant.
