import { describe, it, expect } from "vitest";
import { mergeTrips, mergeOutfits, mergeCapsule } from "../src/utils/guestMigration";

describe("mergeTrips", () => {
  const existing = [{ id: "trip_1", name: "Paris", createdAt: "2026-01-01T00:00:00Z", days: [] }];
  const guest    = [
    { id: "trip_g1", name: "Berlin", createdAt: "2026-02-01T00:00:00Z", days: [] },
    { id: "trip_g2", name: "Paris",  createdAt: "2026-01-01T00:00:00Z", days: [] },
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
    const result = mergeOutfits({ trip_1: { d01: { daytime: { base: "item_a" } } } }, {});
    expect(result.trip_1.d01.daytime.base).toBe("item_a");
  });
});

describe("mergeCapsule", () => {
  it("returns union of both arrays", () => {
    const result = mergeCapsule(["a","b"], ["b","c"]);
    expect(result).toEqual(expect.arrayContaining(["a","b","c"]));
    expect(result.length).toBe(3);
  });
  it("handles empty arrays", () => {
    expect(mergeCapsule([], ["a"])).toEqual(["a"]);
    expect(mergeCapsule(["a"], [])).toEqual(["a"]);
  });
});
