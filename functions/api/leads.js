/* ===================================================================
   Easy As Loans — leads API  (Cloudflare Pages Function)
   Route: /api/leads

   POST   create a lead   (public — used by the website form)
   GET    list leads       (admin — requires Bearer ADMIN_PASSWORD)
   PATCH  update status    (admin — requires Bearer ADMIN_PASSWORD)

   Bindings / environment variables (set in Cloudflare — see CRM-SETUP.md):
     DB                D1 database binding
     ADMIN_PASSWORD    password for the /admin dashboard
     RESEND_API_KEY    (optional) Resend key to email each lead
     LEAD_EMAIL_TO     (optional) where to email leads, e.g. cristian.r@savvy.com.au
     LEAD_EMAIL_FROM   (optional) verified sender, e.g. "Easy As Loans <leads@easyasloans.com.au>"
   =================================================================== */

export async function onRequest(context) {
  const { request } = context;
  try {
    switch (request.method) {
      case "POST":  return await createLead(context);
      case "GET":   return await listLeads(context);
      case "PATCH": return await updateLead(context);
      case "DELETE": return await deleteLead(context);
      case "OPTIONS": return new Response(null, { status: 204 });
      default: return json({ error: "Method not allowed" }, 405);
    }
  } catch (err) {
    // Never leak internal error detail to the client.
    return json({ error: "Server error" }, 500);
  }
}

/* ----------------------------- helpers --------------------------- */
function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      // Lead data must never be cached by browsers or intermediaries.
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer"
    }
  });
}

