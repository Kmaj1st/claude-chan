// Copies the built bundle (dist/*.js incl. lazy chunks) and the sprites into a host app folder.
// Usage: node scripts/vendor.mjs <target-dir> (run npm run build first)
// Result: <target>/claude-chan.js, chunks, and <target>/chars/ (pass sprites: '<public-url>/chars').
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
if (!target) {
 console.error('usage: node scripts/vendor.mjs <target-dir>');
 process.exit(2);
}
const dist = join(root, 'dist');
const chars = join(root, 'assets', 'chars');
if (!existsSync(join(dist, 'claude-chan.js'))) {
 console.error('dist/claude-chan.js missing: run npm run build first');
 process.exit(1);
}
if (!existsSync(join(chars, 'poses.json'))) {
 console.error('assets/chars/poses.json missing');
 process.exit(1);
}
const out = resolve(target);
mkdirSync(out, { recursive: true });
let n = 0;
for (const f of readdirSync(dist)) {
 if (f.endsWith('.js')) {
 cpSync(join(dist, f), join(out, f));
 n++;
 }
}
cpSync(chars, join(out, 'chars'), { recursive: true });
console.log('vendored ' + n + ' js files and chars/ into ' + out);
console.log('mount({ sprites: <public url of ' + out + '>/chars })');
