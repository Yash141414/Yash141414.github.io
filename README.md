# yashchheda.dev — portfolio

A single-page portfolio built around two things a PDF cannot do: a **live Black–Scholes
engine** and a **research report you can scrub**. No framework, no build step, no
dependencies — open `index.html` and it runs.

## Run it locally

```bash
python -m http.server 8000
# then open http://127.0.0.1:8000
```

Opening `index.html` directly from disk also works, though the résumé download behaves
better over HTTP.

## Files

```
index.html          all markup and copy
css/style.css       design tokens, layout, responsive, reduced-motion
js/main.js          shared canvas helpers (window.QC), nav, reveals, form, clock
js/options.js       Black–Scholes engine + payoff / Greek charts
js/research.js      seeded equity curve, drawdown, cost-filter demo
js/terminal.js      the ` terminal overlay
assets/             résumé PDF
```

`js/main.js` must load first — it defines `window.QC`, which the other three use.
All four are `defer`red, which preserves order.

## Things you need to edit

| What | Where |
|---|---|
| **Contact form key** | `WEB3FORMS_KEY` at the top of `js/main.js`. Get a free key at [web3forms.com](https://web3forms.com) and paste it in. Until you do, the form tells visitors to email you directly instead of silently failing. |
| **Hobbies** | `index.html`, `#now` section — four `<li class="todo">` placeholders. |
| **"Currently"** | Same section. Keep it current; it is the most-read part of any portfolio. |

## Deploying to GitHub Pages

```bash
git init
git add .
git commit -m "portfolio"
git branch -M main
git remote add origin https://github.com/Yash141414/<repo>.git
git push -u origin main
```

Then **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.
It goes live at `https://yash141414.github.io/<repo>/` in a minute or two.
If you name the repo `Yash141414.github.io`, that becomes the URL itself.

## Honesty notes

Two numbers on this site are generated rather than measured, and both say so on the page:

- The **equity curve** is produced by a seeded random process calibrated to the
  Sharpe 1.8 / 60% hit-ratio figures reported for the Ikiquant backtests. The stat
  tiles are computed from the curve you are actually looking at, so the chart and the
  numbers can never disagree. It is labelled an illustrative reconstruction, not a
  track record.
- The **cost-filter** bars are synthetic candidate edges, labelled as such.

Keep those disclaimers if you change the charts.

## Verification

The pricing engine is checked against published Black–Scholes values
(S=100, K=100, T=1, r=5%, σ=20% → call 10.4506, put 5.5735, Δ 0.6368, Γ 0.018762),
put–call parity, and the deep-ITM/OTM and expiry edge cases. The terminal's `greeks`
command calls the same `window.QC.bs` the charts use, so the two can be cross-checked
against each other by eye.
