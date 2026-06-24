/* ===================================================================
   Easy As Loans — full-page application engine (apply.html)

   Two flows:
     • car      (Car loan / Business loan)      — see FLOW_CAR  [stub — awaiting steps]
     • personal (Personal loan / Debt consol.)  — see FLOW_PERSONAL (built per spec)

   Entry: apply.html?loan=car|business|personal|debt
   Leads are POSTed to /api/leads on completion.
   =================================================================== */

(function () {
  "use strict";

  var LEAD_ENDPOINT = "/api/leads";

  var LOGO_MARK =
    '<svg viewBox="0 0 210 120" aria-hidden="true">' +
    '<path class="logo-stroke" style="stroke:#48206e;stroke-width:7;fill:none;stroke-linecap:round;stroke-linejoin:round" d="M8 92 L98 24 L126 47 L126 32 L146 32 L146 51 C166 68 188 74 204 64"/>' +
    '<path class="logo-stroke" style="stroke:#48206e;stroke-width:7;fill:none;stroke-linecap:round;stroke-linejoin:round" d="M8 101 C72 95 122 94 152 79 C172 69 190 68 204 64"/></svg>';

  /* ----------------------------- helpers -------------------------- */
  function money(n) { return "$" + (Number(n) || 0).toLocaleString("en-AU"); }
  function clampAmount(n) { return Math.min(150000, Math.max(2000, Math.round(n / 500) * 500)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function optButtons(field, opts, cols) {
    return '<div class="optrow ' + (cols === 1 ? "one" : "") + '">' +
      opts.map(function (o) {
        var v = o.value != null ? o.value : o, l = o.label != null ? o.label : o;
        return '<button type="button" class="opt-btn" data-field="' + field + '" data-value="' + esc(v) + '">' + esc(l) + "</button>";
      }).join("") + "</div>";
  }
  function selectField(field, placeholder, opts) {
    return '<select class="q-select" data-field="' + field + '"><option value="">' + esc(placeholder) + "</option>" +
      opts.map(function (o) { return '<option value="' + esc(o) + '">' + esc(o) + "</option>"; }).join("") + "</select>";
  }

  /* ------------------------------ steps --------------------------- */
  var STEP_AMOUNT = {
    section: "Loan",
    title: "How much do you want to borrow?",
    sub: "You can always change this later.",
    tip: "Pop in roughly how much you're after — a ballpark is fine, you can change it later.",
    body: function (d) {
      var v = d.loanAmount || 10000;
      return '<div class="amount-field"><input type="text" class="js-amount-input" inputmode="numeric" value="' + money(v) + '" aria-label="Loan amount" /></div>' +
        '<input type="range" class="range js-amount-range" min="2000" max="150000" step="500" value="' + v + '" aria-label="Loan amount slider" />';
    },
    wire: function (root, d) {
      if (!d.loanAmount) { d.loanAmount = 10000; }
      var input = root.querySelector(".js-amount-input"), range = root.querySelector(".js-amount-range");
      range.addEventListener("input", function () { d.loanAmount = clampAmount(+range.value); input.value = money(d.loanAmount); });
      input.addEventListener("input", function () {
        var n = parseInt(input.value.replace(/[^\d]/g, ""), 10);
        if (!isNaN(n)) { d.loanAmount = n; range.value = clampAmount(n); }
      });
      input.addEventListener("blur", function () { d.loanAmount = clampAmount(d.loanAmount || 10000); input.value = money(d.loanAmount); range.value = d.loanAmount; });
    },
    validate: function (root, d) { return d.loanAmount >= 2000 ? { ok: true } : { ok: false, msg: "Please enter an amount." }; }
  };

  var STEP_TERM = {
    section: "Loan",
    title: "How long do you want to have the loan for?",
    sub: "You can always change this later.",
    tip: "A longer term can lower your repayments, but you may pay more interest over the life of the loan.",
    body: function (d) {
      var html = optButtons("loanTerm", [
        { value: 1, label: "1 year" }, { value: 2, label: "2 years" }, { value: 3, label: "3 years" },
        { value: 4, label: "4 years" }, { value: 5, label: "5 years" }, { value: 7, label: "7 years" }
      ]);
      return preselect(html, "loanTerm", d.loanTerm);
    },
    validate: function (root, d) { return d.loanTerm ? { ok: true } : { ok: false, msg: "Please choose a loan term." }; }
  };

  var STEP_EMPLOYMENT = {
    section: "Employment",
    title: "What is your current employment type?",
    tip: "Casual, contract or self-employed are all welcome — this just helps us match the right lenders.",
    body: function (d) {
      return selectField("employmentType", "Select option", ["Full-time", "Part-time", "Casual", "Self-employed", "Contractor", "Unemployed", "Retired", "Centrelink / Pension"]) +
        '<span class="q-label">How long have you been in your current employment?</span>' +
        '<div class="q-twocol">' +
          selectField("empYears", "Years", years(0, 30)) +
          selectField("empMonths", "Months", years(0, 11)) +
        "</div>";
    },
    wire: function (root, d) { presetSelects(root, d); },
    validate: function (root, d) {
      if (!d.employmentType) { return { ok: false, msg: "Please select your employment type." }; }
      if (d.empYears == null || d.empYears === "" || d.empMonths == null || d.empMonths === "") { return { ok: false, msg: "Please tell us how long you've been there." }; }
      return { ok: true };
    }
  };

  var STEP_RESIDENCY = {
    section: "Residency",
    title: "What is your residency status?",
    tip: "On a visa or renting? No problem — we work with lenders across every situation.",
    body: function (d) {
      var status = preselect(optButtons("residencyStatus", ["Australian Citizen", "Permanent resident", "Temporary visa"]), "residencyStatus", d.residencyStatus);
      return status +
        '<span class="q-label">What is your current living situation?</span>' +
        selectField("livingSituation", "Select option", ["Renting", "Renting but own property", "Owner with mortgage", "Owner without mortgage", "Living with parents", "Board"]);
    },
    wire: function (root, d) { presetSelects(root, d); },
    validate: function (root, d) {
      if (!d.residencyStatus) { return { ok: false, msg: "Please select your residency status." }; }
      if (!d.livingSituation) { return { ok: false, msg: "Please select your living situation." }; }
      return { ok: true };
    }
  };

  var STEP_FINAL = {
    section: "Final details",
    title: "Final details",
    sub: "Where should we send your options?",
    tip: "Almost done! Pop in your details and we'll be in touch. Enquiring won't affect your credit score.",
    cta: "See my options",
    body: function (d) {
      return '<div class="q-field"><label for="a-name">Full name</label><input class="q-input" id="a-name" data-field="fullName" autocomplete="name" value="' + esc(d.fullName || "") + '" /></div>' +
        '<div class="q-field"><label for="a-email">Email</label><input class="q-input" id="a-email" type="email" data-field="email" autocomplete="email" value="' + esc(d.email || "") + '" /></div>' +
        '<div class="q-field"><label for="a-mobile">Mobile</label><input class="q-input" id="a-mobile" type="tel" data-field="mobile" autocomplete="tel" value="' + esc(d.mobile || "") + '" /></div>' +
        '<label class="q-consent"><input type="checkbox" data-field="consent" ' + (d.consent ? "checked" : "") + ' /> <span>I\'d like Easy As Loans to contact me about my enquiry.</span></label>';
    },
    validate: function (root, d) {
      var problems = [];
      if (!d.fullName) { problems.push("name"); }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || "")) { problems.push("email"); }
      if (!d.mobile || d.mobile.replace(/\D/g, "").length < 8) { problems.push("mobile"); }
      if (!d.consent) { return { ok: false, msg: "Please tick the box so we can contact you." }; }
      return problems.length ? { ok: false, msg: "Please check your name, email and mobile." } : { ok: true };
    },
    submit: true
  };

  /* car/business: placeholder step until the real steps are provided */
  var STEP_CAR_YEAR = {
    section: "Your car",
    title: "What year is the car?",
    sub: "A rough year is fine if you're still looking.",
    tip: "Not sure yet? Give us your best guess — we can fine-tune it later.",
    body: function (d) {
      var yrs = years(1995, new Date().getFullYear() + 1).reverse().map(String);
      return selectField("carYear", "Select year", yrs);
    },
    wire: function (root, d) { presetSelects(root, d); },
    validate: function (root, d) { return d.carYear ? { ok: true } : { ok: false, msg: "Please choose a year." }; }
  };

  /* ------------------------------ flows --------------------------- */
  var FLOW_PERSONAL = {
    sections: ["Loan", "Employment", "Residency", "Final details"],
    steps: [STEP_AMOUNT, STEP_TERM, STEP_EMPLOYMENT, STEP_RESIDENCY, STEP_FINAL]
  };
  // NOTE: car/business flow is a starting point — to be replaced with the
  // real steps. Currently: amount, term, car year, then final details.
  var FLOW_CAR = {
    sections: ["Loan", "Your car", "Final details"],
    steps: [STEP_AMOUNT, STEP_TERM, STEP_CAR_YEAR, STEP_FINAL]
  };

  var PRODUCTS = { car: "Car loan", business: "Business loan", personal: "Personal loan", debt: "Debt consolidation" };

  /* ----------------------- small util builders -------------------- */
  function years(a, b) { var o = []; for (var i = a; i <= b; i++) { o.push(i); } return o; }
  // Selection state is applied to the DOM after render by applyPreselect();
  // this just passes the markup through unchanged.
  function preselect(html) { return html; }
  function applyPreselect(root, d) {
    root.querySelectorAll(".opt-btn").forEach(function (b) {
      if (String(d[b.dataset.field]) === b.dataset.value) { b.classList.add("is-selected"); }
    });
  }
  function presetSelects(root, d) {
    root.querySelectorAll("select[data-field]").forEach(function (s) {
      if (d[s.dataset.field] != null && d[s.dataset.field] !== "") { s.value = d[s.dataset.field]; }
    });
  }

  /* ------------------------------ state --------------------------- */
  var qs = new URLSearchParams(location.search);
  var loanParam = (qs.get("loan") || "").toLowerCase();
  var state = {
    product: PRODUCTS[loanParam] || null,
    flow: (loanParam === "car" || loanParam === "business") ? FLOW_CAR : (loanParam ? FLOW_PERSONAL : null),
    data: {},
    index: 0
  };

  var root = document.querySelector(".js-step-root");
  var stepsEl = document.querySelector(".js-steps");
  var backBtn = document.querySelector(".js-back");
  var mbLabel = document.querySelector(".js-mb-label");
  var mbCount = document.querySelector(".js-mb-count");
  var mbFill = document.querySelector(".js-mb-fill");

  /* --------------------------- chooser ---------------------------- */
  var CHOICES = [
    { loan: "car", label: "Car Loan" }, { loan: "personal", label: "Personal Loan" },
    { loan: "business", label: "Business Loan" }, { loan: "debt", label: "Debt Consolidation" }
  ];
  function renderChooser() {
    stepsEl.innerHTML = "";
    backBtn.style.visibility = "hidden";
    root.innerHTML = '<div class="q"><h1 class="q-title">What are you looking to finance?</h1>' +
      '<p class="q-sub">Pick one to get started — it only takes a minute.</p>' +
      '<div class="q-body"><div class="optrow">' +
      CHOICES.map(function (c) { return '<button type="button" class="opt-btn js-choose" data-loan="' + c.loan + '">' + c.label + "</button>"; }).join("") +
      "</div></div></div>";
    root.querySelectorAll(".js-choose").forEach(function (b) {
      b.addEventListener("click", function () {
        var l = b.dataset.loan;
        state.product = PRODUCTS[l];
        state.flow = (l === "car" || l === "business") ? FLOW_CAR : FLOW_PERSONAL;
        state.index = 0;
        render();
      });
    });
  }

  /* ---------------------------- render ---------------------------- */
  function render() {
    var step = state.flow.steps[state.index];
    backBtn.style.visibility = "visible";

    root.innerHTML =
      '<div class="q">' +
        '<h1 class="q-title">' + esc(step.title) + "</h1>" +
        (step.sub ? '<p class="q-sub">' + esc(step.sub) + "</p>" : "") +
        '<div class="q-body">' + step.body(state.data) + "</div>" +
        (step.tip ? '<div class="helper"><span class="helper-av">' + LOGO_MARK + '</span><p class="helper-text">' + esc(step.tip) + "</p></div>" : "") +
        '<button type="button" class="btn-continue js-continue">' + esc(step.cta || "Continue") + "</button>" +
        '<p class="q-error js-error" hidden></p>' +
        '<p class="q-trust">Enquiring won’t affect your credit score.</p>' +
      "</div>";

    applyPreselect(root, state.data);
    if (step.wire) { step.wire(root, state.data); }
    root.querySelector(".js-continue").addEventListener("click", onContinue);
    renderSidebar();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  // Delegated handlers — attached once to the stable root element.
  function setupDelegation() {
    root.addEventListener("click", function (e) {
      var b = e.target.closest(".opt-btn"); if (!b || !b.dataset.field) { return; }
      var f = b.dataset.field;
      root.querySelectorAll('.opt-btn[data-field="' + f + '"]').forEach(function (x) { x.classList.toggle("is-selected", x === b); });
      state.data[f] = isNaN(+b.dataset.value) ? b.dataset.value : +b.dataset.value;
    });
    root.addEventListener("change", function (e) {
      var t = e.target; if (!t.dataset.field) { return; }
      state.data[t.dataset.field] = t.type === "checkbox" ? t.checked : t.value;
    });
    root.addEventListener("input", function (e) {
      var t = e.target; if (t.dataset.field && t.classList.contains("q-input")) { state.data[t.dataset.field] = t.value.trim(); }
    });
  }

  function onContinue() {
    var step = state.flow.steps[state.index];
    var res = step.validate(root, state.data);
    var err = root.querySelector(".js-error");
    if (!res.ok) { err.textContent = res.msg; err.hidden = false; return; }
    err.hidden = true;
    if (step.submit) { submit(); }
    else { state.index++; render(); }
  }

  function renderSidebar() {
    var sections = state.flow.sections;
    var cur = sections.indexOf(state.flow.steps[state.index].section);
    stepsEl.innerHTML = sections.map(function (s, i) {
      var cls = i < cur ? "is-done" : (i === cur ? "is-active" : "");
      return '<li class="apply-step ' + cls + '"><span class="apply-dot">' + (i < cur ? "✓" : "") + "</span>" + esc(s) + "</li>";
    }).join("");
    // mobile bar
    if (mbLabel) {
      mbLabel.textContent = state.flow.steps[state.index].section;
      mbCount.textContent = "Step " + (state.index + 1) + " of " + state.flow.steps.length;
      mbFill.style.width = Math.round(((state.index + 1) / state.flow.steps.length) * 100) + "%";
    }
  }

  backBtn.addEventListener("click", function () {
    if (!state.flow) { location.href = "index.html"; return; }
    if (state.index > 0) { state.index--; render(); }
    else if (!loanParam) { renderChooser(); }
    else { location.href = "index.html"; }
  });

  /* ---------------------------- submit ---------------------------- */
  function submit() {
    var d = state.data;
    var payload = {
      loanType: state.product || "",
      loanAmount: d.loanAmount || null,
      loanTerm: d.loanTerm || null,
      use: (state.product === "Business loan") ? "Business" : "Personal",
      state: d.state || "",
      employmentType: d.employmentType || "",
      employmentDuration: (d.empYears != null ? d.empYears + "y " : "") + (d.empMonths != null ? d.empMonths + "m" : ""),
      residencyStatus: d.residencyStatus || "",
      livingSituation: d.livingSituation || "",
      carYear: d.carYear || null,
      fullName: d.fullName || "",
      email: d.email || "",
      mobile: d.mobile || "",
      consent: !!d.consent,
      submittedAt: new Date().toISOString(),
      source: "easyasloans.com.au",
      pageUrl: location.href
    };
    var btn = root.querySelector(".js-continue");
    if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }

    fetch(LEAD_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(payload) })
      .then(function (res) { if (!res.ok) { throw new Error("bad"); } return res.json().catch(function () { return {}; }); })
      .then(showDone)
      .catch(function (err) {
        if (err instanceof TypeError) { showDone(); return; } // no backend (preview)
        if (btn) { btn.disabled = false; btn.textContent = "See my options"; }
        var e = root.querySelector(".js-error"); if (e) { e.textContent = "Sorry — something went wrong. Please call us on 0402 083 863."; e.hidden = false; }
      });
  }

  function showDone() {
    stepsEl.innerHTML = "";
    backBtn.style.visibility = "hidden";
    if (mbFill) { mbFill.style.width = "100%"; }
    root.innerHTML =
      '<div class="apply-done">' +
        '<div class="success-tick"><svg viewBox="0 0 52 52"><path class="logo-stroke" d="M14 27 l8 8 l16 -18" /></svg></div>' +
        "<h1>Thanks — we've got it.</h1>" +
        "<p>One of our team will be in touch very soon with your options. If you'd rather talk now, call us on <a href=\"tel:+61402083863\" style=\"color:var(--purple);font-weight:700\">0402 083 863</a>.</p>" +
        '<a class="btn-continue" href="index.html" style="display:block;text-decoration:none;text-align:center">Back to home</a>' +
      "</div>";
    window.scrollTo({ top: 0 });
  }

  /* ----------------------------- boot ----------------------------- */
  setupDelegation();
  if (!state.flow) { renderChooser(); }
  else { render(); }
})();
