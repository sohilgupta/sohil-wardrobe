import { useState, useMemo } from "react";
import { fetchProductDetails } from "../utils/urlExtract";
import { T } from "../theme";
import { useTier, useAuth } from "../contexts/AuthContext";
import ItemVisual from "./ItemVisual";
import Chip from "./Chip";
import GuestLanding from "./GuestLanding";

/* ─── shared input style ─────────────────────────────────────────────────── */
const INPUT = {
  width: "100%",
  padding: "9px 12px",
  background: T.alt,
  border: `1.5px solid ${T.border}`,
  borderRadius: 10,
  fontSize: 13,
  color: T.text,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

/* ─── filter select helpers ──────────────────────────────────────────────── */
// NOTE: use `backgroundColor` (not `background` shorthand) when combining with
// `backgroundImage` — the shorthand resets backgroundRepeat/backgroundPosition,
// causing the arrow SVG to tile across the whole element.
const selStyle = {
  padding: "7px 28px 7px 12px",
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
  appearance: "none",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  outline: "none",
};
const selBg     = (a) => (a ? "#E8E6E1" : "#26262B");   // neutral off-white / dark
const selColor  = (a) => (a ? "#0F0F12" : "#C4C1BB");   // near-black / warm gray
const selBorder = (a) => `1.5px solid ${a ? "#E8E6E1" : "#3C3C44"}`;
const selArrow  = (a) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='${a ? "%230F0F12" : "%23C4C1BB"}'/%3E%3C/svg%3E")`;

/* ─── URL import — static options ────────────────────────────────────────── */
const COLOR_OPTIONS = [
  "Black","White","Navy Blue","Blue","Grey","Beige","Camel","Brown",
  "Khaki","Burgundy","Red","Green","Pink","Yellow","Orange","Purple",
  "Olive Green","Charcoal","Cream","Stone",
];
const LAYER_OPTIONS = ["Base", "Mid", "Outer", "Bottom", "Footwear"];

/* ─── sync status badge ──────────────────────────────────────────────────── */
function SyncBadge({ status, lastSync, onSync }) {
  const dotColor = { syncing: "#FBBF24", ok: "#4ADE80", offline: "#F87171", idle: T.border }[status] || T.border;
  const label    = { syncing: "Syncing…", ok: "Live", offline: "Offline", idle: "—" }[status] || "";
  const ago = lastSync
    ? (() => {
        const s = Math.floor((Date.now() - lastSync) / 1000);
        if (s < 60)   return "just now";
        if (s < 3600) return `${Math.floor(s / 60)}m ago`;
        return `${Math.floor(s / 3600)}h ago`;
      })()
    : null;

  return (
    <button onClick={onSync} title="Click to re-sync"
      style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: `1.5px solid ${T.borderLight}`, borderRadius: 20, padding: "4px 10px", cursor: "pointer", fontSize: 10, color: T.light, flexShrink: 0 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, display: "inline-block", flexShrink: 0 }} />
      {label}
      {ago && status !== "syncing" && <span style={{ opacity: 0.6 }}>· {ago}</span>}
    </button>
  );
}

/* ─── form field ─────────────────────────────────────────────────────────── */
function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 10, fontWeight: 600, color: T.light, letterSpacing: 0.8, display: "block", marginBottom: 4 }}>
        {label.toUpperCase()}
      </label>
      {type === "textarea" ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2}
          style={{ ...INPUT, resize: "vertical" }} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          style={INPUT} />
      )}
    </div>
  );
}

