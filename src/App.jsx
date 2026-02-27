import { useState, useEffect } from "react";
import { T } from "./theme";
import useWardrobe from "./hooks/useWardrobe";
import useOutfits from "./hooks/useOutfits";
import WardrobeTab from "./components/WardrobeTab";
import TripTab from "./components/TripTab";
import OutfitTab from "./components/OutfitTab";
import AddTab from "./components/AddTab";
import PackTab from "./components/PackTab";
import OutfitsTab from "./components/OutfitsTab";
import LoginPage from "./components/LoginPage";

const NAV = [
  { id: "wardrobe", icon: "⊞", label: "WARDROBE" },
  { id: "trip",     icon: "✈", label: "TRIP" },
  { id: "daily",    icon: "◫", label: "DAILY" },
  { id: "outfit",   icon: "✦", label: "OUTFIT AI" },
  { id: "add",      icon: "+", label: "ADD" },
  { id: "packing",  icon: "⊛", label: "PACKING" },
];

const CACHE_KEYS = ["wdb_cache_v3", "wdb_overrides_v2", "wdb_drive_matches_v1"];

/* ─── ROOT — handles auth state before rendering anything sensitive ────────── */
export default function App() {
  // "checking" | "authenticated" | "unauthenticated"
  const [authState, setAuthState] = useState("checking");

  useEffect(() => {
    fetch("/api/auth/check")
      .then(async (r) => {
        if (!r.ok) { setAuthState("unauthenticated"); return; }
        // Parse JSON to confirm a real auth response (not an SPA HTML fallback)
        try {
          const data = await r.json();
          setAuthState(data.authenticated === true ? "authenticated" : "unauthenticated");
        } catch {
          setAuthState("unauthenticated");
        }
      })
      .catch(() => setAuthState("unauthenticated"));
  }, []);

  if (authState === "checking") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: T.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
        }}
      >
        <p style={{ fontSize: 10, color: T.light, letterSpacing: 3, fontWeight: 600 }}>
          LOADING…
        </p>
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return <LoginPage onLogin={() => setAuthState("authenticated")} />;
  }

  async function handleLogout() {
    // Clear all local caches before expiring the session cookie
    CACHE_KEYS.forEach((k) => localStorage.removeItem(k));
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setAuthState("unauthenticated");
  }

  return <AuthenticatedApp onLogout={handleLogout} />;
}

/* ─── AUTHENTICATED APP — only mounts after auth check passes ─────────────── */
function AuthenticatedApp({ onLogout }) {
  const [tab, setTab] = useState("wardrobe");

  const {
    items:      wardrobe,
    loading:    wLoading,
    syncStatus,
    lastSync,
    sync,
    editItem,
    deleteItem,
    addItem,
  } = useWardrobe();

  // Outfit-per-day state — shared between Daily and Packing tabs
  const { outfitIds, setOutfitIds } = useOutfits();

  const travel = wardrobe.filter((i) => i.t === "Yes").length;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
        color: T.text,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px}
        ::-webkit-scrollbar-track{background:transparent}
        select,input{outline:none;}
        select option{background:${T.surface};color:${T.text};}
        button:active{transform:scale(0.98);}
        body{background:${T.bg};color:${T.text};}
        ::placeholder{color:${T.light};}
        @keyframes slideUp{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}
      `}</style>

      {/* Header */}
      <div
        style={{
          background: T.surface,
          borderBottom: `1px solid ${T.borderLight}`,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 16px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              height: 54,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span
                style={{
                  fontFamily: "'Cormorant Garamond',serif",
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: -0.5,
                  color: T.text,
                }}
              >
                SOHIL-WARDROBE
              </span>
              <span style={{ fontSize: 10, color: T.light, letterSpacing: 2, fontWeight: 600 }}>
                AUS·NZ 2026
              </span>
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: T.text, lineHeight: 1 }}>
                  {wardrobe.length}
                </p>
                <p style={{ fontSize: 8, color: T.light, letterSpacing: 1, marginTop: 1 }}>ITEMS</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: T.green, lineHeight: 1 }}>
                  {travel}
                </p>
                <p style={{ fontSize: 8, color: T.light, letterSpacing: 1, marginTop: 1 }}>TRAVEL</p>
              </div>
              {/* Logout */}
              <button
                onClick={onLogout}
                title="Log out"
                style={{
                  background: "none",
                  border: `1px solid ${T.border}`,
                  borderRadius: 6,
                  color: T.light,
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: 1,
                  padding: "4px 8px",
                  cursor: "pointer",
                }}
              >
                EXIT
              </button>
            </div>
          </div>
          <div style={{ display: "flex", borderTop: `1px solid ${T.borderLight}` }}>
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                style={{
                  flex: 1,
                  padding: "9px 0 10px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  position: "relative",
                }}
              >
                <span style={{ fontSize: 13, color: tab === n.id ? T.text : T.light }}>{n.icon}</span>
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: tab === n.id ? 700 : 500,
                    color: tab === n.id ? T.text : T.light,
                    letterSpacing: 0.8,
                  }}
                >
                  {n.label}
                </span>
                {tab === n.id && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: "15%",
                      right: "15%",
                      height: 2,
                      background: T.text,
                      borderRadius: 2,
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px 100px" }}>
        {tab === "wardrobe" && (
          <WardrobeTab
            wardrobe={wardrobe}
            loading={wLoading}
            syncStatus={syncStatus}
            lastSync={lastSync}
            onSync={sync}
            onEdit={editItem}
            onDelete={deleteItem}
            onAdd={addItem}
          />
        )}
        {tab === "trip"    && <TripTab    wardrobe={wardrobe} />}
        {tab === "daily"   && <OutfitsTab wardrobe={wardrobe} loading={wLoading} outfitIds={outfitIds} setOutfitIds={setOutfitIds} />}
        {tab === "outfit"  && <OutfitTab  wardrobe={wardrobe} />}
        {tab === "add"     && <AddTab     onAdd={addItem} />}
        {tab === "packing" && <PackTab    wardrobe={wardrobe} outfitIds={outfitIds} />}
      </div>
    </div>
  );
}
