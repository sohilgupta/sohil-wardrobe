import { describe, it, expect } from "vitest";
import { LIMITS, resolveTier } from "../src/utils/tiers";

describe("LIMITS", () => {
  it("guest wardrobe limit is 10", () => expect(LIMITS.guest.wardrobe).toBe(10));
  it("free wardrobe limit is 50", () => expect(LIMITS.free.wardrobe).toBe(50));
  it("pro wardrobe limit is Infinity", () => expect(LIMITS.pro.wardrobe).toBe(Infinity));
  it("guest outfitDays limit is 3", () => expect(LIMITS.guest.outfitDays).toBe(3));
  it("free outfitDays is Infinity", () => expect(LIMITS.free.outfitDays).toBe(Infinity));
  it("guest trips limit is 1", () => expect(LIMITS.guest.trips).toBe(1));
  it("free trips limit is 3", () => expect(LIMITS.free.trips).toBe(3));
});

describe("resolveTier", () => {
  it("returns guest when no user and no guestId", () => {
    expect(resolveTier(null, null, null)).toEqual({ tier: "guest", limits: LIMITS.guest, isPro: false });
  });
  it("returns guest when guestId but no user", () => {
    expect(resolveTier(null, "guest-uuid", null).tier).toBe("guest");
  });
  it("returns pro for owner email regardless of profile", () => {
    const u = { email: "sohilgupta@gmail.com" };
    expect(resolveTier(u, null, { plan: "free", subscription_status: null }).tier).toBe("pro");
    expect(resolveTier(u, null, null).tier).toBe("pro");
  });
  it("returns pro for active subscription", () => {
    const u = { email: "other@example.com" };
    expect(resolveTier(u, null, { plan: "pro", subscription_status: "active" }).tier).toBe("pro");
  });
  it("returns free for logged-in user with no active subscription", () => {
    const u = { email: "other@example.com" };
    expect(resolveTier(u, null, { plan: "free", subscription_status: null }).tier).toBe("free");
  });
  it("returns free even if plan=pro but subscription_status is not active", () => {
    const u = { email: "other@example.com" };
    expect(resolveTier(u, null, { plan: "pro", subscription_status: "canceled" }).tier).toBe("free");
  });
});
