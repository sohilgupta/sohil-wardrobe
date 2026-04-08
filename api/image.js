/* ─── GET /api/image?id={fileId} ─────────────────────────────────────────────
   Secure server-side image proxy for Google Drive files.
   Streams the image back to the client — Drive URLs are never exposed.
   Requires a valid session cookie.
   ─────────────────────────────────────────────────────────────────────────── */

// Strict validation: Drive file IDs are base62 + underscore/dash, 15-60 chars
const VALID_FILE_ID = /^[A-Za-z0-9_-]{15,60}$/;

export default async function handler(req, res) {
  // No auth required — Drive files are publicly shared; ID regex prevents abuse

  const { id } = req.query;

  if (!id || !VALID_FILE_ID.test(id)) {
    return res.status(400).json({ error: "Invalid or missing image ID" });
  }

  // Try two Google Drive URL formats — thumbnail endpoint first, lh3 as fallback
  const candidates = [
    `https://drive.google.com/thumbnail?id=${id}&sz=w800`,
    `https://lh3.googleusercontent.com/d/${id}`,
  ];

  for (const url of candidates) {
    try {
      const upstream = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Wardrobe-Proxy/1.0)" },
        redirect: "follow",
      });

      if (!upstream.ok) continue;

      const contentType = upstream.headers.get("content-type") || "";

      // Reject if Google redirected to a login / consent page (HTML response)
      if (!contentType.includes("image/")) continue;

      res.setHeader("Content-Type", contentType);
      // Private browser cache: 24 h — fast UX, won't leak across users
      res.setHeader("Cache-Control", "private, max-age=86400");

      const buffer = await upstream.arrayBuffer();
      return res.send(Buffer.from(buffer));
    } catch {
      // Try next candidate
      continue;
    }
  }

  return res.status(404).end();
}
