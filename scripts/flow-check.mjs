// Прогон ключевых сценариев в браузере: ищем ошибки в рантайме.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const SP = process.env.SP || '.';
const PORT = process.env.PORT || 4175;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const save = readFileSync(`${SP}/save-d6.json`, 'utf8');
await ctx.addInitScript((s) => {
  if (sessionStorage.getItem('injected')) return;
  sessionStorage.setItem('injected', '1');
  const o = JSON.parse(s);
  const d = Date.now() - o.lastTick;
  o.lastTick += d; o.runStart += d; o.nextWispAt = Date.now() + 1500;
  for (const b of Object.values(o.buffs)) b.until += d;
  o.expeditions = [];
  o.seenChapter = o.chapter; o.prologueSeen = true;
  localStorage.setItem('alchemist-guild-save-v1', JSON.stringify(o));
}, save);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${PORT}/`);
await page.waitForTimeout(2500);
const shot = (n) => page.screenshot({ path: `${SP}/flow-${n}.png` });
// Искра
const wisp = await page.$('.wisp');
if (wisp) { const b = await wisp.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(300); await shot('wisp'); } else console.log('no wisp');
// Экспедиция
await page.click('.tab:nth-child(3)');
await page.click('.seg button:nth-child(2)');
await page.click('.exp-slot.empty');
await page.waitForTimeout(400);
await shot('planner');
await page.click('.sheet .btn.teal');
await page.waitForTimeout(300);
console.log('expeditions:', await page.$$eval('.exp-slot:not(.empty)', (x) => x.length));
// Варка: неудача и известный рецепт
await page.click('.tab:nth-child(4)');
await page.waitForTimeout(200);
const ings = await page.$$('.ing:not(.empty)');
for (let i = 0; i < 3; i++) await ings[Math.min(i, ings.length - 1)].click();
await page.click('.btn.teal.block');
await page.waitForTimeout(300);
console.log('brew msg:', await page.$eval('.card .small[style*="center"]', (e) => e.textContent).catch(() => '—'));
await shot('brew');
await page.click('text=Перегнать лишнее в эссенцию');
await page.click('.ing:not(.empty) >> nth=0');
console.log('distill msg:', await page.$eval('.card .small[style*="center"]', (e) => e.textContent).catch(() => '—'));
// Трансмутация
await page.click('.tab:nth-child(5)');
await page.click('.stone-hero .btn');
await page.click('.stone-hero .btn.violet');
await page.waitForTimeout(500);
await shot('transmute');
for (let i = 0; i < 10; i++) { if (!(await page.$('.modal, .dialogue'))) break; await page.click('.modal .btn, .dialogue .dnext button'); await page.waitForTimeout(200); }
console.log('gold after:', await page.$eval('.gold-amount', (e) => e.textContent));
// Меню и достижения
await page.click('.topbar .icon-btn:last-child');
await page.click('.sheet .btn.ghost.grow >> nth=0');
await page.waitForTimeout(300);
await shot('ach');
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
