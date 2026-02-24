/* ─── CHIP BADGE ───────────────────────────────────────────────────────────── */
export default function Chip({ text, colors }) {
  const [bg, fg] = colors || ["#2A2A30", "#9A9890"];
  return (
    <span
      style={{
        display: "inline-flex",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.3,
        padding: "2px 8px",
        borderRadius: 20,
        background: bg,
        color: fg,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}
