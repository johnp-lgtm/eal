/* ===================================================================
   Easy As Loans — source / attribution capture
   Works out where a visitor came from (Meta ads, Google, direct, etc.)
   on their FIRST page of the session, and keeps it for the whole visit
   so the funnel can attach it to the lead. Exposes window.EAL_SOURCE.
   Loaded on the landing pages (index / apply / dealers) before their
   own scripts.
   =================================================================== */
(function () {
  "use strict";
  var KEY = "eal_src";

  // Return a clean source label, or "" when there's no meaningful signal
  // (a direct visit, or internal page-to-page navigation).
  function signal() {
    var qs;
    try { qs = new URLSearchParams(location.search); } catch (e) { qs = null; }
    var get = function (k) { return qs ? (qs.get(k) || "") : ""; };

    var utmSource = get("utm_source").toLowerCase();
    var utmMedium = get("utm_medium").toLowerCase();

    // 1) Explicit campaign tags win.
    if (utmSource) {
      if (/fb|face|meta|ig|insta/.test(utmSource)) { return "Meta Ads"; }
      if (/google/.test(utmSource)) {
        return /cpc|paid|ppc/.test(utmMedium) ? "Google Ads" : "Google";
      }
      if (/tiktok/.test(utmSource)) { return "TikTok Ads"; }
      if (/bing|microsoft/.test(utmSource)) { return "Microsoft Ads"; }
      var label = utmSource.charAt(0).toUpperCase() + utmSource.slice(1);
      return utmMedium ? label + " (" + utmMedium + ")" : label;
    }

    // 2) Ad click IDs (present even when UTM tags aren't).
    if (get("fbclid")) { return "Meta Ads"; }
    if (get("gclid") || get("gbraid") || get("wbraid")) { return "Google Ads"; }
    if (get("ttclid")) { return "TikTok Ads"; }
    if (get("msclkid")) { return "Microsoft Ads"; }

    // 3) Referring domain.
    var host = "";
    try { host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "").toLowerCase() : ""; } catch (e) { host = ""; }
    if (host) {
      if (host.indexOf("easyasloans") !== -1) { return ""; }  // internal navigation
      if (/facebook|instagram|fb\.com|fb\.me/.test(host)) { return "Meta (organic)"; }
      if (/google\./.test(host)) { return "Google (organic)"; }
      if (/bing\./.test(host)) { return "Bing (organic)"; }
      if (/duckduckgo/.test(host)) { return "DuckDuckGo"; }
      if (/tiktok/.test(host)) { return "TikTok"; }
      if (/youtube|youtu\.be/.test(host)) { return "YouTube"; }
      if (/t\.co|twitter|x\.com/.test(host)) { return "X/Twitter"; }
      if (/linkedin|lnkd\.in/.test(host)) { return "LinkedIn"; }
      return host;  // some other referring site
    }

    // 4) No signal — direct or internal.
    return "";
  }

  var stored = "";
  try { stored = sessionStorage.getItem(KEY) || ""; } catch (e) { stored = ""; }
  if (!stored) {
    var s = signal();
    if (s) { stored = s; try { sessionStorage.setItem(KEY, s); } catch (e) {} }
  }
  window.EAL_SOURCE = stored || "Direct";
})();
