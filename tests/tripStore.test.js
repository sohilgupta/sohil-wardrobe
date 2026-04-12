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
