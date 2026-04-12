import { useState } from "react";
import { T } from "./theme";
import { AuthProvider, useAuth, useTier } from "./contexts/AuthContext";
import useWardrobe from "./hooks/useWardrobe";
import useOutfits from "./hooks/useOutfits";
import useCapsule from "./hooks/useCapsule";
import useProfile from "./hooks/useProfile";
import WardrobeTab from "./components/WardrobeTab";
import TripTab from "./components/TripTab";
import OutfitTab from "./components/OutfitTab";
import PackTab from "./components/PackTab";
import OutfitsTab from "./components/OutfitsTab";
import CapsuleTab from "./components/CapsuleTab";
import ProfileTab from "./components/ProfileTab";
import UpgradePrompt from "./components/UpgradePrompt";

const NAV = [
  { id: "wardrobe", icon: "⊞", label: "WARDROBE" },
  { id: "capsule",  icon: "◈", label: "CAPSULE" },
  { id: "trip",     icon: "✈", label: "TRIP" },
  { id: "daily",    icon: "◫", label: "DAILY" },
  { id: "outfit",   icon: "✦", label: "OUTFIT AI" },
  { id: "packing",  icon: "⊛", label: "PACKING" },
  { id: "profile",  icon: "◉", label: "PROFILE" },
];

/* ─── ROOT — wraps everything in AuthProvider ─────────────────────────────── */
export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

/* ─── INNER — reads auth state after provider is mounted ──────────────────── */
function AppInner() {
  const { loading, signOut } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter','Helvetica Neue',sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "'Inter','Helvetica Neue',sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: -0.8, color: T.text, marginBottom: 10 }}>Vesti</p>
          <p style={{ fontSize: 10, color: T.accent, letterSpacing: 3, fontWeight: 600 }}>LOADING…</p>
        </div>
      </div>
    );
  }

  // Guests and logged-in users both proceed into the app.
  // UpgradePrompt handles auth/upgrade flow when limits are hit.
  return <AuthenticatedApp onLogout={signOut} />;
}

/* ─── AUTHENTICATED APP — only mounts after auth check passes ─────────────── */
function AuthenticatedApp({ onLogout }) {
  const [tab, setTab] = useState("wardrobe");
  const [focusDayId, setFocusDayId] = useState(null);
  const { isPro, tier, isGuest } = useTier();

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

  const { outfitIds, setOutfitIds, frozenDays, toggleFreeze, setManyFrozenDays } = useOutfits();
  const { capsuleIds, toggleCapsule, setManyCapsule, clearCapsule } = useCapsule();
  const { photos: profilePhotos, addPhoto, removePhoto, clearAll: clearAllPhotos, MAX_PHOTOS } = useProfile();

  const travel      = wardrobe.filter((i) => i.t === "Yes").length;
  const capsuleCount = capsuleIds.size;

  function navigateToDay(dayId) {
    setFocusDayId(dayId);
    setTab("daily");
  }

  function navigateToProfile() {
    setTab("profile");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        fontFamily: "'Inter','Helvetica Neue',sans-serif",
        color: T.text,
        display: "flex",
        flexDirection: "column",
      }}
    >
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
              {isGuest ? (
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("vesti-limit-reached", { detail: { type: "login" } }))}
                  title="Sign in to sync your data"
                  style={{ background: T.accent, border: "none", borderRadius: 20, color: "#fff", fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: "5px 14px", cursor: "pointer" }}>
                  SIGN IN
                </button>
              ) : (
                <button onClick={onLogout} title="Sign out"
                  style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 20, color: T.light, fontSize: 10, fontWeight: 600, letterSpacing: 1, padding: "5px 12px", cursor: "pointer" }}>
                  EXIT
                </button>
              )}
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

      {/* Content */}
      <div style={{ flex: 1, maxWidth: 700, margin: "0 auto", padding: "28px 20px 60px", width: "100%" }}>
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
        {tab === "capsule" && (
          <CapsuleTab
            wardrobe={wardrobe}
            capsuleIds={capsuleIds}
            toggleCapsule={toggleCapsule}
            setManyCapsule={setManyCapsule}
            clearCapsule={clearCapsule}
            outfitIds={outfitIds}
            frozenDays={frozenDays}
          />
        )}
        {tab === "trip"    && <TripTab    wardrobe={wardrobe} outfitIds={outfitIds} setOutfitIds={setOutfitIds} frozenDays={frozenDays} onNavigateToDay={navigateToDay} capsuleIds={capsuleIds} />}
        {tab === "daily"   && <OutfitsTab wardrobe={wardrobe} loading={wLoading} outfitIds={outfitIds} setOutfitIds={setOutfitIds} frozenDays={frozenDays} toggleFreeze={toggleFreeze} focusDayId={focusDayId} onFocusConsumed={() => setFocusDayId(null)} capsuleIds={capsuleIds} profilePhotos={profilePhotos} onNavigateToProfile={navigateToProfile} />}
        {tab === "outfit"  && <OutfitTab  wardrobe={wardrobe} outfitIds={outfitIds} setOutfitIds={setOutfitIds} capsuleIds={capsuleIds} />}
        {tab === "packing" && <PackTab    wardrobe={wardrobe} outfitIds={outfitIds} setOutfitIds={setOutfitIds} frozenDays={frozenDays} capsuleIds={capsuleIds} />}
        {tab === "profile" && (
          <ProfileTab
            photos={profilePhotos}
            onAdd={addPhoto}
            onRemove={removePhoto}
            onClearAll={clearAllPhotos}
            maxPhotos={MAX_PHOTOS}
            onImportData={({ capsuleArr, outfitIds: importedOutfits, frozenDays: importedFrozen }) => {
              if (capsuleArr.length > 0) setManyCapsule(capsuleArr);
              if (Object.keys(importedOutfits).length > 0) setOutfitIds(importedOutfits);
              if (Object.keys(importedFrozen).length > 0) setManyFrozenDays(importedFrozen);
            }}
          />
        )}
      </div>

      {/* Footer */}
      <AppFooter />
      <UpgradePrompt />
    </div>
  );
}

function AppFooter() {
  return (
    <footer style={{ borderTop: `1px solid ${T.borderLight}`, padding: "20px", textAlign: "center", background: T.surface }}>
      <p style={{ fontSize: 11, color: T.light, letterSpacing: 0.3, fontWeight: 400 }}>
        Designed &amp; developed by Sohil Gupta
      </p>
    </footer>
  );
}
