// src/components/UpgradePrompt.jsx
/* ─── UpgradePrompt ───────────────────────────────────────────────────────────
   Context-aware limit modal.
   - Guest hitting limit → shows auth form (Google + Email)
   - Free user hitting limit → shows Stripe upgrade CTA
   Listens for 'vesti-limit-reached' CustomEvents globally.
   ─────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect } from "react";
import { T } from "../theme";
import { useTier, useAuth } from "../contexts/AuthContext";
import { AuthForm } from "./AuthPage";
import { LIMITS } from "../utils/tiers";

const COPY = {
  wardrobe: {
    heading:    "You've reached your wardrobe limit",
    sub:        () => `Guest: ${LIMITS.guest.wardrobe}  ·  Free: ${LIMITS.free.wardrobe}  ·  Pro: ∞`,
    proHeading: "Unlock unlimited wardrobe items",
  },
  trips: {
    heading:    "Save your trip & plan more",
    sub:        () => `Guest: ${LIMITS.guest.trips} trip  ·  Free: ${LIMITS.free.trips} trips  ·  Pro: ∞`,
    proHeading: "Unlock unlimited trips",
  },
  outfitDays: {
    heading:    "Unlock full trip planning",
    sub:        () => `Guest: ${LIMITS.guest.outfitDays} days  ·  Free: unlimited  ·  Pro: unlimited`,
    proHeading: "Upgrade to plan more days",
  },
};

export default function UpgradePrompt() {
  const { tier, isGuest } = useTier();
  const { user } = useAuth();
  const [open,      setOpen]      = useState(false);
  const [limitType, setLimitType] = useState("wardrobe");
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    function handleLimit(e) {
      setLimitType(e.detail?.type || "wardrobe");
      setOpen(true);
    }
    window.addEventListener("vesti-limit-reached", handleLimit);
    return () => window.removeEventListener("vesti-limit-reached", handleLimit);
  }, []);

  async function handleGoPro() {
    setUpgrading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userId: user?.id, email: user?.email }),
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      alert("Could not start checkout. Please try again.");
    } finally {
      setUpgrading(false);
    }
  }

  if (!open) return null;

  const copy = COPY[limitType] || COPY.wardrobe;

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 380,
        position: "relative",
      }}>
        {/* Close */}
        <button onClick={() => setOpen(false)}
          style={{ position: "absolute", top: 14, right: 16, background: "none",
            border: "none", color: T.light, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>
          ×
        </button>

        {/* Eyebrow */}
        <p style={{ fontSize: 11, color: T.accent, fontWeight: 700, letterSpacing: 1.5,
          textTransform: "uppercase", marginBottom: 8 }}>
          {isGuest ? "Create Free Account" : "Upgrade to Pro"}
        </p>

        {/* Heading */}
        <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, color: T.text, marginBottom: 6 }}>
          {isGuest ? copy.heading : copy.proHeading}
        </p>

        {/* Sub for guests */}
        {isGuest && (
          <p style={{ fontSize: 12, color: T.mid, marginBottom: 20, lineHeight: 1.6 }}>
            {copy.sub()}
          </p>
        )}

        {/* Auth form for guests */}
        {isGuest && <AuthForm compact />}

        {/* Pro CTA for free-tier users */}
        {!isGuest && (
          <>
            <p style={{ fontSize: 13, color: T.mid, marginBottom: 20, lineHeight: 1.7 }}>
              Upgrade to Pro for unlimited wardrobe, trips, AI generation, and clean exports.
            </p>
            <button onClick={handleGoPro} disabled={upgrading}
              style={{ width: "100%", padding: "13px", background: T.accent, color: "#fff",
                border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: upgrading ? "not-allowed" : "pointer", opacity: upgrading ? 0.7 : 1 }}>
              {upgrading ? "Redirecting…" : "Go Pro →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
