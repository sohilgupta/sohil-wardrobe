import { useState } from "react";
import { T } from "./theme";
import { AuthProvider, useAuth, usePlan } from "./contexts/AuthContext";
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
import AuthPage from "./components/AuthPage";

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
  const { user, loading, signOut } = useAuth();

  if (loading) {
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
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontFamily: "'Cormorant Garamond',serif",
              fontSize: 28,
              fontWeight: 700,
              color: T.text,
              marginBottom: 12,
            }}
          >
            Vesti
          </p>
          <p style={{ fontSize: 10, color: T.light, letterSpacing: 3, fontWeight: 600 }}>
            LOADING…
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <AuthenticatedApp onLogout={signOut} />;
}

/* ─── AUTHENTICATED APP — only mounts after auth check passes ─────────────── */
function AuthenticatedApp({ onLogout }) {
  const [tab, setTab] = useState("wardrobe");
  const [focusDayId, setFocusDayId] = useState(null);
  const { isPro } = usePlan();

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

  const { outfitIds, setOutfitIds, frozenDays, toggleFreeze } = useOutfits();
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
        fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
        color: T.text,
        display: "flex",
        flexDirection: "column",
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
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: -0.5,
                  color: T.text,
                }}
              >
                Vesti
              </span>
              {isPro && (
                <span
                  style={{
                    fontSize: 9,
                    color: "#A78BFA",
                    letterSpacing: 1.5,
                    fontWeight: 700,
                    background: "#2E1065",
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  PRO
                </span>
              )}
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
              {capsuleCount > 0 && (
                <button
                  onClick={() => setTab("capsule")}
                  title="View Trip Capsule"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    textAlign: "center",
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#2DD4BF", lineHeight: 1 }}>
                    {capsuleCount}
                  </p>
                  <p style={{ fontSize: 8, color: "#2DD4BF", letterSpacing: 1, marginTop: 1 }}>CAPSULE</p>
                </button>
              )}
              <button
                onClick={onLogout}
                title="Sign out"
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
      <div style={{ flex: 1, maxWidth: 700, margin: "0 auto", padding: "20px 16px 40px", width: "100%" }}>
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
          />
        )}
      </div>

      {/* Footer */}
      <AppFooter />
    </div>
  );
}

function AppFooter() {
  return (
    <footer
      style={{
        borderTop: `1px solid ${T.borderLight}`,
        padding: "16px",
        textAlign: "center",
        background: T.surface,
      }}
    >
      <p style={{ fontSize: 10, color: T.light, letterSpacing: 0.5 }}>
        Designed &amp; developed by Sohil Gupta
      </p>
    </footer>
  );
}
