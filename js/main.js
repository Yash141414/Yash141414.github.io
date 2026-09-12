/* =============================================================
   main.js — shared utilities + page behaviour
   Loaded first (defer preserves order), exposes window.QC.
   ============================================================= */
(function () {
  'use strict';

  /* ---- Web3Forms access key -------------------------------------------
     Get a free key at https://web3forms.com (30 seconds, no account).
     Paste it below and the contact form starts delivering to your inbox.
     Until then the form tells visitors to email directly instead of
     silently swallowing their message.                                  */
  var WEB3FORMS_KEY = 'YOUR_KEY_HERE';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- canvas helpers (shared by options.js / research.js) ---------- */
  function fitCanvas(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width));
    var h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  /* Re-render on resize, debounced through rAF. */
  function onResize(fn) {
    var pending = false;
    window.addEventListener('resize', function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; fn(); });
    });
  }

  var COLORS = {
    green: '#4ade80', red: '#f87171', cyan: '#38bdf8',
    amber: '#fbbf24', violet: '#a78bfa',
    grid: '#1f2630', gridSoft: 'rgba(31,38,48,.55)',
    text: '#e6edf3', dim: '#8b98a9', faint: '#5d6977', panel: '#12161d'
  };

  var MONO = '11px "JetBrains Mono", ui-monospace, monospace';

  /* Nice round axis ticks covering [lo, hi]. */
  function ticks(lo, hi, count) {
    var span = hi - lo;
    if (!isFinite(span) || span <= 0) return [lo];
    var raw = span / Math.max(1, count);
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var norm = raw / mag;
    var step = (norm >= 7 ? 10 : norm >= 3 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
    var out = [], t = Math.ceil(lo / step) * step;
    for (; t <= hi + step * 1e-6; t += step) out.push(Math.round(t / step) * step);
    return out;
  }

  function fmt(n, d) {
    if (!isFinite(n)) return '—';
    if (n === 0) n = 0;              // collapse -0, which prints as "-0"
    return n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  window.QC = {
    fitCanvas: fitCanvas, onResize: onResize, COLORS: COLORS, MONO: MONO,
    ticks: ticks, fmt: fmt, reduceMotion: reduceMotion
  };

  /* ---------- boot sequence ---------- */
  var BOOT = [
    ['> initialising session', 'ok'],
    ['> mounting /research .......... OK', 'ok'],
    ['> loading market conventions .. OK', 'ok'],
    ['> calibrating vol surface ..... OK', 'ok'],
    ['> auth: guest@yashchheda', 'ok']
  ];
  function runBoot() {
    var el = document.getElementById('boot');
    if (!el) return;
    if (reduceMotion) {
      el.textContent = BOOT.map(function (b) { return b[0]; }).join('\n');
      return;
    }
    var line = 0, ch = 0, text = '';
    (function tick() {
      if (line >= BOOT.length) { el.innerHTML = escapeHtml(text) + '<span class="cur"> </span>'; return; }
      var src = BOOT[line][0];
      if (ch < src.length) {
        // type a few characters per frame so the whole sequence stays snappy
        text += src.slice(ch, ch + 2); ch += 2;
        el.innerHTML = escapeHtml(text) + '<span class="cur"> </span>';
        setTimeout(tick, 12);
      } else {
        text += '\n'; line++; ch = 0;
        setTimeout(tick, 110);
      }
    })();
  }
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------- hero grid backdrop ---------- */
  function heroGrid() {
    var cv = document.getElementById('heroGrid');
    if (!cv) return;
    var t = 0, raf = null;

    function draw() {
      var f = fitCanvas(cv), ctx = f.ctx, w = f.w, h = f.h;
      ctx.clearRect(0, 0, w, h);
      var step = 46;

      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(31,38,48,.55)';
      ctx.beginPath();
      for (var x = 0; x <= w; x += step) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, h); }
      for (var y = 0; y <= h; y += step) { ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); }
      ctx.stroke();

      // a slow drifting price-like path, purely decorative
      ctx.beginPath();
      var amp = h * 0.13, mid = h * 0.62;
      for (var i = 0; i <= w; i += 4) {
        var p = i / w;
        var v = Math.sin(p * 5.2 + t) * .55 + Math.sin(p * 11.3 - t * 1.7) * .28 + Math.sin(p * 23.1 + t * .6) * .13;
        var yy = mid - v * amp - p * h * 0.12;
        if (i === 0) ctx.moveTo(i, yy); else ctx.lineTo(i, yy);
      }
      var g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(74,222,128,0)');
      g.addColorStop(.35, 'rgba(74,222,128,.35)');
      g.addColorStop(1, 'rgba(56,189,248,.18)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.5; ctx.stroke();

      // vignette so text stays readable
      var vg = ctx.createRadialGradient(w * .3, h * .45, 0, w * .3, h * .45, Math.max(w, h) * .75);
      vg.addColorStop(0, 'rgba(10,12,16,.86)');
      vg.addColorStop(1, 'rgba(10,12,16,.25)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    }

    function loop() { t += 0.004; draw(); raf = requestAnimationFrame(loop); }

    draw();
    if (!reduceMotion) {
      loop();
      // stop animating once the hero is off screen
      var io = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { if (!raf) loop(); }
        else if (raf) { cancelAnimationFrame(raf); raf = null; }
      }, { threshold: 0 });
      io.observe(cv);
    }
    onResize(draw);
  }

  /* ---------- ticker tape ---------- */
  var TAPE = ['Python', 'pandas', 'numpy', 'scipy', 'statsmodels', 'PostgreSQL', 'NSE F&O',
    'Greeks', 'Vol surface', 'Backtesting', 'Bootstrap', 'Regime analysis', 'TensorRT-LLM',
    'FastAPI', 'WebSocket', 'Streamlit', 'Tableau', 'LangChain', 'Git', 'NISM-VIII'];
  function ticker() {
    var track = document.getElementById('tickerTrack');
    if (!track) return;
    var html = TAPE.map(function (s) { return '<span class="tk"><i>&#9670;</i>' + s + '</span>'; }).join('');
    track.innerHTML = html + html; // duplicated for a seamless -50% loop
  }

  /* ---------- scroll reveal + active section ---------- */
  function observers() {
    var revealables = document.querySelectorAll('.reveal');
    if (reduceMotion) {
      revealables.forEach(function (el) { el.classList.add('in'); });
    } else {
      var ro = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
      revealables.forEach(function (el) { ro.observe(el); });
    }

    var links = {}, sbSection = document.getElementById('sbSection');
    document.querySelectorAll('.rail-list a').forEach(function (a) { links[a.dataset.nav] = a; });
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.id;
        Object.keys(links).forEach(function (k) { links[k].classList.toggle('is-active', k === id); });
        if (sbSection) sbSection.textContent = links[id] ? links[id].querySelector('.lbl').textContent : id;
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main > section[id]').forEach(function (s) { so.observe(s); });
  }

  /* ---------- in-page anchor scrolling ----------
     Done here rather than with CSS scroll-behavior, so that the browser's own
     scroll restoration (reload, back/forward) stays instant. */
  function anchors() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href').slice(1);
      var target = id && document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', '#' + id);
    });
  }

  /* ---------- expandable principle cards ---------- */
  function principles() {
    document.querySelectorAll('.principle').forEach(function (card) {
      function toggle() {
        var open = card.classList.toggle('is-open');
        card.setAttribute('aria-expanded', String(open));
      }
      card.addEventListener('click', toggle);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });
  }

  /* ---------- timeline accordion ---------- */
  function timeline() {
    document.querySelectorAll('.tl-item').forEach(function (item) {
      var head = item.querySelector('.tl-head');
      head.addEventListener('click', function () {
        var open = item.classList.toggle('is-open');
        head.setAttribute('aria-expanded', String(open));
      });
    });
  }

  /* ---------- project filters ---------- */
  function filters() {
    var btns = document.querySelectorAll('.chip-btn');
    var cards = document.querySelectorAll('.proj');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.classList.toggle('is-active', x === b); });
        var f = b.dataset.filter;
        cards.forEach(function (c) {
          var show = f === 'all' || (' ' + c.dataset.tags + ' ').indexOf(' ' + f + ' ') > -1;
          c.classList.toggle('is-hidden', !show);
        });
      });
    });
  }

  /* ---------- copy-to-clipboard chips ---------- */
  function copyChips() {
    document.querySelectorAll('.copy-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var text = chip.dataset.copy;
        var done = function () {
          chip.classList.add('copied');
          var a = chip.querySelector('.cc-a');
          a.textContent = 'copied';
          setTimeout(function () { chip.classList.remove('copied'); a.textContent = 'copy'; }, 1600);
        };
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(done, fallback);
        } else { fallback(); }
        function fallback() {
          var ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); done(); } catch (e) { /* clipboard unavailable */ }
          document.body.removeChild(ta);
        }
      });
    });
  }

  /* ---------- contact form (Web3Forms, no backend) ---------- */
  function contactForm() {
    var form = document.getElementById('contactForm');
    if (!form) return;
    var status = document.getElementById('cfStatus');
    var submit = document.getElementById('cfSubmit');
    var configured = WEB3FORMS_KEY && WEB3FORMS_KEY !== 'YOUR_KEY_HERE';

    if (!configured) {
      status.className = 'form-status err';
      status.textContent = 'Form not wired up yet — please email yash.chheda14@gmail.com directly.';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!configured) {
        status.className = 'form-status err';
        status.textContent = 'No delivery key set. Email yash.chheda14@gmail.com instead.';
        return;
      }
      if (!form.checkValidity()) {
        status.className = 'form-status err';
        status.textContent = 'Please fill in name, a valid email, and a message.';
        return;
      }
      submit.disabled = true;
      status.className = 'form-status';
      status.textContent = 'sending…';

      var data = new FormData(form);
      data.append('access_key', WEB3FORMS_KEY);
      data.append('subject', 'Portfolio message from ' + (data.get('name') || 'visitor'));

      fetch('https://api.web3forms.com/submit', { method: 'POST', body: data })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.success) {
            status.className = 'form-status ok';
            status.textContent = 'Sent. I usually reply within a day or two.';
            form.reset();
          } else { throw new Error(j && j.message ? j.message : 'send failed'); }
        })
        .catch(function (err) {
          status.className = 'form-status err';
          status.textContent = 'Could not send (' + err.message + '). Email yash.chheda14@gmail.com instead.';
        })
        .finally(function () { submit.disabled = false; });
    });
  }

  /* ---------- status bar clock ---------- */
  function clock() {
    var el = document.getElementById('sbClock');
    if (!el) return;
    function tick() {
      el.textContent = new Date().toLocaleTimeString('en-GB', { hour12: false }) + ' IST';
    }
    tick(); setInterval(tick, 1000);
  }

  /* ---------- init ---------- */
  function init() {
    var y = document.getElementById('yr');
    if (y) y.textContent = String(new Date().getFullYear());
    var stamp = document.getElementById('nowStamp');
    if (stamp) stamp.textContent = new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    runBoot(); heroGrid(); ticker(); observers();
    anchors(); principles(); timeline(); filters(); copyChips(); contactForm(); clock();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
