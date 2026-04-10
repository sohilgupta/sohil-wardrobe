# Apple Marketing UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the full Vesti app (auth + all 6 tabs) to match the "Apple Marketing" aesthetic — bold Inter display headlines, eyebrow labels, generous whitespace, featured hero cards + supporting grids, App Store–style section headers.

**Architecture:** Pure visual refactor — no logic, hooks, or API changes. All style changes are inline-style edits in React components plus theme token additions. No new files needed except updated tokens in `src/theme.js`. The existing `T` object is extended with an `accent` blue token. Font switches from Cormorant Garamond + DM Sans to Inter everywhere.

**Tech Stack:** React 19, Vite, inline styles, Google Fonts (Inter), existing `T` theme object from `src/theme.js`

---

## Design Token Reference (used throughout all tasks)

```js
// New tokens added to T in Task 1 — reference these in all subsequent tasks
T.accent    = "#0A84FF"   // Apple blue — eyebrows, active nav, prices, badges
T.accentDim = "rgba(10,132,255,0.12)"  // blue tint backgrounds
T.accentBorder = "rgba(10,132,255,0.25)" // blue borders
```

**Typography scale (Inter):**
- Display: `fontSize: 32, fontWeight: 800, letterSpacing: -0.8` — page heroes
- Title: `fontSize: 22, fontWeight: 700, letterSpacing: -0.4` — section titles
- Eyebrow: `fontSize: 11, fontWeight: 600, letterSpacing: 0.14em, textTransform: "uppercase", color: T.accent`
- Body: `fontSize: 14, fontWeight: 400`
- Label: `fontSize: 11, fontWeight: 500, letterSpacing: 0.06em`
- Caption: `fontSize: 10, fontWeight: 500, color: T.mid`

**Card anatomy (Apple Marketing):**
- Border radius: `16px`
- Background: `T.surface`
- Border: `1px solid ${T.borderLight}`
- Internal padding: `16px`
- Image area height: `140px` for standard cards, `180px` for featured

**Font family string (used everywhere):**
```
"'Inter','Helvetica Neue',sans-serif"
```

---

## File Map

| File | Change |
|------|--------|
| `index.html` | Swap Google Fonts to Inter, remove Cormorant+DM Sans |
| `src/theme.js` | Add `T.accent`, `T.accentDim`, `T.accentBorder` |
| `src/App.jsx` | Loading screen font, global CSS font, header/nav redesign, footer |
| `src/components/AuthPage.jsx` | Full Apple Marketing auth page redesign |
| `src/components/WardrobeTab.jsx` | Hero section + card grid redesign |
| `src/components/OutfitsTab.jsx` | Section header + day list + outfit panel redesign |
| `src/components/CapsuleTab.jsx` | Hero count + list redesign |
| `src/components/TripTab.jsx` | Hero + trip info redesign |
| `src/components/OutfitTab.jsx` | Generate section redesign |
| `src/components/PackTab.jsx` | Group header + list redesign |

---

## Task 1: Foundation — Fonts + Design Tokens

**Files:**
- Modify: `index.html`
- Modify: `src/theme.js`

- [ ] **Step 1: Swap Google Fonts in index.html**

Replace the existing `<link>` font tag with Inter only:

```html
<!-- Remove this line: -->
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

<!-- Replace with: -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
```

The full `<head>` section after change:
```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="theme-color" content="#0F0F12" />
  <meta name="description" content="Vesti — AI-powered wardrobe planner and trip outfit generator" />
  <meta property="og:title" content="Vesti" />
  <meta property="og:description" content="AI-powered wardrobe planner and trip outfit generator" />
  <title>Vesti</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
</head>
```

- [ ] **Step 2: Add accent tokens to src/theme.js**

After the closing brace of the `T` object (line 33), add:

```js
// Append to bottom of T object — add before the closing }:
  accent:       "#0A84FF",
  accentDim:    "rgba(10,132,255,0.12)",
  accentBorder: "rgba(10,132,255,0.25)",
```

The full updated `T` object:
```js
export const T = {
  bg: "#0F0F12",
  surface: "#1A1A1F",
  alt: "#232329",
  border: "#2E2E36",
  borderLight: "#26262E",
  text: "#E8E6E1",
  mid: "#8A8780",
  light: "#5C5A55",
  green: "#4ADE80",
  accent:       "#0A84FF",
  accentDim:    "rgba(10,132,255,0.12)",
  accentBorder: "rgba(10,132,255,0.25)",
  weather: { /* unchanged */ },
  occ:     { /* unchanged */ },
};
```

