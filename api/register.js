const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export default async function handler(req) {
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });
  try {
    const body = await req.json();
    const first = String(body.first || "").trim();
    const last = String(body.last || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    if (first.length < 1 || first.length > 60 || last.length < 1 || last.length > 60) return json(400, { error: "Please enter a valid first and last name." });
    if (!/^\+?[0-9 ()-]{10,20}$/.test(phone)) return json(400, { error: "Please enter a valid phone number." });
    if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: "Please enter a valid email address." });
    if (body.consent !== true) return json(400, { error: "Consent is required before registration." });
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return json(503, { error: "Registration service is not configured. Please contact the campaign team." });
    const response = await fetch(url.replace(/\/$/, "") + "/rest/v1/rpc/register_volunteer", {
      method: "POST",
      headers: { apikey: key, authorization: "Bearer " + key, "content-type": "application/json" },
      body: JSON.stringify({ p_first_name: first, p_last_name: last, p_phone: phone, p_email: email, p_consent: true, p_ward: null, p_interests: [] })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 409 || result?.code === "23505") return json(409, { error: "This phone number or email address is already registered." });
      if (result?.code === "22023") return json(400, { error: result.message || "Please check your registration details." });
      return json(502, { error: "We could not save your registration. Please try again shortly." });
    }
    const row = Array.isArray(result) ? result[0] : result;
    if (!row?.registration_number) return json(502, { error: "Registration was not confirmed by the database. Please contact the campaign team before trying again." });
    return json(200, { ok: true, registration_number: row.registration_number, total_count: Number(row.volunteer_total ?? row.total_count ?? 0) });
  } catch (_) {
    return json(400, { error: "Invalid registration request. Please check your details and try again." });
  }
}
