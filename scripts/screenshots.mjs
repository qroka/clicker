import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const SP = process.env.SP || '.';
const URL = 'http://localhost:4175/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 402, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = ':root{--sat:0px!important;--sab:34px!important}'; document.head.appendChild(st); }));
let page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = (n) => page.screenshot({ path: `${SP}/shot-${n}.png` });

await page.goto(URL);
await page.waitForTimeout(800);
await shot('01-prologue');
// Пролистываем диалог
for (let i = 0; i < 20; i++) { const d = await page.$('.dialogue'); if (!d) break; await page.click('.dialogue .dnext button'); await page.waitForTimeout(150); }
for (let i = 0; i < 40; i++) { await page.mouse.click(195, 430); await page.waitForTimeout(30); }
await page.waitForTimeout(100);
await shot('02-shop');
await page.click('.tab:nth-child(2)');
await page.waitForTimeout(300);
await shot('03-workshop');

// Середина игры
const save = readFileSync(`${SP}/save-d6.json`, 'utf8');
await page.close();
await ctx.addInitScript((s) => { if (sessionStorage.getItem('injected')) return; sessionStorage.setItem('injected', '1'); const o = JSON.parse(s); const d = Date.now() - 3 * 3600e3 - o.lastTick; o.lastTick += d; o.runStart += d; o.nextWispAt = Date.now() + 5000; for (const b of Object.values(o.buffs)) b.until += d; for (const e of o.expeditions) { e.start += d; e.end += d; } o.expeditions = o.expeditions.slice(0, 1); o.seenChapter = o.chapter; o.prologueSeen = true; localStorage.setItem('alchemist-guild-save-v1', JSON.stringify(o)); }, save);
page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(URL);
await page.waitForTimeout(800);
await shot('04-mid-shop');
for (let i = 0; i < 5; i++) { if (!(await page.$('.modal, .dialogue'))) break; await page.click('.modal .cta, .dialogue .dnext button'); await page.waitForTimeout(200); }
for (let i = 0; i < 30; i++) { await page.mouse.click(195, 430); await page.waitForTimeout(25); }
await shot('05-mid-shop-tap');
await page.click('.tab:nth-child(2)'); await page.waitForTimeout(300); await shot('06-mid-workshop');
await page.click('.tab:nth-child(3)'); await page.waitForTimeout(300); await shot('07-guild');
await page.click('.tile'); await page.waitForTimeout(400); await shot('08-hero');
await page.click('.sheet-head .close'); await page.waitForTimeout(200);
await page.click('.tabs2 button:nth-child(2)'); await page.waitForTimeout(300); await shot('09-expeditions');
const empty = await page.$('text=Отправить экспедицию'); if (empty) { await empty.click(); await page.waitForTimeout(400); await shot('10-exp-planner'); await page.click('.sheet-head .close'); }
await page.click('.tab:nth-child(4)'); await page.waitForTimeout(300); await shot('11-lab');
await page.click('.tab:nth-child(5)'); await page.waitForTimeout(300); await shot('12-knowledge');
await page.evaluate(() => document.querySelector('.main').scrollTo(0, 700)); await page.waitForTimeout(200); await shot('13-knowledge2');
await page.click('.topbar .icon-btn'); await page.waitForTimeout(400); await shot('14-daily');
await page.click('.sheet-head .close'); await page.waitForTimeout(200);
await page.click('.topbar .icon-btn:last-child'); await page.waitForTimeout(400); await shot('15-menu');
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