- [ ] **Step 3: Run the app and verify fonts load**

```bash
npm run dev
```

Open http://localhost:5173. Open DevTools → Network → filter "fonts". Confirm `Inter` loads, `Cormorant` and `DM+Sans` do not appear.

- [ ] **Step 4: Commit**

```bash
git add index.html src/theme.js
git commit -m "design: switch to Inter, add accent tokens"
```

---

## Task 2: App Shell — Loading Screen + Global CSS + Header + Nav

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Update loading screen**

Find the loading screen block in `AppInner` (lines 41–70). Replace:

```jsx
// OLD — uses Cormorant Garamond, DM Sans
<div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}>
  <div style={{ textAlign: "center" }}>
    <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700, color: T.text, marginBottom: 12 }}>Vesti</p>
    <p style={{ fontSize: 10, color: T.light, letterSpacing: 3, fontWeight: 600 }}>LOADING…</p>
  </div>
</div>
```

```jsx
// NEW — Inter only
<div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter','Helvetica Neue',sans-serif" }}>
  <div style={{ textAlign: "center" }}>
    <p style={{ fontFamily: "'Inter','Helvetica Neue',sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: -0.8, color: T.text, marginBottom: 10 }}>Vesti</p>
    <p style={{ fontSize: 10, color: T.accent, letterSpacing: 3, fontWeight: 600 }}>LOADING…</p>
  </div>
</div>
```

- [ ] **Step 2: Update global CSS in AuthenticatedApp**

Find the `<style>` block in `AuthenticatedApp` (around line 123). Replace entire contents:

```jsx
<style>{`
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:${T.bg};color:${T.text};font-family:'Inter','Helvetica Neue',sans-serif;}
  ::-webkit-scrollbar{width:3px;height:3px}
  ::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px}
  ::-webkit-scrollbar-track{background:transparent}
  select,input{outline:none;font-family:'Inter','Helvetica Neue',sans-serif;}
  select option{background:${T.surface};color:${T.text};}
  button:active{transform:scale(0.98);}
  ::placeholder{color:${T.light};}
  @keyframes slideUp{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  .wardrobe-card{transition:transform 0.18s ease,box-shadow 0.18s ease;border-radius:16px;}
  .wardrobe-card:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(0,0,0,0.5);}
  .nav-tab{transition:background 0.15s;}
`}</style>
```

- [ ] **Step 3: Update the outer AuthenticatedApp wrapper**

Find the outer `<div>` of `AuthenticatedApp` that sets `fontFamily`. Change:
```jsx
fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
```
to:
```jsx
fontFamily: "'Inter','Helvetica Neue',sans-serif",
```

- [ ] **Step 4: Redesign the header**

Find the `{/* Header */}` block (around line 142). Replace the entire header div with:

