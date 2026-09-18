/* ===================================================================
   Easy As Loans — phone number split (call tracking)
   On each page load, randomly pick one of two numbers and apply it to
   every displayed number (.js-phone) and every tel: link. The chosen
   number is exposed on window.EAL_PHONE so dynamically-inserted copy
   (apply.js / dealers.js messages) can use the same one.
   =================================================================== */
(function () {
  "use strict";

  var phones = [
    { display: "0402 083 863", tel: "+61402083863" },
    { display: "0478 028 202", tel: "+61478028202" }
  ];
  var p = phones[Math.floor(Math.random() * phones.length)];
  window.EAL_PHONE = p;

  function apply() {
    document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
      a.setAttribute("href", "tel:" + p.tel);
    });
    document.querySelectorAll(".js-phone").forEach(function (el) {
      el.textContent = p.display;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }
})();
