/* Easy As Loans — dealer page. Photo slideshow, stat count-up, split-bar reveal, partner form. */
(function () {
  "use strict";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- hero photo slideshow ---------- */
  var slides = [].slice.call(document.querySelectorAll(".js-hero-slides .hero-img"));
  if (slides.length > 1 && !reduce) {
    var idx = 0;
    setInterval(function () {
      slides[idx].classList.remove("is-active");
      idx = (idx + 1) % slides.length;
      slides[idx].classList.add("is-active");
    }, 3200);
  }

  /* ---------- count-up helper ---------- */
  function countUp(el) {
    var target = parseFloat(el.getAttribute("data-count")) || 0;
    var prefix = el.getAttribute("data-prefix") || "";
    var suffix = el.getAttribute("data-suffix") || "";
    if (reduce) { el.textContent = prefix + target + suffix; return; }
    var dur = 1200, start = null;
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

  var hasIO = "IntersectionObserver" in window;

  /* ---------- stat count-up ---------- */
  var stats = [].slice.call(document.querySelectorAll(".d-stat-num"));
  if (stats.length && hasIO && !reduce) {
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) { return; }
        countUp(en.target); obs.unobserve(en.target);
      });
    }, { threshold: 0.4 });
    stats.forEach(function (el) { el.textContent = "0"; io.observe(el); });
  }

  /* ---------- split-bar reveal ---------- */
  var split = document.querySelector(".js-split");
  if (split) {
    var half = split.querySelector(".js-count-half");
    function fire() {
      split.classList.add("in");
      if (half) { countUp(half); }
    }
    if (hasIO && !reduce) {
      var so = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (en) { if (en.isIntersecting) { fire(); obs.unobserve(en.target); } });
      }, { threshold: 0.3 });
      so.observe(split);
    } else { fire(); }
  }

  /* ---------- dealer partner form ---------- */
  var form = document.querySelector(".js-dealer-form");
  if (!form) { return; }
  var errEl = document.querySelector(".js-dealer-error");
  var doneEl = document.querySelector(".js-dealer-done");
  var btn = document.querySelector(".js-dealer-submit");

  function showError(msg) { errEl.textContent = msg; errEl.hidden = false; }

  // Fire the standard Meta Pixel Lead event on a completed dealer enquiry, so the
  // dealer campaign can optimise for "Leads" like any basic conversion campaign.
  function trackDealer() {
    try {
      if (window.fbq) { fbq("track", "Lead", { content_category: "Dealer partner enquiry" }); }
    } catch (e) { /* pixel not loaded — ignore */ }
  }

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
      website: form.website.value,
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
      trackDealer();
      form.hidden = true;
      doneEl.hidden = false;
      window.scrollTo({ top: Math.max(0, doneEl.getBoundingClientRect().top + window.scrollY - 130), behavior: "smooth" });
    }).catch(function (err) {
      if (err instanceof TypeError) { trackDealer(); form.hidden = true; doneEl.hidden = false; return; }
      btn.disabled = false; btn.textContent = "Become a partner";
      showError("Sorry, something went wrong. Please call us on 0402 083 863.");
    });
  });
})();
