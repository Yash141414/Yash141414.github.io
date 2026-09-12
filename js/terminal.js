/* =============================================================
   terminal.js — the easter egg. Backtick or ~ opens it.
   ============================================================= */
(function () {
  'use strict';

  var overlay, body, input, history = [], hIdx = -1;

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function write(html, cls) {
    var div = document.createElement('div');
    div.className = 't-out' + (cls ? ' ' + cls : '');
    div.innerHTML = html;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }
  function echo(cmd) {
    var div = document.createElement('div');
    div.className = 't-cmd';
    div.innerHTML = '<span class="prompt">guest@yc:~$</span> ' + esc(cmd);
    body.appendChild(div);
  }

  var COMMANDS = {
    help: function () {
      write([
        '<span class="t-hi">available commands</span>',
        '  <span class="t-key">whoami</span>      who you are talking to',
        '  <span class="t-key">experience</span>  roles, most recent first',
        '  <span class="t-key">projects</span>    what I have built  (alias: ls)',
        '  <span class="t-key">skills</span>      the stack',
        '  <span class="t-key">education</span>   degree and certification',
        '  <span class="t-key">now</span>         what I am working on today',
        '  <span class="t-key">greeks</span>      greeks S K days iv   e.g. greeks 100 100 30 0.2',
        '  <span class="t-key">cat resume</span>  download the PDF',
        '  <span class="t-key">contact</span>     how to reach me',
        '  <span class="t-key">goto</span>        goto lab | research | projects | contact',
        '  <span class="t-key">clear</span>       clear the screen',
        '  <span class="t-key">exit</span>        close this terminal'
      ].join('\n'));
    },

    whoami: function () {
      write([
        '<span class="t-hi">Yash Chheda</span> — quantitative researcher / AI engineer',
        'Mumbai &amp; Bangalore, India',
        '',
        'Derivatives research, NSE F&amp;O backtesting, and the data and inference',
        'infrastructure underneath it. I care most about whether an effect survives',
        'real transaction costs — most do not, and finding that out early is the job.'
      ].join('\n'));
    },

    experience: function () {
      write([
        '<span class="t-ok">Dec 2025 – Apr 2026</span>  Nxtgen AI Pvt Ltd.        <span class="t-key">AI Engineer</span>',
        '   18 model/hardware configs benchmarked · 4x VRAM cut via quantization',
        '   Little\u2019s Law load modelling · PostgreSQL validation of pipeline data',
        '',
        '<span class="t-ok">May 2025 – Nov 2025</span>  Aurus Alpha Ventures LLP  <span class="t-key">Derivatives Researcher</span>',
        '   8+ strategies validated net of STT/GST/slippage on 2y NSE F&amp;O data',
        '   t-tests · regime splits · bootstrap · 8+ internal research notes',
        '',
        '<span class="t-ok">Apr 2024 – Dec 2024</span>  Ikiquant Technologies     <span class="t-key">Quantitative Analyst</span>',
        '   8+ backtested options strategies (Sharpe 1.8, 60% hit ratio)',
        '   10+ systematic indicators, +15% signal accuracy · 5+ tick pipelines'
      ].join('\n'));
    },

    projects: function () {
      write([
        'drwxr-xr-x  <span class="t-key">black_scholes_engine/</span>   real-time Greeks, 5+ payoff structures',
        'drwxr-xr-x  <span class="t-key">vrp_asymmetry_framework/</span> 4-stage validation, fail-fast cost gate',
        'drwxr-xr-x  <span class="t-key">strategy_validation/</span>     8+ strategies vs real costs',
        'drwxr-xr-x  <span class="t-key">inference_benchmarks/</span>    18 configs, H100 / L40S / Xeon',
        'drwxr-xr-x  <span class="t-key">quantization_sweep/</span>      FP6 / Q6 / Q4 across 6 models',
        'drwxr-xr-x  <span class="t-key">tick_pipelines/</span>          live NSE ingestion + consistency checks',
        '',
        'tip: the Black-Scholes engine is running on this page — type <span class="t-key">goto lab</span>.'
      ].join('\n'));
    },

    skills: function () {
      write([
        '<span class="t-hi">data &amp; analytics</span>  SQL/PostgreSQL · Python (pandas, numpy, scipy, statsmodels)',
        '                    hypothesis testing (t-test, bootstrap, regime) · data QA',
        '<span class="t-hi">tools &amp; systems</span>    Git · Streamlit · Tableau · FastAPI · WebSocket',
        '                    TensorRT-LLM · LangChain',
        '<span class="t-hi">domain</span>             NSE F&amp;O · Greeks &amp; vol surface · backtesting methodology'
      ].join('\n'));
    },

    education: function () {
      write([
        'B.Sc. Data Science &amp; Business Analytics — HSNC University, Mumbai (2022–2025)',
        'GPA <span class="t-ok">9.45 / 10</span>',
        '',
        'NISM-Series-VIII Equity Derivatives (May 2024)',
        '  exchange-traded derivatives regulation, contract specs, risk frameworks'
      ].join('\n'));
    },

    now: function () {
      write([
        '<span class="t-ok">[active]</span>  Intraday NIFTY options research — out-of-sample harness first,',
        '           conclusions second.',
        '<span class="t-ok">[active]</span>  Vectorised BankNifty short-strangle backtest, optimised for',
        '           full-history runtime.',
        '<span class="t-hi">[reading]</span> Microstructure and VRP literature — mostly to see which',
        '           published effects survive Indian transaction costs.',
        '<span class="t-hi">[building]</span> This website.'
      ].join('\n'));
    },

    contact: function () {
      write([
        'email     <span class="t-key">yash.chheda14@gmail.com</span>',
        'phone     <span class="t-key">+91 97690 54481</span>',
        'linkedin  <a href="https://linkedin.com/in/yash-chheda14" target="_blank" rel="noopener">linkedin.com/in/yash-chheda14</a>',
        'github    <a href="https://github.com/Yash141414" target="_blank" rel="noopener">github.com/Yash141414</a>'
      ].join('\n'));
    },

    clear: function () { body.innerHTML = ''; },

    exit: function () { close(); },

    sudo: function (args) {
      write(args.join(' ') === 'rm -rf /'
        ? 'Nice try. This is a portfolio, not a production box.'
        : 'guest is not in the sudoers file. This incident has been logged. (It has not.)', 't-err');
    }
  };

  COMMANDS.ls = COMMANDS.projects;
  COMMANDS.about = COMMANDS.whoami;

  /* ---- commands that need arguments ---- */

  function cmdCat(args) {
    var f = (args[0] || '').toLowerCase();
    if (f === 'resume' || f === 'resume.pdf' || f === 'cv') {
      write('opening <span class="t-key">Yash_Chheda_Resume.pdf</span> …');
      window.open('assets/Yash_Chheda_Resume.pdf', '_blank', 'noopener');
    } else if (!f) {
      write('usage: cat resume', 't-err');
    } else {
      write('cat: ' + esc(f) + ': No such file or directory', 't-err');
    }
  }

  function cmdGoto(args) {
    var target = (args[0] || '').toLowerCase();
    var map = { lab: 'lab', options: 'lab', research: 'research', projects: 'projects',
                contact: 'contact', now: 'now', experience: 'experience', top: 'hero' };
    var id = map[target];
    if (!id) { write('usage: goto lab | research | projects | experience | now | contact', 't-err'); return; }
    close();
    document.getElementById(id).scrollIntoView({ behavior: window.QC.reduceMotion ? 'auto' : 'smooth' });
  }

  /* Reuses the exact pricing engine that drives the Options Lab. */
  function cmdGreeks(args) {
    if (args.length < 4) {
      write('usage: greeks &lt;spot&gt; &lt;strike&gt; &lt;days&gt; &lt;iv&gt;\n   eg: greeks 100 100 30 0.2   (iv as a decimal, or 20 for 20%)', 't-err');
      return;
    }
    var S = parseFloat(args[0]), K = parseFloat(args[1]), days = parseFloat(args[2]), iv = parseFloat(args[3]);
    if (![S, K, days, iv].every(isFinite) || S <= 0 || K <= 0 || days <= 0 || iv <= 0) {
      write('all four arguments must be positive numbers', 't-err');
      return;
    }
    if (iv > 3) iv = iv / 100;                    // accept "20" as 20%
    var r = 0.065, T = days / 365;
    var c = window.QC.bs('call', S, K, T, r, iv);
    var p = window.QC.bs('put', S, K, T, r, iv);
    var f = function (v, d) { return (v >= 0 ? ' ' : '') + v.toFixed(d); };
    write([
      'S=' + S + '  K=' + K + '  T=' + days + 'd  IV=' + (iv * 100).toFixed(1) + '%  r=6.5%',
      '',
      '            <span class="t-key">call</span>        <span class="t-key">put</span>',
      'price    ' + f(c.price, 4) + '    ' + f(p.price, 4),
      'delta    ' + f(c.delta, 4) + '    ' + f(p.delta, 4),
      'gamma    ' + f(c.gamma, 4) + '    ' + f(p.gamma, 4),
      'vega     ' + f(c.vega, 4) + '    ' + f(p.vega, 4) + '   per 1 vol pt',
      'theta    ' + f(c.theta, 4) + '    ' + f(p.theta, 4) + '   per day',
      'rho      ' + f(c.rho, 4) + '    ' + f(p.rho, 4) + '   per 1% rate'
    ].join('\n'));
  }

  /* ---- dispatch ---- */

  function run(line) {
    var parts = line.trim().split(/\s+/);
    var cmd = (parts.shift() || '').toLowerCase();
    if (!cmd) return;
    if (cmd === 'cat') return cmdCat(parts);
    if (cmd === 'goto') return cmdGoto(parts);
    if (cmd === 'greeks' || cmd === 'bs') return cmdGreeks(parts);
    if (COMMANDS[cmd]) return COMMANDS[cmd](parts);
    write('command not found: ' + esc(cmd) + " — try <span class=\"t-key\">help</span>", 't-err');
  }

  var NAMES = ['help', 'whoami', 'experience', 'projects', 'skills', 'education', 'now',
               'greeks', 'cat resume', 'contact', 'goto', 'clear', 'exit', 'ls'];

  /* ---- open / close ---- */

  function open() {
    overlay.hidden = false;
    if (!body.childElementCount) {
      write('<span class="t-hi">yc-shell 1.0</span> — type <span class="t-key">help</span> to see what is here.\n' +
            'Everything below is real content from the page, not a canned transcript.');
    }
    setTimeout(function () { input.focus(); }, 30);
  }
  function close() {
    overlay.hidden = true;
    input.blur();
  }

  function init() {
    overlay = document.getElementById('termOverlay');
    if (!overlay) return;
    body = document.getElementById('termBody');
    input = document.getElementById('termInput');

    document.querySelectorAll('[data-open-terminal]').forEach(function (b) {
      b.addEventListener('click', open);
    });
    document.getElementById('termClose').addEventListener('click', close);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });

    document.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if ((e.key === '`' || e.key === '~') && !typing) { e.preventDefault(); overlay.hidden ? open() : close(); }
      if (e.key === 'Escape' && !overlay.hidden) close();
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var line = input.value;
        if (line.trim()) { history.push(line); hIdx = history.length; }
        echo(line); input.value = ''; run(line);
        body.scrollTop = body.scrollHeight;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (hIdx > 0) { hIdx--; input.value = history[hIdx]; }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (hIdx < history.length - 1) { hIdx++; input.value = history[hIdx]; }
        else { hIdx = history.length; input.value = ''; }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        var v = input.value.toLowerCase();
        var hit = NAMES.filter(function (n) { return n.indexOf(v) === 0; });
        if (hit.length === 1) input.value = hit[0] + ' ';
        else if (hit.length > 1) write(hit.join('   '));
      }
    });

    overlay.addEventListener('click', function (e) {
      if (e.target.tagName !== 'A') input.focus();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
