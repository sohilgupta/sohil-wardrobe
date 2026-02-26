/* ─── LOGIN PAGE ─────────────────────────────────────────────────────────────
   Shown when the user is not authenticated.
   POSTs to /api/auth/login — never touches credentials client-side.
   ─────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import { T } from "../theme";

export default function LoginPage({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ password }),
      });

      if (res.ok) {
        onLogin();
      } else {
        setError("Incorrect password");
        setPassword("");
      }
    } catch {
      setError("Connection error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
        color: T.text,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:${T.bg};}
        ::placeholder{color:${T.light};}
        input:focus{border-color:${T.mid} !important; outline:none;}
      `}</style>

      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: "40px 36px",
          width: "100%",
          maxWidth: 360,
          margin: "0 20px",
        }}
      >
        {/* Wordmark */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <p
            style={{
              fontFamily: "'Cormorant Garamond',serif",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: -0.5,
              color: T.text,
              marginBottom: 4,
            }}
          >
            SOHIL-WARDROBE
          </p>
          <p style={{ fontSize: 10, color: T.light, letterSpacing: 2, fontWeight: 600 }}>
            AUS·NZ 2026
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            autoComplete="current-password"
            style={{
              width: "100%",
              padding: "13px 14px",
              background: T.alt,
              border: `1px solid ${error ? "#EF4444" : T.border}`,
              borderRadius: 8,
              color: T.text,
              fontSize: 15,
              marginBottom: error ? 10 : 18,
              display: "block",
            }}
          />

          {error && (
            <p style={{ color: "#EF4444", fontSize: 12, marginBottom: 18, textAlign: "center" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: "100%",
              padding: "13px",
              background: T.text,
              color: T.bg,
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 1.5,
              cursor: loading || !password ? "not-allowed" : "pointer",
              opacity: loading || !password ? 0.55 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {loading ? "SIGNING IN…" : "ENTER"}
          </button>
        </form>
      </div>
    </div>
  );
}
