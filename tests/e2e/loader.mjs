// Headless hot-load tests (docs/HOT-LOAD.md): the built hotload/ files are injected into fixture pages served from a
// different origin than the loader (like a third-party site): plain page, heavy global CSS, SPA with route changes,
// iframes, double load, unload cleanup, import(), data attributes, and a strict-CSP page (external loader blocked,
// inline build injected the way a userscript manager does it).
// Run: npm run test:loader (builds first). Drives the system Edge/Chrome through puppeteer-core.
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import puppeteer from 'puppeteer-core';
import { createLoaderServer } from '../../scripts/serve-loader.mjs';

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
 console.error('loader e2e: no Chrome/Edge found; set CHROME_PATH');
 process.exit(2);
}

let failures = 0;
const check = (name, ok, extra = '') => {
 console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' ' + extra));
 if (!ok) failures++;
};

const LOADER_PORT = Number(process.env.LOADER_PORT) || 5189;
const SITE_PORT = LOADER_PORT + 1;
const BASE = 'http://127.0.0.1:' + LOADER_PORT + '/';
const INLINE = readFileSync(new URL('../../hotload/claude-chan.inline.js', import.meta.url), 'utf8');

const page = (body, head = '') => '<!doctype html><html><head><meta charset="utf-8"><title>fixture</title>' + head + '</head><body>' + body + '</body></html>';
const HEAVY_CSS = '<style>' +
 '*,*::before,*::after{transform:rotate(180deg) scale(.2)!important;filter:blur(4px)!important;opacity:.1!important;' +
 'position:static!important;display:inline!important;visibility:hidden!important;all:revert}' +
 'html *{width:1px!important;height:1px!important;margin:50px!important;z-index:-1!important;pointer-events:none!important}' +
 'img{display:none!important}div{display:none!important}claude-chan-loader,claude-chan-host{display:none!important;position:absolute!important}' +
 '</style>';
const SPA = page('<nav><a href="/spa/a">a</a></nav><div id="app">home</div>',
 '<script>window.go=function(p,mode){history.pushState({},"",p);' +
 'if(mode==="body"){var b=document.createElement("body");b.innerHTML="<div id=app>"+p+"</div>";document.body.replaceWith(b);}' +
 'else if(mode==="html"){while(document.documentElement.lastChild)document.documentElement.lastChild.remove();' +
 'document.documentElement.append(document.createElement("head"),document.createElement("body"));document.body.textContent=p;}' +
 'else document.getElementById("app").textContent=p;};</script>');
const CSP_DATA = "default-src 'self'; script-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self'";
const CSP_NO_DATA = "default-src 'self'; script-src 'self'; img-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'";
const ROUTES = {
 '/plain': { html: page('<h1>Plain page</h1><p>Hello.</p>') },
 '/heavy': { html: page('<h1>Heavy CSS</h1><div>content</div>', HEAVY_CSS) },
 '/spa': { html: SPA },
 '/frame': { html: page('<iframe id="f" src="/plain" width="600" height="400"></iframe>') },
 '/csp': { html: page('<h1>Strict CSP</h1>'), csp: CSP_DATA },
 '/csp-strict': { html: page('<h1>Strict CSP, no data: images</h1>'), csp: CSP_NO_DATA },
};
const site = createServer((req, res) => {
 const path = new URL(req.url, 'http://x').pathname;
 const r = ROUTES[path] ?? (path.startsWith('/spa/') ? ROUTES['/spa'] : null);
 if (!r) return res.writeHead(404).end();
 const headers = { 'Content-Type': 'text/html; charset=utf-8' };
 if (r.csp) headers['Content-Security-Policy'] = r.csp;
 res.writeHead(200, headers).end(r.html);
});
const loaderServer = createLoaderServer();
await new Promise((ok) => loaderServer.listen(LOADER_PORT, '127.0.0.1', ok));
await new Promise((ok) => site.listen(SITE_PORT, '127.0.0.1', ok));
const SITE = 'http://127.0.0.1:' + SITE_PORT;

const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });

// Injects the loader the way the console one-liner and the bookmarklet do (optionally with data-* attributes).
const inject = (p, attrs = {}) =>
 p.evaluate((src, attrs) => new Promise((ok) => {
 const s = Object.assign(document.createElement('script'), { src });
 for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
 s.onload = () => ok('load');
 s.onerror = () => ok('error');
 document.head.append(s);
 }), BASE + 'hotload/loader.js', attrs);