function isAuthed(request, env) {
  if (!env.ADMIN_PASSWORD) { return false; }
  const header = request.headers.get("Authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "");
  // length-safe-ish comparison
  if (token.length !== env.ADMIN_PASSWORD.length) { return false; }
  let diff = 0;
  for (let i = 0; i < token.length; i++) { diff |= token.charCodeAt(i) ^ env.ADMIN_PASSWORD.charCodeAt(i); }
  return diff === 0;
}

function toInt(v) {
  if (v === null || v === undefined || v === "") { return null; }
  const n = parseInt(String(v).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

// Trim, strip control characters, and cap length on any user-supplied string.
function str(v, max) {
  if (v === null || v === undefined) { return ""; }
  var s = String(v).replace(/[\x00-\x1F\x7F]/g, " ").trim();
  return s.slice(0, max || 200);
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") ||
         request.headers.get("X-Forwarded-For") || "unknown";
}

/* Simple D1-backed sliding-window rate limiter. Fails OPEN on any error so a
   real lead is never lost to a limiter hiccup. */
async function rateOk(env, key, limit, windowMs) {
  if (!env.DB) { return true; }
  try {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS throttle (k TEXT PRIMARY KEY, n INTEGER, ts INTEGER)"
    ).run();
    const now = Date.now();
    const row = await env.DB.prepare("SELECT n, ts FROM throttle WHERE k = ?").bind(key).first();
    if (!row || (now - row.ts) > windowMs) {
      await env.DB.prepare(
        "INSERT INTO throttle (k, n, ts) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = 1, ts = ?"
      ).bind(key, now, now).run();
      return true;
    }
    if (row.n >= limit) { return false; }
    await env.DB.prepare("UPDATE throttle SET n = n + 1 WHERE k = ?").bind(key).run();
    return true;
  } catch (e) {
    return true;
  }
}

/* ----------------------------- create ---------------------------- */
async function createLead({ request, env }) {
  // Cap the request body size (defends against oversized-payload abuse).
  const raw = await request.text();
  if (raw.length > 20000) { return json({ error: "Payload too large" }, 413); }
  let body;
  try { body = JSON.parse(raw); } catch (e) { return json({ error: "Invalid JSON" }, 400); }

  // Honeypot: silently accept & drop obvious bots
  if (body.website || body.company_url) { return json({ ok: true }); }

  // Rate limit: max 8 submissions per IP per hour. Fails open on limiter error.
  const ip = clientIp(request);
  if (!(await rateOk(env, "post:" + ip, 8, 3600000))) {
    return json({ error: "Too many requests. Please try again later." }, 429);
  }

  const fullName = str(body.fullName, 120);
  const email = str(body.email, 160);
  const mobile = str(body.mobile, 40);
  if (!fullName || !email || !mobile) {
    return json({ error: "Missing required contact details" }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Invalid email" }, 400);
  }

  const lead = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    loan_type: str(body.loanType, 40) || null,
    loan_amount: toInt(body.loanAmount),
    loan_term: toInt(body.loanTerm),
    use_type: str(body.use, 40) || null,
    car_year: toInt(body.carYear),
    state: str(body.state, 40) || null,
    full_name: fullName,
    email: email,
    mobile: mobile,
    consent: body.consent ? 1 : 0,
    source: str(body.source, 80) || null,
    page_url: str(body.pageUrl, 300) || null,
    status: "New"
  };

  // Full submission captured as structured JSON — future-proof for any
  // new form fields without further schema changes.
  lead.details = JSON.stringify({
    loanType: str(body.loanType, 40) || null,
    loanAmount: toInt(body.loanAmount),
    loanTerm: toInt(body.loanTerm),
    use: str(body.use, 40) || null,
    carYear: toInt(body.carYear),
    state: str(body.state, 40) || null,
    firstName: str(body.firstName, 80),
    middleName: str(body.middleName, 80),
    lastName: str(body.lastName, 80),
    fullName: fullName,
    dob: str(body.dob, 12),
    employmentType: str(body.employmentType, 60) || null,
    employmentDuration: str(body.employmentDuration, 60) || null,
    residencyStatus: str(body.residencyStatus, 60) || null,
    livingSituation: str(body.livingSituation, 60) || null,
    abnDuration: str(body.abnDuration, 60) || null,
    gstRegistered: str(body.gstRegistered, 20) || null,
    email: email,
    mobile: mobile,
    submittedAt: str(body.submittedAt, 40) || null,
    source: str(body.source, 80) || null,
    pageUrl: str(body.pageUrl, 300) || null,
    ip: clientIp(request)
  });
  // keep a copy on the object so the email can include everything
  lead._extra = JSON.parse(lead.details);

  if (!env.DB) {
    return json({ error: "Database not configured" }, 500);
  }

  function fullInsert() {
    return env.DB.prepare(
      `INSERT INTO leads
         (id, created_at, loan_type, loan_amount, loan_term, use_type, car_year,
          state, full_name, email, mobile, consent, source, page_url, status, details)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      lead.id, lead.created_at, lead.loan_type, lead.loan_amount, lead.loan_term,
      lead.use_type, lead.car_year, lead.state, lead.full_name, lead.email,
      lead.mobile, lead.consent, lead.source, lead.page_url, lead.status, lead.details
    ).run();
  }
  function coreInsert() {
    return env.DB.prepare(
      `INSERT INTO leads
         (id, created_at, loan_type, loan_amount, loan_term, use_type, car_year,
          state, full_name, email, mobile, consent, source, page_url, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      lead.id, lead.created_at, lead.loan_type, lead.loan_amount, lead.loan_term,
      lead.use_type, lead.car_year, lead.state, lead.full_name, lead.email,
      lead.mobile, lead.consent, lead.source, lead.page_url, lead.status
    ).run();
  }

  try {
    await fullInsert();
  } catch (e) {
    // The `details` column probably doesn't exist yet — create it once and
    // retry, so the full submission is captured with no manual migration.
    try {
      await env.DB.prepare("ALTER TABLE leads ADD COLUMN details TEXT").run();
      await fullInsert();
    } catch (e2) {
      // Last resort: still save the core fields so no lead is ever lost.
      await coreInsert();
    }
  }

  // Email backup (best-effort: never block the lead on email failure)
  try { await emailLead(env, lead); } catch (e) { /* logged by platform */ }

  return json({ ok: true, id: lead.id });
}

/* Gate an admin request. Successful auth is never penalised; each failure
   consumes one slot and, past the threshold, the IP is blocked (429). */
async function guardAdmin(request, env) {
  if (isAuthed(request, env)) { return null; }
  const under = await rateOk(env, "authfail:" + clientIp(request), 10, 900000);
  return under ? json({ error: "Unauthorised" }, 401)
               : json({ error: "Too many failed attempts. Try again later." }, 429);
}

/* ------------------------------ list ----------------------------- */
async function listLeads({ request, env }) {
  const blocked = await guardAdmin(request, env);
  if (blocked) { return blocked; }
  if (!env.DB) { return json({ error: "Database not configured" }, 500); }
  const { results } = await env.DB.prepare(
    `SELECT * FROM leads ORDER BY created_at DESC LIMIT 1000`
  ).all();
  return json({ ok: true, leads: results || [] });
}

/* ----------------------------- update ---------------------------- */
async function updateLead({ request, env }) {
  const blocked = await guardAdmin(request, env);
  if (blocked) { return blocked; }
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "Invalid JSON" }, 400); }
  const allowed = ["New", "Contacted", "Qualified", "Won", "Lost"];
  if (!body.id || allowed.indexOf(body.status) === -1) {
    return json({ error: "Invalid id or status" }, 400);
  }
  await env.DB.prepare(`UPDATE leads SET status = ? WHERE id = ?`)
    .bind(body.status, body.id).run();
  return json({ ok: true });
}

