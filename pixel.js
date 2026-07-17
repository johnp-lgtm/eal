/* Meta (Facebook) Pixel loader for Easy As Loans.
   Loaded as an external file so it complies with the site's Content-Security-Policy
   (no inline scripts). PageView fires only where the tag carries data-pv="1"
   (the landing page). The Lead event is fired from apply.js on a successful submit. */
(function () {
  var me = document.currentScript;
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ?
      n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
    n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  fbq('init', '1375070801214225');

  if (me && me.getAttribute('data-pv') === '1') {
    fbq('track', 'PageView');
  }
})();
