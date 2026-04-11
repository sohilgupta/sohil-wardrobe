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

/* ── One-time migration export script (user runs this on sohil-wardrobe.vercel.app) ── */
const EXPORT_SCRIPT = `copy(JSON.stringify({v:1,capsule:JSON.parse(localStorage.getItem("wdb_capsule_v1")||"[]"),outfits:JSON.parse(localStorage.getItem("wdb_outfits_v3")||localStorage.getItem("wdb_outfits_v1")||"{}")}))`;

export default function ProfileTab({ photos, onAdd, onRemove, onClearAll, maxPhotos, onImportData }) {
  const { user, signOut } = useAuth();
  const { isPro } = usePlan();
  const [upgrading,    setUpgrading]    = useState(false);
  const [importJson,   setImportJson]   = useState("");
  const [importStatus, setImportStatus] = useState(null); // null | "ok" | "error"
  const [importMsg,    setImportMsg]    = useState("");
  const [scriptCopied, setScriptCopied] = useState(false);

  function handleCopyScript() {
    navigator.clipboard.writeText(EXPORT_SCRIPT).then(() => {
      setScriptCopied(true);
      setTimeout(() => setScriptCopied(false), 2000);
    });
  }

  function handleImport() {
    setImportStatus(null);
    setImportMsg("");
    try {
      const data = JSON.parse(importJson.trim());
      if (!data || typeof data !== "object") throw new Error("Invalid JSON");

      const capsuleArr = Array.isArray(data.capsule) ? data.capsule : [];
      const outfitsRaw = data.outfits && typeof data.outfits === "object" ? data.outfits : {};

      // outfitsRaw may be { outfitIds, frozenDays, updatedAt } (wdb_outfits_v3 format)
      const outfitIds  = outfitsRaw.outfitIds  || {};
      const frozenDays = outfitsRaw.frozenDays  || {};

      onImportData({ capsuleArr, outfitIds, frozenDays });
      setImportStatus("ok");
      setImportMsg(`Imported ${capsuleArr.length} capsule items and ${Object.keys(outfitIds).length} outfit days.`);
      setImportJson("");
    } catch (err) {
      setImportStatus("error");
      setImportMsg("Could not parse the data. Make sure you pasted the full copied text.");
    }
  }

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

      {/* Data Migration */}
      <Section title="Migrate Data from Old URL">
        <p style={{ fontSize: 12, color: T.mid, marginBottom: 14, lineHeight: 1.7 }}>
          Transfer your capsule &amp; outfit data from{" "}
          <code style={{ fontSize: 11, color: T.light, background: T.alt, padding: "1px 5px", borderRadius: 4 }}>
            sohil-wardrobe.vercel.app
          </code>{" "}
          to this app.
        </p>

        {/* Step 1 */}
        <p style={{ fontSize: 11, fontWeight: 700, color: T.text, letterSpacing: 0.3, marginBottom: 6 }}>
          Step 1 — Copy this script
        </p>
        <div style={{ position: "relative", marginBottom: 14 }}>
          <code style={{
            display: "block",
            background: T.alt,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 10,
            color: T.mid,
            wordBreak: "break-all",
            lineHeight: 1.6,
            paddingRight: 72,
          }}>
            {EXPORT_SCRIPT}
          </code>
          <button onClick={handleCopyScript} style={{
            position: "absolute", top: 8, right: 8,
            background: scriptCopied ? "rgba(34,197,94,0.15)" : T.accentDim,
            border: `1px solid ${scriptCopied ? "rgba(34,197,94,0.3)" : T.accentBorder}`,
            borderRadius: 6, color: scriptCopied ? "#22C55E" : T.accent,
            fontSize: 10, fontWeight: 700, padding: "4px 10px", cursor: "pointer", letterSpacing: 0.3,
          }}>
            {scriptCopied ? "Copied!" : "Copy"}
          </button>
        </div>

        {/* Step 2 */}
        <p style={{ fontSize: 11, fontWeight: 700, color: T.text, letterSpacing: 0.3, marginBottom: 6 }}>
          Step 2 — Run it on the old URL
        </p>
        <ol style={{ fontSize: 12, color: T.mid, lineHeight: 1.9, paddingLeft: 16, marginBottom: 14 }}>
          <li>Open <strong style={{ color: T.light }}>sohil-wardrobe.vercel.app</strong> in a new tab</li>
          <li>Open DevTools → Console <span style={{ color: T.light, fontSize: 11 }}>(⌘+Option+J on Mac)</span></li>
          <li>Paste the script and press Enter — your data is now copied to clipboard</li>
        </ol>

        {/* Step 3 */}
        <p style={{ fontSize: 11, fontWeight: 700, color: T.text, letterSpacing: 0.3, marginBottom: 6 }}>
          Step 3 — Paste here and import
        </p>
        <textarea
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          placeholder='Paste the JSON here…'
          rows={4}
          style={{
            width: "100%",
            background: T.alt,
            border: `1px solid ${importStatus === "error" ? "#EF4444" : T.border}`,
            borderRadius: 8,
            color: T.text,
            fontSize: 11,
            padding: "10px 12px",
            fontFamily: "monospace",
            resize: "vertical",
            marginBottom: 10,
          }}
        />
        {importStatus && (
          <p style={{
            fontSize: 12, marginBottom: 10,
            color: importStatus === "ok" ? "#22C55E" : "#EF4444",
          }}>
            {importMsg}
          </p>
        )}
        <button
          onClick={handleImport}
          disabled={!importJson.trim()}
          style={{
            width: "100%",
            padding: "11px",
            background: importJson.trim() ? T.accentDim : "none",
            border: `1px solid ${importJson.trim() ? T.accentBorder : T.border}`,
            borderRadius: 8,
            color: importJson.trim() ? T.accent : T.light,
            fontSize: 12,
            fontWeight: 700,
            cursor: importJson.trim() ? "pointer" : "not-allowed",
            letterSpacing: 0.5,
          }}
        >
          Import Data
        </button>
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
