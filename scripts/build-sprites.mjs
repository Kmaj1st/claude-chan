// Builds assets/chars (webp pose images + poses.json) from the MIT-licensed art repo.
// Usage: node scripts/build-sprites.mjs <path to a clone of Chaosnap/Claude_Overdose>
// Every image is scaled so the face box has the same height (FACE_H), which keeps the
// character the same size across poses; poses.json stores the face centre as the anchor.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sharp = createRequire(import.meta.url)('sharp');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const art = process.argv[2];
if (!art) { console.error('usage: node scripts/build-sprites.mjs <art repo folder>'); process.exit(2); }

const REF = { w: 400, h: 600, faceH: 144, faceY: 137, zoom: 0.85 };
// pose id -> source file (without .webp) and optional blink/talk partner pose ids.
const SOURCES = {
 idle: { src: 'seq_a_smile', blink: 'blink', talk: 'explain', tags: ['neutral', 'idle', 'calm'] },
 blink: { src: 'seq_a_blink', tags: ['blink', 'eyes-closed'] },
 beam: { src: 'seq_a_beam', tags: ['smile', 'happy', 'blush'] },
 happy: { src: 'char_close_e', tags: ['happy', 'eyes-closed'] },
 giggle: { src: 'seq_d_giggle', tags: ['happy', 'laugh'] },
 wave: { src: 'seq_f_wave', tags: ['wave', 'greeting'] },
 ponder: { src: 'seq_e_ponder', tags: ['think'] },
 think: { src: 'char_close_think', tags: ['think'] },
 notice: { src: 'seq_f_notice', tags: ['surprised', 'blush'] },
 surprised: { src: 'char_close_surprised', tags: ['surprised'] },
 cheer: { src: 'char_close_a', tags: ['cheer'] },
 cheer_wink: { src: 'char_close_b', tags: ['cheer', 'wink'] },
 sleepy: { src: 'char_close_sleepy', tags: ['sleepy'] },
 typing: { src: 'char_close_phone', tags: ['typing'] },
 explain: { src: 'seq_e_explain', tags: ['talk', 'serve'] },
 pout: { src: 'char_close_pout', tags: ['pout', 'angry'] },
 idea: { src: 'seq_e_idea', tags: ['point', 'idea'] },
 sad: { src: 'seq_b_down', tags: ['sad'] },
 blush: { src: 'char_close_chin', tags: ['blush', 'shy'] },
 wink: { src: 'char_close_fingerheart', tags: ['wink'] },
 away: { src: 'seq_f_away', tags: ['look-away'] },
};

const manifest = JSON.parse(readFileSync(join(art, 'public/assets/manifest.json'), 'utf8')).chars;
const out = join(root, 'assets/chars');
mkdirSync(out, { recursive: true });
const poses = {};
for (const [id, s] of Object.entries(SOURCES)) {
 const m = manifest[s.src];
 if (!m || !m.face) throw new Error('no face box for ' + s.src);
 const [x0, y0, x1, y1] = m.face;
 const k = REF.faceH / (y1 - y0);
 const w = Math.round(m.w * k);
 const h = Math.round(m.h * k);
 const file = id + '.webp';
 await sharp(join(art, 'public/assets/chars', s.src + '.webp')).resize(w, h).webp({ quality: 80, effort: 6 }).toFile(join(out, file));
 poses[id] = {
 file, w, h,
 anchor: [Math.round((x0 + x1) / 2 * k), Math.round((y0 + y1) / 2 * k)],
 tags: s.tags,
 ...(s.blink ? { blink: s.blink } : {}),
 ...(s.talk ? { talk: s.talk } : {}),
 source: s.src,
 };
 console.log(id.padEnd(11), w + 'x' + h, 'anchor', poses[id].anchor.join(','), statSync(join(out, file)).size);
}
writeFileSync(join(out, 'poses.json'), JSON.stringify({ version: 1, ref: REF, poses }, null, 1) + '\n');
