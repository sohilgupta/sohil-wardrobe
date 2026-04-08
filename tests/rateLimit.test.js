import { describe, it, expect, beforeEach } from "vitest";
import { enforceRateLimit, callsRemaining, resetRateLimit } from "../src/utils/aiRateLimit";

// jsdom provides sessionStorage — reset before each test
beforeEach(() => {
  resetRateLimit("text");
  resetRateLimit("preview");
});

describe("enforceRateLimit — text bucket (max 5 / 60s)", () => {
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

describe("enforceRateLimit — preview bucket (max 10 / 60s)", () => {
  it("allows up to 10 calls without throwing", () => {
    for (let i = 0; i < 10; i++) {
      expect(() => enforceRateLimit("preview")).not.toThrow();
    }
  });

  it("throws on the 11th call", () => {
    for (let i = 0; i < 10; i++) enforceRateLimit("preview");
    expect(() => enforceRateLimit("preview")).toThrow(/rate limit/i);
  });
});

describe("callsRemaining", () => {
  it("starts at max for an unused bucket", () => {
    expect(callsRemaining("text")).toBe(5);
    expect(callsRemaining("preview")).toBe(10);
  });

  it("decrements after each enforced call", () => {
    enforceRateLimit("text");
    expect(callsRemaining("text")).toBe(4);
    enforceRateLimit("text");
    expect(callsRemaining("text")).toBe(3);
  });

  it("returns 0 when limit is exhausted", () => {
    for (let i = 0; i < 5; i++) {
      try { enforceRateLimit("text"); } catch { /* ignore */ }
    }
    expect(callsRemaining("text")).toBe(0);
  });
});

describe("resetRateLimit", () => {
  it("restores calls remaining to max after reset", () => {
    for (let i = 0; i < 5; i++) {
      try { enforceRateLimit("text"); } catch { /* ignore */ }
    }
    resetRateLimit("text");
    expect(callsRemaining("text")).toBe(5);
  });

  it("allows calls again after reset", () => {
    for (let i = 0; i < 5; i++) {
      try { enforceRateLimit("text"); } catch { /* ignore */ }
    }
    resetRateLimit("text");
    expect(() => enforceRateLimit("text")).not.toThrow();
  });
});
