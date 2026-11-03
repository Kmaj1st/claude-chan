// Opt-in e2e for the Live2D (Cubism) renderer in headless Chrome/Edge (puppeteer-core, system browser).
// Nothing third-party is committed: point it at a model folder on disk (the owner's export, or a Live2D sample such as
// Haru from github.com/Live2D/CubismWebSamples, Free Material License) and optionally a local Cubism Core.
//   LIVE2D_MODEL_DIR  folder with one *.model3.json (required, else the test is skipped)
//   LIVE2D_CORE       local live2dcubismcore.min.js (optional; default: the official Live2D CDN, needs network)
//   LIVE2D_EXPRESSION model expression id to map 'smile' onto (optional; default: the model's first expression)
// Covers: npm-module mount, model + motion + expression, drag/click reactions, console API, fallback to sprites
// (bad model, bad core), and the hot-load loader with renderer 'live2d' (runtime from script tags) vs. default
// sprites (no Live2D request at all). Run: npm run build:loader && npm run test:live2d
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';

const modelDir = process.env.LIVE2D_MODEL_DIR;
const corePath = process.env.LIVE2D_CORE;
if (!modelDir || !existsSync(modelDir)) {
 console.log('live2d e2e: skipped (set LIVE2D_MODEL_DIR; see docs/LIVE2D.md)');
 process.exit(0);
}
const modelFile = readdirSync(modelDir).find((f) => f.endsWith('.model3.json'));
if (!modelFile) {
 console.error('live2d e2e: no *.model3.json in ' + modelDir);
 process.exit(2);
}
const model3 = JSON.parse(readFileSync(join(modelDir, modelFile), 'utf8'));
const firstExpr = (model3.FileReferences?.Expressions ?? [])[0]?.Name;
const smileId = process.env.LIVE2D_EXPRESSION || firstExpr || null;
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
 console.error('live2d e2e: no Chrome/Edge found; set CHROME_PATH');
 process.exit(2);
}
const CORE_URL = corePath && existsSync(corePath) ? '/l2d-core.js' : 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js';

const root = process.cwd();
const FILES = {
 '/l2d-core.js': corePath,
 '/l2d-pixi.js': join(root, 'node_modules/pixi.js/dist/browser/pixi.min.js'),
 '/l2d-cubism4.js': join(root, 'node_modules/pixi-live2d-display/dist/cubism4.min.js'),
 '/hotload/loader.js': join(root, 'hotload/loader.js'),
};
const MIME = { '.json': 'application/json', '.js': 'text/javascript', '.png': 'image/png', '.moc3': 'application/octet-stream' };
const serveFixtures = {
 name: 'serve-live2d-fixture',
 configureServer(server) {
 server.middlewares.use((req, res, next) => {
 const url = decodeURIComponent((req.url || '').split('?')[0]);
 if (url === '/blank') {
 res.setHeader('content-type', 'text/html');
 return res.end('<!doctype html><html><head><meta charset="utf-8"><title>blank</title></head><body><h1>blank</h1></body></html>');
 }
 const fixed = FILES[url];
 if (fixed && existsSync(fixed)) {
 res.setHeader('content-type', 'text/javascript');
 return res.end(readFileSync(fixed));
 }
 if (!url.startsWith('/l2d-model/')) return next();
 const file = normalize(join(modelDir, url.slice('/l2d-model/'.length)));
 if (!file.startsWith(normalize(modelDir)) || !existsSync(file) || !statSync(file).isFile()) {
 res.statusCode = 404;
 return res.end('not found');
 }
 res.setHeader('content-type', MIME[extname(file)] || 'application/octet-stream');
 res.end(readFileSync(file));
 });
 },
};

let failures = 0;
const check = (name, ok, extra = '') => {
 console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' ' + extra));
 if (!ok) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = await createServer({ configFile: 'vite.config.ts', logLevel: 'error', server: { port: 5198 }, plugins: [serveFixtures] });
await server.listen();
const url = server.resolvedUrls.local[0];
const MODEL = '/l2d-model/' + modelFile;
const browser = await puppeteer.launch({
 executablePath,
 headless: true,
 args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function newPage() {
 const page = await browser.newPage();
 await page.setViewport({ width: 900, height: 700 });
 const log = { errors: [], warns: [], requests: [] };
 page.on('pageerror', (e) => log.errors.push(String(e)));
 page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'warn' || m.type() === 'error') log.warns.push(m.text()); });
 page.on('request', (r) => log.requests.push(r.url()));
 return { page, log };
}

// Waits in the page until the mascot reports ready (or 25 s).
const WAIT_READY = `(c) => new Promise((res) => { let done = false; c.on('ready', () => { done = true; res(true); }); c.ready.then(() => setTimeout(() => res(done || true), 50)); setTimeout(() => res(false), 25000); })`;

