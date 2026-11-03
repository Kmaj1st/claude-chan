// Generates art/claude-chan.psd: an original, layered placeholder for the Live2D rig.
// Layer names follow docs/ART-PIPELINE.md section 2; colours follow docs/CHARACTER.md.
// Run: npm run build:psd
import sharp from 'sharp';
import { writePsd } from 'ag-psd';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 2048, H = 2048;
const C = {
  hair: '#D97757', hairShade: '#B85C3E', hi: '#F2A27F', white: '#FFF8F0', whiteShade: '#EADFD2',
  brown: '#4A2E22', line: '#2B1A13', skin: '#FDE3D0', blush: '#F4A0A0',
};
const stroke = `stroke="${C.line}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;
const CX = 1024, HEAD_Y = 640;

// Each part: [group, name, svg body]. Order is back to front within the file.
const parts = [];
const add = (group, name, body) => parts.push({ group, name, body });
const both = (group, name, fn) => { add(group, name + '_L', fn(-1)); add(group, name + '_R', fn(1)); };
const x = (s, d) => CX + s * d;

// Hair back
add('Hair back', 'hair_back_long', `<path d="M${CX - 380} 520 C${CX - 460} 900 ${CX - 430} 1350 ${CX - 340} 1560 L${CX + 340} 1560 C${CX + 430} 1350 ${CX + 460} 900 ${CX + 380} 520 Z" fill="${C.hair}" ${stroke}/>`);
add('Hair back', 'hair_back_tips', `<path d="M${CX - 340} 1500 L${CX - 260} 1640 L${CX - 170} 1520 L${CX - 80} 1650 L${CX} 1520 L${CX + 90} 1650 L${CX + 180} 1520 L${CX + 260} 1640 L${CX + 340} 1500 Z" fill="${C.hairShade}" ${stroke}/>`);

// Body
add('Body', 'neck', `<rect x="${CX - 60}" y="940" width="120" height="120" rx="30" fill="${C.skin}" ${stroke}/>`);
add('Body', 'body', `<path d="M${CX - 230} 1040 Q${CX} 980 ${CX + 230} 1040 L${CX + 200} 1500 L${CX - 200} 1500 Z" fill="${C.skin}" ${stroke}/>`);
both('Body', 'arm_upper', s => `<path d="M${x(s, 220)} 1060 L${x(s, 330)} 1330 L${x(s, 250)} 1360 L${x(s, 170)} 1100 Z" fill="${C.skin}" ${stroke}/>`);
both('Body', 'arm_lower', s => `<path d="M${x(s, 330)} 1320 L${x(s, 360)} 1560 L${x(s, 280)} 1580 L${x(s, 250)} 1350 Z" fill="${C.skin}" ${stroke}/>`);
both('Body', 'hand', s => `<ellipse cx="${x(s, 325)}" cy="1620" rx="55" ry="60" fill="${C.skin}" ${stroke}/>`);

// Outfit
add('Outfit', 'dress', `<path d="M${CX - 230} 1040 Q${CX} 990 ${CX + 230} 1040 L${CX + 330} 1900 L${CX - 330} 1900 Z" fill="${C.brown}" ${stroke}/>`);
add('Outfit', 'apron', `<path d="M${CX - 150} 1120 Q${CX} 1090 ${CX + 150} 1120 L${CX + 230} 1880 L${CX - 230} 1880 Z" fill="${C.white}" ${stroke}/>`);
add('Outfit', 'apron_frill', `<path d="M${CX - 235} 1860 ${Array.from({ length: 8 }, (_, i) => `q${i % 2 ? 30 : 30} 50 ${(470 / 8).toFixed(1)} 0`).join(' ')} L${CX + 235} 1900 L${CX - 235} 1900 Z" fill="${C.whiteShade}" ${stroke}/>`);
both('Outfit', 'suspender', s => `<path d="M${x(s, 120)} 1090 L${x(s, 90)} 1130 L${x(s, 130)} 1480 L${x(s, 170)} 1470 Z" fill="${C.brown}" ${stroke}/>`);
add('Outfit', 'bow_brown', `<path d="M${CX} 1085 L${CX - 110} 1030 L${CX - 110} 1140 Z M${CX} 1085 L${CX + 110} 1030 L${CX + 110} 1140 Z" fill="${C.brown}" ${stroke}/><circle cx="${CX}" cy="1085" r="26" fill="${C.brown}" ${stroke}/>`);
add('Outfit', 'brooch_flower', [0, 72, 144, 216, 288].map(a => `<ellipse cx="${CX}" cy="1190" rx="14" ry="26" fill="${C.hi}" ${stroke} transform="rotate(${a} ${CX} 1190) translate(0 -26)"/>`).join('') + `<circle cx="${CX}" cy="1190" r="14" fill="${C.white}" ${stroke}/>`);

// Head
both('Head', 'ear', s => `<ellipse cx="${x(s, 300)}" cy="${HEAD_Y + 30}" rx="40" ry="60" fill="${C.skin}" ${stroke}/>`);
add('Head', 'face', `<path d="M${CX - 300} ${HEAD_Y - 80} Q${CX - 300} ${HEAD_Y + 330} ${CX} ${HEAD_Y + 340} Q${CX + 300} ${HEAD_Y + 330} ${CX + 300} ${HEAD_Y - 80} Q${CX + 300} ${HEAD_Y - 330} ${CX} ${HEAD_Y - 330} Q${CX - 300} ${HEAD_Y - 330} ${CX - 300} ${HEAD_Y - 80} Z" fill="${C.skin}" ${stroke}/>`);
both('Head', 'cheek_blush', s => `<ellipse cx="${x(s, 170)}" cy="${HEAD_Y + 170}" rx="70" ry="38" fill="${C.blush}" opacity="0.75"/>`);
add('Head', 'nose', `<path d="M${CX - 8} ${HEAD_Y + 140} q8 14 16 0" fill="none" ${stroke}/>`);

// Eyes (per side). Eye centre x = CX +- 120, y = HEAD_Y + 60.
const EY = HEAD_Y + 60;
both('Eyes', 'eye_white', s => `<ellipse cx="${x(s, 120)}" cy="${EY}" rx="82" ry="95" fill="#FFFFFF"/>`);
both('Eyes', 'iris', s => `<ellipse cx="${x(s, 120)}" cy="${EY + 10}" rx="62" ry="78" fill="${C.hair}"/><ellipse cx="${x(s, 120)}" cy="${EY + 45}" rx="55" ry="40" fill="${C.hi}" opacity="0.7"/>`);
both('Eyes', 'pupil', s => `<ellipse cx="${x(s, 120)}" cy="${EY + 12}" rx="30" ry="42" fill="${C.line}"/>`);
both('Eyes', 'highlight', s => `<circle cx="${x(s, 120) - 22}" cy="${EY - 25}" r="16" fill="#FFFFFF"/><circle cx="${x(s, 120) + 24}" cy="${EY + 40}" r="8" fill="#FFFFFF"/>`);
both('Eyes', 'upper_lash', s => `<path d="M${x(s, 120) - 92} ${EY - 10} Q${x(s, 120)} ${EY - 135} ${x(s, 120) + 92} ${EY - 10}" fill="none" stroke="${C.line}" stroke-width="16" stroke-linecap="round"/><path d="M${x(s, 120) + s * 92} ${EY - 10} l${s * 22} -22" stroke="${C.line}" stroke-width="12" stroke-linecap="round"/>`);
both('Eyes', 'lower_lash', s => `<path d="M${x(s, 120) - 70} ${EY + 90} Q${x(s, 120)} ${EY + 112} ${x(s, 120) + 70} ${EY + 90}" fill="none" stroke="${C.line}" stroke-width="6" stroke-linecap="round" opacity="0.7"/>`);
both('Eyes', 'eyelid_closed', s => `<path d="M${x(s, 120) - 85} ${EY + 10} Q${x(s, 120)} ${EY + 55} ${x(s, 120) + 85} ${EY + 10}" fill="none" stroke="${C.line}" stroke-width="14" stroke-linecap="round"/>`);

// Brows
both('Brows', 'brow', s => `<path d="M${x(s, 120) - 70} ${EY - 140} Q${x(s, 120)} ${EY - 170} ${x(s, 120) + 70} ${EY - 140}" fill="none" stroke="${C.hairShade}" stroke-width="14" stroke-linecap="round"/>`);

// Mouth
const MY = HEAD_Y + 230;
add('Mouth', 'teeth', `<path d="M${CX - 38} ${MY + 6} Q${CX} ${MY + 14} ${CX + 38} ${MY + 6} L${CX + 34} ${MY + 28} L${CX - 34} ${MY + 28} Z" fill="#FFFFFF"/>`);
add('Mouth', 'tongue', `<ellipse cx="${CX}" cy="${MY + 48}" rx="30" ry="18" fill="#E87A7A"/>`);
add('Mouth', 'mouth_open', `<path d="M${CX - 44} ${MY} Q${CX} ${MY + 90} ${CX + 44} ${MY} Q${CX} ${MY + 10} ${CX - 44} ${MY} Z" fill="#8A2E2E" ${stroke}/>`);
add('Mouth', 'mouth_closed', `<path d="M${CX - 45} ${MY} Q${CX} ${MY + 36} ${CX + 45} ${MY}" fill="none" stroke="${C.line}" stroke-width="9" stroke-linecap="round"/>`);

// Hair front
both('Hair front', 'side_hair', s => `<path d="M${x(s, 300)} ${HEAD_Y - 120} C${x(s, 380)} ${HEAD_Y + 200} ${x(s, 340)} ${HEAD_Y + 520} ${x(s, 250)} ${HEAD_Y + 640} C${x(s, 200)} ${HEAD_Y + 400} ${x(s, 230)} ${HEAD_Y + 100} ${x(s, 230)} ${HEAD_Y - 100} Z" fill="${C.hair}" ${stroke}/>`);
add('Hair front', 'bangs', `<path d="M${CX - 320} ${HEAD_Y - 100} Q${CX - 320} ${HEAD_Y - 400} ${CX} ${HEAD_Y - 400} Q${CX + 320} ${HEAD_Y - 400} ${CX + 320} ${HEAD_Y - 100} Q${CX + 250} ${HEAD_Y - 180} ${CX + 180} ${HEAD_Y - 40} Q${CX + 110} ${HEAD_Y - 190} ${CX + 40} ${HEAD_Y - 30} Q${CX - 20} ${HEAD_Y - 190} ${CX - 100} ${HEAD_Y - 30} Q${CX - 170} ${HEAD_Y - 180} ${CX - 320} ${HEAD_Y - 100} Z" fill="${C.hair}" ${stroke}/><path d="M${CX - 200} ${HEAD_Y - 300} Q${CX - 60} ${HEAD_Y - 360} ${CX + 80} ${HEAD_Y - 320}" fill="none" stroke="${C.hi}" stroke-width="18" stroke-linecap="round"/>`);
add('Hair front', 'ahoge', `<path d="M${CX} ${HEAD_Y - 390} C${CX - 40} ${HEAD_Y - 480} ${CX + 70} ${HEAD_Y - 520} ${CX + 20} ${HEAD_Y - 600} C${CX + 90} ${HEAD_Y - 530} ${CX + 20} ${HEAD_Y - 450} ${CX + 30} ${HEAD_Y - 390} Z" fill="${C.hair}" ${stroke}/>`);

// Accessories
add('Accessories', 'headdress_frill', `<path d="M${CX - 280} ${HEAD_Y - 320} Q${CX} ${HEAD_Y - 450} ${CX + 280} ${HEAD_Y - 320} ${Array.from({ length: 7 }, () => 'q-20 50 -80 0').join(' ')} Z" fill="${C.white}" ${stroke}/>`);
add('Accessories', 'hairpin_flower', [0, 72, 144, 216, 288].map(a => `<ellipse cx="${CX + 230}" cy="${HEAD_Y - 280}" rx="22" ry="42" fill="${C.hi}" ${stroke} transform="rotate(${a} ${CX + 230} ${HEAD_Y - 280}) translate(0 -40)"/>`).join('') + `<circle cx="${CX + 230}" cy="${HEAD_Y - 280}" r="20" fill="${C.white}" ${stroke}/>`);
const tassel = (dx, dir) => `<path d="M${CX + dx} ${HEAD_Y - 240} l${dir * 10} 110" stroke="${C.brown}" stroke-width="8" stroke-linecap="round"/><ellipse cx="${CX + dx + dir * 10}" cy="${HEAD_Y - 120}" rx="14" ry="26" fill="${C.hi}" ${stroke}/>`;
add('Accessories', 'hairpin_tassel_L', tassel(215, -1));
add('Accessories', 'hairpin_tassel_R', tassel(245, 1));

async function rasterise(body) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
  const { data } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    if (data[(y * W + xx) * 4 + 3]) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) throw new Error('empty layer');
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) out.set(data.subarray(((y + y0) * W + x0) * 4, ((y + y0) * W + x0 + w) * 4), y * w * 4);
  return { left: x0, top: y0, right: x1 + 1, bottom: y1 + 1, imageData: { width: w, height: h, data: out } };
}

const groups = new Map();
const bad = [];
const previewLayers = [];
for (const p of parts) {
  const layer = { name: p.name, ...(await rasterise(p.body)) };
  if (layer.left < 0 || layer.top < 0 || layer.right > W || layer.bottom > H || layer.imageData.width > W) bad.push(p.name + JSON.stringify([layer.left, layer.top, layer.right, layer.bottom]));
  if (!/eyelid_closed|mouth_open|tongue|teeth/.test(p.name)) previewLayers.push({ input: Buffer.from(layer.imageData.data.buffer), raw: { width: layer.imageData.width, height: layer.imageData.height, channels: 4 }, left: layer.left, top: layer.top });
  if (!groups.has(p.group)) groups.set(p.group, []);
  groups.get(p.group).push(layer);
}
if (bad.length) console.log("out of canvas:", bad.join(" "));
const children = [...groups].map(([name, kids]) => ({ name, opened: true, children: kids }));
const psd = { width: W, height: H, children };
const out = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'art', 'claude-chan.psd');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.from(writePsd(psd, { generateThumbnail: false })));
await sharp(await sharp({ create: { width: W, height: H, channels: 4, background: '#ffffff' } }).composite(previewLayers).png().toBuffer()).resize(640).png().toFile(resolve(dirname(out), 'claude-chan.preview.png'));
console.log(`wrote ${out}: ${parts.length} layers in ${groups.size} groups`);
