const puppeteer = require('puppeteer-core');
const fs = require('fs');

// Resolve a Chrome binary across Windows / Linux / CI. Prefer an explicit
// CHROME_PATH, fall back to the standard Windows install, then let puppeteer
// use whatever `puppeteer browsers install chrome` put on the runner.
const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const CHROME = CANDIDATES.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });

// This file lives in scripts/, the site lives one level up.
const ROOT = __dirname.replace(/\\/g, '/') + '/..';
const FILE = 'file:///' + ROOT + '/index.html';

const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function ok(c, m) { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); }

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });

  async function load({ rm = false, deadIO = false, seedNoAnim = false, seedClass = null } = {}) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000 });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    if (rm) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    if (seedNoAnim) await page.evaluateOnNewDocument(() => {
      try { localStorage.setItem('noAnim', '1'); } catch (e) {}
    });
    if (seedClass) await page.evaluateOnNewDocument(c => {
      document.addEventListener('DOMContentLoaded', () => { document.body.className = c; });
    }, seedClass);
    if (deadIO) await page.evaluateOnNewDocument(() => {
      window.IntersectionObserver = class {
        constructor() {} observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
      };
    });
    await page.goto(FILE, { waitUntil: 'domcontentloaded' });
    await sleep(5500);
    const data = await page.evaluate(() => {
      const op = s => { const e = document.querySelector(s); return e ? +getComputedStyle(e).opacity : null; };
      return {
        hero: op('.hero-name'),
        reveal: op('.reveal'),
        counters: Array.from(document.querySelectorAll('[data-count]')).map(e => e.textContent),
        // Any element still stuck invisible, anywhere on the page.
        stuck: Array.from(document.querySelectorAll('.reveal'))
          .filter(e => +getComputedStyle(e).opacity < .99).length,
        textLen: (document.body.innerText || '').replace(/\s+/g, '').length
      };
    });
    await page.close();
    return { ...data, errs };
  }

  console.log('\n--- REGRESSION: no content may ever be blank ---');
  const expected = ['7', '4', '28', '216'];

  let r = await load();
  ok(r.errs.length === 0, 'baseline: no JS errors');
  ok(r.counters.join() === expected.join(), 'baseline: counters animate ' + r.counters);
  ok(r.reveal > .99 && r.stuck === 0, 'baseline: nothing stuck invisible');

  r = await load({ rm: true });
  ok(r.counters.join() === expected.join(), 'reduced-motion: counters correct');
  ok(r.stuck === 0, 'reduced-motion: no invisible .reveal blocks');

  r = await load({ seedNoAnim: true });
  ok(r.counters.join() === expected.join(), 'noAnim kill switch: counters correct');
  ok(r.stuck === 0, 'noAnim kill switch: no invisible .reveal blocks');

  r = await load({ seedClass: 'no-anim' });
  ok(r.stuck === 0, 'body.no-anim class: no invisible blocks');

  r = await load({ deadIO: true });
  ok(r.counters.join() === expected.join(), 'dead observer: counters rescued by failsafe');
  ok(r.reveal > .99, 'dead observer: motion failsafe revealed content');

  r = await load({ deadIO: true, rm: true });
  ok(r.counters.join() === expected.join(), 'dead observer + reduced-motion: counters rescued');
  ok(r.stuck === 0, 'dead observer + reduced-motion: no invisible blocks');

  console.log('\n--- no-anim wiring ---');
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('noAnim', '1'); } catch (e) {} });
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  const wiring = await page.evaluate(() => {
    // `const motionOff` in a classic script does NOT attach to window, so
    // read it off the <html> class the flag is supposed to drive instead.
    // Asserting window.motionOff would be asserting a false premise.
    const html = document.documentElement.classList.contains('no-anim');
    return {
      html,
      body: document.body.classList.contains('no-anim'),
      // The observable consequence that actually matters.
      revealStuck: Array.from(document.querySelectorAll('.reveal'))
        .filter(e => +getComputedStyle(e).opacity < .99).length
    };
  });
  ok(wiring.html === true, 'noAnim reflects onto <html>.no-anim (drives the CSS rescue)');
  ok(wiring.revealStuck === 0, 'noAnim: flag and stylesheet agree, nothing invisible');
  await page.close();

  console.log('\n--- CSS sanity: no malformed selectors ---');
  const p2 = await browser.newPage();
  await p2.goto(FILE, { waitUntil: 'domcontentloaded' });
  const sheets = await p2.evaluate(() => {
    const bad = [];
    for (const s of document.styleSheets) {
      let rules; try { rules = s.cssRules; } catch (e) { continue; }
      for (const r of rules) {
        if (r.style && r.style.length === 0 && r.selectorText && /,,\s|,\s*,|,\s*$/.test(r.selectorText)) {
          bad.push(r.selectorText);
        }
      }
    }
    return { bad, total: document.styleSheets.length };
  });
  ok(sheets.bad.length === 0, 'no malformed comma selectors ' + JSON.stringify(sheets.bad));
  await p2.close();

  await browser.close();
  console.log('\n' + (fail === 0 ? 'ALL GREEN' : 'RED') + ' — ' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})();
