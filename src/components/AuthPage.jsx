/* ─── AUTH PAGE ───────────────────────────────────────────────────────────────
   Multi-user auth with:
   - Google OAuth (primary, one-click)
   - Email OTP (secondary, magic link)

   Uses Supabase Auth — no passwords stored.
   ─────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { T } from "../theme";

const LOGO_STYLE = {
  fontFamily: "'Cormorant Garamond',serif",
  fontSize: 36,
  fontWeight: 700,
  letterSpacing: -1,
  color: T.text,
};

export default function AuthPage() {
  const [mode,    setMode]    = useState("landing"); // "landing" | "email" | "otp_sent"
  const [email,   setEmail]   = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  /* ── Google OAuth ── */
  async function handleGoogle() {
    if (!supabaseConfigured) {
      setError("Auth is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.local file.");
      return;
    }
    setError("");
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider:  "google",
      options:   { redirectTo: window.location.origin },
    });
    if (err) { setError(err.message); setLoading(false); }
  }

  /* ── Email OTP (magic link) ── */
  async function handleEmailOTP(e) {
    e.preventDefault();
    if (!email) return;
    if (!supabaseConfigured) {
      setError("Auth is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.local file.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (err) throw err;
      setMode("otp_sent");
    } catch (err) {
      setError(err.message || "Failed to send login link. Try again.");
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
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
        color: T.text,
        padding: "20px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:${T.bg};}
        ::placeholder{color:${T.light};}
        input:focus{border-color:${T.mid} !important;outline:none;}
        .auth-btn{transition:background 0.15s,opacity 0.15s;}
        .auth-btn:hover:not(:disabled){opacity:0.88;}
      `}</style>

      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: "44px 40px",
          width: "100%",
          maxWidth: 380,
        }}
      >
        {/* Wordmark */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p style={LOGO_STYLE}>Vesti</p>
          <p style={{ fontSize: 11, color: T.light, letterSpacing: 2, marginTop: 6, fontWeight: 500 }}>
            AI WARDROBE PLANNER
          </p>
        </div>

        {/* Dev-mode setup notice */}
        {!supabaseConfigured && (
          <div
            style={{
              background: "#1C1508",
              border: "1px solid #78350F",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 20,
              fontSize: 11,
              color: "#FBBF24",
              lineHeight: 1.6,
            }}
          >
            <strong>Setup required</strong> — add to <code style={{ background: "#2A1E08", padding: "1px 4px", borderRadius: 3 }}>.env.local</code>:<br />
            <code style={{ color: "#FCD34D" }}>VITE_SUPABASE_URL</code><br />
            <code style={{ color: "#FCD34D" }}>VITE_SUPABASE_ANON_KEY</code>
          </div>
        )}

        {/* OTP Sent confirmation */}
        {mode === "otp_sent" ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 28, marginBottom: 16 }}>✉️</p>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Check your inbox</p>
            <p style={{ fontSize: 13, color: T.mid, lineHeight: 1.6, marginBottom: 24 }}>
              We sent a magic link to <strong style={{ color: T.text }}>{email}</strong>.<br />
              Click it to sign in — no password needed.
            </p>
            <button
              onClick={() => { setMode("email"); setError(""); }}
              style={{
                background: "none",
                border: "none",
                color: T.mid,
                fontSize: 12,
                cursor: "pointer",
                letterSpacing: 0.5,
              }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            {/* Google */}
            <button
              className="auth-btn"
              onClick={handleGoogle}
              disabled={loading}
              style={{
                width: "100%",
                padding: "13px 16px",
                background: T.text,
                color: T.bg,
                border: "none",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 0.5,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 1, background: T.border }} />
              <span style={{ fontSize: 11, color: T.light, letterSpacing: 1 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: T.border }} />
            </div>

            {/* Email OTP */}
            {mode === "email" ? (
              <form onSubmit={handleEmailOTP}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  autoFocus
                  autoComplete="email"
                  style={{
                    width: "100%",
                    padding: "13px 14px",
                    background: T.alt,
                    border: `1px solid ${error ? "#EF4444" : T.border}`,
                    borderRadius: 8,
                    color: T.text,
                    fontSize: 15,
                    marginBottom: error ? 10 : 12,
                    display: "block",
                  }}
                />
                {error && (
                  <p style={{ color: "#EF4444", fontSize: 12, marginBottom: 12, textAlign: "center" }}>
                    {error}
                  </p>
                )}
                <button
                  className="auth-btn"
                  type="submit"
                  disabled={loading || !email}
                  style={{
                    width: "100%",
                    padding: "13px",
                    background: T.alt,
                    color: T.text,
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: 0.5,
                    cursor: loading || !email ? "not-allowed" : "pointer",
                    opacity: loading || !email ? 0.5 : 1,
                    marginBottom: 10,
                  }}
                >
                  {loading ? "Sending…" : "Send magic link"}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("landing"); setError(""); }}
                  style={{
                    background: "none",
                    border: "none",
                    color: T.light,
                    fontSize: 11,
                    cursor: "pointer",
                    width: "100%",
                    textAlign: "center",
                    letterSpacing: 0.5,
                  }}
                >
                  Back
                </button>
              </form>
            ) : (
              <>
                <button
                  className="auth-btn"
                  onClick={() => setMode("email")}
                  style={{
                    width: "100%",
                    padding: "13px 16px",
                    background: "none",
                    color: T.mid,
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Continue with Email
                </button>
                {error && (
                  <p style={{ color: "#EF4444", fontSize: 12, marginTop: 12, textAlign: "center" }}>
                    {error}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Footer attribution */}
      <p style={{ fontSize: 11, color: T.light, marginTop: 32, opacity: 0.6 }}>
        Designed &amp; developed by Sohil Gupta
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