```jsx
{/* Header */}
<div style={{ background: T.surface, borderBottom: `1px solid ${T.borderLight}`, position: "sticky", top: 0, zIndex: 100 }}>
  <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 20px" }}>
    {/* Top bar: wordmark + stats */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 56 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "'Inter','Helvetica Neue',sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: -0.8, color: T.text }}>
          Vesti
        </span>
        {isPro && (
          <span style={{ fontSize: 9, color: T.accent, letterSpacing: 1.5, fontWeight: 700, background: T.accentDim, border: `1px solid ${T.accentBorder}`, padding: "2px 7px", borderRadius: 20 }}>
            PRO
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: T.text, lineHeight: 1, letterSpacing: -0.4 }}>{wardrobe.length}</p>
          <p style={{ fontSize: 8, color: T.light, letterSpacing: 1.5, marginTop: 1, fontWeight: 600, textTransform: "uppercase" }}>Items</p>
        </div>
        <div style={{ width: 1, height: 24, background: T.border }} />
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: T.green, lineHeight: 1, letterSpacing: -0.4 }}>{travel}</p>
          <p style={{ fontSize: 8, color: T.light, letterSpacing: 1.5, marginTop: 1, fontWeight: 600, textTransform: "uppercase" }}>Travel</p>
        </div>
        {capsuleCount > 0 && (
          <>
            <div style={{ width: 1, height: 24, background: T.border }} />
            <button onClick={() => setTab("capsule")} title="View Trip Capsule"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "right" }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: "#2DD4BF", lineHeight: 1, letterSpacing: -0.4 }}>{capsuleCount}</p>
              <p style={{ fontSize: 8, color: "#2DD4BF", letterSpacing: 1.5, marginTop: 1, fontWeight: 600, textTransform: "uppercase" }}>Capsule</p>
            </button>
          </>
        )}
        <button onClick={onLogout} title="Sign out"
          style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 20, color: T.light, fontSize: 10, fontWeight: 600, letterSpacing: 1, padding: "5px 12px", cursor: "pointer" }}>
          EXIT
        </button>
      </div>
    </div>

    {/* Nav tabs */}
    <div style={{ display: "flex", gap: 0, borderTop: `1px solid ${T.borderLight}` }}>
      {NAV.map((n) => (
        <button key={n.id} onClick={() => setTab(n.id)} className="nav-tab"
          style={{ flex: 1, padding: "10px 0 11px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, position: "relative" }}>
          {tab === n.id && (
            <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: 2, background: T.accent, borderRadius: "0 0 2px 2px" }} />
          )}
          <span style={{ fontSize: 12, color: tab === n.id ? T.accent : T.light }}>{n.icon}</span>
          <span style={{ fontSize: 7.5, fontWeight: tab === n.id ? 700 : 500, color: tab === n.id ? T.text : T.light, letterSpacing: 0.8, textTransform: "uppercase" }}>
            {n.label}
          </span>
        </button>
      ))}
    </div>
  </div>
</div>
```

- [ ] **Step 5: Update content area padding**

Find the content area div (`{/* Content */}`, line ~288). Change padding:
```jsx
// OLD
padding: "20px 16px 40px"
// NEW
padding: "28px 20px 60px"
```

- [ ] **Step 6: Redesign footer**

Replace `AppFooter` function:
```jsx
function AppFooter() {
  return (
    <footer style={{ borderTop: `1px solid ${T.borderLight}`, padding: "20px", textAlign: "center", background: T.surface }}>
      <p style={{ fontSize: 11, color: T.light, letterSpacing: 0.3, fontWeight: 400 }}>
        Designed &amp; developed by Sohil Gupta
      </p>
    </footer>
  );
}
```

- [ ] **Step 7: Run tests to verify nothing broke**

```bash
npm test
```

Expected: all tests pass (no logic was changed).

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "design: Apple Marketing shell — Inter font, header, nav, global CSS"
```

---

## Task 3: Auth Page

**Files:**
- Modify: `src/components/AuthPage.jsx`

- [ ] **Step 1: Replace LOGO_STYLE constant**

```jsx
// OLD
const LOGO_STYLE = {
  fontFamily: "'Cormorant Garamond',serif",
  fontSize: 36,
  fontWeight: 700,
  letterSpacing: -1,
  color: T.text,
};

