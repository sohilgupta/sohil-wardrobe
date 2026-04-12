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
