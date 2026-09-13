/* =============================================================
   options.js — Black-Scholes engine + live payoff / Greek charts
   European, continuous compounding, zero dividend yield.
   ============================================================= */
(function () {
  'use strict';
  var QC = window.QC, C = QC.COLORS;

  /* ---------------- maths ---------------- */

  /* Abramowitz & Stegun 7.1.26 — max abs error ~1.5e-7 */
  function erf(x) {
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function N(x) { return 0.5 * (1 + erf(x / Math.SQRT2)); }
  function npdf(x) { return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI); }

  /* Full Black-Scholes valuation for one European option.
     T in years, sigma and r as decimals. Theta is per day, vega per
     volatility point, rho per 1% of rate — i.e. trader units. */
  function bs(type, S, K, T, r, sig) {
    var isCall = type === 'call';
    if (T <= 0 || sig <= 0 || S <= 0) {
      var intr = isCall ? Math.max(0, S - K) : Math.max(0, K - S);
      return { price: intr, delta: intr > 0 ? (isCall ? 1 : -1) : 0, gamma: 0, vega: 0, theta: 0, rho: 0 };
    }
    var sqT = Math.sqrt(T);
    var d1 = (Math.log(S / K) + (r + 0.5 * sig * sig) * T) / (sig * sqT);
    var d2 = d1 - sig * sqT;
    var disc = Math.exp(-r * T);
    var nd1 = N(d1), nd2 = N(d2), pd1 = npdf(d1);

    var price = isCall ? S * nd1 - K * disc * nd2
                       : K * disc * (1 - nd2) - S * (1 - nd1);
    var delta = isCall ? nd1 : nd1 - 1;
    var gamma = pd1 / (S * sig * sqT);
    var vega = S * pd1 * sqT;                       // per 1.00 of vol
    var theta = isCall
      ? (-S * pd1 * sig / (2 * sqT) - r * K * disc * nd2)
      : (-S * pd1 * sig / (2 * sqT) + r * K * disc * (1 - nd2));
    var rho = isCall ? K * T * disc * nd2 : -K * T * disc * (1 - nd2);

    return {
      price: price, delta: delta, gamma: gamma,
      vega: vega / 100,        // per 1 vol point
      theta: theta / 365,      // per calendar day
      rho: rho / 100           // per 1% rate
    };
  }
  window.QC.bs = bs;   // the terminal's `greeks` command reuses this

  /* ---------------- strategy definitions ---------------- */

  var round = function (x) { return Math.round(x * 2) / 2; };

  var STRATEGIES = {
    'long-call':   { name: 'Long call',       legs: function (K) { return [{ t: 'call', K: K, q: 1 }]; } },
    'long-put':    { name: 'Long put',        legs: function (K) { return [{ t: 'put', K: K, q: 1 }]; } },
    'straddle':    { name: 'Long straddle',   legs: function (K) { return [{ t: 'call', K: K, q: 1 }, { t: 'put', K: K, q: 1 }]; } },
    'strangle':    { name: 'Long strangle',   legs: function (K) { return [{ t: 'call', K: round(K * 1.05), q: 1 }, { t: 'put', K: round(K * 0.95), q: 1 }]; } },
    'bull-call':   { name: 'Bull call spread', legs: function (K) { return [{ t: 'call', K: K, q: 1 }, { t: 'call', K: round(K * 1.05), q: -1 }]; } },
    'iron-condor': { name: 'Iron condor',     legs: function (K) { return [
        { t: 'put', K: round(K * 0.90), q: 1 }, { t: 'put', K: round(K * 0.95), q: -1 },
        { t: 'call', K: round(K * 1.05), q: -1 }, { t: 'call', K: round(K * 1.10), q: 1 }]; } },
    'covered-call':{ name: 'Covered call',    legs: function (K) { return [{ t: 'stock', K: 0, q: 1 }, { t: 'call', K: round(K * 1.05), q: -1 }]; } }
  };

  /* Value of one leg at spot x. */
  function legValue(leg, x, T, r, sig) {
    if (leg.t === 'stock') return x;
    return bs(leg.t, x, leg.K, T, r, sig).price;
  }
  function legIntrinsic(leg, x) {
    if (leg.t === 'stock') return x;
    return leg.t === 'call' ? Math.max(0, x - leg.K) : Math.max(0, leg.K - x);
  }
  function positionGreeks(legs, S, T, r, sig) {
    var g = { price: 0, delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 };
    legs.forEach(function (leg) {
      if (leg.t === 'stock') { g.price += leg.q * S; g.delta += leg.q; return; }
      var o = bs(leg.t, S, leg.K, T, r, sig);
      g.price += leg.q * o.price; g.delta += leg.q * o.delta; g.gamma += leg.q * o.gamma;
      g.vega += leg.q * o.vega;   g.theta += leg.q * o.theta; g.rho += leg.q * o.rho;
    });
    return g;
  }

  /* ---------------- state ---------------- */

  var els = {};
  var state = { S: 100, K: 100, vol: 0.20, days: 30, r: 0.065, strategy: 'straddle', greek: 'delta' };
  var model = null;       // recomputed on every change
  var hoverX = null;      // spot under the cursor, or null

  function readInputs() {
    state.S = parseFloat(els.inS.value);
    state.K = parseFloat(els.inK.value);
    state.vol = parseFloat(els.inV.value) / 100;
    state.days = parseInt(els.inT.value, 10);
    state.r = parseFloat(els.inR.value) / 100;
    state.strategy = els.selStrategy.value;

    els.vS.textContent = QC.fmt(state.S, 2);
    els.vK.textContent = QC.fmt(state.K, 2);
    els.vV.textContent = QC.fmt(state.vol * 100, 1) + '%';
    els.vT.textContent = state.days;
    els.vR.textContent = QC.fmt(state.r * 100, 1) + '%';
    els.lgDays.textContent = state.days;
  }

  /* Build everything the two charts and the readouts need, once per change. */
  function build() {
    var T = state.days / 365;
    var legs = STRATEGIES[state.strategy].legs(state.K);
    var cost = 0;
    legs.forEach(function (leg) {
      leg.px = legValue(leg, state.S, T, state.r, state.vol);
      cost += leg.q * leg.px;
    });

    var strikes = legs.filter(function (l) { return l.t !== 'stock'; }).map(function (l) { return l.K; });
    var lo = Math.min.apply(null, strikes.concat([state.S])) * 0.70;
    var hi = Math.max.apply(null, strikes.concat([state.S])) * 1.30;

    var STEPS = 220, xs = [], expiry = [], today = [];
    for (var i = 0; i <= STEPS; i++) {
      var x = lo + (hi - lo) * i / STEPS;
      var e = 0, n = 0;
      for (var j = 0; j < legs.length; j++) {
        e += legs[j].q * legIntrinsic(legs[j], x);
        n += legs[j].q * legValue(legs[j], x, T, state.r, state.vol);
      }
      xs.push(x); expiry.push(e - cost); today.push(n - cost);
    }

    /* breakevens: linear interpolation across sign changes of the expiry P&L */
    var bes = [];
    for (var k = 1; k <= STEPS; k++) {
      var a = expiry[k - 1], b = expiry[k];
      if ((a < 0 && b >= 0) || (a > 0 && b <= 0)) {
        var frac = Math.abs(a) / (Math.abs(a) + Math.abs(b) || 1);
        bes.push(xs[k - 1] + (xs[k] - xs[k - 1]) * frac);
      }
    }

    model = {
      T: T, legs: legs, cost: cost, lo: lo, hi: hi, xs: xs,
      expiry: expiry, today: today, breakevens: bes,
      greeks: positionGreeks(legs, state.S, T, state.r, state.vol)
    };
  }

  /* ---------------- readouts ---------------- */

  function renderLegs() {
    els.legs.innerHTML = model.legs.map(function (l) {
      var side = l.q > 0 ? 'long' : 'short';
      var label = l.t === 'stock' ? 'stock' : l.t + ' ' + QC.fmt(l.K, 1);
      return '<div class="leg"><span class="lg-side ' + side + '">' + (l.q > 0 ? '+' : '') + l.q + '</span>' +
             '<span>' + label + '</span><span class="lg-px">' + QC.fmt(l.px, 2) + '</span></div>';
    }).join('');
  }

  function setVal(el, v, digits, signed) {
    el.textContent = (signed && v > 0 ? '+' : '') + QC.fmt(v, digits);
    el.classList.toggle('pos', signed && v > 0);
    el.classList.toggle('neg', signed && v < 0);
  }

  function renderGreeks() {
    var g = model.greeks;
    setVal(els.gPrice, g.price, 2, false);
    setVal(els.gDelta, g.delta, 3, true);
    setVal(els.gGamma, g.gamma, 4, true);
    setVal(els.gVega, g.vega, 3, true);
    setVal(els.gTheta, g.theta, 3, true);
    setVal(els.gRho, g.rho, 3, true);
  }

  function renderNote() {
    if (hoverX !== null) {
      var i = Math.round((hoverX - model.lo) / (model.hi - model.lo) * (model.xs.length - 1));
      i = Math.max(0, Math.min(model.xs.length - 1, i));
      els.payoffNote.innerHTML = 'spot <b>' + QC.fmt(model.xs[i], 2) + '</b> &nbsp; at expiry <b>' +
        QC.fmt(model.expiry[i], 2) + '</b> &nbsp; today <b>' + QC.fmt(model.today[i], 2) + '</b>';
      return;
    }
    var be = model.breakevens.length
      ? model.breakevens.map(function (b) { return QC.fmt(b, 2); }).join(' / ')
      : 'none in range';
    var kind = model.cost >= 0 ? 'net debit' : 'net credit';
    els.payoffNote.innerHTML = STRATEGIES[state.strategy].name + ' &nbsp;·&nbsp; ' + kind +
      ' <b>' + QC.fmt(Math.abs(model.cost), 2) + '</b> &nbsp;·&nbsp; breakeven <b>' + be + '</b>';
  }

  /* ---------------- payoff chart ---------------- */

  function drawPayoff() {
    var f = QC.fitCanvas(els.payoffCanvas), ctx = f.ctx, w = f.w, h = f.h;
    ctx.clearRect(0, 0, w, h);
    var PL = 58, PR = 14, PT = 12, PB = 30;
    var iw = w - PL - PR, ih = h - PT - PB;
    if (iw < 40 || ih < 40) return;

    var all = model.expiry.concat(model.today);
    var ymin = Math.min.apply(null, all), ymax = Math.max.apply(null, all);
    var padY = (ymax - ymin) * 0.12 || 1;
    ymin -= padY; ymax += padY;
    if (ymin > 0) ymin = -padY;
    if (ymax < 0) ymax = padY;

    var X = function (v) { return PL + (v - model.lo) / (model.hi - model.lo) * iw; };
    var Y = function (v) { return PT + (ymax - v) / (ymax - ymin) * ih; };
    var y0 = Y(0);

    /* grid + axis labels */
    ctx.font = QC.MONO; ctx.lineWidth = 1;
    ctx.strokeStyle = C.gridSoft; ctx.fillStyle = C.faint;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    QC.ticks(ymin, ymax, 5).forEach(function (t) {
      var y = Math.round(Y(t)) + .5;
      if (y < PT || y > PT + ih) return;
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + iw, y); ctx.stroke();
      ctx.fillText(QC.fmt(t, 0), PL - 9, y);
    });
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    QC.ticks(model.lo, model.hi, 6).forEach(function (t) {
      var x = Math.round(X(t)) + .5;
      if (x < PL || x > PL + iw) return;
      ctx.beginPath(); ctx.moveTo(x, PT); ctx.lineTo(x, PT + ih); ctx.stroke();
      ctx.fillText(QC.fmt(t, 0), x, PT + ih + 8);
    });

    /* Shaded P&L regions, clipped above / below the zero line.
       The polygon self-intersects wherever the payoff crosses zero, so it must be
       filled even-odd — nonzero winding would flood the gap between breakevens. */
    var path = new Path2D();
    path.moveTo(X(model.xs[0]), Y(model.expiry[0]));
    for (var i = 1; i < model.xs.length; i++) path.lineTo(X(model.xs[i]), Y(model.expiry[i]));
    path.lineTo(X(model.xs[model.xs.length - 1]), y0);
    path.lineTo(X(model.xs[0]), y0);
    path.closePath();

    ctx.save();
    ctx.beginPath(); ctx.rect(PL, PT, iw, Math.max(0, y0 - PT)); ctx.clip();
    ctx.fillStyle = 'rgba(74,222,128,.16)'; ctx.fill(path, 'evenodd');
    ctx.restore();

    ctx.save();
    ctx.beginPath(); ctx.rect(PL, y0, iw, Math.max(0, PT + ih - y0)); ctx.clip();
    ctx.fillStyle = 'rgba(248,113,113,.15)'; ctx.fill(path, 'evenodd');
    ctx.restore();

    /* zero line */
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PL, Math.round(y0) + .5); ctx.lineTo(PL + iw, Math.round(y0) + .5); ctx.stroke();

    /* today's value curve (dashed) */
    ctx.setLineDash([5, 4]); ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (i = 0; i < model.xs.length; i++) {
      var px = X(model.xs[i]), py = Y(model.today[i]);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke(); ctx.setLineDash([]);

    /* expiry payoff (solid) */
    ctx.strokeStyle = C.green; ctx.lineWidth = 2;
    ctx.beginPath();
    for (i = 0; i < model.xs.length; i++) {
      var qx = X(model.xs[i]), qy = Y(model.expiry[i]);
      i === 0 ? ctx.moveTo(qx, qy) : ctx.lineTo(qx, qy);
    }
    ctx.stroke();

    /* strike ticks */
    ctx.setLineDash([2, 3]); ctx.strokeStyle = 'rgba(167,139,250,.5)'; ctx.lineWidth = 1;
    model.legs.forEach(function (l) {
      if (l.t === 'stock') return;
      var x = Math.round(X(l.K)) + .5;
      if (x < PL || x > PL + iw) return;
      ctx.beginPath(); ctx.moveTo(x, PT); ctx.lineTo(x, PT + ih); ctx.stroke();
    });
    ctx.setLineDash([]);

    /* breakeven markers */
    ctx.fillStyle = C.amber;
    model.breakevens.forEach(function (b) {
      var x = X(b);
      ctx.beginPath(); ctx.arc(x, y0, 3.5, 0, Math.PI * 2); ctx.fill();
    });

    /* spot */
    var sx = Math.round(X(state.S)) + .5;
    ctx.setLineDash([3, 3]); ctx.strokeStyle = C.amber; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(sx, PT); ctx.lineTo(sx, PT + ih); ctx.stroke();
    ctx.setLineDash([]);

    /* hover crosshair */
    if (hoverX !== null) {
      var hx = X(hoverX);
      var idx = Math.max(0, Math.min(model.xs.length - 1,
        Math.round((hoverX - model.lo) / (model.hi - model.lo) * (model.xs.length - 1))));
      ctx.strokeStyle = 'rgba(230,237,243,.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx, PT); ctx.lineTo(hx, PT + ih); ctx.stroke();
      ctx.fillStyle = C.green;
      ctx.beginPath(); ctx.arc(hx, Y(model.expiry[idx]), 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.cyan;
      ctx.beginPath(); ctx.arc(hx, Y(model.today[idx]), 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* ---------------- Greek profile chart ---------------- */

  function drawGreek() {
    var f = QC.fitCanvas(els.greekCanvas), ctx = f.ctx, w = f.w, h = f.h;
    ctx.clearRect(0, 0, w, h);
    var PL = 46, PR = 10, PT = 10, PB = 20;
    var iw = w - PL - PR, ih = h - PT - PB;
    if (iw < 30 || ih < 30) return;

    var key = state.greek, vals = [];
    for (var i = 0; i < model.xs.length; i++) {
      vals.push(positionGreeks(model.legs, model.xs[i], model.T, state.r, state.vol)[key]);
    }
    var ymin = Math.min.apply(null, vals), ymax = Math.max.apply(null, vals);
    var pad = (ymax - ymin) * 0.15 || Math.abs(ymax) * 0.2 || 0.01;
    ymin -= pad; ymax += pad;
    if (ymin > 0) ymin = -pad * 0.3;
    if (ymax < 0) ymax = pad * 0.3;

    var X = function (v) { return PL + (v - model.lo) / (model.hi - model.lo) * iw; };
    var Y = function (v) { return PT + (ymax - v) / (ymax - ymin) * ih; };

    var digits = (key === 'gamma') ? 4 : 2;
    ctx.font = QC.MONO; ctx.strokeStyle = C.gridSoft; ctx.fillStyle = C.faint;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.lineWidth = 1;
    QC.ticks(ymin, ymax, 3).forEach(function (t) {
      var y = Math.round(Y(t)) + .5;
      if (y < PT || y > PT + ih) return;
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + iw, y); ctx.stroke();
      ctx.fillText(QC.fmt(t, digits), PL - 7, y);
    });

    ctx.strokeStyle = C.grid;
    var yz = Math.round(Y(0)) + .5;
    ctx.beginPath(); ctx.moveTo(PL, yz); ctx.lineTo(PL + iw, yz); ctx.stroke();

    ctx.strokeStyle = C.violet; ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (i = 0; i < model.xs.length; i++) {
      var px = X(model.xs[i]), py = Y(vals[i]);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();

    var sx = Math.round(X(state.S)) + .5;
    ctx.setLineDash([3, 3]); ctx.strokeStyle = C.amber; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx, PT); ctx.lineTo(sx, PT + ih); ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = C.amber;
    var si = Math.max(0, Math.min(model.xs.length - 1,
      Math.round((state.S - model.lo) / (model.hi - model.lo) * (model.xs.length - 1))));
    ctx.beginPath(); ctx.arc(sx, Y(vals[si]), 3, 0, Math.PI * 2); ctx.fill();
  }

  /* ---------------- render loop ---------------- */

  function renderNow() {
    build(); renderLegs(); renderGreeks(); renderNote(); drawPayoff(); drawGreek();
  }

  /* Coalesce bursts of slider input into one paint per frame. Never use this for
     the first render: rAF does not fire in a background tab, which would leave
     the lab blank until the tab is focused. */
  var queued = false;
  function render() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; renderNow(); });
  }

  /* ---------------- wiring ---------------- */

  function init() {
    ['inS', 'inK', 'inV', 'inT', 'inR', 'selStrategy', 'vS', 'vK', 'vV', 'vT', 'vR',
     'legs', 'gPrice', 'gDelta', 'gGamma', 'gVega', 'gTheta', 'gRho', 'lgDays',
     'payoffCanvas', 'greekCanvas', 'payoffNote', 'btnReset'].forEach(function (id) {
      els[id] = document.getElementById(id);
    });
    if (!els.payoffCanvas) return;   // section not on the page

    ['inS', 'inK', 'inV', 'inT', 'inR'].forEach(function (id) {
      els[id].addEventListener('input', function () { readInputs(); render(); });
    });
    els.selStrategy.addEventListener('change', function () { readInputs(); render(); });

    els.btnReset.addEventListener('click', function () {
      els.inS.value = 100; els.inK.value = 100; els.inV.value = 20;
      els.inT.value = 30; els.inR.value = 6.5;
      readInputs(); renderNow();
    });

    document.querySelectorAll('.gk-chart .tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.gk-chart .tab').forEach(function (t) {
          var on = t === tab;
          t.classList.toggle('is-active', on);
          t.setAttribute('aria-selected', String(on));
        });
        state.greek = tab.dataset.greek;
        drawGreek();
      });
    });

    /* ---- scrub to read, drag to move spot ----
       The chart is the control, not just a picture of one. Hovering scrubs a
       crosshair readout; pressing and dragging sets the spot price directly and
       keeps the slider in sync, so both routes stay honest about one state. */
    var cv = els.payoffCanvas;

    /* The x-domain is derived from spot, so it would rescale under the cursor
       mid-drag. Freeze it at pointerdown and map against that for the whole drag. */
    var frozen = null;

    function priceAt(ev) {
      var rect = cv.getBoundingClientRect();
      var PL = 58, PR = 14;
      var lo = frozen ? frozen.lo : model.lo;
      var hi = frozen ? frozen.hi : model.hi;
      var frac = (ev.clientX - rect.left - PL) / Math.max(1, rect.width - PL - PR);
      return lo + (hi - lo) * Math.max(0, Math.min(1, frac));
    }

    function setSpot(price) {
      var min = parseFloat(cv.ownerDocument.getElementById('inS').min);
      var max = parseFloat(cv.ownerDocument.getElementById('inS').max);
      var step = 0.5;
      var v = Math.max(min, Math.min(max, Math.round(price / step) * step));
      if (v === state.S) return;
      els.inS.value = v;
      readInputs();
      render();          // rAF-coalesced: a drag fires far faster than we can paint
    }

    var dragging = false;

    cv.addEventListener('pointerdown', function (ev) {
      dragging = true;
      frozen = { lo: model.lo, hi: model.hi };
      cv.classList.add('is-dragging');
      // Capture keeps the drag alive outside the canvas, but it throws if the
      // pointer is not active (synthetic events, some automation). Never let
      // that abort the drag itself.
      try { cv.setPointerCapture(ev.pointerId); } catch (err) { /* non-fatal */ }
      hoverX = null;
      setSpot(priceAt(ev));
      ev.preventDefault();
    });

    cv.addEventListener('pointermove', function (ev) {
      if (dragging) { setSpot(priceAt(ev)); return; }
      if (ev.pointerType === 'touch') return;   // no hover state on touch
      hoverX = priceAt(ev);
      renderNote(); drawPayoff();
    });

    function endDrag(ev) {
      if (!dragging) return;
      dragging = false;
      frozen = null;
      cv.classList.remove('is-dragging');
      try {
        if (ev && ev.pointerId != null && cv.hasPointerCapture(ev.pointerId)) {
          cv.releasePointerCapture(ev.pointerId);
        }
      } catch (err) { /* capture was never taken */ }
    }
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', endDrag);
    cv.addEventListener('pointerleave', function () {
      if (dragging) return;
      hoverX = null; renderNote(); drawPayoff();
    });

    QC.onResize(function () { if (model) { drawPayoff(); drawGreek(); } });

    readInputs(); renderNow();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
