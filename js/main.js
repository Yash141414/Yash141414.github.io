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

  /* Kept in step with the CSS custom properties — the canvases draw over glass
     panels, so gridlines are light-on-dark translucency rather than flat greys. */
  var COLORS = {
    green: '#4ade80', red: '#f87171', cyan: '#22d3ee',
    amber: '#fbbf24', violet: '#a78bfa',
    grid: 'rgba(146,178,230,.22)', gridSoft: 'rgba(146,178,230,.10)',
    text: '#e8eefc', dim: '#94a3c4', faint: '#7d8fb2', panel: '#131a2c'
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

  /* Animate a number up to its value. `format` turns a number into display text,
     so the same helper drives "1.80", "60%" and "-18.2%". */
  function countUp(el, target, format, ms) {
    if (reduceMotion) { el.textContent = format(target); return; }
    var t0 = performance.now(), dur = ms || 900;
    (function step(now) {
      var p = Math.min(1, (now - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(target * eased);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = format(target);
    })(t0);
  }

  window.QC = {
    fitCanvas: fitCanvas, onResize: onResize, COLORS: COLORS, MONO: MONO,
    ticks: ticks, fmt: fmt, countUp: countUp, reduceMotion: reduceMotion
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
  /* One fixed canvas behind the entire page: a drifting grid, two slow light
     sources, and a decorative price trace. It parallaxes gently with scroll so
     the page reads as a window onto something continuous rather than a stack
     of panels. */
  function ambient() {
    var cv = document.getElementById('ambient');
    if (!cv) return;
    var t = 0, raf = null, scrollY = 0;

    function draw() {
      var f = fitCanvas(cv), ctx = f.ctx, w = f.w, h = f.h;
      ctx.clearRect(0, 0, w, h);

      // two drifting light sources
      var orbs = [
        { x: w * (0.22 + Math.sin(t * 0.21) * 0.07), y: h * (0.28 + Math.cos(t * 0.17) * 0.09),
          r: Math.max(w, h) * 0.46, c: '34,211,238', a: 0.15 },
        { x: w * (0.80 + Math.cos(t * 0.15) * 0.08), y: h * (0.70 + Math.sin(t * 0.23) * 0.08),
          r: Math.max(w, h) * 0.42, c: '167,139,250', a: 0.13 }
      ];
      orbs.forEach(function (o) {
        var g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, 'rgba(' + o.c + ',' + o.a + ')');
        g.addColorStop(1, 'rgba(' + o.c + ',0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });

      // grid, offset by scroll so it drifts as you move down the page
      var step = 54, off = (scrollY * 0.12) % step;
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(146,178,230,.055)';
      ctx.beginPath();
      for (var x = 0; x <= w; x += step) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, h); }
      for (var y = -step; y <= h + step; y += step) {
        var yy = Math.round(y - off) + .5;
        ctx.moveTo(0, yy); ctx.lineTo(w, yy);
      }
      ctx.stroke();

      // decorative price trace, parallaxed at a slower rate than the grid
      ctx.beginPath();
      var amp = h * 0.11, mid = h * 0.58 - (scrollY * 0.04) % (h * 0.5);
      for (var i = 0; i <= w; i += 4) {
        var p = i / w;
        var v = Math.sin(p * 5.2 + t) * .55 + Math.sin(p * 11.3 - t * 1.7) * .28 + Math.sin(p * 23.1 + t * .6) * .13;
        var py = mid - v * amp;
        if (i === 0) ctx.moveTo(i, py); else ctx.lineTo(i, py);
      }
      var lg = ctx.createLinearGradient(0, 0, w, 0);
      lg.addColorStop(0, 'rgba(34,211,238,0)');
      lg.addColorStop(.38, 'rgba(34,211,238,.26)');
      lg.addColorStop(1, 'rgba(167,139,250,.14)');
      ctx.strokeStyle = lg; ctx.lineWidth = 1.4; ctx.stroke();
    }

    function loop() { t += 0.003; draw(); raf = requestAnimationFrame(loop); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    draw();
    if (!reduceMotion) {
      loop();
      // a hidden tab should not burn frames on decoration
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop(); else if (!raf) loop();
      });
    }

    var ticking = false;
    window.addEventListener('scroll', function () {
      scrollY = window.scrollY;
      if (reduceMotion && !ticking) {          // static mode still tracks the parallax
        ticking = true;
        requestAnimationFrame(function () { ticking = false; draw(); });
      }
    }, { passive: true });

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

  /* ---------- cursor-following glow on cards ---------- */
  function glow() {
    if (reduceMotion || !window.matchMedia('(hover:hover)').matches) return;
    document.addEventListener('pointermove', function (e) {
      var card = e.target.closest('[data-glow]');
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  /* ---------- section headings type themselves on first view ---------- */
  function typeHeaders() {
    var heads = document.querySelectorAll('.sec-title[data-type]');
    if (reduceMotion) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var el = e.target;
        var mark = el.querySelector('.prompt').textContent;
        var full = el.textContent.replace(mark, '').trim();

        // Keep the real text available to screen readers while the glyphs animate in.
        el.setAttribute('aria-label', mark + ' ' + full);
        el.innerHTML = '<span class="prompt">' + mark + '</span> ';
        var tail = document.createTextNode('');
        el.appendChild(tail);

        /* Driven by elapsed time on rAF, not one timeout per character: a
           background tab pauses rAF entirely and throttles timers to ~1s, which
           would otherwise leave the heading stranded empty for half a minute.
           On return, elapsed time has moved on and it completes at once. */
        var t0 = performance.now(), CPS = 38;
        (function tick(now) {
          var shown = Math.floor((now - t0) / 1000 * CPS);
          tail.nodeValue = full.slice(0, shown);
          if (shown < full.length) requestAnimationFrame(tick);
          else tail.nodeValue = full;
        })(t0);
      });
    }, { threshold: .6 });
    heads.forEach(function (h) { io.observe(h); });
  }

  /* ---------- skill chips trace back to the projects that used them ---------- */
  function skillTrace() {
    var chips = document.querySelectorAll('.sk');
    var projects = document.querySelectorAll('.proj');
    if (!chips.length || !projects.length) return;

    function apply(skill) {
      projects.forEach(function (p) {
        if (!skill) { p.classList.remove('is-dim', 'is-hit'); return; }
        var hit = (' ' + (p.dataset.skills || '') + ' ').indexOf(' ' + skill + ' ') > -1;
        p.classList.toggle('is-hit', hit);
        p.classList.toggle('is-dim', !hit);
      });
    }

    var pinned = null;
    chips.forEach(function (chip) {
      var skill = chip.dataset.skill;
      chip.addEventListener('pointerenter', function () { if (!pinned) apply(skill); });
      chip.addEventListener('pointerleave', function () { if (!pinned) apply(null); });
      chip.addEventListener('focus', function () { if (!pinned) apply(skill); });
      chip.addEventListener('blur', function () { if (!pinned) apply(null); });
      // click pins the trace so it survives moving the mouse to the grid
      chip.addEventListener('click', function () {
        var same = pinned === skill;
        pinned = same ? null : skill;
        chips.forEach(function (c) { c.classList.toggle('is-on', !same && c === chip); });
        apply(pinned);
      });
    });
  }

  /* ---------- j / k (and arrows) step between sections ----------
     Position is read from the live scroll offset, but presses are locked out
     until the smooth scroll settles. Without the lock, a second press measures
     mid-flight and skips several sections at once. */
  function keyNav() {
    var locked = false;
    function unlock() { locked = false; }
    var ids = [].map.call(document.querySelectorAll('main > section[id]'), function (s) { return s.id; });
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      var overlay = document.getElementById('termOverlay');
      if (overlay && !overlay.hidden) return;

      var dir = 0;
      if (e.key === 'j' || e.key === 'ArrowDown') dir = 1;
      else if (e.key === 'k' || e.key === 'ArrowUp') dir = -1;
      else return;
      e.preventDefault();
      if (locked) return;

      // section whose top sits nearest the viewport top right now
      var cur = 0, best = Infinity;
      ids.forEach(function (id, i) {
        var d = Math.abs(document.getElementById(id).getBoundingClientRect().top);
        if (d < best) { best = d; cur = i; }
      });

      var next = Math.max(0, Math.min(ids.length - 1, cur + dir));
      if (next === cur) return;

      locked = true;
      document.getElementById(ids[next])
        .scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });

      if ('onscrollend' in window) window.addEventListener('scrollend', unlock, { once: true });
      setTimeout(unlock, 900);   // belt and braces, and the only path when scrollend is missing
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
    runBoot(); ambient(); ticker(); observers();
    anchors(); timeline(); filters(); copyChips(); contactForm(); clock();
    glow(); typeHeaders(); skillTrace(); keyNav();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