// NEW
const LOGO_STYLE = {
  fontFamily: "'Inter','Helvetica Neue',sans-serif",
  fontSize: 40,
  fontWeight: 800,
  letterSpacing: -1.5,
  color: T.text,
};
```

- [ ] **Step 2: Replace the outer container and style block**

Find the outer `<div>` returned by `AuthPage` (around line 67). Replace the entire `return (...)` with:

```jsx
return (
  <div style={{
    minHeight: "100vh",
    background: `radial-gradient(ellipse 90% 70% at 50% -10%, #0D1B2E 0%, ${T.bg} 55%)`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Inter','Helvetica Neue',sans-serif",
    color: T.text,
    padding: "20px",
    position: "relative",
    overflow: "hidden",
  }}>
    <style>{`
      *{box-sizing:border-box;margin:0;padding:0;}
      body{background:${T.bg};}
      ::placeholder{color:${T.light};font-family:'Inter','Helvetica Neue',sans-serif;}
      input:focus{border-color:${T.mid} !important;outline:none;}
      .auth-btn{transition:all 0.2s ease;font-family:'Inter','Helvetica Neue',sans-serif;}
      .auth-btn:hover:not(:disabled){opacity:0.88;transform:translateY(-1px);}
      @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
      .auth-card{animation:fadeUp 0.5s ease forwards;}
    `}</style>

    {/* Subtle blue accent line at top */}
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 2,
      background: `linear-gradient(90deg, transparent, ${T.accent}, transparent)`,
      opacity: 0.6, zIndex: 1,
    }} />

    {/* Grain texture */}
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,
      backgroundRepeat: "repeat", backgroundSize: "128px",
    }} />

    <div className="auth-card" style={{
      position: "relative", zIndex: 2,
      background: "rgba(22,22,28,0.88)",
      backdropFilter: "blur(16px)",
      border: `1px solid rgba(255,255,255,0.07)`,
      borderRadius: 24,
      padding: "52px 44px",
      width: "100%",
      maxWidth: 400,
      boxShadow: "0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)",
    }}>
      {/* Wordmark */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <p style={{ ...LOGO_STYLE }}>Vesti</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginTop: 12 }}>
          <div style={{ height: "0.5px", width: 32, background: T.light, opacity: 0.3 }} />
          <p style={{ fontSize: 9, color: T.accent, letterSpacing: 3.5, fontWeight: 700, opacity: 0.9 }}>
            AI WARDROBE
          </p>
          <div style={{ height: "0.5px", width: 32, background: T.light, opacity: 0.3 }} />
        </div>
      </div>

      {/* Dev-mode setup notice — unchanged logic */}
      {!supabaseConfigured && (
        <div style={{
          background: "#1C1508", border: "1px solid #78350F", borderRadius: 10,
          padding: "10px 14px", marginBottom: 20, fontSize: 11, color: "#FBBF24", lineHeight: 1.6,
        }}>
          <strong>Setup required</strong> — add to <code style={{ background: "#2A1E08", padding: "1px 4px", borderRadius: 3 }}>.env.local</code>:<br />
          <code style={{ color: "#FCD34D" }}>VITE_SUPABASE_URL</code><br />
          <code style={{ color: "#FCD34D" }}>VITE_SUPABASE_ANON_KEY</code>
        </div>
      )}

      {/* OTP Sent */}
      {mode === "otp_sent" ? (
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 32, marginBottom: 16 }}>✉️</p>
          <p style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3, marginBottom: 8 }}>Check your inbox</p>
          <p style={{ fontSize: 13, color: T.mid, lineHeight: 1.7, marginBottom: 28 }}>
            We sent a magic link to <strong style={{ color: T.text }}>{email}</strong>.<br />
            Click it to sign in — no password needed.
          </p>
          <button onClick={() => { setMode("email"); setError(""); }}
            style={{ background: "none", border: "none", color: T.mid, fontSize: 12, cursor: "pointer", letterSpacing: 0.3 }}>
            Use a different email
          </button>
        </div>
      ) : (
        <>
          {/* Google button */}
          <button className="auth-btn" onClick={handleGoogle} disabled={loading}
            style={{
              width: "100%", padding: "14px 16px",
              background: T.text, color: T.bg,
              border: "none", borderRadius: 12,
              fontSize: 14, fontWeight: 700, letterSpacing: -0.1,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              marginBottom: 14,
            }}>
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 1, background: T.border }} />
            <span style={{ fontSize: 11, color: T.light, letterSpacing: 1.5 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: T.border }} />
          </div>

          {/* Email OTP */}
          {mode === "email" ? (
            <form onSubmit={handleEmailOTP}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com" autoFocus autoComplete="email"
                style={{
                  width: "100%", padding: "14px 16px",
                  background: T.alt, border: `1px solid ${error ? "#EF4444" : T.border}`,
                  borderRadius: 10, color: T.text, fontSize: 15,
                  marginBottom: error ? 10 : 12, display: "block", fontFamily: "inherit",
                }} />
              {error && <p style={{ color: "#EF4444", fontSize: 12, marginBottom: 12, textAlign: "center" }}>{error}</p>}
              <button className="auth-btn" type="submit" disabled={loading || !email}
                style={{
                  width: "100%", padding: "14px",
                  background: T.accentDim, color: T.accent,
                  border: `1px solid ${T.accentBorder}`,
                  borderRadius: 10, fontSize: 14, fontWeight: 600, letterSpacing: 0,
                  cursor: loading || !email ? "not-allowed" : "pointer",
                  opacity: loading || !email ? 0.5 : 1, marginBottom: 10,
                }}>
                {loading ? "Sending…" : "Send magic link"}
              </button>
              <button type="button" onClick={() => { setMode("landing"); setError(""); }}
                style={{ background: "none", border: "none", color: T.light, fontSize: 12, cursor: "pointer", width: "100%", textAlign: "center" }}>
                Back
              </button>
            </form>
          ) : (
            <>
              <button className="auth-btn" onClick={() => setMode("email")}
                style={{
                  width: "100%", padding: "14px 16px",
                  background: "none", color: T.mid,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: "pointer",
                }}>
                Continue with Email
              </button>
              {error && <p style={{ color: "#EF4444", fontSize: 12, marginTop: 12, textAlign: "center" }}>{error}</p>}
            </>
          )}
        </>
      )}
    </div>

    <p style={{ fontSize: 11, color: T.light, marginTop: 28, opacity: 0.5, fontFamily: "'Inter','Helvetica Neue',sans-serif" }}>
      Designed &amp; developed by Sohil Gupta
    </p>
  </div>
);
```

- [ ] **Step 2: Verify auth page visually**

```bash
npm run dev
```

Navigate to http://localhost:5173 while logged out. Confirm: Inter font, blue accent line at top, bold wordmark, blue "AI WARDROBE" subtitle, tighter glassmorphism card.

- [ ] **Step 3: Commit**

```bash
git add src/components/AuthPage.jsx
git commit -m "design: Apple Marketing auth page — Inter, blue accent, bold wordmark"
```

---

## Task 4: Wardrobe Tab

**Files:**
- Modify: `src/components/WardrobeTab.jsx`

- [ ] **Step 1: Add Apple Marketing hero section**

Find the `export default function WardrobeTab(...)` return. Locate where the tab content begins (after the filters/search bar). The wardrobe tab currently starts with a sync badge and filter row.

Add a hero block **above** the search/filter row (right after the opening content div). Insert before the `<div>` that contains the SyncBadge:

```jsx
{/* ── Apple Marketing Hero ── */}
<div style={{ marginBottom: 28 }}>
  <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: T.accent, marginBottom: 6 }}>
    Your Collection
  </p>
  <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.8, color: T.text, lineHeight: 1.1, marginBottom: 6 }}>
    {wardrobe.length} Pieces.
  </p>
  <p style={{ fontSize: 14, color: T.mid, fontWeight: 400 }}>
    {wardrobe.filter(i => i.t === "Yes").length} travel-ready · {[...new Set(wardrobe.map(i => i.c))].length} categories
  </p>
