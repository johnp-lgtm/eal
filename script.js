/* ===================================================================
   Easy As Loans — interactions
   - Finance enquiry modal (open/close, focus trap, ESC, scroll lock)
   - Multi-step lead form (choices, sliders, chips) + submission
   - Footer year
   =================================================================== */

(function () {
  "use strict";

  /* -----------------------------------------------------------------
     LEAD DELIVERY
     ------------------------------------------------------------------
     Completed leads are POSTed as JSON to LEAD_ENDPOINT. In production
     this is the Cloudflare Pages Function at /api/leads, which saves
     the lead to the database (so it shows in /admin) and emails a copy.
     If the endpoint isn't reachable (e.g. opening index.html directly
     from disk before deployment), the form still completes in "demo
     mode" so it can be previewed.
     ----------------------------------------------------------------- */
  var LEAD_ENDPOINT = "/api/leads";

  /* ------------------- Sticky header on the hero band ------------- */
  var heroHeader = document.querySelector(".js-header");
  if (heroHeader) {
    var onScroll = function () {
      heroHeader.classList.toggle("is-stuck", window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ----------------------------- Year ----------------------------- */
  var yearEl = document.querySelectorAll(".js-year");
  yearEl.forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ----------------------------- Modal ---------------------------- */
  var modal = document.getElementById("finance-modal");
  if (!modal) { return; }

  var formContent = modal.querySelector(".js-form-content");
  var successContent = modal.querySelector(".js-form-success");
  var form = modal.querySelector(".js-finance-form");
  var errorMsg = modal.querySelector(".js-form-error");
  var backBtn = modal.querySelector(".js-back");
  var stepLabel = modal.querySelector(".js-step-label");
  var progressBar = modal.querySelector(".js-progress");
  var lastFocused = null;

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /* ------------------------- Step engine -------------------------- */
  var lead = {};
  var allSteps = Array.prototype.slice.call(form.querySelectorAll(".form-step"));
  var currentKey = null;

  // Set the car-year slider range to current year + 1
  (function initYearSlider() {
    var yearSlider = form.querySelector('[data-field="carYear"]');
    if (!yearSlider) { return; }
    var max = new Date().getFullYear() + 1;
    yearSlider.max = String(max);
    yearSlider.value = String(max - 3);
    var maxLabel = form.querySelector(".js-year-max");
    if (maxLabel) { maxLabel.textContent = String(max); }
    var out = form.querySelector(".js-year-out");
    if (out) { out.textContent = yearSlider.value; }
  })();

  function keyOf(section) { return section.getAttribute("data-step"); }

  // The active sequence of steps, skipping any conditional step that
  // doesn't match the current answers (carYear only for car loans).
  function flow() {
    return allSteps.filter(function (s) {
      var cond = s.getAttribute("data-conditional");
      if (!cond) { return true; }
      return lead.loanType === cond;
    });
  }

  function formatMoney(n) {
    var v = Number(n) || 0;
    var s = "$" + v.toLocaleString("en-AU");
    return v >= 150000 ? s + "+" : s;
  }

  // Reflect stored answers back into a step's controls (for going Back)
  function reflectStep(section) {
    var key = keyOf(section);
    // choices / chips
    section.querySelectorAll(".js-choice").forEach(function (btn) {
      var field = btn.getAttribute("data-field");
      btn.classList.toggle("is-selected", String(lead[field]) === btn.getAttribute("data-value"));
    });
    // sliders
    var slider = section.querySelector(".js-slider");
    if (slider) {
      var field = slider.getAttribute("data-field");
      if (lead[field] != null) { slider.value = String(lead[field]); }
      updateSliderReadout(slider);
    }
    // detail inputs
    section.querySelectorAll("[data-field]").forEach(function (input) {
      if (input.tagName === "INPUT" && input.type !== "range") {
        var f = input.getAttribute("data-field");
        if (lead[f] != null) { input.value = lead[f]; }
      }
    });
  }

  function updateSliderReadout(slider) {
    var field = slider.getAttribute("data-field");
    if (field === "loanAmount") {
      var out = form.querySelector(".js-amount-out");
      if (out) { out.textContent = formatMoney(slider.value); }
    } else if (field === "carYear") {
      var yo = form.querySelector(".js-year-out");
      if (yo) { yo.textContent = slider.value; }
    }
  }

  function showStep(key) {
    var seq = flow();
    var section = allSteps.filter(function (s) { return keyOf(s) === key; })[0];
    if (!section) { return; }
    currentKey = key;

    allSteps.forEach(function (s) { s.classList.toggle("is-active", s === section); });
    reflectStep(section);

    var pos = seq.indexOf(section);
    var total = seq.length;
    progressBar.style.width = Math.round(((pos + 1) / total) * 100) + "%";
    stepLabel.textContent = "Step " + (pos + 1) + " of " + total;
    backBtn.hidden = pos === 0;
    if (errorMsg) { errorMsg.hidden = true; }

    // Focus the first interactive control (or the heading) for accessibility
    window.setTimeout(function () {
      var focusTarget = section.querySelector(".js-choice, .js-slider, input:not([type=hidden]), .js-next");
      if (focusTarget) { focusTarget.focus({ preventScroll: true }); }
      section.scrollIntoView({ block: "nearest" });
    }, 30);
  }

  function goNext() {
    var seq = flow();
    var pos = seq.map(keyOf).indexOf(currentKey);
    if (pos < seq.length - 1) { showStep(keyOf(seq[pos + 1])); }
  }

  function goBack() {
    var seq = flow();
    var pos = seq.map(keyOf).indexOf(currentKey);
    if (pos > 0) { showStep(keyOf(seq[pos - 1])); }
  }

  // Choice / chip selection -> store + auto-advance
  form.querySelectorAll(".js-choice").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var field = btn.getAttribute("data-field");
      var value = btn.getAttribute("data-value");
      lead[field] = (field === "loanTerm" || field === "carYear") ? Number(value) : value;
      // visual selection within this step
      var parent = btn.closest(".form-step");
      parent.querySelectorAll('.js-choice[data-field="' + field + '"]').forEach(function (b) {
        b.classList.toggle("is-selected", b === btn);
      });
      window.setTimeout(goNext, 180);
    });
  });

  // Sliders -> live readout + store
  form.querySelectorAll(".js-slider").forEach(function (slider) {
    var field = slider.getAttribute("data-field");
    lead[field] = Number(slider.value);
    slider.addEventListener("input", function () {
      lead[field] = Number(slider.value);
      updateSliderReadout(slider);
    });
  });

  // Continue buttons
  form.querySelectorAll(".js-next").forEach(function (btn) {
    btn.addEventListener("click", goNext);
  });
  backBtn.addEventListener("click", goBack);

  /* --------------------------- Modal open/close ------------------- */
  function openModal(presetType) {
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("body-lock");
    formContent.hidden = false;
    successContent.hidden = true;
    if (presetType) {
      // Came from a hero finance card — pre-select the type and skip step 1
      lead.loanType = presetType;
      var step1 = allSteps.filter(function (s) { return keyOf(s) === "loanType"; })[0];
      if (step1) {
        step1.querySelectorAll('.js-choice[data-field="loanType"]').forEach(function (b) {
          b.classList.toggle("is-selected", b.getAttribute("data-value") === presetType);
        });
      }
      var seq = flow();
      showStep(keyOf(seq[Math.min(1, seq.length - 1)]));
    } else {
      showStep(keyOf(flow()[0]));
    }
    document.addEventListener("keydown", onKeydown);
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("body-lock");
    document.removeEventListener("keydown", onKeydown);
    if (lastFocused && typeof lastFocused.focus === "function") { lastFocused.focus(); }
  }

  function onKeydown(e) {
    if (e.key === "Escape") { closeModal(); return; }
    if (e.key !== "Tab") { return; }
    var nodes = Array.prototype.slice.call(modal.querySelectorAll(FOCUSABLE))
      .filter(function (n) { return n.offsetParent !== null; });
    if (!nodes.length) { return; }
    var first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  document.querySelectorAll(".js-open-form").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      openModal(btn.getAttribute("data-loan") || null);
    });
  });
  modal.querySelectorAll(".js-close-form").forEach(function (btn) {
    btn.addEventListener("click", closeModal);
  });

  /* --------------------------- Submission ------------------------- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (errorMsg) { errorMsg.hidden = true; }

    // Capture detail fields
    var details = form.querySelector('[data-step="details"]');
    details.querySelectorAll("[data-field]").forEach(function (input) {
      lead[input.getAttribute("data-field")] = input.value.trim();
    });
    var consent = details.querySelector(".js-consent");
    lead.consent = !!(consent && consent.checked);

    // Validate the final step
    var problems = [];
    if (!lead.fullName) { problems.push("name"); }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email || "")) { problems.push("email"); }
    if (!lead.mobile || lead.mobile.replace(/\D/g, "").length < 8) { problems.push("mobile"); }
    if (!lead.consent) { problems.push("consent"); }

    details.querySelectorAll("[data-field]").forEach(function (input) {
      var f = input.getAttribute("data-field");
      input.classList.toggle("invalid", problems.indexOf(f) !== -1);
    });

    if (problems.length) {
      errorMsg.textContent = problems.indexOf("consent") !== -1 && problems.length === 1
        ? "Please tick the box so we can contact you."
        : "Please check the highlighted fields.";
      errorMsg.hidden = false;
      var firstBad = details.querySelector(".invalid");
      if (firstBad) { firstBad.focus(); }
      return;
    }

    var payload = buildPayload();
    var submitBtn = form.querySelector(".js-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    submitLead(payload)
      .then(showSuccess)
      .catch(function (err) {
        if (err && err.demo) { showSuccess(); return; } // no backend yet (preview)
        errorMsg.textContent = "Sorry — something went wrong. Please call us on 0402 083 863 and we'll sort it out.";
        errorMsg.hidden = false;
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit my application";
      });
  });

  // Clear the invalid state as the user types
  form.addEventListener("input", function (e) {
    if (e.target.classList && e.target.classList.contains("invalid")) {
      e.target.classList.remove("invalid");
    }
  });

  function buildPayload() {
    var p = {
      loanType: lead.loanType || "",
      loanAmount: lead.loanAmount || null,
      loanTerm: lead.loanTerm || null,
      use: lead.use || "",
      state: lead.state || "",
      fullName: lead.fullName || "",
      email: lead.email || "",
      mobile: lead.mobile || "",
      consent: !!lead.consent,
      submittedAt: new Date().toISOString(),
      source: "easyasloans.com.au",
      pageUrl: window.location.href
    };
    if (lead.loanType === "Car loan") { p.carYear = lead.carYear || null; }
    var hp = form.querySelector(".js-hp");
    if (hp && hp.value) { p.website = hp.value; } // honeypot
    return p;
  }

  function submitLead(payload) {
    return fetch(LEAD_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) { throw new Error("Bad response " + res.status); }
      return res.json().catch(function () { return {}; });
    }).catch(function (err) {
      // Network failure (e.g. no backend in local preview) -> demo mode
      if (err instanceof TypeError) { var e = new Error("demo"); e.demo = true; throw e; }
      throw err;
    });
  }

  function showSuccess() {
    formContent.hidden = true;
    successContent.hidden = false;
    successContent.scrollIntoView({ block: "nearest" });
    // Reset for next time
    lead = {};
    form.reset();
  }
})();
