// Generates art/claude-chan-sprite.psd from the normal sprite art (assets/chars, see NOTICE.md).
// Base = idle. Overlays (closed eyes, open mouth, wink eye) are cut from the beam and blink poses with a
// feathered mask and moved onto the idle face. Coordinates are in idle pixels; the PSD is scaled by S.
// Run: npm run build:psd:sprite
import sharp from 'sharp';
import { writePsd } from 'ag-psd';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const S = 2;
// [name, source pose, source centre, target centre on idle, half width, half height]
const overlays = [
  ['eyelid_closed_L', 'beam', [246, 155], [240, 157], 34, 24],
  ['eyelid_closed_R', 'beam', [306, 122], [300, 128], 30, 22],
  ['mouth_open', 'beam', [279, 179], [281, 180], 26, 24],
];

async function raw(file) {
  const { data, info } = await sharp(resolve(root, 'assets/chars', file)).ensureAlpha().resize(Math.round((await sharp(resolve(root, 'assets/chars', file)).metadata()).width * S)).raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
const idle = await raw('idle.webp');
const layers = [{ name: 'body_full', left: 0, top: 0, imageData: { width: idle.w, height: idle.h, data: new Uint8ClampedArray(idle.data) } }];
const poses = { beam: await raw('beam.webp') };

for (const [name, pose, [sx, sy], [tx, ty], hw, hh] of overlays) {
  const src = poses[pose], w = hw * 2 * S, h = hh * 2 * S;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ex = (x / w) * 2 - 1, ey = (y / h) * 2 - 1, r = Math.hypot(ex, ey);
    const a = r >= 1 ? 0 : r < 0.6 ? 1 : (1 - r) / 0.4; // feathered ellipse
    const px = Math.round((sx - hw) * S + x), py = Math.round((sy - hh) * S + y);
    if (px < 0 || py < 0 || px >= src.w || py >= src.h) continue;
    const i = (py * src.w + px) * 4, o = (y * w + x) * 4;
    out[o] = src.data[i]; out[o + 1] = src.data[i + 1]; out[o + 2] = src.data[i + 2]; out[o + 3] = Math.round(src.data[i + 3] * a);
  }
  layers.push({ name, left: Math.round((tx - hw) * S), top: Math.round((ty - hh) * S), imageData: { width: w, height: h, data: out } });
}

const psd = { width: idle.w, height: idle.h, children: [
  { name: 'Body', opened: true, children: [layers[0]] },
  { name: 'Face overlays', opened: true, children: layers.slice(1) },
] };
const dir = resolve(root, 'art');
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'claude-chan-sprite.psd'), Buffer.from(writePsd(psd, { generateThumbnail: false })));
// Preview with every overlay visible, to check placement.
const comp = layers.slice(1).map(l => ({ input: Buffer.from(l.imageData.data.buffer), raw: { width: l.imageData.width, height: l.imageData.height, channels: 4 }, left: l.left, top: l.top }));
await sharp(await sharp(Buffer.from(idle.data), { raw: { width: idle.w, height: idle.h, channels: 4 } }).flatten({ background: '#888' }).composite(comp).png().toBuffer())
  .extract({ left: 340, top: 180, width: 400, height: 280 }).png().toFile(resolve(dir, 'claude-chan-sprite.preview.png'));
console.log('wrote art/claude-chan-sprite.psd:', layers.length, 'layers');