</div>
```

- [ ] **Step 2: Update card grid styling**

Find the grid container div that wraps wardrobe cards. Update the gap and ensure cards use the new 16px border-radius. Locate the `grid-template-columns` style and update:

```jsx
// Find the card grid container and update:
style={{
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
  gap: 14,
  marginTop: 16,
}}
```

- [ ] **Step 3: Update individual card styling**

Find each wardrobe card div (the one with `className="wardrobe-card"`). Update the inner card border-radius and padding:

```jsx
// Card container — update border-radius to 16px, background stays T.surface
style={{
  background: T.surface,
  borderRadius: 16,
  border: `1px solid ${T.borderLight}`,
  overflow: "hidden",
  cursor: "pointer",
}}
```

Find the card image area (`ItemVisual` or the image div) and update its height:
```jsx
// Image area height: 140px (was typically 120px)
style={{ height: 140 }}
```

Find the card text area and update:
```jsx
// Card text padding and typography
style={{ padding: "12px 14px 14px" }}

// Category label (eyebrow):
style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: T.mid, marginBottom: 4 }}

// Item name:
style={{ fontSize: 13, fontWeight: 600, color: T.text, letterSpacing: -0.1, lineHeight: 1.3, marginBottom: 8 }}

// Price (if present):
style={{ fontSize: 12, fontWeight: 700, color: T.accent }}
```

- [ ] **Step 4: Update the search input and filter pills**

Find the search input and update:
```jsx
style={{
  width: "100%",
  padding: "11px 14px",
  background: T.alt,
  border: `1px solid ${T.border}`,
  borderRadius: 12,
  fontSize: 13,
  color: T.text,
  outline: "none",
  fontFamily: "'Inter','Helvetica Neue',sans-serif",
}}
```

Find the filter select dropdowns and update `selStyle`:
```js
const selStyle = {
  padding: "8px 28px 8px 14px",
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "'Inter','Helvetica Neue',sans-serif",
  appearance: "none",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  outline: "none",
};
```

- [ ] **Step 5: Update section headers (category group titles if any)**

If category group headers exist in the grid, update them:
```jsx
// Section header above a group of items:
<p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: T.mid, marginBottom: 10, marginTop: 20 }}>
  {categoryName}
