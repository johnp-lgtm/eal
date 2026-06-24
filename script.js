/* ===================================================================
   Easy As Loans — homepage interactions
   (The application form now lives on its own full page: apply.html)
   =================================================================== */

(function () {
  "use strict";

  // Footer year
  document.querySelectorAll(".js-year").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  // Header turns solid white once you scroll off the hero band
  var header = document.querySelector(".js-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-stuck", window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }
})();