// State of the mascot in the current page.
const state = (p) => p.evaluate(() => {
 const outers = document.querySelectorAll('claude-chan-loader');
 const outer = outers[0];
 const host = outer?.shadowRoot?.querySelector('claude-chan-host');
 const stage = host?.shadowRoot?.querySelector('.stage');
 const r = stage?.getBoundingClientRect();
 const imgs = stage ? [...stage.querySelectorAll('img')] : [];
 return {
 count: outers.length,
 hosts: document.querySelectorAll('claude-chan-host').length,
 rect: r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null,
 vw: innerWidth,
 vh: innerHeight,
 outerPos: outer ? getComputedStyle(outer).position : null,
 outerDisplay: outer ? getComputedStyle(outer).display : null,
 imgs: imgs.length,
 imgsLoaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
 imgSrc: imgs[0]?.src.slice(0, 40) ?? null,
 svg: stage ? stage.querySelectorAll('svg').length : 0,
 api: typeof window.claudeChan,
 unload: typeof window.claudeChan?.unload,
 version: window.claudeChan?.version ?? null,
 loader: typeof window.__claudeChanLoader,
 };
});
const settle = (p, ms = 600) => p.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms);
const waitMascot = (p) => p.waitForFunction(() => {
 const host = document.querySelector('claude-chan-loader')?.shadowRoot?.querySelector('claude-chan-host');
 const stage = host?.shadowRoot?.querySelector('.stage');
 return stage && (stage.querySelector('img') || stage.querySelector('svg'));
}, { timeout: 8000 }).then(() => true, () => false);

async function newPage(path) {
 const p = await browser.newPage();
 await p.setViewport({ width: 1000, height: 700 });
 const errors = [];
 const cspErrors = [];
 p.on('pageerror', (e) => errors.push(String(e)));
 p.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) cspErrors.push(m.text()); });
 await p.goto(SITE + path, { waitUntil: 'load' });
 return { p, errors, cspErrors };
}

