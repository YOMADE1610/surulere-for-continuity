const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export default async function handler(req) {
  if (req.method !== "GET") return json(405, { error: "Method not allowed." });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return json(503, { error: "Count service is not configured." });
  try {
    const response = await fetch(url.replace(/\/$/, "") + "/rest/v1/rpc/volunteer_public_count", {
      method: "POST",
      headers: { apikey: key, authorization: "Bearer " + key, "content-type": "application/json" },
      body: "{}"
    });
    if (!response.ok) return json(502, { error: "Volunteer count is temporarily unavailable." });
    const count = Number(await response.json());
    if (!Number.isFinite(count) || count < 0) return json(502, { error: "Invalid count response." });
    return json(200, { count });
  } catch (_) {
    return json(502, { error: "Volunteer count is temporarily unavailable." });
  }
}
