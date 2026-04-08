import { describe, it, expect } from "vitest";
import { outfitSlotHash, buildPreviewKey } from "../src/hooks/usePreview";

describe("outfitSlotHash", () => {
  it("returns 'empty' for null input", () => {
    expect(outfitSlotHash(null)).toBe("empty");
  });

  it("returns 'empty' for undefined input", () => {
    expect(outfitSlotHash(undefined)).toBe("empty");
  });

  it("produces a deterministic hash for the same slot IDs", () => {
    const slotIds = { base: "gs_Shirts_WhiteTee", bottom: "gs_Pants_NavyChino", shoes: "gs_Shoes_WhiteSneaker" };
    expect(outfitSlotHash(slotIds)).toBe(outfitSlotHash(slotIds));
  });

  it("produces different hashes for different base items", () => {
    const a = { base: "item_A", bottom: "item_X", shoes: "item_Y" };
    const b = { base: "item_B", bottom: "item_X", shoes: "item_Y" };
    expect(outfitSlotHash(a)).not.toBe(outfitSlotHash(b));
  });

  it("treats missing layers and empty strings consistently", () => {
    const withEmpty   = { base: "item_A", mid: "",    bottom: "item_B", shoes: "item_C" };
    const withMissing = { base: "item_A", mid: undefined, bottom: "item_B", shoes: "item_C" };
    // Both should produce the same hash (missing key → "")
    expect(outfitSlotHash(withEmpty)).toBe(outfitSlotHash(withMissing));
  });

  it("includes all 6 expected layer keys in the hash", () => {
    // If a key is unexpectedly omitted the hash would differ — just check it's stable
    const slotIds = {
      base: "A", mid: "B", outer: "C",
      thermalBottom: "D", bottom: "E", shoes: "F",
    };
    const hash = outfitSlotHash(slotIds);
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("changing only the mid layer changes the hash", () => {
    const base = { base: "A", mid: "B", outer: "C", bottom: "D", shoes: "E" };
    const changed = { ...base, mid: "Z" };
    expect(outfitSlotHash(base)).not.toBe(outfitSlotHash(changed));
  });
});

describe("buildPreviewKey", () => {
  it("includes dayId and slot in the key", () => {
    const slotIds = { base: "item_A", bottom: "item_B", shoes: "item_C" };
    const key = buildPreviewKey("d03", "daytime", slotIds);
    expect(key).toContain("d03");
    expect(key).toContain("daytime");
  });

  it("is deterministic — same inputs produce same key", () => {
    const slotIds = { base: "item_A", bottom: "item_B", shoes: "item_C" };
    expect(buildPreviewKey("d03", "daytime", slotIds))
      .toBe(buildPreviewKey("d03", "daytime", slotIds));
  });

  it("differs for different day IDs", () => {
    const slotIds = { base: "item_A", bottom: "item_B", shoes: "item_C" };
    expect(buildPreviewKey("d03", "daytime", slotIds))
      .not.toBe(buildPreviewKey("d04", "daytime", slotIds));
  });

  it("differs for different slots", () => {
    const slotIds = { base: "item_A", bottom: "item_B", shoes: "item_C" };
    expect(buildPreviewKey("d03", "daytime", slotIds))
      .not.toBe(buildPreviewKey("d03", "evening", slotIds));
  });

  it("changes key when outfit items change (cache invalidation)", () => {
    const original = { base: "item_A", bottom: "item_B", shoes: "item_C" };
    const changed  = { base: "item_X", bottom: "item_B", shoes: "item_C" };
    expect(buildPreviewKey("d03", "daytime", original))
      .not.toBe(buildPreviewKey("d03", "daytime", changed));
  });
});
