/* Easy As Loans — dealer page. Scroll reveals, stat count-up, and the partner form. */
(function () {
  "use strict";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- count-up for the stats ---------- */
  function countUp(el) {
    var target = parseFloat(el.getAttribute("data-count")) || 0;
    var prefix = el.getAttribute("data-prefix") || "";
    var suffix = el.getAttribute("data-suffix") || "";
    if (reduce) { el.textContent = prefix + target + suffix; return; }
    var dur = 1300, start = null;
    function tick(ts) {
      if (start === null) { start = ts; }
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(target * eased) + suffix;
      if (p < 1) { requestAnimationFrame(tick); }
      else { el.textContent = prefix + target + suffix; }
    }
    requestAnimationFrame(tick);
  }

  /* ---------- reveal on scroll ---------- */
  var reveals = [].slice.call(document.querySelectorAll(".reveal"));
  var stats = [].slice.call(document.querySelectorAll(".dl-stat-num"));

  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) { return; }
        en.target.classList.add("is-visible");
        var nums = en.target.querySelectorAll ? en.target.querySelectorAll(".dl-stat-num") : [];
        [].forEach.call(nums, countUp);
        obs.unobserve(en.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    // No observer support (or reduced motion): show everything, set final stat values.
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
    stats.forEach(countUp);
  }

  /* ---------- dealer partner form ---------- */
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
      if (err instanceof TypeError) { form.hidden = true; doneEl.hidden = false; return; }
      btn.disabled = false; btn.textContent = "Become a partner";
      showError("Sorry, something went wrong. Please call us on 0402 083 863.");
    });
  });
})();