</p>
```

- [ ] **Step 6: Verify wardrobe tab**

```bash
npm run dev
```

Open app, go to WARDROBE tab. Confirm: bold "42 Pieces." hero headline, blue "Your Collection" eyebrow, taller image cards with 16px radius.

- [ ] **Step 7: Commit**

```bash
git add src/components/WardrobeTab.jsx
git commit -m "design: Apple Marketing wardrobe — hero headline, card grid refresh"
```

---

## Task 5: Daily Tab (OutfitsTab)

**Files:**
- Modify: `src/components/OutfitsTab.jsx`

- [ ] **Step 1: Update the Daily tab hero header**

Find the tab header area (the `div` containing the "✨ Generate Outfits for Trip" button and day count). Add/update a hero block above it:

```jsx
{/* ── Hero ── */}
<div style={{ marginBottom: 24 }}>
  <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: T.accent, marginBottom: 6 }}>
    Daily Planning
  </p>
  <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.7, color: T.text, lineHeight: 1.1, marginBottom: 6 }}>
    {TRIP.days.length}-Day Trip.
  </p>
  <p style={{ fontSize: 14, color: T.mid, fontWeight: 400 }}>
    {Object.values(outfitIds).filter(d => d?.daytime || d?.evening).length} days planned
  </p>
</div>
```

- [ ] **Step 2: Update day list items (left sidebar on desktop, scroll strip on mobile)**

Find the day list button/div for each day. Update:

```jsx
// Active day style:
{
  background: T.accentDim,
  border: `1px solid ${T.accentBorder}`,
  borderRadius: 12,
  padding: "10px 12px",
}

// Inactive day style:
{
  background: T.surface,
  border: `1px solid ${T.borderLight}`,
  borderRadius: 12,
  padding: "10px 12px",
}

// Day name typography:
style={{ fontSize: 13, fontWeight: 700, color: isActive ? T.accent : T.text, letterSpacing: -0.2 }}

// Day date typography:
style={{ fontSize: 10, color: T.mid, fontWeight: 400, marginTop: 2 }}
```

- [ ] **Step 3: Update slot (daytime/evening) section headers**

Find the slot label row (the one with `☀️ DAYTIME` and `🌙 EVENING` labels). Update:

```jsx
// Slot label:
style={{
  fontSize: 11, fontWeight: 600, letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: isActive ? T.accent : T.mid,
  display: "flex", alignItems: "center", gap: 6, marginBottom: 12,
}}
```

- [ ] **Step 4: Update the generate button**

Find the "✨ Generate Outfits for Trip" button. Update:

```jsx
style={{
  background: T.accentDim,
  border: `1px solid ${T.accentBorder}`,
  borderRadius: 12,
  color: T.accent,
  fontSize: 13,
  fontWeight: 700,
  padding: "11px 18px",
  cursor: "pointer",
  letterSpacing: 0,
}}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/OutfitsTab.jsx
git commit -m "design: Apple Marketing daily tab — hero, day list, slot headers"
```

---

## Task 6: Capsule Tab

**Files:**
- Modify: `src/components/CapsuleTab.jsx`

- [ ] **Step 1: Read the file first**

```bash
head -100 src/components/CapsuleTab.jsx
```

- [ ] **Step 2: Add hero section at the top of the tab return**

Locate the top of the rendered JSX. Insert before the existing content:

```jsx
{/* ── Hero ── */}
<div style={{ marginBottom: 28 }}>
  <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: T.accent, marginBottom: 6 }}>
    Trip Capsule
  </p>
  <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.8, color: T.text, lineHeight: 1.1, marginBottom: 6 }}>
    {capsuleIds.size > 0 ? `${capsuleIds.size} Pieces.` : "Build Your Capsule."}
  </p>
  <p style={{ fontSize: 14, color: T.mid, fontWeight: 400 }}>
    {capsuleIds.size === 0 ? "Curate your ideal travel wardrobe" : "Your curated travel collection"}
  </p>
