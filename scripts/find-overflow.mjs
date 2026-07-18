import puppeteer from 'puppeteer';

const URL = process.argv[2] || 'http://localhost:3000/';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 375, height: 812, isMobile: true, deviceScaleFactor: 2 });
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));

const result = await page.evaluate(() => {
  const docW = document.documentElement.clientWidth;
  const scrollW = document.documentElement.scrollWidth;
  const offenders = [];
  const all = document.querySelectorAll('*');
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.right > docW + 1 || r.left < -1) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.toString ? el.className.toString() : '').slice(0, 120),
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
      });
    }
  }
  // Keep only the widest / most-overflowing, dedupe-ish
  offenders.sort((a, b) => (b.right - a.right));
  return { docW, scrollW, overflow: scrollW - docW, offenders: offenders.slice(0, 25) };
});

console.log('viewport clientWidth:', result.docW);
console.log('document scrollWidth:', result.scrollW);
console.log('horizontal overflow (px):', result.overflow);
console.log('--- elements extending past right edge (sorted by right):');
for (const o of result.offenders) {
  console.log(`  right=${o.right} left=${o.left} w=${o.width}  <${o.tag} class="${o.cls}">`);
}

await browser.close();
