/* Easy As Loans — dealer partner form handler. Posts to /api/dealers. */
(function () {
  "use strict";
  var form = document.querySelector(".js-dealer-form");
  if (!form) { return; }
  var errEl = document.querySelector(".js-dealer-error");
  var doneEl = document.querySelector(".js-dealer-done");
  var btn = document.querySelector(".js-dealer-submit");

  function showError(msg) { errEl.textContent = msg; errEl.hidden = false; }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errEl.hidden = true;

    var data = {
      dealership: form.dealership.value.trim(),
      contactName: form.contactName.value.trim(),
      mobile: form.mobile.value.trim(),
      email: form.email.value.trim(),
      monthlyVolume: form.monthlyVolume.value,
      currentFinance: form.currentFinance.value,
      message: form.message.value.trim(),
      website: form.website.value, // honeypot
      source: "dealers page"
    };

    if (!data.dealership || !data.contactName || !data.mobile || !data.email) {
      showError("Please fill in your dealership, name, mobile and email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      showError("Please enter a valid email address.");
      return;
    }

    btn.disabled = true; btn.textContent = "Sending…";

    fetch("/api/dealers", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(data)
    }).then(function (res) {
      if (!res.ok) { throw new Error("bad"); }
      return res.json().catch(function () { return {}; });
    }).then(function () {
      form.hidden = true;
      doneEl.hidden = false;
      window.scrollTo({ top: Math.max(0, doneEl.getBoundingClientRect().top + window.scrollY - 130), behavior: "smooth" });
    }).catch(function (err) {
      if (err instanceof TypeError) { form.hidden = true; doneEl.hidden = false; return; } // no backend (preview)
      btn.disabled = false; btn.textContent = "Become a partner";
      showError("Sorry — something went wrong. Please call us on 0402 083 863.");
    });
  });
})();