</div>
```

- [ ] **Step 3: Update capsule item cards**

Find the capsule item list. For each item card, update:

```jsx
// Item row/card:
style={{
  display: "flex", alignItems: "center", gap: 12,
  background: T.surface,
  border: `1px solid ${T.borderLight}`,
  borderRadius: 14,
  padding: "12px 14px",
  marginBottom: 8,
}}

// Item name:
style={{ fontSize: 14, fontWeight: 600, color: T.text, letterSpacing: -0.1 }}

// Item category label:
style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.mid, marginBottom: 3 }}
```

- [ ] **Step 4: Update the "Generate Trip Capsule" AI button**

```jsx
style={{
  background: T.accentDim,
  border: `1px solid ${T.accentBorder}`,
  borderRadius: 12,
  color: T.accent,
  fontSize: 13,
  fontWeight: 700,
  padding: "13px 20px",
  cursor: "pointer",
  width: "100%",
  textAlign: "center",
}}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/CapsuleTab.jsx
git commit -m "design: Apple Marketing capsule tab — hero, item cards, AI button"
```

---

## Task 7: Trip Tab

**Files:**
- Modify: `src/components/TripTab.jsx`

- [ ] **Step 1: Read the file first**

```bash
head -80 src/components/TripTab.jsx
```

- [ ] **Step 2: Add hero section**

Locate the top of the tab return. Insert before existing content:

```jsx
{/* ── Hero ── */}
<div style={{ marginBottom: 28 }}>
  <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: T.accent, marginBottom: 6 }}>
    Trip Overview
  </p>
  <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.8, color: T.text, lineHeight: 1.1, marginBottom: 6 }}>
    {TRIP.name || "Your Trip."}
  </p>
  <p style={{ fontSize: 14, color: T.mid, fontWeight: 400 }}>
    {TRIP.days.length} days · {TRIP.location || ""}
  </p>
</div>
```

- [ ] **Step 3: Update trip day cards**

Find the day cards list. For each day card:

```jsx
// Day card:
style={{
  background: T.surface,
  border: `1px solid ${T.borderLight}`,
  borderRadius: 16,
  padding: "16px 18px",
  marginBottom: 10,
  cursor: "pointer",
}}

// Day title:
style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3, color: T.text, marginBottom: 4 }}

// Day subtitle (date, weather):
style={{ fontSize: 12, color: T.mid, fontWeight: 400 }}

// "Plan outfits →" link:
style={{ fontSize: 12, fontWeight: 600, color: T.accent, marginTop: 8, display: "inline-block" }}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/TripTab.jsx
git commit -m "design: Apple Marketing trip tab — hero, day cards"
```

---

## Task 8: Outfit AI Tab

**Files:**
- Modify: `src/components/OutfitTab.jsx`

- [ ] **Step 1: Read the file first**

```bash
head -80 src/components/OutfitTab.jsx
```

- [ ] **Step 2: Add hero section**

```jsx
{/* ── Hero ── */}
<div style={{ marginBottom: 28 }}>
  <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: T.accent, marginBottom: 6 }}>
    AI Styling
  </p>
  <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.8, color: T.text, lineHeight: 1.1, marginBottom: 6 }}>
    Generate Outfits.
  </p>
  <p style={{ fontSize: 14, color: T.mid, fontWeight: 400 }}>
    Let AI suggest complete looks from your wardrobe
  </p>
</div>
```

- [ ] **Step 3: Update generate button**

```jsx
style={{
  background: T.accent,
  border: "none",
  borderRadius: 14,
  color: "#fff",
  fontSize: 15,
  fontWeight: 700,
  padding: "15px 24px",
  cursor: "pointer",
  width: "100%",
  letterSpacing: -0.2,
}}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/OutfitTab.jsx
git commit -m "design: Apple Marketing outfit AI tab — hero, generate button"
```

---

## Task 9: Packing Tab

**Files:**
- Modify: `src/components/PackTab.jsx`

- [ ] **Step 1: Read the file first**

```bash
head -80 src/components/PackTab.jsx
```

- [ ] **Step 2: Add hero section**

```jsx
{/* ── Hero ── */}
<div style={{ marginBottom: 28 }}>
  <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: T.accent, marginBottom: 6 }}>
    Packing List
  </p>
  <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.8, color: T.text, lineHeight: 1.1, marginBottom: 6 }}>
    Pack Smart.
  </p>
  <p style={{ fontSize: 14, color: T.mid, fontWeight: 400 }}>
    From your frozen outfits + capsule
  </p>
