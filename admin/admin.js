/* ===================================================================
   Easy As Loans — admin dashboard
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
  var rowsEl = document.querySelector(".js-rows");
  var countEl = document.querySelector(".js-count");
  var emptyEl = document.querySelector(".js-empty");
  var searchEl = document.querySelector(".js-search");
  var statusFilterEl = document.querySelector(".js-status-filter");
  var drawer = document.querySelector(".js-drawer");
  var detailEl = document.querySelector(".js-detail");

  var leads = [];
  var sortKey = "created_at";
  var sortDir = "desc";
  var flushNotes = null; // set while a lead drawer is open, to save pending notes on close

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

  /* --------------------------- Rendering -------------------------- */
  function fmtMoney(n) { return n == null ? "—" : "$" + Number(n).toLocaleString("en-AU"); }
  function fmtDate(iso) {
    if (!iso) { return "—"; }
    var d = new Date(iso);
    return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short" }) + " " +
           d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
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
  var STATUSES = ["New", "Attempted contact 1", "Attempted contact 2", "Attempted contact 3", "Converted"];

  function filtered() {
    var q = (searchEl.value || "").toLowerCase().trim();
    var sf = statusFilterEl.value;
    var list = leads.filter(function (l) {
      if (sf && l.status !== sf) { return false; }
      if (!q) { return true; }
      return [l.full_name, l.email, l.mobile, l.state, l.loan_type]
        .join(" ").toLowerCase().indexOf(q) !== -1;
    });
    list.sort(function (a, b) {
      var av = a[sortKey], bv = b[sortKey];
      if (av == null) { av = ""; } if (bv == null) { bv = ""; }
      if (typeof av === "number" || sortKey === "loan_amount") { av = Number(av) || 0; bv = Number(bv) || 0; }
      if (av < bv) { return sortDir === "asc" ? -1 : 1; }
      if (av > bv) { return sortDir === "asc" ? 1 : -1; }
      return 0;
    });
    return list;
  }

  function render() {
    var list = filtered();
    countEl.textContent = leads.length + (leads.length === 1 ? " lead" : " leads");
    emptyEl.hidden = leads.length !== 0;
    rowsEl.innerHTML = list.map(function (l) {
      return '<tr data-id="' + esc(l.id) + '">' +
        '<td>' + esc(fmtDate(l.created_at)) + '</td>' +
        '<td class="admin-name">' + esc(l.full_name) + '</td>' +
        '<td>' + esc(l.loan_type || "—") + '</td>' +
        '<td class="num">' + esc(fmtMoney(l.loan_amount)) + '</td>' +
        '<td>' + esc(l.state || "—") + '</td>' +
        '<td><span class="badge ' + statusClass(l.status) + '">' + esc(l.status || "New") + '</span></td>' +
        '</tr>';
    }).join("");

    // sort header indicators
    document.querySelectorAll("th.sortable").forEach(function (th) {
      th.classList.remove("sorted-asc", "sorted-desc");
      if (th.getAttribute("data-sort") === sortKey) {
        th.classList.add(sortDir === "asc" ? "sorted-asc" : "sorted-desc");
      }
    });
  }

  document.querySelectorAll("th.sortable").forEach(function (th) {
    th.addEventListener("click", function () {
      var k = th.getAttribute("data-sort");
      if (sortKey === k) { sortDir = sortDir === "asc" ? "desc" : "asc"; }
      else { sortKey = k; sortDir = k === "created_at" ? "desc" : "asc"; }
      render();
    });
  });
  searchEl.addEventListener("input", render);
  statusFilterEl.addEventListener("change", render);

  /* ---------------------------- Detail ---------------------------- */
  rowsEl.addEventListener("click", function (e) {
    var tr = e.target.closest("tr[data-id]");
    if (!tr) { return; }
    openDetail(tr.getAttribute("data-id"));
  });

  function row(k, v) {
    return '<div class="detail-row"><span class="k">' + esc(k) + '</span><span class="v">' + v + '</span></div>';
  }

  function openDetail(id) {
    var l = leads.filter(function (x) { return x.id === id; })[0];
    if (!l) { return; }
    var d = {};
    try { d = l.details ? JSON.parse(l.details) : {}; } catch (e) { d = {}; }
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
      '<p class="detail-meta">Received ' + esc(fmtDate(l.created_at)) + '</p>' +

      '<div class="detail-section"><h3>Loan</h3>' +
        row("Loan type", esc(l.loan_type || "—")) +
        row("Amount", esc(fmtMoney(l.loan_amount))) +
        row("Term", l.loan_term != null ? esc(l.loan_term) + " years" : "—") +
        row("Use", esc(l.use_type || "—")) +
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

      '<div class="detail-section"><h3>Source</h3>' +
        row("From", esc(l.source || "—")) +
        (d.submittedAt ? row("Submitted", esc(fmtDate(d.submittedAt))) : "") +
        row("Lead ID", esc(l.id)) +
      '</div>' +

      '<div class="detail-actions">' +
        '<label for="d-status">Status</label>' +
        '<select id="d-status" class="js-detail-status">' +
          statuses.map(function (s) {
            return '<option value="' + esc(s) + '"' + (s === (l.status || "New") ? " selected" : "") + '>' + esc(s) + '</option>';
          }).join("") +
        '</select>' +
      '</div>' +

      '<div class="detail-section detail-notes">' +
        '<h3>Notes <span class="notes-state js-notes-state"></span></h3>' +
        '<textarea class="notes-input js-notes" placeholder="Add a note — e.g. \'Left voicemail 2pm, will try again tomorrow.\' Saves automatically.">' + esc(l.notes || "") + '</textarea>' +
      '</div>' +

      '<div class="detail-cta">' +
        '<a class="btn btn-primary" href="tel:' + esc(l.mobile) + '">Call</a>' +
        '<a class="btn btn-ghost" href="mailto:' + esc(l.email) + '">Email</a>' +
      '</div>' +
      '<div class="detail-danger">' +
        '<button type="button" class="btn-delete js-delete">Delete lead</button>' +
      '</div>';

    detailEl.querySelector(".js-detail-status").addEventListener("change", function () {
      var newStatus = this.value;
      api("PATCH", { id: l.id, status: newStatus }).then(function (res) {
        if (res.ok) { l.status = newStatus; render(); }
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
