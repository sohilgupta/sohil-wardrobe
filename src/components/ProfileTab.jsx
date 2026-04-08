/* ─── PROFILE TAB ─────────────────────────────────────────────────────────────
   Displays:
   - User account info (email, plan)
   - Profile reference photos for outfit previews
   - Subscription management (upgrade / manage billing)
   - Attribution
   ─────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import { T } from "../theme";
import { useAuth, usePlan } from "../contexts/AuthContext";

export default function ProfileTab({ photos, onAdd, onRemove, onClearAll, maxPhotos }) {
  const { user, signOut } = useAuth();
  const { isPro } = usePlan();
  const [upgrading, setUpgrading] = useState(false);

  async function handleUpgrade() {
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

  async function handleManageBilling() {
    try {
      const res = await fetch("/api/stripe/portal", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userId: user?.id }),
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      alert("Could not open billing portal. Please try again.");
    }
  }

  return (
    <div style={{ animation: "slideUp 0.25s ease" }}>
      {/* Account */}
      <Section title="Account">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Row label="Email" value={user?.email || "—"} />
          <Row
            label="Plan"
            value={
              <span style={{ color: isPro ? "#A78BFA" : T.mid, fontWeight: 600 }}>
                {isPro ? "Pro" : "Free"}
              </span>
            }
          />
          {!isPro && (
            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              style={upgradeBtn}
            >
              {upgrading ? "Redirecting…" : "Upgrade to Pro"}
            </button>
          )}
          {isPro && (
            <button onClick={handleManageBilling} style={manageBtn}>
              Manage Billing
            </button>
          )}
        </div>
      </Section>

      {/* Free tier limits notice */}
      {!isPro && (
        <div
          style={{
            background: "#1A1520",
            border: `1px solid #3B1A5A`,
            borderRadius: 10,
            padding: "14px 16px",
            marginBottom: 20,
          }}
        >
          <p style={{ fontSize: 11, color: "#C084FC", fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
            FREE TIER LIMITS
          </p>
          <ul style={{ fontSize: 12, color: T.mid, lineHeight: 1.8, paddingLeft: 14 }}>
            <li>1 trip</li>
            <li>10 wardrobe items</li>
            <li>3 days of outfit planning</li>
            <li>Basic AI generation</li>
            <li>Exports include watermark</li>
          </ul>
          <p style={{ fontSize: 12, color: T.light, marginTop: 10 }}>
            Upgrade to Pro for unlimited everything.
          </p>
        </div>
      )}

      {/* Profile Photos */}
      <Section title="Reference Photos">
        <p style={{ fontSize: 12, color: T.mid, marginBottom: 14, lineHeight: 1.6 }}>
          Add photos of yourself for AI outfit preview generation.
          {photos.length >= maxPhotos && (
            <span style={{ color: T.light }}> ({maxPhotos}/{maxPhotos} used)</span>
          )}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          {photos.map((p) => (
            <div key={p.id} style={{ position: "relative" }}>
              <img
                src={p.dataUrl}
                alt="Profile reference"
                style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: `1px solid ${T.border}` }}
              />
              <button
                onClick={() => onRemove(p.id)}
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#EF4444",
                  border: "none",
                  color: "#fff",
                  fontSize: 11,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                }}
              >
                ×
              </button>
            </div>
          ))}
          {photos.length < maxPhotos && (
            <label
              style={{
                width: 80,
                height: 80,
                borderRadius: 8,
                border: `1px dashed ${T.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: T.light,
                fontSize: 22,
              }}
            >
              +
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && onAdd(e.target.files[0])}
              />
            </label>
          )}
        </div>
        {photos.length > 0 && (
          <button onClick={onClearAll} style={dangerBtn}>Clear all photos</button>
        )}
      </Section>

      {/* Sign Out */}
      <Section title="">
        <button onClick={signOut} style={dangerBtn}>Sign out</button>
      </Section>

      {/* Attribution */}
      <p
        style={{
          fontSize: 10,
          color: T.light,
          textAlign: "center",
          marginTop: 32,
          opacity: 0.6,
          letterSpacing: 0.3,
        }}
      >
        Built by Sohil Gupta
      </p>
    </div>
  );
}

/* ── Sub-components ── */
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      {title && (
        <p style={{ fontSize: 10, color: T.light, letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>
          {title.toUpperCase()}
        </p>
      )}
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          padding: "14px 16px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: T.light }}>{label}</span>
      <span style={{ fontSize: 13, color: T.text }}>{value}</span>
    </div>
  );
}

/* ── Button styles ── */
const upgradeBtn = {
  width: "100%",
  marginTop: 8,
  padding: "11px",
  background: "#2E1065",
  border: "1px solid #7C3AED",
  borderRadius: 8,
  color: "#A78BFA",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1,
  cursor: "pointer",
};

const manageBtn = {
  width: "100%",
  marginTop: 8,
  padding: "11px",
  background: "none",
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  color: T.mid,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const dangerBtn = {
  background: "none",
  border: `1px solid ${T.border}`,
  borderRadius: 7,
  color: "#EF4444",
  fontSize: 11,
  fontWeight: 600,
  padding: "8px 14px",
  cursor: "pointer",
  letterSpacing: 0.5,
};