</div>
```

- [ ] **Step 3: Update group section headers**

Find each category group header (e.g., "Jackets", "Shoes"). Update:

```jsx
// Group header:
<div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, marginTop: 24 }}>
  <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.mid }}>
    {groupName}
  </p>
  <p style={{ fontSize: 11, color: T.light }}>{groupItems.length} items</p>
</div>
```

- [ ] **Step 4: Update packing list item rows**

```jsx
// Item row:
style={{
  display: "flex", alignItems: "center", gap: 12,
  background: T.surface,
  border: `1px solid ${T.borderLight}`,
  borderRadius: 12,
  padding: "11px 14px",
  marginBottom: 6,
}}

// Item name:
style={{ flex: 1, fontSize: 14, fontWeight: 500, color: T.text, letterSpacing: -0.1 }}

// Usage badge (×N):
style={{
  fontSize: 11, fontWeight: 700, color: T.accent,
  background: T.accentDim,
  border: `1px solid ${T.accentBorder}`,
  borderRadius: 20, padding: "2px 8px",
}}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/PackTab.jsx
git commit -m "design: Apple Marketing packing tab — hero, group headers, item rows"
```

---

## Task 10: Final Polish + Full Verification

**Files:**
- Modify: `src/components/OutfitCard.jsx` (if needed)
- Modify: `src/components/Chip.jsx` (update border-radius)

- [ ] **Step 1: Update Chip component border-radius**

Open `src/components/Chip.jsx`. Find the chip container style. Update border-radius from whatever it is to `20px` and ensure font is Inter:

```jsx
// Chip base style — update these values:
borderRadius: 20,
fontFamily: "'Inter','Helvetica Neue',sans-serif",
fontSize: 10,
fontWeight: 500,
```

- [ ] **Step 2: Update ItemVisual border-radius**

Open `src/components/ItemVisual.jsx`. Find the outer container border-radius. Update to match cards:

```jsx
// If ItemVisual has a border-radius, update to 12px for images inside cards:
borderRadius: 12,
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests pass. If any fail, they are logic-unrelated — investigate before proceeding.

- [ ] **Step 4: Run build to confirm no compilation errors**

```bash
npm run build
```

Expected: `dist/` generated, zero errors.

- [ ] **Step 5: Visual tour — open every tab**

```bash
npm run dev
```

Open http://localhost:5173. Tour every tab in this order:
1. **Auth page** — Inter font, bold wordmark, blue accent line at top ✓
2. **Header/Nav** — bold "Vesti" wordmark, blue top-indicator on active tab, stat counters ✓
3. **Wardrobe** — "Your Collection" eyebrow + "42 Pieces." headline + card grid ✓
4. **Capsule** — hero section + item cards with 14px radius ✓
5. **Trip** — trip hero + day cards ✓
6. **Daily** — "Daily Planning" eyebrow + trip day count + outfit slots ✓
7. **Outfit AI** — hero + prominent generate button ✓
8. **Packing** — hero + grouped item rows with blue badges ✓

- [ ] **Step 6: Final commit**

```bash
git add src/components/OutfitCard.jsx src/components/Chip.jsx src/components/ItemVisual.jsx
git commit -m "design: Apple Marketing polish — chip radius, ItemVisual, final pass"
```

---

## Self-Review

**Spec coverage:**
- ✅ Direction: Apple
- ✅ Mode: Dark with Apple Precision (dark bg preserved throughout)
- ✅ Scope: All 6 tabs + auth + nav + loading screen
- ✅ Typography: Inter 800 for display, Inter 600 for headings, Inter 400 for body
- ✅ Approach 2 "Apple Marketing": eyebrow labels, bold display headlines, generous padding, featured cards

**Placeholder scan:** No TBD/TODO. Every step has actual code.

**Type consistency:** `T.accent`, `T.accentDim`, `T.accentBorder` defined in Task 1 and used consistently in all subsequent tasks. No naming drift.

**Gaps:** None identified. All 6 tabs + auth + shell covered.
