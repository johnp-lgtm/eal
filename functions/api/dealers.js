/* ===================================================================
   Easy As Loans — dealer partner enquiries  (POST /api/dealers)
   Stores B2B dealership enquiries in their own `dealers` table (kept
   separate from consumer leads) and emails the team. Self-contained.
   =================================================================== */

export async function onRequest(context) {
  const { request } = context;
  try {
    switch (request.method) {
      case "POST": return await createDealer(context);
      case "OPTIONS": return new Response(null, { status: 204 });
      default: return json({ error: "Method not allowed" }, 405);
    }
  } catch (e) {
    return json({ error: "Server error" }, 500);
  }
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer"
    }
  });
}

function str(v, max) {
  if (v === null || v === undefined) { return ""; }
  return String(v).replace(/[\x00-\x1F\x7F]/g, " ").trim().slice(0, max || 200);
}
function noteStr(v, max) {
  if (v === null || v === undefined) { return ""; }
  return String(v).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, max || 1000);
}
function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") ||
    (request.headers.get("X-Forwarded-For") || "").split(",")[0].trim() || "";
}

async function createDealer({ request, env }) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "Invalid JSON" }, 400); }

  // Honeypot: silently accept & drop bots.
  if (body.website || body.company_url) { return json({ ok: true }); }

  const dealership = str(body.dealership, 140);
  const contactName = str(body.contactName, 120);
  const email = str(body.email, 160);
  const mobile = str(body.mobile, 40);
  if (!dealership || !contactName || !email || !mobile) {
    return json({ error: "Missing required details" }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { return json({ error: "Invalid email" }, 400); }

  const rec = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    dealership: dealership,
    contact_name: contactName,
    email: email,
    mobile: mobile,
    monthly_volume: str(body.monthlyVolume, 40) || null,
    current_finance: str(body.currentFinance, 80) || null,
    message: noteStr(body.message, 1200) || null,
    source: str(body.source, 80) || "dealers page",
    ip: clientIp(request)
  };

  const sql = "INSERT INTO dealers " +
    "(id, created_at, dealership, contact_name, email, mobile, monthly_volume, current_finance, message, source, ip) " +
    "VALUES (?,?,?,?,?,?,?,?,?,?,?)";
  const binds = [rec.id, rec.created_at, rec.dealership, rec.contact_name, rec.email, rec.mobile,
                 rec.monthly_volume, rec.current_finance, rec.message, rec.source, rec.ip];
  try {
    await env.DB.prepare(sql).bind(...binds).run();
  } catch (e) {
    // Table may not exist yet — create it once and retry.
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS dealers (" +
      "id TEXT PRIMARY KEY, created_at TEXT NOT NULL, dealership TEXT, contact_name TEXT, " +
      "email TEXT, mobile TEXT, monthly_volume TEXT, current_finance TEXT, message TEXT, source TEXT, ip TEXT)").run();
    await env.DB.prepare(sql).bind(...binds).run();
  }

  // Best-effort email — never blocks the enquiry.
  try { await emailDealer(env, rec); } catch (e) { /* ignore */ }

  return json({ ok: true, id: rec.id });
}

async function emailDealer(env, d) {
  if (!env.RESEND_API_KEY || !env.LEAD_EMAIL_TO) { return; }
  const lines = [
    "New DEALER PARTNER enquiry from easyasloans.com/dealers",
    "",
    "Dealership:   " + d.dealership,
    "Contact:      " + d.contact_name,
    "Mobile:       " + d.mobile,
    "Email:        " + d.email,
    "Cars / month: " + (d.monthly_volume || "-"),
    "Finance now:  " + (d.current_finance || "-"),
    "",
    "Message:",
    (d.message || "-"),
    "",
    "Received:     " + d.created_at
  ];
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.LEAD_EMAIL_FROM || "Easy As Loans <onboarding@resend.dev>",
      to: env.LEAD_EMAIL_TO.split(",").map(function (s) { return s.trim(); }).filter(Boolean),
      reply_to: d.email,
      subject: "[NEW DEALER ENQUIRY] " + d.dealership,
      text: lines.join("\n")
    })
  });
}
