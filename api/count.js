module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return res.status(503).json({ error: "Count service is not configured." });
  try {
    const response = await fetch(url.replace(/\/$/, "") + "/rest/v1/rpc/volunteer_public_count", {
      method: "POST",
      headers: { apikey: key, authorization: "Bearer " + key, "content-type": "application/json" },
      body: "{}"
    });
    if (!response.ok) return res.status(502).json({ error: "Volunteer count is temporarily unavailable." });
    const count = Number(await response.json());
    if (!Number.isFinite(count) || count < 0) return res.status(502).json({ error: "Invalid count response." });
    return res.status(200).json({ count });
  } catch (_) {
    return res.status(502).json({ error: "Volunteer count is temporarily unavailable." });
  }
};
