# TODOS

## Canvas export renderer tests

**What:** Add tests for `drawCard` (ExportModal) and `generateCanvas` (DayExportModal) using jsdom + the `canvas` npm package (Node.js canvas mock).

**Why:** Both functions have significant layout logic (dynamic height calculation, slot/hero image branching, text truncation). A regression in item count or height math would silently produce a broken PNG with no error.

**Pros:** Confidence that canvas output doesn't silently break. Covers 300+ lines of logic currently unprotected.

**Cons:** Requires installing the `canvas` npm package (native bindings, can be flaky). Canvas mocks won't match browser font metrics exactly.

**Context:** Deferred from the preview+export PR (2026-04-07). Vitest is set up by that PR, so canvas tests would have a framework to build on. Test files would live in `tests/canvas/`.

**Depends on:** Vitest setup (already done in preview+export PR).

---

## Split OutfitsTab.jsx (currently 1,066 lines — over CLAUDE.md 500-line limit)

**What:** Extract day-panel JSX and/or AI generation logic from `OutfitsTab.jsx` into sub-components.

**Why:** CLAUDE.md says "keep files under 500 lines." OutfitsTab was 914 lines before the preview+export PR pushed it to 1,066. It will keep growing.

**Pros:** Cleaner navigation, respects project conventions, easier to grep.

**Cons:** State is tightly coupled (previewTarget, showExport, showDayExport, pickerLayer, slotLoading all co-located). Splitting naively increases prop-drilling.

**Context:** Most natural first cut: extract the day-panel (the right-side outfit column, ~300 lines) into a `DayOutfitPanel` component, passing the shared state down as props. Modals are already in their own files.

**Depends on:** Nothing — independent refactor.
