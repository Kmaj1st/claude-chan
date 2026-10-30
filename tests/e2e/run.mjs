// Headless browser asserts: mount, drag, clamp, persist, tool-call path.
// Drives the system Edge/Chrome through puppeteer-core (no browser download).
import { existsSync } from 'node:fs';
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';

const CANDIDATES = [
 process.env.CHROME_PATH,
 'C:/Program Files/Google/Chrome/Application/chrome.exe',
 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
 '/usr/bin/google-chrome',
 '/usr/bin/chromium',
];
const executablePath = CANDIDATES.find((p) => p && existsSync(p));
if (!executablePath) {
 console.error('e2e: no Chrome/Edge found; set CHROME_PATH');
 process.exit(2);
}

let failures = 0;
const check = (name, ok, extra = '') => {
 console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' ' + extra));
 if (!ok) failures++;
};

const server = await createServer({ configFile: 'vite.config.ts', logLevel: 'error', server: { port: 5199 } });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });

const rect = (page) =>
 page.evaluate(() => {
 const s = document.querySelector('claude-chan-host').shadowRoot.querySelector('.stage');
 const r = s.getBoundingClientRect();
 return { x: r.left, y: r.top, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight };
 });

const drag = async (page, r, dx, dy) => {
 await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2);
 await page.mouse.down();
 await page.mouse.move(r.x + r.w / 2 + dx, r.y + r.h / 2 + dy, { steps: 5 });
 await page.mouse.up();
};

try {
 const page = await browser.newPage();
 await page.setViewport({ width: 900, height: 700 });
 const errors = [];
 page.on('pageerror', (e) => errors.push(String(e)));
 await page.goto(url, { waitUntil: 'networkidle0' });
 await page.waitForSelector('claude-chan-host');

 const r0 = await rect(page);
 check('mounts bottom-left', r0.x < 100 && r0.y + r0.h > r0.vh - 100, JSON.stringify(r0));

 const seen = await page.evaluate(async () => {
 const el = document.getElementById('cc');
 const out = [];
 el.controller.on('motionstart', (d) => out.push(JSON.stringify(d)));
 el.controller.act({ motion: 'wave', priority: 'high' });
 await new Promise((r) => setTimeout(r, 300));
 return out;
 });
 check('act() emits motionstart for wave', seen.some((s) => s.includes('wave')), JSON.stringify(seen));

 const bubble = await page.evaluate(async () => {
 document.getElementById('cc').controller.say('<b>hi</b>');
 await new Promise((r) => setTimeout(r, 100));
 const b = document.querySelector('claude-chan-host').shadowRoot.querySelector('.bubble');
 return { text: b.textContent, html: b.innerHTML.includes('<b>') };
 });
 check('bubble uses textContent only', bubble.text.includes('<b>hi</b>') && !bubble.html, JSON.stringify(bubble));

 await drag(page, r0, 200, -150);
 const r1 = await rect(page);
 check('drag moves the mascot', Math.abs(r1.x - r0.x - 200) < 3 && Math.abs(r1.y - r0.y + 150) < 3, JSON.stringify(r1));

 await drag(page, r1, -900, -900);
 const r2 = await rect(page);
 check('drag clamps to viewport', r2.x >= 0 && r2.y >= 0 && r2.x < 50 && r2.y < 50, JSON.stringify(r2));

 await drag(page, r2, 120, 90);
 const r3 = await rect(page);
 await page.reload({ waitUntil: 'networkidle0' });
 await page.waitForSelector('claude-chan-host');
 const r4 = await rect(page);
 check('position persists after reload', Math.abs(r4.x - r3.x) < 2 && Math.abs(r4.y - r3.y) < 2, JSON.stringify([r3, r4]));

 await page.setViewport({ width: 300, height: 300 });
 await new Promise((r) => setTimeout(r, 200));
 const r5 = await rect(page);
 check('resize keeps it inside', r5.x + r5.w <= 300.5 && r5.y + r5.h <= 300.5, JSON.stringify(r5));

 check('no page errors', errors.length === 0, errors.join(' | '));
} finally {
 await browser.close();
 await server.close();
}
console.log(failures ? failures + ' e2e check(s) failed' : 'e2e: all checks passed');
process.exit(failures ? 1 : 0);