/* ─── WARDROBE TAB ────────────────────────────────────────────────────────── */
export default function WardrobeTab({
  wardrobe = [],
  onEdit,
  onDelete,
  onAdd,
  loading,
  syncStatus,
  lastSync,
  onSync,
  isDemoMode = false,
  onTryDemo,
}) {
  const { limits, isPro } = useTier();
  const { isGuest } = useAuth();
  const showLanding = isGuest && wardrobe.length === 0 && !isDemoMode;

  /* ── derived filter options ── */
  const cats   = useMemo(() => [...new Set(wardrobe.map((i) => i.c))].sort(),  [wardrobe]);
  const colors = useMemo(() => [...new Set(wardrobe.map((i) => i.col || i.color).filter(Boolean))].sort(), [wardrobe]);

  /* ── filter state ── */
  const [cat, setCat] = useState("");
  const [col, setCol] = useState("");
  const [occ, setOcc] = useState("");
  const [wth, setWth] = useState("");
  const [q,   setQ]   = useState("");

  /* ── detail / edit / add state ── */
  const [detail,    setDetail]    = useState(null);
  const [editing,   setEditing]   = useState(false);
  const [editForm,  setEditForm]  = useState({});
  const [adding,    setAdding]    = useState(false);
  const [addForm,   setAddForm]   = useState({ n: "", b: "", col: "", c: "", img: "", notes: "" });
  const [confirmDel, setConfirmDel] = useState(false);

  /* ── URL import state ── */
  const [importUrl,     setImportUrl]     = useState("");
  const [importState,   setImportState]   = useState("idle"); // idle|loading|confirm|error|manual
  const [importResult,  setImportResult]  = useState(null);
  const [importPartial, setImportPartial] = useState({});
  const [confirmForm,   setConfirmForm]   = useState({ n: "", col: "", c: "", b: "", l: "" });
  const [editMoreOpen,  setEditMoreOpen]  = useState(false);

  /* ── filtered list ── */
  const f = useMemo(
    () =>
      wardrobe.filter(
        (i) =>
          (!cat || i.c === cat) &&
          (!col || (i.col || i.color || "") === col) &&
          (!occ || i.occ === occ) &&
          (!wth || i.w === wth) &&
          (!q ||
            (i.n || "").toLowerCase().includes(q.toLowerCase()) ||
            (i.col || i.color || "").toLowerCase().includes(q.toLowerCase()) ||
            (i.b || i.brand || "").toLowerCase().includes(q.toLowerCase()) ||
            (i.c || "").toLowerCase().includes(q.toLowerCase()) ||
            (i.productCode || "").toLowerCase().includes(q.toLowerCase()))
      ),
    [wardrobe, cat, col, occ, wth, q]
  );

  const hasFilter = cat || col || occ || wth || q;

  /* ── helpers ── */
  function openDetail(item) { setDetail(item); setEditing(false); setConfirmDel(false); }

  function startEdit() {
    setEditForm({
      n:     detail.n     || detail.itemName || "",
      b:     detail.b     || detail.brand    || "",
      col:   detail.col   || detail.color    || "",
      c:     detail.c     || detail.category || "",
      img:   detail.img   || detail.imageUrl || "",
      notes: detail.notes || "",
    });
    setEditing(true);
  }

  function saveEdit() {
    onEdit?.(detail.id, editForm);
    setDetail((p) => ({ ...p, ...editForm }));
    setEditing(false);
  }

  function confirmDelete() {
    onDelete?.(detail.id);
    setDetail(null);
    setConfirmDel(false);
  }

  function openAdd() {
    setAddForm({ n: "", b: "", col: "", c: cats[0] || "Shirts", img: "", notes: "" });
    setAdding(true);
  }

  function saveAdd() {
    if (!addForm.n.trim()) return;
    if (wardrobe.length >= limits.wardrobe) {
      window.dispatchEvent(new CustomEvent("vesti-limit-reached", { detail: { type: "wardrobe" } }));
      return;
    }
    onAdd?.({
      n: addForm.n.trim(), b: addForm.b.trim(),
      col: addForm.col.trim() || "Black", c: addForm.c || "Shirts",
      img: addForm.img.trim(), notes: addForm.notes.trim(),
      l: "Base", occ: "Casual", w: "Mild", t: "Yes",
    });
    setAdding(false);
  }

  /* ── URL import handlers ── */
  async function handleFetch() {
    if (!importUrl.trim()) return;
    setImportState("loading");
    const res = await fetchProductDetails(importUrl.trim());
    if (res.ok) {
      const d = res.data;
      setImportResult(d);
      setConfirmForm({
        n:   d.name  || "",
        col: d.color || "",
        c:   d.c     || cats[0] || "Shirts",
        b:   d.brand || "",
        l:   d.l     || "Base",
      });
      setEditMoreOpen(false);
      setImportState("confirm");
    } else {
      setImportPartial(res.partial || {});
      setImportState("error");
    }
  }

  function handleConfirmAdd() {
    if (!confirmForm.n.trim()) return;
    if (wardrobe.length >= limits.wardrobe) {
      window.dispatchEvent(new CustomEvent("vesti-limit-reached", { detail: { type: "wardrobe" } }));
      return;
    }
    onAdd?.({
      n:          confirmForm.n.trim(),
      b:          confirmForm.b.trim(),
      col:        confirmForm.col || "Black",
      c:          confirmForm.c  || "Shirts",
      l:          confirmForm.l  || "Base",
      img:        importResult?.image || "",
      productUrl: importResult?.productUrl || "",
      _source:    "url_import",
      t:          "Yes",
    });
    handleCloseModal();
  }

  function handleCompleteDetails() {
    setAddForm({
      n:     importPartial.name  || "",
      b:     importPartial.brand || "",
      col:   importPartial.color || "",
      c:     importPartial.c     || cats[0] || "Shirts",
      img:   importPartial.image || "",
      notes: "",
    });
    setImportUrl("");
    setImportResult(null);
    setImportPartial({});
    setEditMoreOpen(false);
    setImportState("manual");
  }

  function handleCloseModal() {
    setImportUrl("");
    setImportResult(null);
    setImportPartial({});
    setEditMoreOpen(false);
    setImportState("idle");
    setAdding(false);
  }

  /* ── loading state ── */
  if (loading && wardrobe.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: T.mid, flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 20 }}>⧖</span>
        <span style={{ fontSize: 12 }}>Loading wardrobe…</span>
      </div>
    );
  }

  return (
    <div>
      {/* ── Hero / Guest Landing ── */}
      {showLanding ? (
        <GuestLanding
          onAddItem={() => setAdding(true)}
          onTryDemo={onTryDemo}
        />
      ) : (
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: T.accent, marginBottom: 6 }}>
            Your Collection
          </p>
          <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.8, color: T.text, lineHeight: 1.1, marginBottom: 6 }}>
            {wardrobe.length} Pieces.
            {!isPro && (
              <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 8 }}>
                ({wardrobe.length}/{limits.wardrobe === Infinity ? "\u221e" : limits.wardrobe})
              </span>
            )}
          </p>
          <p style={{ fontSize: 14, color: T.mid, fontWeight: 400 }}>
            {wardrobe.filter(i => i.t === "Yes").length} travel-ready · {[...new Set(wardrobe.map(i => i.c))].length} categories
          </p>
        </div>
      )}

      {!showLanding && (
        <>
          {/* ── Search + sync ── */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.light, fontSize: 16 }}>⌕</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, color, brand, code…"
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  background: T.alt,
                  border: `1.5px solid ${T.border}`,
                  borderRadius: 12,
                  fontSize: 13,
                  color: T.text,
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "'Inter','Helvetica Neue',sans-serif",
                }} />
            </div>
            <SyncBadge status={syncStatus} lastSync={lastSync} onSync={onSync} />
          </div>

          {/* ── Filters ── */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <select value={cat} onChange={(e) => setCat(e.target.value)}
              style={{ ...selStyle, backgroundColor: selBg(cat), color: selColor(cat), border: selBorder(cat), backgroundImage: selArrow(cat) }}>
              <option value="">Category</option>
              {cats.map((o) => <option key={o}>{o}</option>)}
            </select>

            <select value={col} onChange={(e) => setCol(e.target.value)}
              style={{ ...selStyle, backgroundColor: selBg(col), color: selColor(col), border: selBorder(col), backgroundImage: selArrow(col) }}>
              <option value="">Color</option>
              {colors.map((o) => <option key={o}>{o}</option>)}
            </select>

            <select value={occ} onChange={(e) => setOcc(e.target.value)}
              style={{ ...selStyle, backgroundColor: selBg(occ), color: selColor(occ), border: selBorder(occ), backgroundImage: selArrow(occ) }}>
              <option value="">Occasion</option>
              {["Casual", "Dinner", "Flight", "Hiking", "Gym", "Formal"].map((o) => <option key={o}>{o}</option>)}
            </select>

            <select value={wth} onChange={(e) => setWth(e.target.value)}
              style={{ ...selStyle, backgroundColor: selBg(wth), color: selColor(wth), border: selBorder(wth), backgroundImage: selArrow(wth) }}>
              <option value="">Weather</option>
              {["Cold", "Mild", "Warm"].map((o) => <option key={o}>{o}</option>)}
            </select>

            {hasFilter && (
              <button onClick={() => { setCat(""); setCol(""); setOcc(""); setWth(""); setQ(""); }}
                style={{ padding: "7px 14px", background: "none", border: `1.5px solid ${T.border}`, borderRadius: 20, fontSize: 12, color: T.mid, cursor: "pointer" }}>
                Clear ×
              </button>
            )}
          </div>

          {/* ── Count + Add ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: T.light }}>{f.length} of {wardrobe.length} items</p>
            <button onClick={openAdd}
              style={{ padding: "6px 14px", background: T.text, color: T.bg, border: "none", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5 }}>
              + Add Item
            </button>
          </div>

          {/* ── Grid ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(148px,1fr))", gap: 14 }}>
            {f.map((item) => (
              <div key={item.id} onClick={() => openDetail(item)} className="wardrobe-card" style={{ cursor: "pointer", borderRadius: "16px", overflow: "hidden" }}>
                <div style={{ position: "relative" }}>
                  <ItemVisual item={item} size={140} />
                  {item.t === "Yes" && (
                    <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 6, letterSpacing: 0.5 }}>✈</div>
                  )}
                  {item._source === "local" && (
                    <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(60,20,100,0.85)", color: "#A78BFA", fontSize: 8, fontWeight: 700, padding: "2px 5px", borderRadius: 5 }}>LOCAL</div>
                  )}
                  {item.productUrl && (
                    <a
                      href={item.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="View product"
                      style={{
                        position: "absolute", bottom: 6, right: 6,
                        background: "rgba(0,0,0,0.65)",
                        color: "#E8E6E1",
                        fontSize: 10,
                        padding: "2px 5px",
                        borderRadius: 6,
                        textDecoration: "none",
                        lineHeight: 1,
                      }}
                    >
                      ↗
                    </a>
                  )}
                </div>
                <div style={{ padding: "12px 14px 14px" }}>
                  <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: T.mid, marginBottom: 4 }}>
                    {item.c}
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: T.text, letterSpacing: -0.1, lineHeight: 1.3, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {item.n || item.itemName}
                  </p>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                    <Chip text={item.col || item.color} />
                    <Chip text={item.w} colors={T.weather[item.w]} />
                    {item.price && (
                      <span style={{ fontSize: 12, color: T.accent, fontWeight: 700 }}>
                        ₹{Number(item.price).toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Detail sheet ── */}
      {detail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => { setDetail(null); setEditing(false); setConfirmDel(false); }}>
          <div style={{ background: T.surface, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>

            {!editing ? (
              /* view mode */
              <>
                <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                  <ItemVisual item={detail} size={110} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 4 }}>
                      {detail.productUrl ? (
                        <a
                          href={detail.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="View product page"
                          style={{ fontSize: 16, fontWeight: 700, color: T.text, lineHeight: 1.3, flex: 1, textDecoration: "none" }}
                        >
                          {detail.n || detail.itemName}
                        </a>
                      ) : (
                        <p style={{ fontSize: 16, fontWeight: 700, color: T.text, lineHeight: 1.3, flex: 1 }}>{detail.n || detail.itemName}</p>
                      )}
                      {detail.productUrl && (
                        <a
                          href={detail.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="View product page"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 26,
                            height: 26,
                            borderRadius: 8,
                            background: T.alt,
                            border: `1.5px solid ${T.border}`,
                            color: T.mid,
                            fontSize: 13,
                            textDecoration: "none",
                            flexShrink: 0,
                            cursor: "pointer",
                          }}
                        >
                          ↗
                        </a>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: T.mid, marginBottom: 4 }}>{detail.b || detail.brand}</p>
                    {detail.productCode && (
                      <p style={{ fontSize: 10, color: T.light, marginBottom: 6, fontFamily: "monospace" }}>#{detail.productCode}</p>
                    )}
                    {/* Price + Purchase Date */}
                    {(detail.price || detail.purchaseDate) && (
                      <div style={{ display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                        {detail.price && (
                          <span style={{ fontSize: 11, color: "#4ADE80", fontWeight: 700 }}>
                            ₹{Number(detail.price).toLocaleString("en-IN")}
                          </span>
                        )}
                        {detail.purchaseDate && (
                          <span style={{ fontSize: 10, color: T.light }}>
                            Bought {detail.purchaseDate}
                          </span>
                        )}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      <Chip text={detail.col || detail.color} />
                      <Chip text={detail.c || detail.category} />
                      {detail.occ && <Chip text={detail.occ} colors={T.occ[detail.occ]} />}
                      {detail.w   && <Chip text={detail.w}   colors={T.weather[detail.w]} />}
                      {detail.t === "Yes" && <Chip text="✈ Travel" colors={["#14532D", "#4ADE80"]} />}
                      {detail._source === "local" && <Chip text="Local" colors={["#2A1A40", "#A78BFA"]} />}
                    </div>
                    {detail.notes && <p style={{ fontSize: 11, color: T.mid, marginTop: 8, lineHeight: 1.5, fontStyle: "italic" }}>{detail.notes}</p>}
                  </div>
                </div>

                {confirmDel ? (
                  <div style={{ background: "#2A1A1A", border: `1.5px solid #7F1D1D`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
                    <p style={{ fontSize: 13, color: "#FCA5A5", marginBottom: 8, fontWeight: 600 }}>Delete this item locally?</p>
                    <p style={{ fontSize: 11, color: T.mid, marginBottom: 12, lineHeight: 1.5 }}>This is a local-only change and won't modify the Google Sheet.</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setConfirmDel(false)} style={{ flex: 1, padding: 9, background: "none", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 12, color: T.mid, cursor: "pointer" }}>Cancel</button>
                      <button onClick={confirmDelete} style={{ flex: 1, padding: 9, background: "#DC2626", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" }}>Delete</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <button onClick={() => setConfirmDel(true)} style={{ flex: 1, padding: 10, background: "none", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 12, color: "#F87171", cursor: "pointer" }}>🗑 Delete</button>
                    <button onClick={startEdit} style={{ flex: 2, padding: 10, background: T.alt, border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 12, color: T.text, cursor: "pointer", fontWeight: 600 }}>✎ Edit</button>
                  </div>
                )}

                <button onClick={() => { setDetail(null); setConfirmDel(false); }}
                  style={{ width: "100%", padding: 13, background: T.text, color: T.bg, border: "none", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                  Close
                </button>
              </>
            ) : (
              /* edit mode */
              <>
                <p style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 16 }}>Edit Item</p>
                <Field label="Name"      value={editForm.n}     onChange={(v) => setEditForm((p) => ({ ...p, n: v }))}     placeholder="Item name" />
                <Field label="Brand"     value={editForm.b}     onChange={(v) => setEditForm((p) => ({ ...p, b: v }))}     placeholder="Brand" />
                <Field label="Color"     value={editForm.col}   onChange={(v) => setEditForm((p) => ({ ...p, col: v }))}   placeholder="e.g. Black" />
                <Field label="Image URL" value={editForm.img}   onChange={(v) => setEditForm((p) => ({ ...p, img: v }))}   placeholder="https://…" />
                <Field label="Notes"     value={editForm.notes} onChange={(v) => setEditForm((p) => ({ ...p, notes: v }))} placeholder="Notes" type="textarea" />

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 10, fontWeight: 600, color: T.light, letterSpacing: 0.8, display: "block", marginBottom: 4 }}>CATEGORY</label>
                  <select value={editForm.c} onChange={(e) => setEditForm((p) => ({ ...p, c: e.target.value }))}
                    style={{ ...INPUT, appearance: "auto", color: T.text }}>
                    {cats.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>

                <p style={{ fontSize: 10, color: T.light, marginBottom: 12, fontStyle: "italic" }}>
                  Local-only — Google Sheet is not modified.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEditing(false)} style={{ flex: 1, padding: 11, background: "none", border: `1.5px solid ${T.border}`, borderRadius: 12, fontSize: 13, color: T.mid, cursor: "pointer" }}>Cancel</button>
                  <button onClick={saveEdit} style={{ flex: 2, padding: 11, background: T.text, border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, color: T.bg, cursor: "pointer" }}>Save Changes</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Add Item modal ── */}
      {adding && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={handleCloseModal}
        >
          <div
            style={{ background: T.surface, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 16 }}>Add Item</p>

            {/* ── IDLE: URL input + "Add manually" ── */}
            {importState === "idle" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: T.alt, border: `1.5px solid ${T.border}`, borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: T.light, letterSpacing: 1, marginBottom: 6 }}>PASTE PRODUCT LINK</p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="url"
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && importUrl.trim() && handleFetch()}
                      placeholder="https://www.zara.com/…"
                      style={{ ...INPUT, flex: 1, padding: "7px 10px", fontSize: 12, background: "transparent", border: "none", outline: "none" }}
                    />
                    <button
                      onClick={handleFetch}
                      disabled={!importUrl.trim()}
                      style={{
                        padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, border: "none",
                        cursor: importUrl.trim() ? "pointer" : "default",
                        background: importUrl.trim() ? T.accent : T.border,
                        color: importUrl.trim() ? "#fff" : T.light,
                        flexShrink: 0, whiteSpace: "nowrap",
                      }}
                    >
                      Fetch
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                  <span style={{ fontSize: 10, color: T.light }}>OR</span>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                </div>

                <button
                  onClick={() => setImportState("manual")}
                  style={{ width: "100%", padding: 11, background: "none", border: `1.5px solid ${T.border}`, borderRadius: 12, fontSize: 13, color: T.mid, cursor: "pointer", fontWeight: 600 }}
                >
                  + Add manually
                </button>
              </div>
            )}

            {/* ── LOADING: skeleton shimmer ── */}
            {importState === "loading" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: T.alt, border: `1.5px solid ${T.border}`, borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: T.light, letterSpacing: 1, marginBottom: 6 }}>PASTE PRODUCT LINK</p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: T.light, flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {importUrl}
                    </span>
                    <span style={{ padding: "5px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: T.border, color: T.light, flexShrink: 0 }}>Fetch</span>
                  </div>
                </div>
                <div style={{ background: T.alt, border: `1.5px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ display: "flex", gap: 12, padding: "12px 14px", alignItems: "flex-start" }}>
                    <div style={{ width: 80, height: 100, borderRadius: 10, flexShrink: 0, background: `linear-gradient(90deg,${T.surface} 25%,${T.border} 50%,${T.surface} 75%)`, backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
                    <div style={{ flex: 1, paddingTop: 4, display: "flex", flexDirection: "column", gap: 8 }}>
                      {[60, 85, 55, 45].map((w, i) => (
                        <div key={i} style={{ height: i === 3 ? 20 : i === 1 ? 14 : 8, borderRadius: i === 3 ? 20 : 4, width: `${w}%`, background: `linear-gradient(90deg,${T.surface} 25%,${T.border} 50%,${T.surface} 75%)`, backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ height: 1, background: T.border, margin: "0 14px" }} />
                  <div style={{ padding: "14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${T.border}`, borderTopColor: T.accent, flexShrink: 0, animation: "spin 0.9s linear infinite" }} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 2 }}>Analyzing product…</p>
                      <p style={{ fontSize: 10, color: T.light }}>Extracting details from page</p>
                    </div>
                  </div>
                  <div style={{ padding: "0 14px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
                    {[null, null].map((_, i) => (
                      <div key={i} style={{ height: 32, borderRadius: 8, background: `linear-gradient(90deg,${T.surface} 25%,${T.border} 50%,${T.surface} 75%)`, backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── CONFIRM: confirmation card ── */}
            {importState === "confirm" && importResult && (
              <div style={{ background: T.alt, border: `1.5px solid ${T.accentBorder}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "flex", gap: 12, padding: "12px 14px", alignItems: "flex-start" }}>
                  {importResult.image ? (
                    <img
                      src={importResult.image}
                      alt={confirmForm.n}
                      style={{ width: 80, height: 100, objectFit: "cover", borderRadius: 10, flexShrink: 0 }}
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  ) : (
                    <div style={{ width: 80, height: 100, borderRadius: 10, flexShrink: 0, background: "linear-gradient(145deg,#1B2A4A,#374151)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
                      🧥
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                      <span style={{ fontSize: 8.5, fontWeight: 700, background: "rgba(74,222,128,0.12)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.25)", padding: "2px 7px", borderRadius: 20 }}>✓ Detected</span>
                      <span style={{ fontSize: 9, color: T.light }}>
                        {(() => { try { return new URL(importResult.productUrl).hostname.replace(/^www\./, ""); } catch { return ""; } })()}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 3, lineHeight: 1.3 }}>{confirmForm.n || "—"}</p>
                    <p style={{ fontSize: 11, color: T.mid, marginBottom: 6 }}>{[confirmForm.b, confirmForm.col, confirmForm.l].filter(Boolean).join(" · ")}</p>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {confirmForm.c && <span style={{ fontSize: 8.5, fontWeight: 700, background: T.accentDim, color: "#60A5FA", border: `1px solid ${T.accentBorder}`, padding: "2px 7px", borderRadius: 20 }}>{confirmForm.c}</span>}
                      {confirmForm.l && <span style={{ fontSize: 8.5, fontWeight: 700, background: "rgba(167,139,250,0.1)", color: "#A78BFA", border: "1px solid rgba(167,139,250,0.2)", padding: "2px 7px", borderRadius: 20 }}>{confirmForm.l}</span>}
                    </div>
                  </div>
                </div>

                <div style={{ height: 1, background: T.border, margin: "0 14px" }} />

                <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
                  <div>
                    <p style={{ fontSize: 8.5, fontWeight: 700, color: T.light, letterSpacing: 1, marginBottom: 3 }}>NAME</p>
                    <input
                      type="text"
                      value={confirmForm.n}
                      onChange={(e) => setConfirmForm((p) => ({ ...p, n: e.target.value }))}
                      style={{ ...INPUT, padding: "7px 10px", fontSize: 12, border: `1.5px solid ${T.accentBorder}` }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                    <div>
                      <p style={{ fontSize: 8.5, fontWeight: 700, color: T.light, letterSpacing: 1, marginBottom: 3 }}>COLOR</p>
                      <select
                        value={confirmForm.col}
                        onChange={(e) => setConfirmForm((p) => ({ ...p, col: e.target.value }))}
                        style={{ ...INPUT, padding: "7px 10px", fontSize: 11, appearance: "auto", color: T.text }}
                      >
                        {COLOR_OPTIONS.map((c) => <option key={c}>{c}</option>)}
                        {confirmForm.col && !COLOR_OPTIONS.includes(confirmForm.col) && (
                          <option value={confirmForm.col}>{confirmForm.col}</option>
                        )}
                      </select>
                    </div>
                    <div>
                      <p style={{ fontSize: 8.5, fontWeight: 700, color: T.light, letterSpacing: 1, marginBottom: 3 }}>CATEGORY</p>
                      <select
                        value={confirmForm.c}
                        onChange={(e) => setConfirmForm((p) => ({ ...p, c: e.target.value }))}
                        style={{ ...INPUT, padding: "7px 10px", fontSize: 11, appearance: "auto", color: T.text }}
                      >
                        {cats.map((c) => <option key={c}>{c}</option>)}
                        {confirmForm.c && !cats.includes(confirmForm.c) && (
                          <option value={confirmForm.c}>{confirmForm.c}</option>
                        )}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => setEditMoreOpen((p) => !p)}
                    style={{ background: "none", border: "none", padding: "2px 0", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    <span style={{ fontSize: 10, color: T.light, fontWeight: 600 }}>Edit more</span>
                    <span style={{ fontSize: 10, color: T.light }}>{editMoreOpen ? "⌄" : "›"}</span>
                  </button>

                  {editMoreOpen && (
                    <div style={{ borderTop: `1px dashed ${T.border}`, paddingTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                      <div>
                        <p style={{ fontSize: 8.5, fontWeight: 700, color: T.light, letterSpacing: 1, marginBottom: 3 }}>BRAND</p>
                        <input
                          type="text"
                          value={confirmForm.b}
                          onChange={(e) => setConfirmForm((p) => ({ ...p, b: e.target.value }))}
                          style={{ ...INPUT, padding: "7px 10px", fontSize: 11 }}
                        />
                      </div>
                      <div>
                        <p style={{ fontSize: 8.5, fontWeight: 700, color: T.light, letterSpacing: 1, marginBottom: 3 }}>LAYER</p>
                        <select
                          value={confirmForm.l}
                          onChange={(e) => setConfirmForm((p) => ({ ...p, l: e.target.value }))}
                          style={{ ...INPUT, padding: "7px 10px", fontSize: 11, appearance: "auto", color: T.text }}
                        >
                          {LAYER_OPTIONS.map((l) => <option key={l}>{l}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ borderTop: `1px solid ${T.border}`, display: "grid", gridTemplateColumns: "1fr 2fr" }}>
                  <button onClick={handleCloseModal} style={{ padding: 12, background: "none", border: "none", borderRight: `1px solid ${T.border}`, fontSize: 12, color: T.mid, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  <button
                    onClick={handleConfirmAdd}
                    disabled={!confirmForm.n.trim()}
                    style={{ padding: 12, background: confirmForm.n.trim() ? T.text : T.border, border: "none", fontSize: 13, fontWeight: 700, color: confirmForm.n.trim() ? T.bg : T.light, cursor: confirmForm.n.trim() ? "pointer" : "default", fontFamily: "inherit" }}
                  >
                    Confirm & Add
                  </button>
                </div>
              </div>
            )}

            {/* ── ERROR: smart fallback card ── */}
            {importState === "error" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: T.alt, border: `1.5px solid ${T.border}`, borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: T.light, letterSpacing: 1, marginBottom: 6 }}>PASTE PRODUCT LINK</p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: T.light, flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{importUrl}</span>
                    <button
                      onClick={() => setImportState("idle")}
                      style={{ padding: "5px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: T.accentDim, color: T.accent, border: `1px solid ${T.accentBorder}`, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", fontFamily: "inherit" }}
                    >
                      Try again
                    </button>
                  </div>
                </div>

                <div style={{ background: T.alt, border: "1.5px solid rgba(248,113,113,0.25)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "16px 14px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 40, height: 40, background: "rgba(248,113,113,0.1)", borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(248,113,113,0.2)", fontSize: 18 }}>
                      ⚠
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4, lineHeight: 1.3 }}>Couldn't detect all details</p>
                      <p style={{ fontSize: 11, color: T.mid, lineHeight: 1.5 }}>
                        {Object.keys(importPartial).length > 0
                          ? "We found some info — fill in the rest below."
                          : "This site may block automated reads. Add details manually instead."}
                      </p>
                    </div>
                  </div>

                  {Object.keys(importPartial).length > 0 && (
                    <>
                      <div style={{ height: 1, background: T.border, margin: "0 14px" }} />
                      <div style={{ padding: "10px 14px" }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: T.light, letterSpacing: 1, marginBottom: 7 }}>WHAT WE FOUND</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {["name", "brand", "color", "l"].map((field) => (
                            <div key={field} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {importPartial[field] ? (
                                <>
                                  <span style={{ fontSize: 10, color: "#4ADE80" }}>✓</span>
                                  <span style={{ fontSize: 11, color: T.mid }}>
                                    {field.charAt(0).toUpperCase() + field.slice(1)}: <span style={{ color: T.text }}>{importPartial[field]}</span>
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span style={{ fontSize: 10, color: "#F87171" }}>✕</span>
                                  <span style={{ fontSize: 11, color: T.light }}>{field.charAt(0).toUpperCase() + field.slice(1)}: not detected</span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div style={{ borderTop: `1px solid ${T.border}`, display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    <button onClick={handleCloseModal} style={{ padding: 12, background: "none", border: "none", borderRight: `1px solid ${T.border}`, fontSize: 12, color: T.mid, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    <button onClick={handleCompleteDetails} style={{ padding: 12, background: T.text, border: "none", fontSize: 13, fontWeight: 700, color: T.bg, cursor: "pointer", fontFamily: "inherit" }}>Complete details</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── MANUAL: standard form ── */}
            {importState === "manual" && (
              <>
                <Field label="Name *"    value={addForm.n}     onChange={(v) => setAddForm((p) => ({ ...p, n: v }))}     placeholder="e.g. Zara Black Tee" />
                <Field label="Brand"     value={addForm.b}     onChange={(v) => setAddForm((p) => ({ ...p, b: v }))}     placeholder="Brand" />
                <Field label="Color"     value={addForm.col}   onChange={(v) => setAddForm((p) => ({ ...p, col: v }))}   placeholder="e.g. Black" />
                <Field label="Image URL" value={addForm.img}   onChange={(v) => setAddForm((p) => ({ ...p, img: v }))}   placeholder="https://…" />
                <Field label="Notes"     value={addForm.notes} onChange={(v) => setAddForm((p) => ({ ...p, notes: v }))} placeholder="Optional notes" type="textarea" />
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 10, fontWeight: 600, color: T.light, letterSpacing: 0.8, display: "block", marginBottom: 4 }}>CATEGORY</label>
                  <select value={addForm.c} onChange={(e) => setAddForm((p) => ({ ...p, c: e.target.value }))}
                    style={{ ...INPUT, appearance: "auto", color: T.text }}>
                    {cats.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleCloseModal} style={{ flex: 1, padding: 11, background: "none", border: `1.5px solid ${T.border}`, borderRadius: 12, fontSize: 13, color: T.mid, cursor: "pointer" }}>Cancel</button>
                  <button onClick={saveAdd} disabled={!addForm.n.trim()}
                    style={{ flex: 2, padding: 11, background: addForm.n.trim() ? T.text : T.border, border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, color: addForm.n.trim() ? T.bg : T.light, cursor: addForm.n.trim() ? "pointer" : "default" }}>
                    Add Item
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
