import { useState } from "react";
import { T } from "../theme";
import { parseURL } from "../engine/ai";

/* ─── ADD ITEM ─────────────────────────────────────────────────────────────── */
export default function AddTab({ onAdd }) {
  const [url, setUrl] = useState("");
  const [fl, setFl] = useState(false);
  const [st, setSt] = useState("");
  const blank = { n: "", c: "", col: "", b: "", occ: "Casual", w: "Mild", l: "Base", img: "", t: "No" };
  const [form, setForm] = useState(blank);
  const ff = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const fetchUrl = async () => {
    if (!url) return;
    setFl(true);
    setSt("Fetching…");
    const d = await parseURL(url);
    setForm((f) => ({
      ...f,
      n: d.name || f.n,
      c: d.category || f.c,
      col: d.color || f.col,
      b: d.brand || f.b,
      img: d.imageUrl || f.img,
    }));
    setSt("✓ Done! Review and save.");
    setFl(false);
  };

  const save = () => {
    if (!form.n) return;
    onAdd({ ...form, id: `add_${Date.now()}` });
    setForm(blank);
    setUrl("");
    setSt("✓ Added!");
    setTimeout(() => setSt(""), 2500);
  };

  const F = ({ label, k, opts }) => (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, color: T.light, letterSpacing: 1, marginBottom: 5 }}>
        {label}
      </p>
      {opts ? (
        <select
          value={form[k]}
          onChange={(e) => ff(k, e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            background: T.alt,
            border: `1.5px solid ${T.borderLight}`,
            borderRadius: 10,
            fontSize: 13,
            color: T.text,
            fontFamily: "inherit",
            outline: "none",
          }}
        >
          <option value="">Select…</option>
          {opts.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          value={form[k]}
          onChange={(e) => ff(k, e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            background: T.alt,
            border: `1.5px solid ${T.borderLight}`,
            borderRadius: 10,
            fontSize: 13,
            color: T.text,
            fontFamily: "inherit",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 500 }}>
      <div
        style={{
          background: T.surface,
          border: `1.5px solid ${T.borderLight}`,
          borderRadius: 16,
          padding: 18,
          marginBottom: 16,
        }}
      >
        <p style={{ fontSize: 11, fontWeight: 700, color: T.light, letterSpacing: 1.5, marginBottom: 12 }}>
          AUTO-FILL FROM URL
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchUrl()}
            placeholder="Paste product URL…"
            style={{
              flex: 1,
              padding: "10px 14px",
              background: T.alt,
              border: `1.5px solid ${T.borderLight}`,
              borderRadius: 10,
              fontSize: 13,
              color: T.text,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <button
            onClick={fetchUrl}
            disabled={fl || !url}
            style={{
              padding: "10px 18px",
              background: url ? T.text : T.border,
              color: url ? T.bg : "#666",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 13,
              cursor: url ? "pointer" : "default",
            }}
          >
            {fl ? "…" : "Fetch"}
          </button>
        </div>
        {st && <p style={{ fontSize: 12, color: T.green, marginTop: 8 }}>{st}</p>}
      </div>
      <div
        style={{
          background: T.surface,
          border: `1.5px solid ${T.borderLight}`,
          borderRadius: 16,
          padding: 18,
        }}
      >
        <p style={{ fontSize: 11, fontWeight: 700, color: T.light, letterSpacing: 1.5, marginBottom: 16 }}>
          ITEM DETAILS
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "span 2" }}>
            <F label="ITEM NAME *" k="n" />
          </div>
          <F label="BRAND" k="b" />
          <F label="COLOR" k="col" />
          <F
            label="CATEGORY"
            k="c"
            opts={[
              "Jacket", "Light Jacket", "Overshirt", "Coat", "Blazer",
              "T-Shirt", "Polo", "Shirt", "Sweater", "Sweatshirt", "Jumper",
              "Linen Pants", "Trousers", "Jeans", "Cargo", "Track Pants", "Joggers",
              "Sneakers", "Derby", "Trainers", "Sandals",
            ]}
          />
          <F label="OCCASION" k="occ" opts={["Casual", "Dinner", "Flight", "Hiking", "Gym", "Formal"]} />
          <F label="WEATHER" k="w" opts={["Cold", "Mild", "Warm"]} />
          <F label="LAYER" k="l" opts={["Base", "Mid", "Outer", "Bottom", "Footwear"]} />
          <F label="TRAVEL" k="t" opts={["Yes", "No"]} />
          <div style={{ gridColumn: "span 2" }}>
            <F label="IMAGE URL" k="img" />
          </div>
        </div>
        {form.img && (
          <div
            style={{
              marginTop: 12,
              borderRadius: 12,
              overflow: "hidden",
              height: 100,
              background: T.alt,
            }}
          >
            <img src={form.img} alt="preview" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
        )}
        <button
          onClick={save}
          disabled={!form.n}
          style={{
            marginTop: 16,
            width: "100%",
            padding: 14,
            background: form.n ? T.text : T.border,
            color: form.n ? T.bg : "#666",
            border: "none",
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 14,
            cursor: form.n ? "pointer" : "default",
          }}
        >
          Add to Wardrobe
        </button>
      </div>
    </div>
  );
}
