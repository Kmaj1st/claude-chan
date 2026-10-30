// Import tool for ChatGPT-generated art. Usage: node scripts/import-generated.mjs [--status]
// Reads assets/generated-inbox/, keys out chroma green, slices contact sheets (S1..S5),
// aligns every cell to the base canvas, validates, writes assets/generated/ + manifest.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INBOX = path.join(ROOT, 'assets', 'generated-inbox');
const OUT = path.join(ROOT, 'assets', 'generated');
const CANVAS = 1536;
const items = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'art-items.json'), 'utf8'));
const manifestPath = path.join(OUT, 'manifest.json');

function loadManifest() {
 return fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { canvas: CANVAS, items: {} };
}

// Remove flat chroma green (and spill) from an RGBA buffer.
export function keyGreen(data) {
 for (let i = 0; i < data.length; i += 4) {
 const r = data[i], g = data[i + 1], b = data[i + 2];
 if (g > 120 && g > r * 1.35 && g > b * 1.35) {
 const k = Math.min(1, (g - Math.max(r, b)) / 90);
 data[i + 3] = Math.round(data[i + 3] * (1 - k));
 data[i + 1] = Math.min(g, Math.max(r, b));
 }
 }
 return data;
}

// Validate a keyed cell: transparency present, but the character is not empty.
export function validate(data) {
 let clear = 0;
 const px = data.length / 4;
 for (let i = 3; i < data.length; i += 4) if (data[i] < 16) clear++;
 const ratio = clear / px;
 if (ratio < 0.05) return 'no transparency (green key failed?)';
 if (ratio > 0.97) return 'cell is almost empty';
 return null;
}

async function keyed(input) {
 const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
 keyGreen(data);
 return { data, info };
}

async function save(dir, name, data, info, manifest, source) {
 const err = validate(data);
 if (err) { console.log(' REJECT ' + name + ': ' + err); return; }
 const dest = path.join(OUT, dir);
 fs.mkdirSync(dest, { recursive: true });
 await sharp(data, { raw: info }).resize(CANVAS, CANVAS, { fit: 'fill' }).png().toFile(path.join(dest, name + '.png'));
 manifest.items[name] = { dir, file: dir + '/' + name + '.png', source };
 console.log(' ok ' + name);
}

async function importSheet(id, spec, file, manifest) {
 const { data, info } = await keyed(file);
 const cw = Math.floor(info.width / spec.cols), ch = Math.floor(info.height / spec.rows);
 for (let n = 0; n < spec.items.length; n++) {
 const cx = (n % spec.cols) * cw, cy = Math.floor(n / spec.cols) * ch;
 const cell = Buffer.alloc(cw * ch * 4);
 for (let y = 0; y < ch; y++) data.copy(cell, y * cw * 4, ((cy + y) * info.width + cx) * 4, ((cy + y) * info.width + cx + cw) * 4);
 await save(spec.dir, spec.items[n], cell, { width: cw, height: ch, channels: 4 }, manifest, path.basename(file));
 }
}

async function importSingle(name, dir, file, manifest) {
 const { data, info } = await keyed(file);
 await save(dir, name, data, info, manifest, path.basename(file));
}

function status(manifest) {
 const missing = [];
 for (const [id, spec] of Object.entries(items)) {
 const gone = spec.items.filter((n) => !manifest.items[n]);
 if (gone.length) missing.push(id + ': ' + gone.join(', '));
 }
 console.log(missing.length ? 'Still missing:' + String.fromCharCode(10) + ' ' + missing.join(String.fromCharCode(10) + ' ') : 'All items present.');
}

async function main() {
 const manifest = loadManifest();
 if (!process.argv.includes('--status') && fs.existsSync(INBOX)) {
 const files = fs.readdirSync(INBOX).filter((f) => /.$/i.test(f)).sort();
 for (const f of files) {
 const full = path.join(INBOX, f);
 const sheet = Object.keys(items).find((id) => f.toUpperCase().startsWith(id + '-') || f.toUpperCase().startsWith(id + '.') || f.toUpperCase().startsWith(id + '_'));
 if (sheet) { console.log(f + ' -> sheet ' + sheet); await importSheet(sheet, items[sheet], full, manifest); continue; }
 let hit = null;
 for (const spec of Object.values(items)) { const n = spec.items.find((i) => f.startsWith(i)); if (n) hit = { n, dir: spec.dir }; }
 if (hit) { console.log(f + ' -> item ' + hit.n); await importSingle(hit.n, hit.dir, full, manifest); }
 else console.log(f + ' -> ignored (name does not start with a sheet or item id)');
 }
 fs.mkdirSync(OUT, { recursive: true });
 fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
 }
 status(manifest);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) await main();
