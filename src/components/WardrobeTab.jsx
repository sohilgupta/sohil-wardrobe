import { useState, useMemo } from "react";
import { T } from "../theme";
import ItemVisual from "./ItemVisual";
import Chip from "./Chip";

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
const selBg     = (a) => (a ? T.text    : "#2C2C36");
const selColor  = (a) => (a ? T.bg     : T.text);
const selBorder = (a) => `1.5px solid ${a ? T.text : "#4A4A58"}`;
const selArrow  = (a) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='${a ? "%230F0F12" : "%23B0ADA7"}'/%3E%3C/svg%3E")`;

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
}) {
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
    onAdd?.({
      n: addForm.n.trim(), b: addForm.b.trim(),
      col: addForm.col.trim() || "Black", c: addForm.c || "Shirts",
      img: addForm.img.trim(), notes: addForm.notes.trim(),
      l: "Base", occ: "Casual", w: "Mild", t: "Yes",
    });
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
      {/* ── Search + sync ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.light, fontSize: 16 }}>⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, color, brand, code…"
            style={{ width: "100%", padding: "11px 14px 11px 38px", background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12, fontSize: 14, color: T.text, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
        </div>
        <SyncBadge status={syncStatus} lastSync={lastSync} onSync={onSync} />
      </div>

      {/* ── Filters ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <select value={cat} onChange={(e) => setCat(e.target.value)}
          style={{ ...selStyle, background: selBg(cat), color: selColor(cat), border: selBorder(cat), backgroundImage: selArrow(cat) }}>
          <option value="">Category</option>
          {cats.map((o) => <option key={o}>{o}</option>)}
        </select>

        <select value={col} onChange={(e) => setCol(e.target.value)}
          style={{ ...selStyle, background: selBg(col), color: selColor(col), border: selBorder(col), backgroundImage: selArrow(col) }}>
          <option value="">Color</option>
          {colors.map((o) => <option key={o}>{o}</option>)}
        </select>

        <select value={occ} onChange={(e) => setOcc(e.target.value)}
          style={{ ...selStyle, background: selBg(occ), color: selColor(occ), border: selBorder(occ), backgroundImage: selArrow(occ) }}>
          <option value="">Occasion</option>
          {["Casual", "Dinner", "Flight", "Hiking", "Gym", "Formal"].map((o) => <option key={o}>{o}</option>)}
        </select>

        <select value={wth} onChange={(e) => setWth(e.target.value)}
          style={{ ...selStyle, background: selBg(wth), color: selColor(wth), border: selBorder(wth), backgroundImage: selArrow(wth) }}>
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
                    <p style={{ fontSize: 16, fontWeight: 700, color: T.text, lineHeight: 1.3, marginBottom: 4 }}>{detail.n || detail.itemName}</p>
                    <p style={{ fontSize: 13, color: T.mid, marginBottom: 4 }}>{detail.b || detail.brand}</p>
                    {detail.productCode && (
                      <p style={{ fontSize: 10, color: T.light, marginBottom: 8, fontFamily: "monospace" }}>#{detail.productCode}</p>
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setAdding(false)}>
          <div style={{ background: T.surface, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 16 }}>Add Item</p>
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
              <button onClick={() => setAdding(false)} style={{ flex: 1, padding: 11, background: "none", border: `1.5px solid ${T.border}`, borderRadius: 12, fontSize: 13, color: T.mid, cursor: "pointer" }}>Cancel</button>
              <button onClick={saveAdd} disabled={!addForm.n.trim()}
                style={{ flex: 2, padding: 11, background: addForm.n.trim() ? T.text : T.border, border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, color: addForm.n.trim() ? T.bg : T.light, cursor: addForm.n.trim() ? "pointer" : "default" }}>
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(148px,1fr))", gap: 16 }}>
        {f.map((item) => (
          <div key={item.id} onClick={() => openDetail(item)} style={{ cursor: "pointer" }}>
            <div style={{ position: "relative" }}>
              <ItemVisual item={item} size={148} />
              {item.t === "Yes" && (
                <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 6, letterSpacing: 0.5 }}>✈</div>
              )}
              {item._source === "local" && (
                <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(60,20,100,0.85)", color: "#A78BFA", fontSize: 8, fontWeight: 700, padding: "2px 5px", borderRadius: 5 }}>LOCAL</div>
              )}
            </div>
            <div style={{ padding: "8px 2px 0" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: T.text, lineHeight: 1.3, marginBottom: 3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {item.n || item.itemName}
              </p>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <Chip text={item.col || item.color} />
                <Chip text={item.w} colors={T.weather[item.w]} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
