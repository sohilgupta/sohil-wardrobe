import { describe, it, expect, beforeEach } from "vitest";
import { enforceRateLimit, resetBucket } from "../src/utils/aiRateLimit";

beforeEach(() => {
  resetBucket("text");
  resetBucket("image");
});

describe("enforceRateLimit — text bucket (max 5)", () => {
  it("allows calls up to the limit without throwing", () => {
    for (let i = 0; i < 5; i++) {
      expect(() => enforceRateLimit("text")).not.toThrow();
    }
  });

  it("throws on the 6th call within the window", () => {
    for (let i = 0; i < 5; i++) enforceRateLimit("text");
    expect(() => enforceRateLimit("text")).toThrow(/rate limit/i);
  });

  it("error message includes wait time in seconds", () => {
    for (let i = 0; i < 5; i++) enforceRateLimit("text");
    let msg = "";
    try { enforceRateLimit("text"); } catch (e) { msg = e.message; }
    expect(msg).toMatch(/\d+s/);
  });
});

describe("enforceRateLimit — image bucket (max 2)", () => {
  it("allows up to 2 calls without throwing", () => {
    for (let i = 0; i < 2; i++) {
      expect(() => enforceRateLimit("image")).not.toThrow();
    }
  });

  it("throws on the 3rd call", () => {
    for (let i = 0; i < 2; i++) enforceRateLimit("image");
    expect(() => enforceRateLimit("image")).toThrow(/rate limit/i);
  });
});

describe("resetBucket", () => {
  it("allows calls again after reset", () => {
    for (let i = 0; i < 5; i++) {
      try { enforceRateLimit("text"); } catch { /* ignore */ }
    }
    resetBucket("text");
    expect(() => enforceRateLimit("text")).not.toThrow();
  });

  it("unknown bucket defaults to text config", () => {
    // unknown type falls back to text config (max 5)
    expect(() => enforceRateLimit("preview")).not.toThrow();
  });
});
