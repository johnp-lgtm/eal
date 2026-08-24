/* ===================================================================
   Easy As Loans — homepage repayment calculator
   Pure illustration. Standard amortising repayment, no balloon.
   All fees excluded; clearly labelled an estimate, not a quote.
   =================================================================== */
(function () {
  "use strict";

  var amountEl = document.getElementById("calc-amount");
  var termEl = document.getElementById("calc-term");
  var rateEl = document.getElementById("calc-rate");
  if (!amountEl || !termEl || !rateEl) { return; }

  var amountOut = document.getElementById("calc-amount-out");
  var termOut = document.getElementById("calc-term-out");
  var rateOut = document.getElementById("calc-rate-out");
  var repayEl = document.getElementById("calc-repayment");
  var rateEcho = document.getElementById("calc-rate-echo");
  var termEcho = document.getElementById("calc-term-echo");
  var freqWord = document.querySelector(".js-freq-word");
  var freqBtns = [].slice.call(document.querySelectorAll(".js-freq"));

  var PERIODS = { weekly: 52, fortnightly: 26, monthly: 12 };
  var freq = "weekly";

  function fmtMoney(n) {
    return "$" + Math.round(n).toLocaleString("en-AU");
  }
  function fmtYears(y) {
    return y + (y === 1 ? " year" : " years");
  }

  // Amortising repayment per period for principal P, annual rate, term years.
  function repayment(P, annualPct, years, periodsPerYear) {
    var n = years * periodsPerYear;
    var r = (annualPct / 100) / periodsPerYear;
    if (r === 0) { return P / n; }
    return (P * r) / (1 - Math.pow(1 + r, -n));
  }

  function render() {
    var amount = parseFloat(amountEl.value);
    var years = parseInt(termEl.value, 10);
    var rate = parseFloat(rateEl.value);
    var ppy = PERIODS[freq];

    amountOut.textContent = fmtMoney(amount);
    termOut.textContent = fmtYears(years);
    rateOut.textContent = rate.toFixed(1) + "% p.a.";

    var pay = repayment(amount, rate, years, ppy);
    repayEl.textContent = fmtMoney(pay);

    if (freqWord) { freqWord.textContent = freq; }
    if (rateEcho) { rateEcho.textContent = rate.toFixed(1) + "%"; }
    if (termEcho) { termEcho.textContent = fmtYears(years); }
  }

  [amountEl, termEl, rateEl].forEach(function (el) {
    el.addEventListener("input", render);
  });

  freqBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      freq = btn.getAttribute("data-freq");
      freqBtns.forEach(function (b) { b.classList.toggle("is-active", b === btn); });
      render();
    });
  });

  render();
})();
