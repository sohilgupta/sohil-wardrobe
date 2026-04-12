// src/components/TripCreator.jsx
/* ─── TripCreator ─────────────────────────────────────────────────────────────
   Modal to create a new trip. User enters name + date range.
   Days are generated as stubs by useTripStore.createTrip().
   ─────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import { T } from "../theme";

export default function TripCreator({ onClose, onCreateTrip }) {
  const [name,      setName]      = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [error,     setError]     = useState("");

  function handleCreate() {
    if (!name.trim())            { setError("Trip name is required."); return; }
    if (!startDate)              { setError("Start date is required."); return; }
    if (!endDate)                { setError("End date is required."); return; }
    if (endDate < startDate)     { setError("End date must be on or after start date."); return; }
    const trip = onCreateTrip(name.trim(), startDate, endDate);
    if (trip) onClose();
  }

  const inputStyle = {
    width: "100%", padding: "11px 14px",
    background: T.alt, border: `1px solid ${T.border}`,
    borderRadius: 8, color: T.text, fontSize: 14,
    fontFamily: "inherit", marginBottom: 12,
    colorScheme: "dark",
  };

  const labelStyle = {
    fontSize: 11, color: T.light, letterSpacing: 0.5,
    fontWeight: 600, display: "block", marginBottom: 5,
    textTransform: "uppercase",
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 360,
        position: "relative",
      }}>
        {/* Close */}
        <button onClick={onClose}
          style={{ position: "absolute", top: 12, right: 14, background: "none",
            border: "none", color: T.light, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>
          ×
        </button>

        {/* Header */}
        <p style={{ fontSize: 11, color: T.accent, fontWeight: 700, letterSpacing: 1.5,
          textTransform: "uppercase", marginBottom: 6 }}>
          New Trip
        </p>
        <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, color: T.text, marginBottom: 20 }}>
          Plan a Trip
        </p>

        {/* Fields */}
        <label style={labelStyle}>Trip Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Paris Summer 2026"
          style={inputStyle}
        />

        <label style={labelStyle}>Start Date</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          style={inputStyle}
        />

        <label style={labelStyle}>End Date</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          style={inputStyle}
        />

        {error && (
          <p style={{ color: "#EF4444", fontSize: 12, marginBottom: 10, marginTop: -4 }}>
            {error}
          </p>
        )}

        <p style={{ fontSize: 11, color: T.light, lineHeight: 1.6, marginBottom: 16 }}>
          Days are created as stubs. Add city and activity details in the Trip tab after creating.
        </p>

        <button
          onClick={handleCreate}
          style={{
            width: "100%", padding: "13px",
            background: T.accent, color: "#fff",
            border: "none", borderRadius: 10,
            fontSize: 14, fontWeight: 700, cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Create Trip
        </button>
      </div>
    </div>
  );
}