try {
 // 1. Plain page: console one-liner, sprites from the loader's own origin.
 {
 const { p, errors } = await newPage('/plain');
 check('plain: script loads', (await inject(p)) === 'load');
 check('plain: mascot appears', await waitMascot(p));
 await settle(p);
 const s = await state(p);
 check('plain: one mascot, bottom-left', s.count === 1 && s.hosts === 0 && s.rect && s.rect.x < 100 && s.rect.y + s.rect.h > s.vh - 100, JSON.stringify(s));
 check('plain: sprites loaded from the loader origin', s.imgsLoaded > 0 && s.imgSrc.startsWith(BASE + 'assets/chars/'), JSON.stringify(s));
 check('plain: window.claudeChan with unload() and version', s.api === 'object' && s.unload === 'function' && s.version === '0.1.0', JSON.stringify(s));

 // Drag works in the top layer, and the page under the empty part of the layer still gets clicks.
 const r0 = s.rect;
 await p.mouse.move(r0.x + r0.w / 2, r0.y + r0.h / 2);
 await p.mouse.down();
 await p.mouse.move(r0.x + r0.w / 2 + 300, r0.y + r0.h / 2 - 200, { steps: 6 });
 await p.mouse.up();
 const r1 = (await state(p)).rect;
 check('plain: drag moves her', Math.abs(r1.x - r0.x - 300) < 4 && Math.abs(r1.y - r0.y + 200) < 4, JSON.stringify({ r0, r1 }));
 const hit = await p.evaluate(() => {
 const h = document.querySelector('h1').getBoundingClientRect();
 return document.elementFromPoint(h.left + 5, h.top + 5)?.tagName;
 });
 check('plain: page under the overlay stays clickable', hit === 'H1', String(hit));

 // 2. Idempotent: inject twice more (one-liner again + bookmarklet-style toggle guard not used here).
 await inject(p);
 await inject(p);
 await settle(p, 300);
 const s2 = await state(p);
 check('double load: still exactly one mascot', s2.count === 1, JSON.stringify(s2));

 // Console API still works on the hot-loaded mascot.
 const pos = await p.evaluate(() => window.claudeChan.setPosition(0.5, 0.5));
 check('console API: setPosition moves her', Math.abs(pos.fx - 0.5) < 0.02 && Math.abs(pos.fy - 0.5) < 0.02, JSON.stringify(pos));
 const said = await p.evaluate(() => window.__claudeChanLoader.controller.act({ motion: 'wave', say: 'hi' }));
 check('controller: act() accepted', said !== false, JSON.stringify(said));

 // 3. Unload: DOM, globals, listeners, storage (forget).
 const before = await p.evaluate(() => localStorage.getItem('claude-chan:position'));
 await p.evaluate(() => window.claudeChan.unload({ forget: true }));
 await settle(p, 200);
 const u = await state(p);
 const after = await p.evaluate(() => {
 // A resize after unload must not throw (listeners removed); rAF loop is stopped (no frames touch removed nodes).
 window.dispatchEvent(new Event('resize'));
 return { pos: localStorage.getItem('claude-chan:position'), hidden: localStorage.getItem('claude-chan:position:hidden') };
 });
 check('unload: removes element and globals', u.count === 0 && u.api === 'undefined' && u.loader === 'undefined', JSON.stringify(u));
 check('unload({forget}): clears stored position', before !== null && after.pos === null && after.hidden === null, JSON.stringify({ before, after }));

 // Load again after unload works (bookmarklet toggle on).
 await inject(p);
 check('reload after unload: mascot back', await waitMascot(p));
 check('reload after unload: exactly one', (await state(p)).count === 1);
 check('plain: no page errors', errors.length === 0, errors.join(' | '));
 await p.close();
 }

 // 4. import() route (module): base found from the stack, not document.currentScript.
 {
 const { p, errors } = await newPage('/plain');
 await p.evaluate((u) => import(u), BASE + 'hotload/loader.js');
 check('import(): mascot appears', await waitMascot(p));
 await settle(p);
 const s = await state(p);
 check('import(): sprites resolved from the loader URL', s.imgsLoaded > 0 && s.imgSrc.startsWith(BASE + 'assets/chars/'), JSON.stringify(s));
 check('import(): no page errors', errors.length === 0, errors.join(' | '));
 await p.close();
 }

 // 5. data-* attributes and window.claudeChanConfig.
 {
 const { p } = await newPage('/plain');
 await inject(p, { 'data-position': 'top-right', 'data-size': '160', 'data-z-index': '77' });
 await waitMascot(p);
 await settle(p);
 const s = await state(p);
 const z = await p.evaluate(() => getComputedStyle(document.querySelector('claude-chan-loader')).zIndex);
 check('data attributes: top-right, size 160, z-index', s.rect && s.rect.x > s.vw - 250 && s.rect.y < 100 && Math.abs(s.rect.h - 160) < 2 && z === '77', JSON.stringify({ ...s, z }));
 await p.close();
 const { p: p2 } = await newPage('/plain');
 await p2.evaluate(() => { window.claudeChanConfig = { position: 'bottom-right', consoleApi: 'cc' }; });
 await inject(p2);
 await waitMascot(p2);
 await settle(p2);
 const s2 = await state(p2);
 const cc = await p2.evaluate(() => typeof window.cc?.unload);
 check('claudeChanConfig: bottom-right + custom console name', s2.rect && s2.rect.x > s2.vw - 250 && cc === 'function' && s2.api === 'undefined', JSON.stringify({ ...s2, cc }));
 await p2.close();
 }

 // 6. Heavy global CSS cannot break her.
 {
 const { p, errors } = await newPage('/heavy');
 await inject(p);
 check('heavy CSS: mascot appears', await waitMascot(p));
 await settle(p);
 const s = await state(p);
 const vis = await p.evaluate(() => {
 const img = document.querySelector('claude-chan-loader').shadowRoot.querySelector('claude-chan-host').shadowRoot.querySelector('.stage img');
 const cs = img ? getComputedStyle(img) : null;
 const st = getComputedStyle(document.querySelector('claude-chan-loader').shadowRoot.querySelector('claude-chan-host').shadowRoot.querySelector('.stage'));
 return { display: cs?.display, visibility: st.visibility, filter: st.filter, outerFilter: getComputedStyle(document.querySelector('claude-chan-loader')).filter };
 });
 check('heavy CSS: outer stays fixed and displayed', s.outerPos === 'fixed' && s.outerDisplay === 'block', JSON.stringify(s));
 check('heavy CSS: normal size, bottom-left, sprites shown', s.rect && Math.abs(s.rect.h - 220) < 2 && s.rect.x < 100 && s.rect.y + s.rect.h > s.vh - 100 && s.imgsLoaded > 0, JSON.stringify(s));
 check('heavy CSS: no blur/hidden leaks in', vis.visibility === 'visible' && vis.filter === 'none' && vis.outerFilter === 'none' && vis.display !== 'none', JSON.stringify(vis));
 check('heavy CSS: no page errors', errors.length === 0, errors.join(' | '));
 await p.close();
 }

 // 7. SPA: pushState routes, body replaced, even <html> children rebuilt: same element, never remounted.
 {
 const { p, errors } = await newPage('/spa');
 await inject(p);
 await waitMascot(p);
 await p.evaluate(() => { document.querySelector('claude-chan-loader').__mark = 42; window.__mounts = window.__claudeChanLoader; });
 for (const [path, mode] of [['/spa/a', 'text'], ['/spa/b', 'body'], ['/spa/c', 'html'], ['/spa/d', 'body']]) {
 await p.evaluate((path, mode) => window.go(path, mode), path, mode);
 await settle(p, 100);
 }
 const r = await p.evaluate(() => ({
 count: document.querySelectorAll('claude-chan-loader').length,
 same: document.querySelector('claude-chan-loader')?.__mark === 42,
 instance: window.__mounts === window.__claudeChanLoader,
 path: location.pathname,
 }));
 check('SPA: survives 4 route changes as the same element (no remount)', r.count === 1 && r.same && r.instance && r.path === '/spa/d', JSON.stringify(r));
 await inject(p);
 await settle(p, 200);
 check('SPA: loader re-run after routes still one mascot', (await state(p)).count === 1);
 check('SPA: no page errors', errors.length === 0, errors.join(' | '));
 await p.close();
 }

 // 8. iframes: top frame only by default; frames: true opts in.
 {
 const { p } = await newPage('/frame');
 const frame = await (await p.$('#f')).contentFrame();
 await frame.waitForSelector('h1');
 const res = await frame.evaluate((src) => new Promise((ok) => {
 const s = Object.assign(document.createElement('script'), { src });
 s.onload = () => setTimeout(() => ok(document.querySelectorAll('claude-chan-loader').length), 300);
 s.onerror = () => ok(-1);
 document.head.append(s);
 }), BASE + 'hotload/loader.js');
 check('iframe: not mounted by default', res === 0, String(res));
 const res2 = await frame.evaluate((src) => new Promise((ok) => {
 window.claudeChanConfig = { frames: true };
 const s = Object.assign(document.createElement('script'), { src });
 s.onload = () => setTimeout(() => ok(document.querySelectorAll('claude-chan-loader').length), 300);
 document.head.append(s);
 }), BASE + 'hotload/loader.js');
 check('iframe: frames: true mounts inside the frame', res2 === 1, String(res2));
 await p.close();
 }

 // 9. Strict CSP: the external loader is blocked (console CSP error); the inline build, injected like a
 //    userscript manager does (outside the page's script-src), shows the embedded sprites.
 {
 const { p, cspErrors, errors } = await newPage('/csp');
 const r = await inject(p);
 await settle(p, 300);
 check('CSP: external loader blocked', r === 'error' && (await state(p)).count === 0 && cspErrors.length > 0, JSON.stringify({ r, cspErrors: cspErrors.length }));
 await p.evaluate(INLINE);
 check('CSP: inline build mounts', await waitMascot(p));
 await settle(p);
 const s = await state(p);
 check('CSP: embedded data: sprites shown', s.imgsLoaded > 0 && s.imgSrc.startsWith('data:image/webp'), JSON.stringify(s));
 check('CSP: no page errors', errors.length === 0, errors.join(' | '));
 await p.close();
 }
 {
 const { p, errors } = await newPage('/csp-strict');
 await p.evaluate(INLINE);
 check('CSP without data: images: falls back to the drawn puppet', await waitMascot(p));
 await settle(p, 1200);
 const s = await state(p);
 check('CSP without data: images: procedural puppet, one mascot', s.count === 1 && s.svg > 0, JSON.stringify(s));
 check('CSP without data: images: no page errors', errors.length === 0, errors.join(' | '));
 await p.close();
 }

 // 10. Userscript file: header + loader; running its body mounts with the baked-in base.
 {
 const us = readFileSync(new URL('../../hotload/claude-chan.user.js', import.meta.url), 'utf8');
 check('userscript: has header with @grant none and @noframes', /@grant\s+none/.test(us) && /@noframes/.test(us) && /@match\s+\S+/.test(us));
 const { p, errors } = await newPage('/plain');
 await p.evaluate((b) => { window.claudeChanConfig = { base: b }; }, BASE);
 await p.evaluate(us);
 check('userscript: mounts', await waitMascot(p));
 await settle(p);
 const s = await state(p);
 check('userscript: sprites from configured base', s.imgsLoaded > 0 && s.imgSrc.startsWith(BASE), JSON.stringify(s));
 check('userscript: no page errors', errors.length === 0, errors.join(' | '));
 await p.close();
 }
} finally {
 await browser.close();
 loaderServer.close();
 site.close();
}

console.log(failures ? 'loader e2e: ' + failures + ' FAILED' : 'loader e2e: all passed');
process.exit(failures ? 1 : 0);
