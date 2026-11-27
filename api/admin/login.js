const crypto = require("crypto");
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const expected = process.env.VOLUNTEER_ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!expected || !secret) return res.status(503).json({ error: "Administrator access is not configured." });
  const supplied = String((req.body && req.body.password) || "");
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  if (!a.length || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: "Incorrect password." });
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 12 * 60 * 60 * 1000 })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  res.setHeader("Set-Cookie", "volunteer_admin_session=" + payload + "." + sig + "; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200");
  return res.status(200).json({ ok: true });
};
