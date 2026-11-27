module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const first = String(body.first || "").trim();
    const last = String(body.last || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    if (first.length < 1 || first.length > 60 || last.length < 1 || last.length > 60) return res.status(400).json({ error: "Please enter a valid first and last name." });
    if (!/^\+?[0-9 ()-]{10,20}$/.test(phone)) return res.status(400).json({ error: "Please enter a valid phone number." });
    if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "Please enter a valid email address." });
    if (body.consent !== true) return res.status(400).json({ error: "Consent is required before registration." });
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return res.status(503).json({ error: "Registration service is not configured. Please contact the campaign team." });
    const response = await fetch(url.replace(/\/$/, "") + "/rest/v1/rpc/register_volunteer", {
      method: "POST",
      headers: { apikey: key, authorization: "Bearer " + key, "content-type": "application/json" },
      body: JSON.stringify({ p_first_name: first, p_last_name: last, p_phone: phone, p_email: email, p_consent: true, p_ward: null, p_interests: [] })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 409 || result?.code === "23505") return res.status(409).json({ error: "This phone number or email address is already registered." });
      if (result?.code === "22023") return res.status(400).json({ error: result.message || "Please check your registration details." });
      return res.status(502).json({ error: "We could not save your registration. Please try again shortly." });
    }
    const row = Array.isArray(result) ? result[0] : result;
    if (!row?.registration_number) return res.status(502).json({ error: "Registration was not confirmed by the database. Please contact the campaign team before trying again." });
    return res.status(200).json({ ok: true, registration_number: row.registration_number, total_count: Number(row.volunteer_total ?? row.total_count ?? 0) });
  } catch (_) {
    return res.status(400).json({ error: "Invalid registration request. Please check your details and try again." });
  }
};
