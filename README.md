# Akinbo Adetayo — Portfolio

Personal portfolio site: **Data Analyst & Web Developer**, based in Nigeria.

Live: **[twinsakinbo-bot.github.io](https://twinsakinbo-bot.github.io)**

## Stack

No framework, no build step, no runtime dependencies. It is four files and a
stylesheet, which is why it loads instantly and never breaks.

| File | What it is |
| --- | --- |
| `index.html` | The whole page — markup plus two inline scripts |
| `styles.css` | Everything visual, custom properties for the light/dark themes |
| `pic.webp` / `pic.avif` / `pic-opt.png` | The portrait, in three formats |
| `scripts/regress.js` | Headless-Chrome regression suite |

Nothing is minified or bundled on purpose. The page is small enough to read
end to end, and the source you commit is exactly what the browser gets.

## Local preview

```bash
# any static server works
npx serve .
# or just open index.html — there is no build step
```

## Tests

The regression suite drives real Chrome and asserts the one thing that
actually matters for a portfolio: **content is never blank**. A `.reveal`
element that never fades in is invisible copy, and that failure is invisible
in a screenshot review.

```bash
npm install --no-save puppeteer-core
npm test
```

It covers the failure modes that have actually bitten this site before:

- counters animating to the wrong values (7 projects, 4 live sites, 28, 216)
- `.reveal` blocks left at `opacity: 0` when `IntersectionObserver` never fires
- the same under `prefers-reduced-motion` and the `noAnim` kill switch
- the `noAnim` flag failing to reach `<html>`, which is what drives the CSS rescue
- malformed comma-separated selectors silently killing a whole CSS rule block

> `regress.js` simulates a dead `IntersectionObserver` by replacing it with a
> no-op class. That is deliberate — the page has a failsafe path that must be
> exercised, not assumed.

## Images

`pic.png` is the 2.2 MB original and is gitignored. The committed derivatives
are generated from it:

```bash
npm install sharp
npm run images
```

`index.html` serves them through `<picture>`, so AVIF gets 101 KB, WebP gets
133 KB, and anything ancient falls back to a quantised PNG. That's **94% less
weight** on the wire than shipping the raw PNG.

## Deploying

Push to `main`. The `Deploy to GitHub Pages` workflow runs the regression
suite as a gate, then publishes the repo root as a Pages artifact. If a test
goes red, the live site is left untouched.

## Accessibility & polish

- Light/dark theme set before first paint, so there is no white flash on load
- `prefers-reduced-motion` honoured throughout, plus a `noAnim` kill switch
- Ambient canvas animation pauses off-screen and degrades to nothing if canvas
  is unavailable
- Semantic landmarks, labelled controls, visible focus rings
