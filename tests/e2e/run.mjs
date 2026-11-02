// Headless browser asserts: mount, free drag (mouse, touch, pen, keyboard), click vs drag, clamp, persist,
// resize re-clamp, dock modes, postMessage position commands, tool-call path.
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

 const remount = await page.evaluate(async () => {
 document.getElementById('cc').setAttribute('size', '100');
 await new Promise((r) => setTimeout(r, 300));
 return {
 hosts: document.querySelectorAll('claude-chan-host').length,
 hasController: !!document.getElementById('cc').controller,
 };
 });
 const r6 = await rect(page);
 check('size attribute change remounts once', remount.hosts === 1 && remount.hasController && Math.abs(r6.h - 100) < 2, JSON.stringify([remount, r6]));

 const side = (vw) => page.evaluate(async (w) => {
 document.getElementById('cc').controller.say('hello');
 await new Promise((r) => setTimeout(r, 100));
 return document.querySelector('claude-chan-host').shadowRoot.querySelector('.bubble').dataset.side;
 }, vw);
 const sideNarrow = await side(300);
 await page.setViewport({ width: 1200, height: 700 });
 await new Promise((r) => setTimeout(r, 200));
 const sideWide = await side(1200);
 check('bubble flips left when no room on the right', sideNarrow === 'left' && sideWide === 'right', JSON.stringify([sideNarrow, sideWide]));

 // Sprite renderer: every motion and expression shows a loaded image, lazily, without moving the stage.
 await page.setViewport({ width: 900, height: 700 });
 await page.reload({ waitUntil: 'networkidle0' });
 await page.waitForSelector('claude-chan-host');
 const sprite = await page.evaluate(async () => {
 const el = document.getElementById('cc');
 const stage = () => document.querySelector('claude-chan-host').shadowRoot.querySelector('.stage');
 const imgs = () => Array.from(stage().querySelectorAll('img'));
 const box = () => { const r = stage().getBoundingClientRect(); return [r.left, r.top, r.width, r.height].join(','); };
 const before = { count: imgs().length, box: box() };
 const names = ['idle', 'wave', 'nod', 'shake_head', 'think', 'happy', 'surprised', 'bow', 'cheer', 'sleepy', 'typing', 'tea_serve', 'pout', 'wink', 'point'];
 const exprs = ['neutral', 'smile', 'sad', 'angry', 'blush', 'surprised'];
 const failed = [];
 const boxes = new Set([before.box]);
 const wait = (ms) => new Promise((r) => setTimeout(r, ms));
 for (const m of names) {
 el.controller.act({ motion: m, priority: 'urgent' });
 await wait(450);
 const shown = imgs().filter((i) => Number(i.style.opacity) > 0.5 && i.naturalWidth > 0);
 if (shown.length < 1) failed.push('motion ' + m);
 boxes.add(box());
 }
 for (const x of exprs) {
 el.controller.stop();
 el.controller.act({ expression: x, duration: 5000 });
 await wait(450);
 const shown = imgs().filter((i) => Number(i.style.opacity) > 0.5 && i.naturalWidth > 0);
 if (shown.length < 1) failed.push('expression ' + x);
 boxes.add(box());
 }
 return { before, after: imgs().length, broken: imgs().filter((i) => i.naturalWidth === 0).length, failed, boxes: boxes.size };
 });
 check('sprite renderer is active and loads poses lazily', sprite.before.count >= 1 && sprite.before.count <= 3 && sprite.after > sprite.before.count, JSON.stringify(sprite));
 check('every motion and expression shows a loaded sprite', sprite.failed.length === 0 && sprite.broken === 0, JSON.stringify(sprite));
 check('sprite poses never change the stage box (no layout shift)', sprite.boxes === 1, JSON.stringify(sprite));

 // Free dragging over the full viewport (docs/API.md, Position and dragging).
 await page.setViewport({ width: 900, height: 700 });
 await page.evaluate(() => localStorage.clear());
 await page.reload({ waitUntil: 'networkidle0' });
 await page.waitForSelector('claude-chan-host');
 const pos = () => page.evaluate(() => document.getElementById('cc').getPosition());
 const home = await rect(page);

 const clicks = await page.evaluate(() => {
 window.__ccClicks = 0;
 document.getElementById('cc').addEventListener('click', () => { window.__ccClicks++; });
 return 0;
 });
 await page.mouse.move(home.x + home.w / 2, home.y + home.h / 2);
 await page.mouse.down();
 await page.mouse.move(home.x + home.w / 2 + 2, home.y + home.h / 2 + 1);
 await page.mouse.up();
 const afterClick = await page.evaluate(() => window.__ccClicks);
 const rClick = await rect(page);
 await drag(page, home, 150, -120);
 const afterDrag = await page.evaluate(() => window.__ccClicks);
 check('a short press is a click and does not move; a drag moves and is not a click',
 clicks === 0 && afterClick === 1 && rClick.x === home.x && rClick.y === home.y && afterDrag === 1, JSON.stringify({ afterClick, afterDrag, rClick, home }));

 const p1 = await pos();
 check('getPosition reports a free spot as px and fractions', p1.free === true && p1.dock === 'free' && p1.fx > 0 && p1.fx < 1 && p1.fy > 0 && p1.fy < 1, JSON.stringify(p1));

 await drag(page, await rect(page), 5000, 5000);
 const rEdge = await rect(page);
 check('drag clamps with the 8 px margin', Math.abs(rEdge.x + rEdge.w - (rEdge.vw - 8)) < 1.5 && Math.abs(rEdge.y + rEdge.h - (rEdge.vh - 8)) < 1.5, JSON.stringify(rEdge));

 // Fractions survive another window size: bottom-right stays bottom-right after reload in a bigger window.
 await page.setViewport({ width: 1200, height: 800 });
 await page.reload({ waitUntil: 'networkidle0' });
 await page.waitForSelector('claude-chan-host');
 const rBig = await rect(page);
 check('saved spot is a fraction: bottom-right survives a reload in a bigger window',
 Math.abs(rBig.x + rBig.w - (rBig.vw - 8)) < 1.5 && Math.abs(rBig.y + rBig.h - (rBig.vh - 8)) < 1.5, JSON.stringify(rBig));

 await page.evaluate(() => document.getElementById('cc').setPosition({ fx: 0.5, fy: 0.5 }));
 const mid = await rect(page);
 await page.setViewport({ width: 320, height: 360 });
 await new Promise((r) => setTimeout(r, 200));
 const small = await rect(page);
 await page.setViewport({ width: 1200, height: 800 });
 await new Promise((r) => setTimeout(r, 200));
 const back = await rect(page);
 check('resize re-clamps inside and comes back to the same spot',
 small.x >= 7.5 && small.x + small.w <= small.vw - 7.5 && small.y >= 7.5 && small.y + small.h <= small.vh - 7.5 &&
 Math.abs(back.x - mid.x) < 1.5 && Math.abs(back.y - mid.y) < 1.5, JSON.stringify([mid, small, back]));

 // Touch drag (CDP touch events) and pen drag (pointerType pen).
 await page.setViewport({ width: 900, height: 700, hasTouch: true });
 await page.reload({ waitUntil: 'networkidle0' });
 await page.waitForSelector('claude-chan-host');
 const t0 = await rect(page);
 await page.touchscreen.touchStart(t0.x + t0.w / 2, t0.y + t0.h / 2);
 for (let i = 1; i <= 5; i++) await page.touchscreen.touchMove(t0.x + t0.w / 2 - 20 * i, t0.y + t0.h / 2 - 20 * i);
 await page.touchscreen.touchEnd();
 const t1 = await rect(page);
 const scrolled = await page.evaluate(() => scrollY);
 check('touch drag moves the mascot (touch-action none on the mascot)', Math.abs(t1.x - t0.x + 100) < 3 && Math.abs(t1.y - t0.y + 100) < 3 && scrolled === 0, JSON.stringify([t0, t1, scrolled]));
 const pen = await page.evaluate(async () => {
 const stage = document.querySelector('claude-chan-host').shadowRoot.querySelector('.stage');
 const r = stage.getBoundingClientRect();
 const ev = (type, x, y) => stage.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'pen', isPrimary: true, button: 0, clientX: x, clientY: y, bubbles: true, composed: true, cancelable: true }));
 ev('pointerdown', r.left + 10, r.top + 10);
 ev('pointermove', r.left + 60, r.top + 40);
 const carried = stage.classList.contains('dragging');
 ev('pointerup', r.left + 60, r.top + 40);
 const r2 = stage.getBoundingClientRect();
 return { dx: r2.left - r.left, dy: r2.top - r.top, carried };
 });
 check('pen drag moves the mascot and shows the carried state', Math.abs(pen.dx - 50) < 1.5 && Math.abs(pen.dy - 30) < 1.5 && pen.carried, JSON.stringify(pen));
 await page.setViewport({ width: 900, height: 700 });

 // Keyboard: focus, arrows, Shift for big steps, Home resets.
 const k0 = await rect(page);
 await page.evaluate(() => document.querySelector('claude-chan-host').shadowRoot.querySelector('.stage').focus());
 await page.keyboard.press('ArrowLeft');
 await page.keyboard.down('Shift');
 await page.keyboard.press('ArrowUp');
 await page.keyboard.up('Shift');
 const k1 = await rect(page);
 check('arrow keys move 10 px, Shift+arrow 60 px', Math.abs(k1.x - k0.x + 10) < 1 && Math.abs(k1.y - k0.y + 60) < 1, JSON.stringify([k0, k1]));
 await page.keyboard.press('Home');
 const k2 = await rect(page);
 const stored = await page.evaluate(() => localStorage.getItem('claude-chan:position'));
 check('Home resets to the home corner and forgets the spot', Math.abs(k2.x - home.x) < 1 && Math.abs(k2.y - home.y) < 1 && stored === null, JSON.stringify([k2, home, stored]));

 await drag(page, k2, 200, -200);
 const d1 = await rect(page);
 await page.mouse.click(d1.x + d1.w / 2, d1.y + d1.h / 2, { count: 2 });
 const d2 = await rect(page);
 check('double-click resets a moved mascot', Math.abs(d2.x - home.x) < 1 && Math.abs(d2.y - home.y) < 1, JSON.stringify([d1, d2]));

 // Outside its own box the page stays clickable.
 const through = await page.evaluate(() => {
 const r = document.querySelector('claude-chan-host').shadowRoot.querySelector('.stage').getBoundingClientRect();
 const outside = document.elementFromPoint(r.right + 30, r.top + 10);
 const inside = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
 return { outside: outside ? outside.tagName : null, inside: inside ? inside.tagName : null };
 });
 check('does not block clicks outside its own box', through.outside !== 'CLAUDE-CHAN-HOST' && through.inside === 'CLAUDE-CHAN-HOST', JSON.stringify(through));

 // dock fixed-default: no drag.
 await page.evaluate(() => document.getElementById('cc').setDock('fixed-default'));
 const f0 = await rect(page);
 await drag(page, f0, 150, -150);
 const f1 = await rect(page);
 check('dock fixed-default does not drag', f1.x === f0.x && f1.y === f0.y, JSON.stringify([f0, f1]));
 await page.evaluate(() => document.getElementById('cc').setDock('free'));

 // Procedural renderer path drags the same way.
 await page.evaluate(() => document.getElementById('cc').setAttribute('renderer', 'procedural'));
 await new Promise((r) => setTimeout(r, 300));
 const g0 = await rect(page);
 await drag(page, g0, -10, -200);
 const g1 = await rect(page);
 check('procedural renderer drags too', Math.abs(g1.y - g0.y + 200) < 3, JSON.stringify([g0, g1]));
 await page.evaluate(() => localStorage.clear());

 // postMessage bridge: claude_chan_set_position / claude_chan_reset_position from the host page into the iframe.
 const embed = await browser.newPage();
 embed.on('pageerror', (e) => errors.push(String(e)));
 await embed.goto(url + 'embed.html', { waitUntil: 'networkidle0' });
 const bridged = await embed.evaluate(async () => {
 const frame = document.getElementById('frame');
 const w = frame.contentWindow;
 for (let i = 0; i < 50 && !w.document.querySelector('claude-chan-host'); i++) await new Promise((r) => setTimeout(r, 100));
 const box = () => { const r = w.document.querySelector('claude-chan-host').shadowRoot.querySelector('.stage').getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, vw: w.document.documentElement.clientWidth, vh: w.document.documentElement.clientHeight }; };
 const call = (id, tool, args) => new Promise((res) => {
 const on = (ev) => { if (ev.data && ev.data.type === 'claude-chan-result' && ev.data.id === id) { removeEventListener('message', on); res(ev.data); } };
 addEventListener('message', on);
 w.postMessage({ type: 'claude-chan', id, tool, args }, location.origin);
 });
 const before = box();
 const set = await call(91, 'claude_chan_set_position', { x: 1, y: 0 });
 const moved = box();
 const bad = await call(92, 'claude_chan_set_position', { x: 2, y: 0 });
 const reset = await call(93, 'claude_chan_reset_position', {});
 const after = box();
 return { before, set, moved, bad, reset, after };
 });
 check('postMessage set_position moves to the fraction, reset_position goes home, bad args rejected',
 bridged.set.ok && Math.abs(bridged.moved.r - (bridged.moved.vw - 8)) < 1.5 && Math.abs(bridged.moved.y - 8) < 1.5 &&
 bridged.bad.ok === false && bridged.reset.ok && Math.abs(bridged.after.x - bridged.before.x) < 1 && Math.abs(bridged.after.y - bridged.before.y) < 1,
 JSON.stringify(bridged));
 await embed.close();

 check('no page errors', errors.length === 0, errors.join(' | '));
} finally {
 await browser.close();
 await server.close();
}
console.log(failures ? failures + ' e2e check(s) failed' : 'e2e: all checks passed');
process.exit(failures ? 1 : 0);