try {
 const entry = '/@fs/' + root.split(String.fromCharCode(92)).join('/') + '/src/index.ts';

 // A. npm module: renderer live2d, model, motion, expression, console API, drag and click reactions.
 {
 const { page, log } = await newPage();
 await page.goto(url, { waitUntil: 'networkidle0' });
 const res = await page.evaluate(async (entry, model, coreUrl, smileId, waitReady) => {
 const { mount } = await import(entry);
 document.querySelectorAll('claude-chan,claude-chan-host').forEach((n) => n.remove());
 for (const k of Object.keys(window)) if (k === 'claudeChan') delete window[k];
 const c = mount(document.body, { renderer: 'live2d', model, coreUrl, position: 'bottom-right', size: 300, consoleApi: 'claudeChanL2D',
 expressions: smileId ? { smile: smileId } : undefined });
 await (0, eval)(waitReady)(c);
 const host = [...document.querySelectorAll('claude-chan-host')].pop();
 const sr = host.shadowRoot;
 const cv = sr.querySelector('canvas');
 const holder = () => sr.querySelector('[data-l2d-motion],[data-l2d-expression]') || (cv && cv.parentElement);
 const started = [];
 c.on('motionstart', (d) => started.push(d.motion));
 c.act({ motion: 'wave', expression: 'smile', priority: 'high' });
 await new Promise((r) => setTimeout(r, 900));
 const api = window.claudeChanL2D;
 const lines = api.help();
 const before = api.getPosition();
 api.setPosition({ x: 50, y: 60 });
 const moved = api.getPosition();
 api.resetPosition();
 const reset = api.getPosition();
 api.hide(); const hidden = c.isHidden(); api.show(); const shown = !c.isHidden();
 const t1 = api.toggle(); const t2 = api.toggle();
 const stage = sr.querySelector('.stage');
 const b = stage.getBoundingClientRect();
 window.__l2d = { c, started };
 return {
 renderer: api.renderer, simplified: api.isSimplified, ctrlRenderer: c.renderer,
 canvas: !!cv, w: cv ? cv.width : 0, core: !!window.Live2DCubismCore,
 motion: holder()?.dataset.l2dMotion ?? null, expression: holder()?.dataset.l2dExpression ?? null,
 helpOk: Array.isArray(lines) && lines.some((l) => String(l).includes('live2d')),
 before, moved, reset, hidden, shown, t1, t2, started: [...started],
 stage: { x: b.left + b.width / 2, y: b.top + b.height / 2 },
 };
 }, entry, MODEL, CORE_URL, smileId, WAIT_READY);
 check('A renderer reports live2d (console API and controller)', res.renderer === 'live2d' && res.ctrlRenderer === 'live2d' && res.simplified === false, JSON.stringify(res));
 check('A Cubism Core loaded (' + CORE_URL + ')', res.core, JSON.stringify(res));
 check('A model renders into a canvas', res.canvas && res.w > 0, JSON.stringify(res));
 check('A act({motion:"wave"}) starts a model motion group', res.started.includes('wave') && !!res.motion, JSON.stringify(res));
 check('A act({expression:"smile"}) applies the mapped expression' + (smileId ? '' : ' (model has no expressions: skipped)'), !smileId || res.expression === smileId, JSON.stringify(res));
 check('A help() mentions the renderer', res.helpOk, JSON.stringify(res));
 check('A setPosition/getPosition/resetPosition', res.moved.x === 50 && res.moved.y === 60 && res.reset.x === res.before.x && res.reset.y === res.before.y, JSON.stringify(res));
 check('A hide/show/toggle', res.hidden && res.shown && res.t1 === false && res.t2 === true, JSON.stringify(res));

 // Drag the character (headless browser mouse, not the user's input) and click it.
 await page.evaluate(() => window.__l2d.c.stop());
 await page.mouse.move(res.stage.x, res.stage.y);
 await page.mouse.down();
 for (let i = 1; i <= 8; i++) await page.mouse.move(res.stage.x - i * 20, res.stage.y - i * 10);
 await page.mouse.up();
 await sleep(400);
 const afterDrag = await page.evaluate(() => ({ pos: window.claudeChanL2D.getPosition(), started: [...window.__l2d.started] }));
 check('A drag moves the mascot', afterDrag.pos.x < res.reset.x - 100, JSON.stringify(afterDrag));
 check('A drag reaction plays (surprised)', afterDrag.started.includes('surprised'), JSON.stringify(afterDrag));
 await page.evaluate(() => window.__l2d.c.stop());
 const s2 = await page.evaluate(() => { const b = [...document.querySelectorAll('claude-chan-host')].pop().shadowRoot.querySelector('.stage').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
 await page.mouse.click(s2.x, s2.y);
 await sleep(300);
 const afterClick = await page.evaluate(() => [...window.__l2d.started]);
 check('A click reaction plays (wave)', afterClick.filter((m) => m === 'wave').length >= 2, JSON.stringify(afterClick));
 check('A no page errors', log.errors.length === 0, log.errors.join(' | '));
 check('A no fallback warning', !log.warns.some((w) => w.includes('failed to load')), log.warns.join(' | '));
 await page.evaluate(() => window.__l2d.c.destroy());
 await page.close();
 }

 // B/C. Fallback to sprites when the model or the Cubism Core cannot load.
 for (const [name, opts] of [['B missing model', { model: '/l2d-model/missing.model3.json', coreUrl: CORE_URL }], ['C blocked Cubism Core', { model: MODEL, coreUrl: '/no-such-core.js' }]]) {
 const { page, log } = await newPage();
 await page.goto(url, { waitUntil: 'networkidle0' });
 const res = await page.evaluate(async (entry, opts, waitReady) => {
 const { mount } = await import(entry);
 document.querySelectorAll('claude-chan,claude-chan-host').forEach((n) => n.remove());
 const c = mount(document.body, { renderer: 'live2d', ...opts, sprites: '/chars/', consoleApi: false });
 const ok = await (0, eval)(waitReady)(c);
 await new Promise((r) => setTimeout(r, 300));
 const sr = [...document.querySelectorAll('claude-chan-host')].pop().shadowRoot;
 return { ok, renderer: c.renderer, canvas: !!sr.querySelector('canvas'), img: !!sr.querySelector('img') };
 }, entry, opts, WAIT_READY);
 check(name + ': falls back to sprites, mascot still shown', res.renderer === 'sprites' && !res.canvas && res.img, JSON.stringify(res));
 check(name + ': warns once with the fallback message', log.warns.some((w) => w.includes('Live2D model failed to load')), log.warns.join(' | '));
 await page.close();
 }

 // D. Hot-load loader: renderer live2d (runtime via script tags), then default sprites must fetch nothing Live2D.
 if (!existsSync(FILES['/hotload/loader.js'])) {
 check('D hot-load (run npm run build:loader first)', false);
 } else {
 const inject = async (page, cfg) => page.evaluate(async (cfg, waitReady) => {
 window.claudeChanConfig = cfg;
 await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/hotload/loader.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
 const inst = window.__claudeChanLoader;
 if (!inst) return { mounted: false };
 await (0, eval)(waitReady)(inst.controller);
 await new Promise((r) => setTimeout(r, 300));
 const r = { mounted: true, renderer: window.claudeChan.renderer, simplified: window.claudeChan.isSimplified };
 window.claudeChan.unload();
 r.unloaded = !document.querySelector('claude-chan-loader') && window.claudeChan === undefined;
 return r;
 }, cfg, WAIT_READY);
 const runtime = { pixi: '/l2d-pixi.js', live2d: '/l2d-cubism4.js' };
 {
 const { page, log } = await newPage();
 await page.goto(url + 'blank', { waitUntil: 'networkidle0' });
 const res = await inject(page, { renderer: 'live2d', model: MODEL, coreUrl: CORE_URL, live2dRuntime: runtime, sprites: '/chars/' });
 check('D hot-load renderer:"live2d" shows the Live2D model', res.mounted && res.renderer === 'live2d', JSON.stringify(res) + ' ' + log.warns.join(' | '));
 check('D hot-load unload() removes it', res.unloaded === true, JSON.stringify(res));
 check('D hot-load no page errors', log.errors.length === 0, log.errors.join(' | '));
 await page.close();
 }
 {
 const { page, log } = await newPage();
 await page.goto(url + 'blank', { waitUntil: 'networkidle0' });
 const res = await inject(page, { renderer: 'live2d', model: '/l2d-model/missing.model3.json', coreUrl: CORE_URL, live2dRuntime: runtime, sprites: '/chars/' });
 check('D hot-load live2d with a missing model falls back to sprites', res.mounted && res.renderer === 'sprites', JSON.stringify(res) + ' ' + log.warns.join(' | '));
 await page.close();
 }
 {
 const { page, log } = await newPage();
 await page.goto(url + 'blank', { waitUntil: 'networkidle0' });
 const res = await inject(page, { sprites: '/chars/' });
 const l2dReq = log.requests.filter((u) => /pixi|cubism|live2d|l2d-/i.test(u));
 check('D hot-load default is sprites', res.mounted && res.renderer === 'sprites', JSON.stringify(res));
 check('D hot-load default fetches nothing Live2D', l2dReq.length === 0, l2dReq.join(' | '));
 await page.close();
 }
 }
} finally {
 await browser.close();
 await server.close();
}
console.log(failures ? failures + ' live2d check(s) failed' : 'live2d e2e: all checks passed');
process.exit(failures ? 1 : 0);
