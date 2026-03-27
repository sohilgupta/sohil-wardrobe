/* ─── PAYWALL MODAL ───────────────────────────────────────────────────────────
   Shown when a free-tier user hits a feature limit.
   Displays pricing plans and links to Stripe checkout.

   Props:
   - trigger  — string describing what triggered the paywall (for copy)
   - onClose  — callback to dismiss
   ─────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import { T } from "../theme";
import { useAuth } from "../contexts/AuthContext";

const TRIGGER_COPY = {
  items:      "You've reached the 10-item free limit.",
  days:       "Free plan includes 3 days of outfit planning.",
  preview:    "Outfit previews are a Pro feature.",
  trip:       "Free plan supports 1 trip.",
  capsule:    "Capsule auto-generation is a Pro feature.",
  export:     "Watermark-free exports require Pro.",
  packing:    "The packing optimizer is a Pro feature.",
  generation: "Full trip generation requires Pro.",
  default:    "Unlock your full trip plan.",
};

const PRO_FEATURES = [
  "Unlimited wardrobe items",
  "Unlimited trips",
  "Full trip outfit planning",
  "Capsule auto-generation",
  "Packing list optimizer",
  "Outfit AI previews",
  "Exports without watermark",
  "Faster AI generation",
];

export default function PaywallModal({ trigger = "default", onClose }) {
  const { user } = useAuth();
  const [billing, setBilling] = useState("monthly"); // "monthly" | "yearly"
  const [loading, setLoading] = useState(false);

  const triggerMessage = TRIGGER_COPY[trigger] || TRIGGER_COPY.default;

  async function handleCheckout() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          userId:  user?.id,
          email:   user?.email,
          billing, // "monthly" | "yearly"
        }),
      });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      if (url) window.location.href = url;
    } catch (err) {
      alert(err.message || "Could not start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      {/* Card — stop propagation so clicking inside doesn't close */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.surface,
          border: `1px solid #3B1A5A`,
          borderRadius: 16,
          padding: "32px 28px",
          maxWidth: 400,
          width: "100%",
          position: "relative",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "none",
            border: "none",
            color: T.light,
            fontSize: 18,
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ×
        </button>

        {/* Heading */}
        <p style={{ fontSize: 11, color: "#C084FC", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>
          UPGRADE TO PRO
        </p>
        <p style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 6, lineHeight: 1.3 }}>
          Unlock your full trip plan
        </p>
        <p style={{ fontSize: 13, color: T.mid, marginBottom: 22, lineHeight: 1.5 }}>
          {triggerMessage}
        </p>

        {/* Billing toggle */}
        <div
          style={{
            display: "flex",
            background: T.alt,
            borderRadius: 8,
            padding: 3,
            marginBottom: 20,
          }}
        >
          {["monthly", "yearly"].map((b) => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              style={{
                flex: 1,
                padding: "8px",
                background: billing === b ? T.surface : "none",
                border: billing === b ? `1px solid ${T.border}` : "1px solid transparent",
                borderRadius: 6,
                color: billing === b ? T.text : T.light,
                fontSize: 12,
                fontWeight: billing === b ? 700 : 400,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {b === "yearly" ? "Yearly" : "Monthly"}
              {b === "yearly" && (
                <span
                  style={{
                    fontSize: 9,
                    background: "#14532D",
                    color: "#4ADE80",
                    padding: "2px 5px",
                    borderRadius: 4,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                  }}
                >
                  BEST VALUE
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Price */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <span
            style={{
              fontFamily: "'Cormorant Garamond',serif",
              fontSize: 42,
              fontWeight: 700,
              color: T.text,
              lineHeight: 1,
            }}
          >
            {billing === "yearly" ? "$5" : "$9"}
          </span>
          <span style={{ fontSize: 13, color: T.mid }}>
            {billing === "yearly" ? "/mo · billed $60/yr" : "/month"}
          </span>
        </div>

        {/* Features list */}
        <ul style={{ listStyle: "none", padding: 0, marginBottom: 22 }}>
          {PRO_FEATURES.map((f) => (
            <li
              key={f}
              style={{
                fontSize: 13,
                color: T.mid,
                padding: "4px 0",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ color: "#4ADE80", fontSize: 11 }}>✓</span>
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          onClick={handleCheckout}
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px",
            background: "#7C3AED",
            border: "none",
            borderRadius: 10,
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 0.5,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Redirecting…" : "Get Pro"}
        </button>

        <p style={{ fontSize: 10, color: T.light, textAlign: "center", marginTop: 10 }}>
          Cancel anytime · Secure checkout via Stripe
        </p>
      </div>
    </div>
  );
}
