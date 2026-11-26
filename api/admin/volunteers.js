const crypto = require("crypto");
function authorized(req) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;
  const cookies = String(req.headers.cookie || "").split(";").map(x => x.trim());
  const raw = cookies.find(x => x.startsWith("volunteer_admin_session="));
  if (!raw) return false;
  const token = raw.slice("volunteer_admin_session=".length);
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const expected = crypto.createHmac("sha256", secret).update(parts[0]).digest("base64url");
  const a = Buffer.from(parts[1]), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try { return JSON.parse(Buffer.from(parts[0], "base64url").toString()).exp > Date.now(); } catch (_) { return false; }
}
function csvCell(value) {
  let s = String(value == null ? "" : value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  if (!authorized(req)) return res.status(401).json({ error: "Please sign in again." });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: "Administrator database access is not configured." });
  try {
    const endpoint = url.replace(/\/$/, "") + "/rest/v1/volunteers?select=registration_number,first_name,last_name,phone,email,ward,created_at&order=created_at.desc&limit=5000";
    const response = await fetch(endpoint, { headers: { apikey: key, authorization: "Bearer " + key } });
    if (!response.ok) return res.status(502).json({ error: "Could not retrieve the volunteer register." });
    const rows = await response.json();
    const q = String(req.query.q || "").trim().toLowerCase();
    const filtered = q ? rows.filter(r => [r.registration_number,r.first_name,r.last_name,r.phone,r.email,r.ward].some(v => String(v || "").toLowerCase().includes(q))) : rows;
    if (req.query.format === "csv") {
      const headers = ["Registration Number","First Name","Last Name","Phone","Email","Ward","Registered At"];
      const lines = [headers, ...filtered.map(r => ["\\t" + String(r.registration_number || ""),r.first_name,r.last_name,r.phone,r.email,r.ward,r.created_at])].map(row => row.map(csvCell).join(","));
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="surulere-volunteer-register.csv"');
      return res.status(200).send("\uFEFF" + lines.join("\r\n"));
    }
    return res.status(200).json({ count: filtered.length, total: rows.length, volunteers: filtered });
  } catch (_) { return res.status(502).json({ error: "Could not retrieve the volunteer register." }); }
};
