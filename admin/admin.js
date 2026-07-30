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
  var flushNotes = null; // set while a lead drawer is open, to save pending notes on close

  var STATUSES = ["New", "Attempted contact 1", "Attempted contact 2", "Attempted contact 3", "Converted"];

  function pw() { return sessionStorage.getItem(KEY) || ""; }

  function api(method, body) {
    return fetch("/api/leads", {
      method: method,
      headers: {
        "Authorization": "Bearer " + pw(),
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });
  }

  /* ----------------------------- Auth ----------------------------- */
  function showApp() { loginView.hidden = true; appView.hidden = false; }
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
      if (res.status === 401) { return false; }
      if (!res.ok) { return false; }
      return res.json().then(function (data) {
        leads = data.leads || [];
        render();
        return true;
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
    "Attempted contact 1": "Hey {first}, it's Cristian from Easy As Loans, just responding to your {loan} enquiry. Give me a call back when you're free!",
    "Attempted contact 2": "Hey {first}, just following up to see if you're still looking into your finance options? We have access to over 50 different lenders, and are able to source the best interest rates tailored to your credit profile. Give me a call if you'd like a quote or have any questions. Thanks, Cristian from Easy As Loans 🙂",
    "Attempted contact 3": "Hey {first}, it's Cristian from Easy As Loans. I've reached out a few times now and haven't heard back, so I'm going to assume you've gone in a different direction with this one. That's no worries, I'll go ahead and close your file down on my end for now. If I'm wrong though and you still need finance, feel free to reach out. Thanks!"
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
    return tpl.replace(/\{first\}/g, first).replace(/\{loan\}/g, loanPhrase(l));
  }
  function smsHref(l, status) { return "sms:" + smsNumber(l.mobile) + "&body=" + encodeURIComponent(smsBody(l, status)); }
  function openMessage(l, status) { window.location.href = smsHref(l, status); }

  // Small inline icon for the loan type.
  function loanIcon(type) {
    var t = String(type || "").toLowerCase();
    var open = '<svg class="li" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">';
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

  /* --------------------------- Rendering -------------------------- */
  function cardHtml(l) {
    var d = detailsOf(l);
    return '<article class="lead-card" data-id="' + esc(l.id) + '">' +
      '<div class="lc-top">' +
        '<span class="lc-icon" title="' + esc(l.loan_type || "") + '">' + loanIcon(l.loan_type) + '</span>' +
        '<span class="lc-name">' + esc(l.full_name || "—") + '</span>' +
        '<span class="lc-amount">' + esc(fmtMoney(l.loan_amount)) + '</span>' +
      '</div>' +
      '<div class="lc-rows">' +
        '<div class="lc-row"><span class="lc-k">Mobile</span><span class="lc-v">' + esc(l.mobile || "—") + '</span></div>' +
        '<div class="lc-row"><span class="lc-k">Living</span><span class="lc-v">' + esc(d.livingSituation || "—") + '</span></div>' +
      '</div>' +
      '<div class="lc-foot">' +
        '<span class="lc-time">' + esc(fmtAgo(lastEdited(l))) + '</span>' +
        '<span class="lc-state">' + esc(l.state || "—") + '</span>' +
      '</div>' +
    '</article>';
  }

  function render() {
    var q = (searchEl.value || "").toLowerCase().trim();
    var visible = leads.filter(function (l) { return matchesSearch(l, q); });
    countEl.textContent = leads.length + (leads.length === 1 ? " lead" : " leads");
    emptyEl.hidden = leads.length !== 0;

    boardEl.innerHTML = STATUSES.map(function (status) {
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
    }).join("");
  }

  boardEl.addEventListener("click", function (e) {
    var card = e.target.closest(".lead-card[data-id]");
    if (!card) { return; }
    openDetail(card.getAttribute("data-id"));
  });
  searchEl.addEventListener("input", render);

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
          l.status = newStatus; touch();
          // Moving into a contact-attempt stage pops that stage's prefilled text.
          if (newStatus.indexOf("Attempted contact") === 0) { openMessage(l, newStatus); }
        }
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
