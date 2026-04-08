import { describe, it, expect } from "vitest";
import { buildExportDays, generateText } from "../src/components/ExportModal";

/* ── Minimal wardrobe fixture ── */
const W = [
  { id: "i_base",   n: "White Tee",     b: "Uniqlo",  col: "White",  l: "Base",     c: "Shirts"  },
  { id: "i_bottom", n: "Navy Chino",    b: "Zara",    col: "Navy",   l: "Bottom",   c: "Bottoms" },
  { id: "i_shoes",  n: "White Sneaker", b: "Nike",    col: "White",  l: "Footwear", c: "Shoes"   },
  { id: "i_outer",  n: "Black Jacket",  b: "H&M",     col: "Black",  l: "Outer",    c: "Jackets" },
];

/* ── Minimal outfitIds fixture ── */
// Two days: d02 has daytime outfit, d03 has daytime + evening outfits
const OUTFIT_IDS = {
  d02: {
    daytime: { base: "i_base", bottom: "i_bottom", shoes: "i_shoes" },
    evening: null,
  },
  d03: {
    daytime: { base: "i_base", outer: "i_outer", bottom: "i_bottom", shoes: "i_shoes" },
    evening: { base: "i_base", bottom: "i_bottom", shoes: "i_shoes" },
  },
};

const FROZEN = { d02: true };   // only d02 is frozen

describe("buildExportDays", () => {
  it("returns days that have at least one outfit slot", () => {
    const result = buildExportDays(OUTFIT_IDS, FROZEN, W, false);
    const ids = result.map((e) => e.day.id);
    expect(ids).toContain("d02");
    expect(ids).toContain("d03");
  });

  it("filters to only frozen days when frozenOnly=true", () => {
    const result = buildExportDays(OUTFIT_IDS, FROZEN, W, true);
    const ids = result.map((e) => e.day.id);
    expect(ids).toContain("d02");
    expect(ids).not.toContain("d03");
  });

  it("returns empty array when no frozen days and frozenOnly=true", () => {
    const result = buildExportDays(OUTFIT_IDS, {}, W, true);
    expect(result).toHaveLength(0);
  });

  it("excludes days with no outfit data", () => {
    const result = buildExportDays({ d05: {} }, {}, W, false);
    expect(result).toHaveLength(0);
  });

  it("resolves slot IDs to wardrobe items", () => {
    const result = buildExportDays(OUTFIT_IDS, FROZEN, W, true);
    const d02 = result.find((e) => e.day.id === "d02");
    expect(d02).toBeDefined();
    expect(d02.slots.daytime).toBeDefined();
    // daytime slot should have base, bottom, shoes resolved
    expect(d02.slots.daytime.base.id).toBe("i_base");
    expect(d02.slots.daytime.bottom.id).toBe("i_bottom");
    expect(d02.slots.daytime.shoes.id).toBe("i_shoes");
  });

  it("excludes slots where all items are REMOVED", () => {
    const outfitIds = {
      d02: {
        daytime: { base: "REMOVED", bottom: "REMOVED", shoes: "REMOVED" },
        evening: { base: "i_base", bottom: "i_bottom", shoes: "i_shoes" },
      },
    };
    const result = buildExportDays(outfitIds, { d02: true }, W, true);
    expect(result).toHaveLength(1);
    // daytime slot has no real items — should not appear
    expect(result[0].slots.daytime).toBeUndefined();
    expect(result[0].slots.evening).toBeDefined();
  });

  it("skips unknown item IDs gracefully", () => {
    const outfitIds = {
      d02: { daytime: { base: "nonexistent_id", bottom: "i_bottom", shoes: "i_shoes" } },
    };
    const result = buildExportDays(outfitIds, {}, W, false);
    // Should still include the day (bottom + shoes are valid)
    expect(result).toHaveLength(1);
    expect(result[0].slots.daytime.base).toBeUndefined();
    expect(result[0].slots.daytime.bottom.id).toBe("i_bottom");
  });
});

describe("generateText", () => {
  it("includes day date and city in output", () => {
    const exportDays = buildExportDays(OUTFIT_IDS, FROZEN, W, true);
    const text = generateText(exportDays);
    expect(text).toMatch(/APR/i);      // date contains Apr
    expect(text).toMatch(/SYDNEY/i);   // d02 is Sydney
  });

  it("includes item names in output", () => {
    const exportDays = buildExportDays(OUTFIT_IDS, FROZEN, W, true);
    const text = generateText(exportDays);
    expect(text).toContain("White Tee");
    expect(text).toContain("Navy Chino");
    expect(text).toContain("White Sneaker");
  });

  it("includes brand when present", () => {
    const exportDays = buildExportDays(OUTFIT_IDS, FROZEN, W, true);
    const text = generateText(exportDays);
    expect(text).toContain("Uniqlo");
  });

  it("includes slot labels (DAYTIME, EVENING)", () => {
    const exportDays = buildExportDays(OUTFIT_IDS, {}, W, false);
    const text = generateText(exportDays);
    expect(text).toContain("DAYTIME");
  });

  it("returns a non-empty string for any non-empty exportDays", () => {
    const exportDays = buildExportDays(OUTFIT_IDS, FROZEN, W, true);
    expect(typeof generateText(exportDays)).toBe("string");
    expect(generateText(exportDays).length).toBeGreaterThan(0);
  });

  it("returns empty-ish string for no days", () => {
    const text = generateText([]);
    // Header lines only — no day content
    expect(text).not.toContain("White Tee");
  });
});
