// Opt-in e2e: loads a real Live2D model through the Live2D renderer in headless Chrome.
// Nothing is committed: point it at a locally downloaded model and Cubism Core (see docs/LICENSES.md).
// Set LIVE2D_MODEL_DIR (folder with a *.model3.json) and LIVE2D_CORE (live2dcubismcore.min.js), then npm run test:live2d
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';

const modelDir = process.env.LIVE2D_MODEL_DIR;
const corePath = process.env.LIVE2D_CORE;
if (!modelDir || !corePath || !existsSync(modelDir) || !existsSync(corePath)) {
 console.log('live2d e2e: skipped (set LIVE2D_MODEL_DIR and LIVE2D_CORE)');
 process.exit(0);
}
const modelFile = readdirSync(modelDir).find((f) => f.endsWith('.model3.json'));
if (!modelFile) {
 console.error('live2d e2e: no *.model3.json in ' + modelDir);
 process.exit(2);
}
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

const MIME = { '.json': 'application/json', '.js': 'text/javascript', '.png': 'image/png', '.moc3': 'application/octet-stream' };
const serveModel = {
 name: 'serve-live2d-fixture',
 configureServer(server) {
 server.middlewares.use((req, res, next) => {
 const url = decodeURIComponent((req.url || '').split('?')[0]);
 if (url === '/l2d-core.js') {
 res.setHeader('content-type', 'text/javascript');
 return res.end(readFileSync(corePath));
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

const server = await createServer({ configFile: 'vite.config.ts', logLevel: 'error', server: { port: 5198 }, plugins: [serveModel] });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await puppeteer.launch({
 executablePath,
 headless: true,
 args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
 const page = await browser.newPage();
 await page.setViewport({ width: 900, height: 700 });
 const errors = [];
 const warns = [];
 page.on('pageerror', (e) => errors.push(String(e)));
 page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warns.push(m.text()); });
 await page.goto(url, { waitUntil: 'networkidle0' });
 const entry = '/@fs/' + process.cwd().split(String.fromCharCode(92)).join('/') + '/src/index.ts';
 const res = await page.evaluate(async (entry, model) => {
 const { mount } = await import(entry);
 document.querySelectorAll('claude-chan,claude-chan-host').forEach((n) => n.remove());
 const c = mount(document.body, { renderer: 'live2d', model, coreUrl: '/l2d-core.js', position: 'bottom-right', size: 300 });
 const host = () => document.querySelector('claude-chan-host');
 const canvas = () => host() && host().shadowRoot.querySelector('canvas');
 const deadline = Date.now() + 20000;
 while (Date.now() < deadline) {
 const cv = canvas();
 if (cv && cv.width > 0) break;
 await new Promise((r) => setTimeout(r, 250));
 }
 const started = [];
 c.on('motionstart', (d) => started.push(d.motion));
 c.act({ motion: 'wave', expression: 'smile', priority: 'high' });
 await new Promise((r) => setTimeout(r, 800));
 c.act({ motion: 'nod', expression: 'sad', priority: 'high' });
 await new Promise((r) => setTimeout(r, 800));
 const cv = canvas();
 return { canvas: !!cv, w: cv ? cv.width : 0, core: !!window.Live2DCubismCore, started };
 }, entry, '/l2d-model/' + modelFile);
 check('Cubism Core loads from the self-hosted file', res.core, JSON.stringify(res));
 check('Live2D model renders into a canvas', res.canvas && res.w > 0, JSON.stringify(res));
 check('act() runs motions on the Live2D puppet', res.started.includes('wave'), JSON.stringify(res));
 check('no page errors', errors.length === 0, errors.join(' | '));
 check('no fallback warning', !warns.some((w) => w.includes('failed to load')), warns.join(' | '));
} finally {
 await browser.close();
 await server.close();
}
console.log(failures ? failures + ' live2d check(s) failed' : 'live2d e2e: all checks passed');
process.exit(failures ? 1 : 0);
