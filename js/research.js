/* =============================================================
   research.js — illustrative equity curve + cost-filter demo
   Everything here is generated from a fixed seed, so the picture
   is identical on every load and on every device. No proprietary
   data is shipped to the browser.
   ============================================================= */
(function () {
  'use strict';
  var QC = window.QC, C = QC.COLORS;

  /* ---------------- seeded generation ---------------- */

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gauss(rnd) {
    var u = 1 - rnd(), v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  var TARGET_SHARPE = 1.8;     // as reported for the Ikiquant backtests
  /* Reported hit ratio is 60%. The affine rescale below nudges the realised win rate
     up by ~2 points, so the generator is seeded under that to land on it. Whatever it
     actually produces is what the stat tiles report — chart and numbers cannot disagree. */
  var GEN_HIT = 0.58;
  var DAYS = 504;              // ~2 trading years
  var ANN = 252;

  function buildSeries() {
    var rnd = mulberry32(20240417);
    var raw = [];
    for (var i = 0; i < DAYS; i++) {
      // asymmetric win/loss magnitudes at the reported hit rate
      raw.push(rnd() < GEN_HIT ? Math.abs(gauss(rnd)) * 0.0080
                                : -Math.abs(gauss(rnd)) * 0.0095);
    }
    var m = raw.reduce(function (a, b) { return a + b; }, 0) / DAYS;
    var sd = Math.sqrt(raw.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (DAYS - 1));

    // affine rescale so the annualised Sharpe lands exactly on target
    var sdT = 0.011, meanT = sdT * TARGET_SHARPE / Math.sqrt(ANN), k = sdT / sd;
    var rets = raw.map(function (r) { return (r - m) * k + meanT; });

    var equity = [1], peak = 1, dd = [0], maxDD = 0, wins = 0;
    for (i = 0; i < DAYS; i++) {
      if (rets[i] > 0) wins++;
      var e = equity[i] * (1 + rets[i]);
      equity.push(e);
      peak = Math.max(peak, e);
      var d = e / peak - 1;
      dd.push(d);
      maxDD = Math.min(maxDD, d);
    }

    var mm = rets.reduce(function (a, b) { return a + b; }, 0) / DAYS;
    var ss = Math.sqrt(rets.reduce(function (a, b) { return a + (b - mm) * (b - mm); }, 0) / (DAYS - 1));

    // business-day stamps starting from the first Monday of 2023
    var dates = [], d0 = new Date(2023, 0, 2);
    for (i = 0; i <= DAYS; i++) {
      dates.push(new Date(d0));
      do { d0.setDate(d0.getDate() + 1); } while (d0.getDay() === 0 || d0.getDay() === 6);
    }

    return {
      equity: equity, dd: dd, dates: dates,
      sharpe: mm / ss * Math.sqrt(ANN),
      hit: wins / DAYS,
      maxDD: maxDD,
      n: DAYS
    };
  }

  var S = null, progress = 0, hoverI = null;

  /* ---------------- equity + drawdown chart ---------------- */

  function drawEquity() {
    var cv = document.getElementById('equityCanvas');
    if (!cv || !S) return;
    var f = QC.fitCanvas(cv), ctx = f.ctx, w = f.w, h = f.h;
    ctx.clearRect(0, 0, w, h);

    var PL = 54, PR = 14, PT = 12, PB = 26, GAP = 16;
    var iw = w - PL - PR;
    var totalH = h - PT - PB - GAP;
    if (iw < 40 || totalH < 60) return;
    var eqH = totalH * 0.68, ddH = totalH * 0.32;
    var eqTop = PT, ddTop = PT + eqH + GAP;

    var n = S.equity.length;
    var shown = Math.max(2, Math.round(n * progress));
    var eqMax = Math.max.apply(null, S.equity), eqMin = Math.min.apply(null, S.equity);
    var padE = (eqMax - eqMin) * 0.08;
    var lo = eqMin - padE, hi = eqMax + padE;

    var X = function (i) { return PL + i / (n - 1) * iw; };
    var YE = function (v) { return eqTop + (hi - v) / (hi - lo) * eqH; };
    var YD = function (v) { return ddTop + (-v) / (-S.maxDD || 1) * ddH; };

    /* grid */
    ctx.font = QC.MONO; ctx.lineWidth = 1;
    ctx.strokeStyle = C.gridSoft; ctx.fillStyle = C.faint;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    QC.ticks(lo, hi, 4).forEach(function (t) {
      var y = Math.round(YE(t)) + .5;
      if (y < eqTop || y > eqTop + eqH) return;
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + iw, y); ctx.stroke();
      ctx.fillText(((t - 1) * 100).toFixed(0) + '%', PL - 8, y);
    });
    [0, S.maxDD / 2, S.maxDD].forEach(function (t) {
      var y = Math.round(YD(t)) + .5;
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + iw, y); ctx.stroke();
      ctx.fillText((t * 100).toFixed(1) + '%', PL - 8, y);
    });

    /* x axis: year boundaries */
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var lastYear = null;
    for (var i = 0; i < n; i += 21) {
      var yr = S.dates[i].getFullYear();
      if (yr !== lastYear) {
        lastYear = yr;
        var x = Math.round(X(i)) + .5;
        ctx.strokeStyle = C.grid;
        ctx.beginPath(); ctx.moveTo(x, eqTop); ctx.lineTo(x, ddTop + ddH); ctx.stroke();
        ctx.fillStyle = C.faint;
        ctx.fillText(String(yr), x, ddTop + ddH + 7);
        ctx.strokeStyle = C.gridSoft;
      }
    }

    /* equity area fill */
    var grad = ctx.createLinearGradient(0, eqTop, 0, eqTop + eqH);
    grad.addColorStop(0, 'rgba(74,222,128,.22)');
    grad.addColorStop(1, 'rgba(74,222,128,0)');
    ctx.beginPath();
    ctx.moveTo(X(0), eqTop + eqH);
    for (i = 0; i < shown; i++) ctx.lineTo(X(i), YE(S.equity[i]));
    ctx.lineTo(X(shown - 1), eqTop + eqH);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    /* equity line */
    ctx.beginPath();
    for (i = 0; i < shown; i++) {
      var px = X(i), py = YE(S.equity[i]);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.strokeStyle = C.green; ctx.lineWidth = 1.8; ctx.stroke();

    /* underwater */
    ctx.beginPath();
    ctx.moveTo(X(0), YD(0));
    for (i = 0; i < shown; i++) ctx.lineTo(X(i), YD(S.dd[i]));
    ctx.lineTo(X(shown - 1), YD(0));
    ctx.closePath();
    ctx.fillStyle = 'rgba(248,113,113,.22)'; ctx.fill();
    ctx.beginPath();
    for (i = 0; i < shown; i++) {
      var dx = X(i), dy = YD(S.dd[i]);
      i === 0 ? ctx.moveTo(dx, dy) : ctx.lineTo(dx, dy);
    }
    ctx.strokeStyle = C.red; ctx.lineWidth = 1.2; ctx.stroke();

    /* section label */
    /* sits in the gap between the two panels, clear of the zero line */
    ctx.fillStyle = C.dim; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText('drawdown', PL + iw, ddTop - 3);

    /* crosshair */
    if (hoverI !== null && hoverI < shown) {
      var hx = Math.round(X(hoverI)) + .5;
      ctx.strokeStyle = 'rgba(230,237,243,.32)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx, eqTop); ctx.lineTo(hx, ddTop + ddH); ctx.stroke();
      ctx.fillStyle = C.green;
      ctx.beginPath(); ctx.arc(hx, YE(S.equity[hoverI]), 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.red;
      ctx.beginPath(); ctx.arc(hx, YD(S.dd[hoverI]), 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* Tiles count up once, when they first scroll into view. */
  function renderStats() {
    var tiles = [
      ['stSharpe', S.sharpe,        function (v) { return v.toFixed(2); }],
      ['stHit',    S.hit * 100,     function (v) { return v.toFixed(0) + '%'; }],
      ['stDD',     S.maxDD * 100,   function (v) { return v.toFixed(1) + '%'; }],
      ['stN',      S.n,             function (v) { return String(Math.round(v)); }]
    ];
    var host = document.querySelector('#view-equity .stats');
    if (!host) return;

    function run() {
      tiles.forEach(function (t) {
        QC.countUp(document.getElementById(t[0]), t[1], t[2]);
      });
    }
    if (QC.reduceMotion) { run(); return; }
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      run();
    }, { threshold: .4 });
    io.observe(host);
  }

  function readout(i) {
    var el = document.getElementById('eqReadout');
    if (!el) return;
    if (i === null) { el.textContent = 'hover to scrub'; return; }
    var d = S.dates[i];
    el.innerHTML = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' &nbsp; cum <span class="pos">' + ((S.equity[i] - 1) * 100).toFixed(1) + '%</span>' +
      ' &nbsp; dd <span class="neg">' + (S.dd[i] * 100).toFixed(1) + '%</span>';
  }

  /* ---------------- cost filter demo ---------------- */

  var SIGNALS = (function () {
    var rnd = mulberry32(778811), out = [];
    for (var i = 0; i < 64; i++) {
      // long right tail: a few strong edges, many marginal ones
      out.push(1.5 + Math.pow(rnd(), 2.1) * 34);
    }
    return out.sort(function (a, b) { return b - a; });
  })();

  function drawCosts() {
    var cv = document.getElementById('costCanvas');
    if (!cv) return;
    var f = QC.fitCanvas(cv), ctx = f.ctx, w = f.w, h = f.h;
    ctx.clearRect(0, 0, w, h);
    var PL = 44, PR = 14, PT = 14, PB = 28;
    var iw = w - PL - PR, ih = h - PT - PB;
    if (iw < 40 || ih < 40) return;

    var cost = parseFloat(document.getElementById('inCost').value);
    var maxE = 38;
    var X = function (i) { return PL + i / SIGNALS.length * iw; };
    var Y = function (v) { return PT + (maxE - v) / maxE * ih; };
    var bw = Math.max(2, iw / SIGNALS.length - 2);

    ctx.font = QC.MONO; ctx.lineWidth = 1;
    ctx.strokeStyle = C.gridSoft; ctx.fillStyle = C.faint;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    QC.ticks(0, maxE, 4).forEach(function (t) {
      var y = Math.round(Y(t)) + .5;
      if (y < PT || y > PT + ih) return;
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + iw, y); ctx.stroke();
      ctx.fillText(t + 'bp', PL - 7, y);
    });

    var survivors = 0;
    SIGNALS.forEach(function (e, i) {
      var alive = e > cost;
      if (alive) survivors++;
      ctx.fillStyle = alive ? 'rgba(74,222,128,.75)' : 'rgba(248,113,113,.30)';
      var y = Y(e), bh = Math.max(1, PT + ih - y);
      ctx.fillRect(X(i), y, bw, bh);
    });

    /* the gate itself */
    var cy = Math.round(Y(cost)) + .5;
    ctx.setLineDash([6, 4]); ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(PL, cy); ctx.lineTo(PL + iw, cy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = C.amber; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText('cost gate  ' + cost.toFixed(1) + ' bps', PL + 6, cy - 5);

    ctx.fillStyle = C.faint; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('candidate signals, ranked by gross edge', PL + iw / 2, PT + ih + 9);

    var el = document.getElementById('costReadout');
    var pct = (survivors / SIGNALS.length * 100).toFixed(0);
    el.innerHTML = survivors === 0
      ? '<span class="neg">0 of ' + SIGNALS.length + ' survive — every candidate dies at the gate</span>'
      : survivors + ' of ' + SIGNALS.length + ' survive (' + pct + '%)';
  }

  /* ---------------- wiring ---------------- */

  function init() {
    var eqCanvas = document.getElementById('equityCanvas');
    if (!eqCanvas) return;

    S = buildSeries();
    renderStats();

    /* draw-on animation once the chart scrolls into view */
    if (QC.reduceMotion) {
      progress = 1; drawEquity();
    } else {
      var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        var t0 = performance.now(), DUR = 1100;
        (function step(now) {
          var p = Math.min(1, (now - t0) / DUR);
          progress = 1 - Math.pow(1 - p, 3);   // ease-out cubic
          drawEquity();
          if (p < 1) requestAnimationFrame(step);
        })(t0);
      }, { threshold: .25 });
      io.observe(eqCanvas);
      drawEquity();
    }

    function locate(ev) {
      if (progress < 1) return;
      var rect = eqCanvas.getBoundingClientRect();
      var clientX = ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX;
      var PL = 54, PR = 14;
      var frac = (clientX - rect.left - PL) / Math.max(1, rect.width - PL - PR);
      hoverI = Math.max(0, Math.min(S.equity.length - 1, Math.round(frac * (S.equity.length - 1))));
      readout(hoverI); drawEquity();
    }
    eqCanvas.addEventListener('mousemove', locate);
    eqCanvas.addEventListener('touchmove', locate, { passive: true });
    eqCanvas.addEventListener('mouseleave', function () { hoverI = null; readout(null); drawEquity(); });
    eqCanvas.addEventListener('touchend', function () { hoverI = null; readout(null); drawEquity(); });

    /* cost filter */
    var inCost = document.getElementById('inCost');
    inCost.addEventListener('input', function () {
      document.getElementById('vCost').textContent = parseFloat(inCost.value).toFixed(1) + ' bps';
      drawCosts();
    });
    document.getElementById('vCost').textContent = parseFloat(inCost.value).toFixed(1) + ' bps';

    /* view tabs */
    document.querySelectorAll('.tabs-lg .tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.tabs-lg .tab').forEach(function (t) {
          var on = t === tab;
          t.classList.toggle('is-active', on);
          t.setAttribute('aria-selected', String(on));
        });
        document.querySelectorAll('#research .view').forEach(function (v) {
          v.classList.toggle('is-active', v.id === 'view-' + tab.dataset.view);
        });
        if (tab.dataset.view === 'costs') drawCosts(); else drawEquity();
      });
    });

    QC.onResize(function () { drawEquity(); drawCosts(); });
    drawCosts();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