/* ----------------------------- delete ---------------------------- */
async function deleteLead({ request, env }) {
  const blocked = await guardAdmin(request, env);
  if (blocked) { return blocked; }
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "Invalid JSON" }, 400); }
  if (!body.id) { return json({ error: "Missing id" }, 400); }
  await env.DB.prepare(`DELETE FROM leads WHERE id = ?`).bind(body.id).run();
  return json({ ok: true });
}

/* ------------------------------ email ---------------------------- */
async function emailLead(env, lead) {
  if (!env.RESEND_API_KEY || !env.LEAD_EMAIL_TO) { return; }
  const money = lead.loan_amount != null ? "$" + Number(lead.loan_amount).toLocaleString("en-AU") : "—";
  const x = lead._extra || {};
  const lines = [
    "New lead from easyasloans.com.au",
    "",
    "Loan type:    " + (lead.loan_type || "—"),
    "Amount:       " + money,
    "Term:         " + (lead.loan_term != null ? lead.loan_term + " years" : "—"),
    "Use:          " + (lead.use_type || "—"),
    "Car year:     " + (lead.car_year != null ? lead.car_year : "—"),
    "State:        " + (lead.state || "—"),
    "",
    "Employment:   " + (x.employmentType || "—"),
    "Time there:   " + (x.employmentDuration || "—"),
    "Residency:    " + (x.residencyStatus || "—"),
    "Living:       " + (x.livingSituation || "—"),
    "ABN age:      " + (x.abnDuration || "—"),
    "GST reg.:     " + (x.gstRegistered || "—"),
    "",
    "Name:         " + lead.full_name,
    "Date of birth:" + (x.dob || "—"),
    "Email:        " + lead.email,
    "Mobile:       " + lead.mobile,
    "",
    "Submitted:    " + lead.created_at,
    "Consent:      " + (lead.consent ? "Yes" : "No")
  ];
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + env.RESEND_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.LEAD_EMAIL_FROM || "Easy As Loans <onboarding@resend.dev>",
      to: env.LEAD_EMAIL_TO.split(",").map(function (s) { return s.trim(); }).filter(Boolean),
      reply_to: lead.email,
      subject: "[NEW LEAD] " + lead.full_name + " — " + (lead.loan_type || "Enquiry"),
      text: lines.join("\n")
    })
  });
}
