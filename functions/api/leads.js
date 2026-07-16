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
      case "OPTIONS": return new Response(null, { status: 204 });
      default: return json({ error: "Method not allowed" }, 405);
    }
  } catch (err) {
    return json({ error: "Server error", detail: String(err && err.message || err) }, 500);
  }
}

/* ----------------------------- helpers --------------------------- */
function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
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

/* ----------------------------- create ---------------------------- */
async function createLead({ request, env }) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "Invalid JSON" }, 400); }

  // Honeypot: silently accept & drop obvious bots
  if (body.website || body.company_url) { return json({ ok: true }); }

  const fullName = (body.fullName || "").trim();
  const email = (body.email || "").trim();
  const mobile = (body.mobile || "").trim();
  if (!fullName || !email || !mobile) {
    return json({ error: "Missing required contact details" }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Invalid email" }, 400);
  }

  const lead = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    loan_type: body.loanType || null,
    loan_amount: toInt(body.loanAmount),
    loan_term: toInt(body.loanTerm),
    use_type: body.use || null,
    car_year: toInt(body.carYear),
    state: body.state || null,
    full_name: fullName,
    email: email,
    mobile: mobile,
    consent: body.consent ? 1 : 0,
    source: body.source || null,
    page_url: body.pageUrl || null,
    status: "New"
  };

  // Full submission captured as structured JSON — future-proof for any
  // new form fields without further schema changes.
  lead.details = JSON.stringify({
    loanType: body.loanType || null,
    loanAmount: toInt(body.loanAmount),
    loanTerm: toInt(body.loanTerm),
    use: body.use || null,
    carYear: toInt(body.carYear),
    state: body.state || null,
    firstName: (body.firstName || "").trim(),
    middleName: (body.middleName || "").trim(),
    lastName: (body.lastName || "").trim(),
    fullName: fullName,
    dob: (body.dob || "").trim(),
    employmentType: body.employmentType || null,
    employmentDuration: body.employmentDuration || null,
    residencyStatus: body.residencyStatus || null,
    livingSituation: body.livingSituation || null,
    abnDuration: body.abnDuration || null,
    gstRegistered: body.gstRegistered || null,
    email: email,
    mobile: mobile,
    submittedAt: body.submittedAt || null,
    source: body.source || null,
    pageUrl: body.pageUrl || null
  });
  // keep a copy on the object so the email can include everything
  lead._extra = JSON.parse(lead.details);

  if (!env.DB) {
    return json({ error: "Database not configured" }, 500);
  }

  try {
    // Preferred insert (includes the details column)
    await env.DB.prepare(
      `INSERT INTO leads
         (id, created_at, loan_type, loan_amount, loan_term, use_type, car_year,
          state, full_name, email, mobile, consent, source, page_url, status, details)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      lead.id, lead.created_at, lead.loan_type, lead.loan_amount, lead.loan_term,
      lead.use_type, lead.car_year, lead.state, lead.full_name, lead.email,
      lead.mobile, lead.consent, lead.source, lead.page_url, lead.status, lead.details
    ).run();
  } catch (e) {
    // Fallback if the `details` column doesn't exist yet (migration not run):
    // still save the core fields so no lead is ever lost.
    await env.DB.prepare(
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

  // Email backup (best-effort: never block the lead on email failure)
  try { await emailLead(env, lead); } catch (e) { /* logged by platform */ }

  return json({ ok: true, id: lead.id });
}

/* ------------------------------ list ----------------------------- */
async function listLeads({ request, env }) {
  if (!isAuthed(request, env)) { return json({ error: "Unauthorised" }, 401); }
  if (!env.DB) { return json({ error: "Database not configured" }, 500); }
  const { results } = await env.DB.prepare(
    `SELECT * FROM leads ORDER BY created_at DESC LIMIT 1000`
  ).all();
  return json({ ok: true, leads: results || [] });
}

/* ----------------------------- update ---------------------------- */
async function updateLead({ request, env }) {
  if (!isAuthed(request, env)) { return json({ error: "Unauthorised" }, 401); }
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
      to: [env.LEAD_EMAIL_TO],
      reply_to: lead.email,
      subject: "New lead: " + lead.full_name + " — " + (lead.loan_type || "Enquiry"),
      text: lines.join("\n")
    })
  });
}
