/* ===================================================================
   Easy As Loans — admin dashboard (Kanban board)
   Talks to /api/leads. Auth is a shared password sent as a Bearer token
   (kept in sessionStorage). Served over HTTPS by Cloudflare Pages.
   =================================================================== */

(function () {
  "use strict";

  var KEY = "eal_admin_pw";
  var loginView = document.querySelector(".js-login");
  var appView = document.querySelector(".js-app");
  var loginForm = document.querySelector(".js-login-form");
  var loginError = document.querySelector(".js-login-error");
  var boardEl = document.querySelector(".js-board");
  var countEl = document.querySelector(".js-count");
  var emptyEl = document.querySelector(".js-empty");
  var searchEl = document.querySelector(".js-search");
  var drawer = document.querySelector(".js-drawer");
  var detailEl = document.querySelector(".js-detail");

  var leads = [];
  var dealers = [];
  var flushNotes = null; // set while a drawer is open, to save pending notes on close

  var STATUSES = ["New", "Attempted contact 1", "Attempted contact 2", "Attempted contact 3", "Converted"];

  function pw() { return sessionStorage.getItem(KEY) || ""; }

  // Which staff member is logged in — derived from the password's first letter.
  // CEAL -> Cristian, DEAL -> Daniela, JEAL -> John (base password -> Cristian).
  var AGENTS = { C: "Cristian", D: "Daniela", J: "John" };
  function agentName() { return AGENTS[(pw().charAt(0) || "").toUpperCase()] || "Cristian"; }

  function api(method, body) {
    return fetch("/api/leads", {
      method: method,
      headers: { "Authorization": "Bearer " + pw(), "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
  }
  function apiDealers(method, body) {
    return fetch("/api/dealers", {
      method: method,
      headers: { "Authorization": "Bearer " + pw(), "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
  }

  /* ----------------------------- Auth ----------------------------- */
  function showApp() {
    loginView.hidden = true; appView.hidden = false;
    var u = document.querySelector(".js-user");
    if (u) { u.textContent = "Hi, " + agentName(); }
  }
  function showLogin() { appView.hidden = true; loginView.hidden = false; }

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    loginError.hidden = true;
    var val = document.querySelector(".js-pw").value;
    sessionStorage.setItem(KEY, val);
    load().then(function (ok) {
      if (ok) { showApp(); }
      else { sessionStorage.removeItem(KEY); loginError.hidden = false; }
    });
  });

  document.querySelector(".js-logout").addEventListener("click", function () {
    sessionStorage.removeItem(KEY);
    showLogin();
  });
  document.querySelector(".js-refresh").addEventListener("click", function () { load(); });

  /* ----------------------------- Load ----------------------------- */
  function load() {
    return api("GET").then(function (res) {
      if (res.status === 401 || !res.ok) { return false; }
      return res.json().then(function (data) {
        leads = data.leads || [];
        // Dealer enquiries (separate table). Non-fatal if it fails.
        return apiDealers("GET")
          .then(function (dr) { return dr.ok ? dr.json() : { dealers: [] }; })
          .catch(function () { return { dealers: [] }; })
          .then(function (dd) {
            dealers = dd.dealers || [];
            render();
            return true;
          });
      });
    }).catch(function () { return false; });
  }

  /* --------------------------- Helpers ---------------------------- */
  function fmtMoney(n) { return n == null ? "—" : "$" + Number(n).toLocaleString("en-AU"); }
  function fmtDate(iso) {
    if (!iso) { return "—"; }
    var d = new Date(iso);
    return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short" }) + " " +
           d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
  }
  // Relative "time ago" — e.g. "just now", "12m ago", "3h ago", "2d ago".
  function fmtAgo(iso) {
    if (!iso) { return "—"; }
    var then = new Date(iso).getTime();
    if (isNaN(then)) { return "—"; }
    var s = Math.floor((Date.now() - then) / 1000);
    if (s < 45) { return "just now"; }
    var m = Math.floor(s / 60); if (m < 60) { return m + "m ago"; }
    var h = Math.floor(m / 60); if (h < 24) { return h + "h ago"; }
    var dd = Math.floor(h / 24); if (dd < 30) { return dd + "d ago"; }
    var mo = Math.floor(dd / 30); if (mo < 12) { return mo + "mo ago"; }
    return Math.floor(mo / 12) + "y ago";
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Turn a status label into a safe CSS class, e.g. "Attempted contact 1" -> "st-attempted-contact-1"
  function statusClass(s) {
    return "st-" + String(s || "New").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  // Any lead whose status isn't one of the known columns falls into "New".
  function effStatus(l) { return STATUSES.indexOf(l.status) !== -1 ? l.status : "New"; }
  function detailsOf(l) { try { return l.details ? JSON.parse(l.details) : {}; } catch (e) { return {}; } }
  function lastEdited(l) { return l.updated_at || l.created_at; }

  // Prefilled texts — opens Messages/iMessage with the customer's number and a
  // stage-specific message. Edit the templates to taste.
  // {first} = customer first name, {loan} = their loan type (e.g. "car loan").
  var SMS_TEMPLATES = {
    "Attempted contact 1": "Hey {first}, it's {agent} from Easy As Loans, just responding to your {loan} enquiry. Give me a call back when you're free!",
    "Attempted contact 2": "Hey {first}, just following up to see if you're still looking into your finance options? We have access to over 50 different lenders, and are able to source the best interest rates tailored to your credit profile. Give me a call if you'd like a quote or have any questions. Thanks, {agent} from Easy As Loans 🙂",
    "Attempted contact 3": "Hey {first}, it's {agent} from Easy As Loans. I've reached out a few times now and haven't heard back, so I'm going to assume you've gone in a different direction with this one. That's no worries, I'll go ahead and close your file down on my end for now. If I'm wrong though and you still need finance, feel free to reach out. Thanks!"
  };
  function smsNumber(m) {
    var d = String(m || "").replace(/[^\d+]/g, "");
    if (d.charAt(0) === "0") { return "+61" + d.slice(1); }   // 04xx… -> +614xx…
    if (d.slice(0, 2) === "61") { return "+" + d; }
    return d;
  }
  function loanPhrase(l) { var t = String(l.loan_type || "").trim(); return t ? t.toLowerCase() : "finance"; }
  function smsBody(l, status) {
    var st = status || l.status || "Attempted contact 1";
    var tpl = SMS_TEMPLATES[st] || SMS_TEMPLATES["Attempted contact 1"];
    var d = detailsOf(l);
    var first = d.firstName || String(l.full_name || "there").trim().split(" ")[0] || "there";
    return tpl.replace(/\{first\}/g, first).replace(/\{loan\}/g, loanPhrase(l)).replace(/\{agent\}/g, agentName());
  }
  function smsHref(l, status) { return "sms:" + smsNumber(l.mobile) + "&body=" + encodeURIComponent(smsBody(l, status)); }
  function openMessage(l, status) { window.location.href = smsHref(l, status); }

  // Small inline icon for the loan type.
  function loanIcon(type) {
    var t = String(type || "").toLowerCase();
    var open = '<svg class="li" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">';
    if (t.indexOf("refinance") !== -1 || t.indexOf("refi") !== -1) {
      return open + '<path d="M4.5 11a7.5 7.5 0 0 1 12.8-4.3L20 9"/><path d="M20 4.5V9h-4.5"/><path d="M19.5 13a7.5 7.5 0 0 1-12.8 4.3L4 15"/><path d="M4 19.5V15h4.5"/></svg>';
    }
    if (t.indexOf("car") !== -1) {
      return open + '<path d="M5 13l1.4-4.2A2 2 0 0 1 8.3 7.4h7.4a2 2 0 0 1 1.9 1.4L19 13"/><path d="M4 17v-3.2a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1V17a1 1 0 0 1-1 1h-1"/><path d="M6 18H5a1 1 0 0 1-1-1"/><circle cx="7.5" cy="17.5" r="1.6"/><circle cx="16.5" cy="17.5" r="1.6"/></svg>';
    }
    if (t.indexOf("business") !== -1) {
      return open + '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6.5A2 2 0 0 1 10 4.5h4a2 2 0 0 1 2 2V8"/><path d="M3 13h18"/></svg>';
    }
    if (t.indexOf("debt") !== -1) {
      return open + '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.6 3.1 3 7 3s7-1.4 7-3V6"/><path d="M5 12v6c0 1.6 3.1 3 7 3s7-1.4 7-3v-6"/></svg>';
    }
    // personal / default
    return open + '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/></svg>';
  }

  function matchesSearch(l, q) {
    if (!q) { return true; }
    var hay = (l.full_name || "") + " " + String(l.mobile || "").replace(/\s/g, "") + " " + (l.email || "");
    return hay.toLowerCase().indexOf(q) !== -1;
  }

  // Small line icons used on the cards (trailing row hints + action strip).
  var IC = {
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5h3l1.5 4-2 1.4a12 12 0 0 0 5.6 5.6l1.4-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 5 5.1 1.5 1.5 0 0 1 6.5 3.5z"/></svg>',
    person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h7L18 8v12.5H6z"/><path d="M13 3.5V8h5"/><path d="M8.5 12.5h7M8.5 15.5h7"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5h7l9 9-6.5 6.5-9-9z"/><circle cx="8" cy="8.5" r="1.4"/></svg>',
    sms: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5h16v11H8.5L4 20z"/><path d="M8.5 11h7M8.5 8.5h7"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 5.5L20 7"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 5.5l3 3M4 20l1-4L16 5a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1L8 19z"/></svg>'
  };

  // One card row: bold label, value, trailing hint icon.
  function lcRow(k, v, icon) {
    return '<div class="lc-row"><span class="lc-k">' + esc(k) + '</span>' +
      '<span class="lc-v">' + esc(v || "—") + '</span>' +
      '<span class="lc-ri">' + icon + '</span></div>';
  }

  /* --------------------------- Rendering -------------------------- */
  function cardHtml(l) {
    return '<article class="lead-card" data-id="' + esc(l.id) + '">' +
      '<div class="lc-main">' +
        '<div class="lc-top">' +
          '<span class="lc-icon" title="' + esc(l.loan_type || "") + '">' + loanIcon(l.loan_type) + '</span>' +
          '<span class="lc-name">' + esc(l.full_name || "—") + '</span>' +
          '<span class="lc-amount">' + esc(fmtMoney(l.loan_amount)) + '</span>' +
        '</div>' +
        '<div class="lc-rows">' +
          lcRow("Mobile", l.mobile, IC.phone) +
          lcRow("Owner", l.owner || "Unassigned", IC.person) +
          lcRow("App. Status", effStatus(l), IC.doc) +
          lcRow("Referrer", l.source || "Direct", IC.tag) +
        '</div>' +
        '<div class="lc-foot">' +
          '<span class="lc-time">' + esc(fmtAgo(lastEdited(l))) + '</span>' +
          '<span class="lc-state">' + esc(l.state || "—") + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="lc-actions">' +
        '<a class="lc-act" href="tel:' + esc(l.mobile) + '" title="Call" aria-label="Call">' + IC.phone + '</a>' +
        '<button type="button" class="lc-act js-note" data-id="' + esc(l.id) + '" data-kind="lead" title="Add note" aria-label="Add note">' + IC.sms + '</button>' +
        '<a class="lc-act" href="mailto:' + esc(l.email) + '" title="Email" aria-label="Email">' + IC.mail + '</a>' +
        '<button type="button" class="lc-act js-status" data-id="' + esc(l.id) + '" title="Change status" aria-label="Change status">' + IC.edit + '</button>' +
      '</div>' +
    '</article>';
  }

  // A little storefront icon for dealer cards.
  function dealerIcon() {
    return '<svg class="li" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 9l1.2-3.4A1 1 0 0 1 6.15 5h11.7a1 1 0 0 1 .95.6L20 9"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/>' +
      '<path d="M4 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/><path d="M9 20v-5h6v5"/></svg>';
  }
  function dealerLastEdited(d) { return d.updated_at || d.created_at; }
  function matchesDealer(d, q) {
    if (!q) { return true; }
    var hay = (d.dealership || "") + " " + (d.contact_name || "") + " " + String(d.mobile || "").replace(/\s/g, "") + " " + (d.email || "");
    return hay.toLowerCase().indexOf(q) !== -1;
  }
  function dealerCardHtml(d) {
    return '<article class="lead-card dealer-card" data-id="' + esc(d.id) + '">' +
      '<div class="lc-main">' +
        '<div class="lc-top">' +
          '<span class="lc-icon">' + dealerIcon() + '</span>' +
          '<span class="lc-name">' + esc(d.dealership || "—") + '</span>' +
          (d.monthly_volume ? '<span class="lc-amount">' + esc(d.monthly_volume) + '</span>' : '') +
        '</div>' +
        '<div class="lc-rows">' +
          lcRow("Contact", d.contact_name, IC.person) +
          lcRow("Mobile", d.mobile, IC.phone) +
          lcRow("Cars/mth", d.monthly_volume, IC.doc) +
        '</div>' +
        '<div class="lc-foot">' +
          '<span class="lc-time">' + esc(fmtAgo(dealerLastEdited(d))) + '</span>' +
          '<span class="lc-state">DEALER</span>' +
        '</div>' +
      '</div>' +
      '<div class="lc-actions">' +
        '<a class="lc-act" href="tel:' + esc(d.mobile) + '" title="Call" aria-label="Call">' + IC.phone + '</a>' +
        '<button type="button" class="lc-act js-note" data-id="' + esc(d.id) + '" data-kind="dealer" title="Add note" aria-label="Add note">' + IC.sms + '</button>' +
        '<a class="lc-act" href="mailto:' + esc(d.email) + '" title="Email" aria-label="Email">' + IC.mail + '</a>' +
        '<button type="button" class="lc-act js-openlead" data-id="' + esc(d.id) + '" title="Open" aria-label="Open">' + IC.edit + '</button>' +
      '</div>' +
    '</article>';
  }

  function render() {
    var q = (searchEl.value || "").toLowerCase().trim();
    var visible = leads.filter(function (l) { return matchesSearch(l, q); });
    countEl.textContent = leads.length + (leads.length === 1 ? " lead" : " leads");
    emptyEl.hidden = leads.length !== 0 || dealers.length !== 0;

    var cols = STATUSES.map(function (status) {
      // Oldest-edited (most overdue) at the top, freshly-edited sink to the bottom.
      var cards = visible.filter(function (l) { return effStatus(l) === status; })
        .sort(function (a, b) { return String(lastEdited(a) || "").localeCompare(String(lastEdited(b) || "")); });
      return '<section class="col ' + statusClass(status) + '">' +
        '<header class="col-head">' +
          '<span class="col-title">' + esc(status) + '</span>' +
          '<span class="col-count">' + cards.length + '</span>' +
        '</header>' +
        '<div class="col-body">' +
          (cards.length ? cards.map(cardHtml).join("") : '<p class="col-empty">No leads</p>') +
        '</div>' +
      '</section>';
    });

    // Dealers column (separate table of B2B partner enquiries).
    var dcards = dealers.filter(function (d) { return matchesDealer(d, q); })
      .sort(function (a, b) { return String(dealerLastEdited(b) || "").localeCompare(String(dealerLastEdited(a) || "")); });
    cols.push('<section class="col st-dealers">' +
      '<header class="col-head">' +
        '<span class="col-title">Dealers</span>' +
        '<span class="col-count">' + dcards.length + '</span>' +
      '</header>' +
      '<div class="col-body">' +
        (dcards.length ? dcards.map(dealerCardHtml).join("") : '<p class="col-empty">No dealer enquiries</p>') +
      '</div>' +
    '</section>');

    boardEl.innerHTML = cols.join("");
  }

  boardEl.addEventListener("click", function (e) {
    // Quick actions: status pen and note bubble open a card popover.
    var statusBtn = e.target.closest(".js-status");
    if (statusBtn) { e.stopPropagation(); openStatusPop(statusBtn); return; }
    var noteBtn = e.target.closest(".js-note");
    if (noteBtn) { e.stopPropagation(); openNotePop(noteBtn); return; }
    // The "open" pen (dealer cards) opens the full drawer.
    var openBtn = e.target.closest(".js-openlead");
    if (openBtn) {
      var dc = openBtn.closest(".dealer-card");
      if (dc) { openDealerDetail(dc.getAttribute("data-id")); }
      else { var lc = openBtn.closest(".lead-card"); if (lc) { openDetail(lc.getAttribute("data-id")); } }
      return;
    }
    // Other action links (call / email) navigate on their own — don't open the drawer.
    if (e.target.closest(".lc-act")) { return; }
    var dcard = e.target.closest(".dealer-card[data-id]");
    if (dcard) { openDealerDetail(dcard.getAttribute("data-id")); return; }
    var card = e.target.closest(".lead-card[data-id]");
    if (card) { openDetail(card.getAttribute("data-id")); }
  });
  searchEl.addEventListener("input", render);

  /* --------------------------- Card popovers ----------------------- */
  // A single floating panel reused for the status picker and the quick-note
  // box. Lives on <body> so a board re-render never rips it out.
  var pop = document.createElement("div");
  pop.className = "lc-pop"; pop.hidden = true;
  document.body.appendChild(pop);

  function closePop() { pop.hidden = true; pop.innerHTML = ""; }
  function openPop(anchor, html, wire) {
    pop.innerHTML = html; pop.hidden = false;
    var r = anchor.getBoundingClientRect();
    var pw = pop.offsetWidth, ph = pop.offsetHeight;
    var left = r.right + 8;
    if (left + pw > window.innerWidth - 8) { left = r.left - pw - 8; }
    if (left < 8) { left = 8; }
    var top = r.top;
    if (top + ph > window.innerHeight - 8) { top = window.innerHeight - ph - 8; }
    if (top < 8) { top = 8; }
    pop.style.left = (left + window.scrollX) + "px";
    pop.style.top = (top + window.scrollY) + "px";
    if (wire) { wire(pop); }
  }
  document.addEventListener("click", function (e) {
    if (pop.hidden) { return; }
    if (e.target.closest(".lc-pop")) { return; }
    closePop();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !pop.hidden) { closePop(); }
  });
  window.addEventListener("resize", closePop);

  function openStatusPop(btn) {
    var l = leads.filter(function (x) { return x.id === btn.getAttribute("data-id"); })[0];
    if (!l) { return; }
    var html = '<div class="pop-head">Set status</div>' +
      STATUSES.map(function (s) {
        return '<button type="button" class="pop-item' + (s === effStatus(l) ? " is-current" : "") + '" data-status="' + esc(s) + '">' +
          '<span class="pop-dot ' + statusClass(s) + '"></span>' + esc(s) + '</button>';
      }).join("");
    openPop(btn, html, function (p) {
      p.querySelectorAll(".pop-item").forEach(function (it) {
        it.addEventListener("click", function () {
          var ns = this.getAttribute("data-status");
          api("PATCH", { id: l.id, status: ns }).then(function (res) {
            if (!res.ok) { return; }
            l.status = ns; l.updated_at = new Date().toISOString();
            if (ns !== "New" && !l.owner) { l.owner = agentName(); }  // auto-assign on first contact
            closePop(); render();
            // Moving into a contact-attempt stage pops the prefilled text.
            if (ns.indexOf("Attempted contact") === 0) { openMessage(l, ns); }
          });
        });
      });
    });
  }

  function openNotePop(btn) {
    var kind = btn.getAttribute("data-kind");
    var list = kind === "dealer" ? dealers : leads;
    var item = list.filter(function (x) { return x.id === btn.getAttribute("data-id"); })[0];
    if (!item) { return; }
    var html = '<div class="pop-head">Notes</div>' +
      '<textarea class="pop-notes" placeholder="Add a note — saves to this lead.">' + esc(item.notes || "") + '</textarea>' +
      '<div class="pop-actions"><span class="pop-state js-pop-state"></span><button type="button" class="pop-save">Save</button></div>';
    openPop(btn, html, function (p) {
      var ta = p.querySelector(".pop-notes");
      var st = p.querySelector(".js-pop-state");
      ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
      p.querySelector(".pop-save").addEventListener("click", function () {
        var val = ta.value;
        st.textContent = "Saving…";
        var fn = kind === "dealer" ? apiDealers : api;
        fn("PATCH", { id: item.id, notes: val }).then(function (res) {
          if (res.ok) {
            item.notes = val; item.updated_at = new Date().toISOString();
            st.textContent = "Saved ✓"; render();
            setTimeout(closePop, 650);
          } else { st.textContent = "Not saved — check connection"; }
        }).catch(function () { st.textContent = "Not saved — check connection"; });
      });
    });
  }

  /* ---------------------------- Detail ---------------------------- */
  function row(k, v) {
    return '<div class="detail-row"><span class="k">' + esc(k) + '</span><span class="v">' + v + '</span></div>';
  }

  function openDetail(id) {
    var l = leads.filter(function (x) { return x.id === id; })[0];
    if (!l) { return; }
    var d = detailsOf(l);
    var statuses = STATUSES;

    var employmentHtml = (d.employmentType || d.employmentDuration)
      ? '<div class="detail-section"><h3>Employment</h3>' +
          row("Employment", esc(d.employmentType || "—")) +
          row("Time in role", esc(d.employmentDuration || "—")) +
        '</div>' : "";
    var businessHtml = (d.abnDuration || d.gstRegistered)
      ? '<div class="detail-section"><h3>Business</h3>' +
          row("ABN held for", esc(d.abnDuration || "—")) +
          row("GST registered", esc(d.gstRegistered || "—")) +
        '</div>' : "";
    var residencyHtml = (d.residencyStatus || d.livingSituation)
      ? '<div class="detail-section"><h3>Residency</h3>' +
          row("Residency", esc(d.residencyStatus || "—")) +
          (d.livingSituation ? row("Living situation", esc(d.livingSituation)) : "") +
        '</div>' : "";

    detailEl.innerHTML =
      '<p class="detail-name">' + esc(l.full_name) + '</p>' +
      '<p class="detail-meta">Received ' + esc(fmtDate(l.created_at)) +
        ' · <span class="js-edited">Edited ' + esc(fmtAgo(lastEdited(l))) + '</span></p>' +

      '<div class="detail-section"><h3>Loan</h3>' +
        row("Loan type", esc(l.loan_type || "—")) +
        row("Amount", esc(fmtMoney(l.loan_amount))) +
        row("Term", l.loan_term != null ? esc(l.loan_term) + " years" : "—") +
        row("Use", esc(l.use_type || "—")) +
        (d.buyTimeframe ? row("Buying", esc(d.buyTimeframe)) : "") +
        (d.creditRating ? row("Credit (self-rated)", esc(d.creditRating)) : "") +
        (l.car_year != null ? row("Car year", esc(l.car_year)) : "") +
        row("State", esc(l.state || "—")) +
      '</div>' +

      employmentHtml +
      businessHtml +
      residencyHtml +

      '<div class="detail-section"><h3>Contact</h3>' +
        row("Email", '<a href="mailto:' + esc(l.email) + '">' + esc(l.email) + '</a>') +
        row("Mobile", '<a href="tel:' + esc(l.mobile) + '">' + esc(l.mobile) + '</a>') +
        (d.dob ? row("Date of birth", esc(d.dob)) : "") +
        row("Consent", l.consent ? "Yes" : "No") +
      '</div>' +

      '<div class="detail-section"><h3>Location <span style="font-weight:600;text-transform:none;letter-spacing:0">(approx. from IP)</span></h3>' +
        row("City", esc(d.geoCity || "—")) +
        row("State / region", esc(d.geoRegion || d.geoRegionCode || "—")) +
        row("Country", esc(d.geoCountry || "—")) +
      '</div>' +

      '<div class="detail-section"><h3>Source</h3>' +
        row("From", esc(l.source || "—")) +
        (d.submittedAt ? row("Submitted", esc(fmtDate(d.submittedAt))) : "") +
        (d.ip ? row("IP address", esc(d.ip)) : "") +
        row("Lead ID", esc(l.id)) +
      '</div>' +

      '<div class="detail-actions">' +
        '<label for="d-status">Status</label>' +
        '<select id="d-status" class="js-detail-status">' +
          statuses.map(function (s) {
            return '<option value="' + esc(s) + '"' + (s === effStatus(l) ? " selected" : "") + '>' + esc(s) + '</option>';
          }).join("") +
        '</select>' +
        '<label for="d-owner">Owner</label>' +
        '<select id="d-owner" class="js-detail-owner">' +
          ['', 'Cristian', 'Daniela', 'John'].map(function (o) {
            return '<option value="' + esc(o) + '"' + (o === (l.owner || "") ? " selected" : "") + '>' + (o || "Unassigned") + '</option>';
          }).join("") +
        '</select>' +
      '</div>' +

      '<div class="detail-section detail-notes">' +
        '<h3>Notes <span class="notes-state js-notes-state"></span></h3>' +
        '<textarea class="notes-input js-notes" placeholder="Add a note — e.g. \'Left voicemail 2pm, will try again tomorrow.\' Saves automatically.">' + esc(l.notes || "") + '</textarea>' +
      '</div>' +

      '<div class="detail-cta">' +
        '<a class="btn btn-primary" href="tel:' + esc(l.mobile) + '">Call</a>' +
        '<a class="btn btn-ghost" href="' + smsHref(l) + '">Text</a>' +
        '<a class="btn btn-ghost" href="mailto:' + esc(l.email) + '">Email</a>' +
      '</div>' +
      '<div class="detail-danger">' +
        '<button type="button" class="btn-delete js-delete">Delete lead</button>' +
      '</div>';

    var editedEl = detailEl.querySelector(".js-edited");
    function touch() {
      l.updated_at = new Date().toISOString();
      if (editedEl) { editedEl.textContent = "Edited just now"; }
      render();
    }

    detailEl.querySelector(".js-detail-status").addEventListener("change", function () {
      var newStatus = this.value;
      api("PATCH", { id: l.id, status: newStatus }).then(function (res) {
        if (res.ok) {
          l.status = newStatus;
          // Auto-assign owner on first contact (mirrors the server).
          if (newStatus !== "New" && !l.owner) {
            l.owner = agentName();
            var os = detailEl.querySelector(".js-detail-owner");
            if (os) { os.value = l.owner; }
          }
          touch();
          // Moving into a contact-attempt stage pops that stage's prefilled text.
          if (newStatus.indexOf("Attempted contact") === 0) { openMessage(l, newStatus); }
        }
      });
    });

    detailEl.querySelector(".js-detail-owner").addEventListener("change", function () {
      var newOwner = this.value;
      api("PATCH", { id: l.id, owner: newOwner }).then(function (res) {
        if (res.ok) { l.owner = newOwner; touch(); }
      });
    });

    // Auto-saving notes: debounced while typing, flushed on blur.
    var notesEl = detailEl.querySelector(".js-notes");
    var noteState = detailEl.querySelector(".js-notes-state");
    var saveTimer = null;
    var lastSaved = notesEl.value;
    function saveNotes() {
      clearTimeout(saveTimer);
      var val = notesEl.value;
      if (val === lastSaved) { return; }
      noteState.textContent = "Saving…";
      api("PATCH", { id: l.id, notes: val }).then(function (res) {
        if (res.ok) {
          lastSaved = val; l.notes = val;
          noteState.textContent = "Saved ✓";
          touch();
          setTimeout(function () { if (noteState) { noteState.textContent = ""; } }, 1600);
        } else {
          noteState.textContent = "Not saved — check connection";
        }
      }).catch(function () { noteState.textContent = "Not saved — check connection"; });
    }
    notesEl.addEventListener("input", function () {
      noteState.textContent = "…";
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveNotes, 700);
    });
    notesEl.addEventListener("blur", saveNotes);
    flushNotes = saveNotes;

    detailEl.querySelector(".js-delete").addEventListener("click", function () {
      if (!window.confirm("Permanently delete " + (l.full_name || "this lead") + "? This cannot be undone.")) { return; }
      var btn = this;
      btn.disabled = true; btn.textContent = "Deleting…";
      api("DELETE", { id: l.id }).then(function (res) {
        if (res.ok) {
          leads = leads.filter(function (x) { return x.id !== l.id; });
          drawer.hidden = true;
          render();
        } else {
          btn.disabled = false; btn.textContent = "Delete lead";
          window.alert("Could not delete this lead. Please try again.");
        }
      }).catch(function () {
        btn.disabled = false; btn.textContent = "Delete lead";
        window.alert("Could not delete this lead. Please try again.");
      });
    });

    drawer.hidden = false;
  }

  /* -------------------------- Dealer detail ------------------------ */
  function openDealerDetail(id) {
    var dz = dealers.filter(function (x) { return x.id === id; })[0];
    if (!dz) { return; }

    detailEl.innerHTML =
      '<p class="detail-name">' + esc(dz.dealership || "Dealer enquiry") + '</p>' +
      '<p class="detail-meta">Received ' + esc(fmtDate(dz.created_at)) +
        ' · <span class="js-edited">Edited ' + esc(fmtAgo(dz.updated_at || dz.created_at)) + '</span></p>' +

      '<div class="detail-section"><h3>Dealer enquiry</h3>' +
        row("Contact", esc(dz.contact_name || "—")) +
        row("Cars / month", esc(dz.monthly_volume || "—")) +
        row("Finance now", esc(dz.current_finance || "—")) +
      '</div>' +

      '<div class="detail-section"><h3>Contact</h3>' +
        row("Email", '<a href="mailto:' + esc(dz.email) + '">' + esc(dz.email) + '</a>') +
        row("Mobile", '<a href="tel:' + esc(dz.mobile) + '">' + esc(dz.mobile) + '</a>') +
      '</div>' +

      (dz.message ? '<div class="detail-section"><h3>Message</h3><p class="detail-msg">' + esc(dz.message) + '</p></div>' : '') +

      '<div class="detail-section"><h3>Source</h3>' +
        row("From", esc(dz.source || "dealers page")) +
        (dz.ip ? row("IP address", esc(dz.ip)) : "") +
        row("Enquiry ID", esc(dz.id)) +
      '</div>' +

      '<div class="detail-section detail-notes">' +
        '<h3>Notes <span class="notes-state js-notes-state"></span></h3>' +
        '<textarea class="notes-input js-notes" placeholder="Add a note — e.g. \'Called, keen, sends ~40 cars/mth. Sending agreement.\' Saves automatically.">' + esc(dz.notes || "") + '</textarea>' +
      '</div>' +

      '<div class="detail-cta">' +
        '<a class="btn btn-primary" href="tel:' + esc(dz.mobile) + '">Call</a>' +
        '<a class="btn btn-ghost" href="mailto:' + esc(dz.email) + '">Email</a>' +
      '</div>' +
      '<div class="detail-danger">' +
        '<button type="button" class="btn-delete js-delete">Delete enquiry</button>' +
      '</div>';

    var editedEl = detailEl.querySelector(".js-edited");

    // Auto-saving notes (via the dealer endpoint).
    var notesEl = detailEl.querySelector(".js-notes");
    var noteState = detailEl.querySelector(".js-notes-state");
    var saveTimer = null;
    var lastSaved = notesEl.value;
    function saveNotes() {
      clearTimeout(saveTimer);
      var val = notesEl.value;
      if (val === lastSaved) { return; }
      noteState.textContent = "Saving…";
      apiDealers("PATCH", { id: dz.id, notes: val }).then(function (res) {
        if (res.ok) {
          lastSaved = val; dz.notes = val; dz.updated_at = new Date().toISOString();
          if (editedEl) { editedEl.textContent = "Edited just now"; }
          noteState.textContent = "Saved ✓";
          render();
          setTimeout(function () { if (noteState) { noteState.textContent = ""; } }, 1600);
        } else { noteState.textContent = "Not saved — check connection"; }
      }).catch(function () { noteState.textContent = "Not saved — check connection"; });
    }
    notesEl.addEventListener("input", function () {
      noteState.textContent = "…"; clearTimeout(saveTimer); saveTimer = setTimeout(saveNotes, 700);
    });
    notesEl.addEventListener("blur", saveNotes);
    flushNotes = saveNotes;

    detailEl.querySelector(".js-delete").addEventListener("click", function () {
      if (!window.confirm("Permanently delete the enquiry from " + (dz.dealership || "this dealer") + "?")) { return; }
      var btn = this; btn.disabled = true; btn.textContent = "Deleting…";
      apiDealers("DELETE", { id: dz.id }).then(function (res) {
        if (res.ok) {
          dealers = dealers.filter(function (x) { return x.id !== dz.id; });
          drawer.hidden = true; flushNotes = null; render();
        } else { btn.disabled = false; btn.textContent = "Delete enquiry"; window.alert("Could not delete. Please try again."); }
      }).catch(function () { btn.disabled = false; btn.textContent = "Delete enquiry"; window.alert("Could not delete. Please try again."); });
    });

    drawer.hidden = false;
  }

  function closeDrawer() {
    if (flushNotes) { flushNotes(); flushNotes = null; }
    drawer.hidden = true;
  }
  document.querySelectorAll(".js-drawer-close").forEach(function (el) {
    el.addEventListener("click", closeDrawer);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !drawer.hidden) { closeDrawer(); }
  });

  /* --------------------------- Boot ------------------------------- */
  if (pw()) {
    load().then(function (ok) { if (ok) { showApp(); } else { sessionStorage.removeItem(KEY); showLogin(); } });
  } else {
    showLogin();
  }
})();
