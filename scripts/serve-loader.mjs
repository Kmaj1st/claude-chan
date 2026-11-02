// Local hot-load server (docs/HOT-LOAD.md): serves hotload/, assets/ and docs/install.html from this repository
// with CORS, so any page in this browser can load http://127.0.0.1:<port>/hotload/loader.js.
//   npm run serve:loader [-- --port 5179]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, normalize, resolve, sep } from 'node:path';

export const DEFAULT_PORT = 5179;
const ROOT = fileURLToPath(new URL('../', import.meta.url));
// Only these folders are served; everything else is 404.
const ALLOWED = ['hotload', 'assets', 'docs'];
const MIME = {
 '.js': 'text/javascript; charset=utf-8',
 '.json': 'application/json; charset=utf-8',
 '.webp': 'image/webp',
 '.png': 'image/png',
 '.svg': 'image/svg+xml',
 '.html': 'text/html; charset=utf-8',
 '.txt': 'text/plain; charset=utf-8',
 '.md': 'text/plain; charset=utf-8',
};

export function createLoaderServer(root = ROOT) {
 return createServer(async (req, res) => {
 // CORS for import() and fetch(); Private Network Access lets public https pages reach 127.0.0.1.
 res.setHeader('Access-Control-Allow-Origin', '*');
 res.setHeader('Access-Control-Allow-Private-Network', 'true');
 res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
 res.setHeader('Cache-Control', 'no-cache');
 if (req.method === 'OPTIONS') {
 res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
 res.setHeader('Access-Control-Allow-Headers', '*');
 res.writeHead(204).end();
 return;
 }
 if (req.method !== 'GET' && req.method !== 'HEAD') {
 res.writeHead(405).end();
 return;
 }
 let rel;
 try {
 rel = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^[\\/]+/, '');
 } catch {
 res.writeHead(400).end();
 return;
 }
 if (rel === '' || rel === '.') rel = 'docs/install.html';
 const file = resolve(root, rel);
 const top = rel.split(/[\\/]/)[0];
 if (!file.startsWith(resolve(root) + sep) || !ALLOWED.includes(top)) {
 res.writeHead(404).end('not found');
 return;
 }
 try {
 const body = await readFile(file);
 res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Content-Length': body.length });
 res.end(req.method === 'HEAD' ? undefined : body);
 } catch {
 res.writeHead(404).end('not found');
 }
 });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const i = process.argv.indexOf('--port');
 const port = Number(i > 0 ? process.argv[i + 1] : process.env.PORT) || DEFAULT_PORT;
 createLoaderServer().listen(port, '127.0.0.1', () => {
 const base = 'http://127.0.0.1:' + port + '/';
 console.log('claude-chan hot-load server on ' + base);
 console.log('bookmarklet page: ' + base + 'docs/install.html');
 console.log('paste into any page\'s console:');
 console.log("  document.head.append(Object.assign(document.createElement('script'),{src:'" + base + "hotload/loader.js'}))");
 });
}
