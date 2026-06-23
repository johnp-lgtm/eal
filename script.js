/* ===================================================================
   Easy As Loans — interactions
   - Finance enquiry modal (open/close, focus trap, ESC, scroll lock)
   - Client-side form validation + submission
   - Footer year
   =================================================================== */

(function () {
  "use strict";

  /* -----------------------------------------------------------------
     FORM DELIVERY
     ------------------------------------------------------------------
     Right now the form validates and shows a success message, but it
     does NOT yet send the enquiry anywhere. To receive submissions,
     set FORM_ENDPOINT to a form-handling URL (e.g. Formspree, Basin,
     your own endpoint). When set, the form will POST the fields there.
     Leave it null to keep the demo (success message only).
     Example: var FORM_ENDPOINT = "https://formspree.io/f/yourid";
     ----------------------------------------------------------------- */
  var FORM_ENDPOINT = null;

  /* ----------------------------- Year ----------------------------- */
  var yearEl = document.querySelector(".js-year");
  if (yearEl) { yearEl.textContent = new Date().getFullYear(); }

  /* ----------------------------- Modal ---------------------------- */
  var modal = document.getElementById("finance-modal");
  if (!modal) { return; }

  var formContent = modal.querySelector(".js-form-content");
  var successContent = modal.querySelector(".js-form-success");
  var form = modal.querySelector(".js-finance-form");
  var errorMsg = modal.querySelector(".js-form-error");
  var lastFocused = null;

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function openModal() {
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("body-lock");
    // Always show the form (reset from any previous success state)
    formContent.hidden = false;
    successContent.hidden = true;
    var first = modal.querySelector("#f-name");
    if (first) { window.setTimeout(function () { first.focus(); }, 30); }
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
    // Simple focus trap
    var nodes = Array.prototype.slice
      .call(modal.querySelectorAll(FOCUSABLE))
      .filter(function (n) { return n.offsetParent !== null; });
    if (!nodes.length) { return; }
    var firstNode = nodes[0];
    var lastNode = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === firstNode) {
      e.preventDefault(); lastNode.focus();
    } else if (!e.shiftKey && document.activeElement === lastNode) {
      e.preventDefault(); firstNode.focus();
    }
  }

  // Open triggers
  document.querySelectorAll(".js-open-form").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      openModal();
    });
  });

  // Close triggers
  modal.querySelectorAll(".js-close-form").forEach(function (btn) {
    btn.addEventListener("click", closeModal);
  });

  /* --------------------------- Validation ------------------------- */
  function validate() {
    var ok = true;
    var requiredFields = form.querySelectorAll("[required]");
    requiredFields.forEach(function (el) {
      var valid = el.type === "checkbox" ? el.checked : String(el.value).trim() !== "";
      if (el.type === "email" && valid) {
        valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim());
      }
      if (!valid) { ok = false; el.classList.add("invalid"); }
      else { el.classList.remove("invalid"); }
    });
    return ok;
  }

  // Clear the invalid state as the user fixes a field
  form.addEventListener("input", function (e) {
    if (e.target.classList.contains("invalid")) {
      e.target.classList.remove("invalid");
    }
  });

  /* --------------------------- Submission ------------------------- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errorMsg.hidden = true;

    if (!validate()) {
      errorMsg.hidden = false;
      var firstInvalid = form.querySelector(".invalid");
      if (firstInvalid) { firstInvalid.focus(); }
      return;
    }

    var submitBtn = form.querySelector(".js-submit");

    function showSuccess() {
      formContent.hidden = true;
      successContent.hidden = false;
      form.reset();
      successContent.scrollIntoView({ block: "nearest" });
    }

    if (FORM_ENDPOINT) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";
      fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Accept": "application/json" },
        body: new FormData(form)
      })
        .then(function (res) {
          if (!res.ok) { throw new Error("Network response was not ok"); }
          showSuccess();
        })
        .catch(function () {
          errorMsg.textContent = "Sorry — something went wrong. Please call us and we'll sort it out.";
          errorMsg.hidden = false;
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit enquiry";
        });
    } else {
      // Demo mode: no endpoint configured yet.
      showSuccess();
    }
  });
})();
