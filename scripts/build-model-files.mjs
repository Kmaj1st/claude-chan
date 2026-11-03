// Generates the Live2D motion3.json / exp3.json files for every preset (src/types.ts MOTIONS, EXPRESSIONS).
// Usage: node scripts/build-model-files.mjs [modelFolder]
// Without an argument it writes art/model-files/. With the exported model folder it writes into it and
// registers the motion groups and expressions in the *.model3.json (so Cubism Viewer is not needed).
import { mkdirSync, writeFileSync, readdirSync, readFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] ? resolve(process.argv[2]) : join(root, 'art', 'model-files');
const FPS = 30;

// Each motion: duration d (s), loop, tracks t { ParamId: [[time, value], ...] }. Start and end on the neutral pose.
const motions = {
  idle: { d: 4, loop: true, t: { ParamBreath: [[0, 0], [2, 1], [4, 0]], ParamAngleZ: [[0, 0], [1, 2], [3, -2], [4, 0]], ParamBodyAngleX: [[0, 0], [1, 1.5], [3, -1.5], [4, 0]], ParamAngleX: [[0, 0], [2, 3], [4, 0]] } },
  wave: { d: 2.4, t: { ParamAngleZ: [[0, 0], [0.4, 6], [1.8, 6], [2.4, 0]], ParamMouthForm: [[0, 0], [0.3, 1], [2, 1], [2.4, 0]], ParamArmRA: [[0, 0], [0.4, 10], [0.7, 4], [1, 10], [1.3, 4], [1.6, 10], [2.4, 0]], ParamBodyAngleZ: [[0, 0], [0.5, 3], [2, 3], [2.4, 0]] } },
  nod: { d: 1.4, t: { ParamAngleY: [[0, 0], [0.3, -18], [0.6, 4], [0.9, -14], [1.4, 0]], ParamEyeLOpen: [[0, 1], [0.3, 0.5], [0.6, 1]], ParamEyeROpen: [[0, 1], [0.3, 0.5], [0.6, 1]] } },
  shake_head: { d: 1.6, t: { ParamAngleX: [[0, 0], [0.25, -22], [0.6, 22], [0.95, -18], [1.3, 12], [1.6, 0]], ParamBrowLY: [[0, 0], [0.3, -0.5], [1.4, -0.5], [1.6, 0]], ParamBrowRY: [[0, 0], [0.3, -0.5], [1.4, -0.5], [1.6, 0]], ParamMouthForm: [[0, 0], [0.3, -0.7], [1.4, -0.7], [1.6, 0]] } },
  think: { d: 3, t: { ParamAngleZ: [[0, 0], [0.6, -10], [2.4, -10], [3, 0]], ParamEyeBallX: [[0, 0], [0.6, 0.7], [2.4, 0.7], [3, 0]], ParamEyeBallY: [[0, 0], [0.6, 0.6], [2.4, 0.6], [3, 0]], ParamBrowLY: [[0, 0], [0.6, 0.5], [2.4, 0.5], [3, 0]], ParamMouthForm: [[0, 0], [0.6, -0.3], [2.4, -0.3], [3, 0]] } },
  happy: { d: 2, t: { ParamMouthForm: [[0, 0], [0.3, 1], [1.7, 1], [2, 0]], ParamEyeLOpen: [[0, 1], [0.3, 0.2], [1.7, 0.2], [2, 1]], ParamEyeROpen: [[0, 1], [0.3, 0.2], [1.7, 0.2], [2, 1]], ParamCheek: [[0, 0], [0.4, 1], [1.7, 1], [2, 0]], ParamBodyAngleZ: [[0, 0], [0.5, 4], [1, -4], [1.5, 4], [2, 0]], ParamAngleZ: [[0, 0], [0.5, 5], [1, -5], [1.5, 5], [2, 0]] } },
  surprised: { d: 1.8, t: { ParamBrowLY: [[0, 0], [0.12, 1], [1.4, 1], [1.8, 0]], ParamBrowRY: [[0, 0], [0.12, 1], [1.4, 1], [1.8, 0]], ParamMouthOpenY: [[0, 0], [0.15, 1], [1.4, 0.8], [1.8, 0]], ParamAngleY: [[0, 0], [0.15, 10], [1.4, 8], [1.8, 0]], ParamBodyAngleZ: [[0, 0], [0.15, -5], [1.4, -4], [1.8, 0]] } },
  bow: { d: 2.4, t: { ParamAngleY: [[0, 0], [0.8, -25], [1.5, -25], [2.4, 0]], ParamBodyAngleZ: [[0, 0], [0.8, 8], [1.5, 8], [2.4, 0]], ParamEyeLOpen: [[0, 1], [0.8, 0.3], [1.5, 0.3], [2.4, 1]], ParamEyeROpen: [[0, 1], [0.8, 0.3], [1.5, 0.3], [2.4, 1]] } },
  cheer: { d: 2.2, t: { ParamArmLA: [[0, 0], [0.4, 10], [0.7, 6], [1, 10], [1.3, 6], [1.6, 10], [2.2, 0]], ParamArmRA: [[0, 0], [0.4, 10], [0.7, 6], [1, 10], [1.3, 6], [1.6, 10], [2.2, 0]], ParamMouthOpenY: [[0, 0], [0.4, 0.8], [1.8, 0.8], [2.2, 0]], ParamMouthForm: [[0, 0], [0.4, 1], [1.8, 1], [2.2, 0]], ParamBodyAngleY: [[0, 0], [0.7, 4], [1.3, -2], [2.2, 0]], ParamAngleY: [[0, 0], [0.4, 10], [1.8, 10], [2.2, 0]] } },
  sleepy: { d: 5, loop: true, t: { ParamEyeLOpen: [[0, 0.5], [1.5, 0.1], [2.5, 0.4], [3.5, 0.05], [5, 0.5]], ParamEyeROpen: [[0, 0.5], [1.5, 0.1], [2.5, 0.4], [3.5, 0.05], [5, 0.5]], ParamAngleY: [[0, -6], [1.5, -14], [2.5, -8], [3.5, -16], [5, -6]], ParamAngleZ: [[0, 3], [2.5, 6], [5, 3]], ParamBreath: [[0, 0], [2.5, 1], [5, 0]] } },
  typing: { d: 1.2, loop: true, t: { ParamAngleY: [[0, -8], [0.6, -10], [1.2, -8]], ParamArmLA: [[0, 4], [0.3, 7], [0.6, 4], [0.9, 7], [1.2, 4]], ParamArmRA: [[0, 7], [0.3, 4], [0.6, 7], [0.9, 4], [1.2, 7]], ParamEyeBallY: [[0, -0.6], [1.2, -0.6]] } },
  tea_serve: { d: 3, t: { ParamAngleZ: [[0, 0], [0.8, 4], [2.2, 4], [3, 0]], ParamArmLA: [[0, 0], [0.8, 8], [2.2, 8], [3, 0]], ParamArmRA: [[0, 0], [0.8, 8], [2.2, 8], [3, 0]], ParamMouthForm: [[0, 0], [0.8, 0.8], [2.2, 0.8], [3, 0]], ParamBodyAngleZ: [[0, 0], [0.8, 4], [2.2, 4], [3, 0]] } },
  pout: { d: 2.4, t: { ParamMouthForm: [[0, 0], [0.4, -1], [2, -1], [2.4, 0]], ParamCheek: [[0, 0], [0.4, 1], [2, 1], [2.4, 0]], ParamBrowLY: [[0, 0], [0.4, -0.7], [2, -0.7], [2.4, 0]], ParamBrowRY: [[0, 0], [0.4, -0.7], [2, -0.7], [2.4, 0]], ParamAngleX: [[0, 0], [0.5, 14], [2, 14], [2.4, 0]], ParamEyeBallX: [[0, 0], [0.5, -0.8], [2, -0.8], [2.4, 0]] } },
  wink: { d: 1.4, t: { ParamEyeLOpen: [[0, 1], [0.25, 0], [0.9, 0], [1.2, 1]], ParamMouthForm: [[0, 0], [0.25, 1], [1, 1], [1.4, 0]], ParamAngleZ: [[0, 0], [0.3, 6], [1, 6], [1.4, 0]] } },
  point: { d: 2.2, t: { ParamArmRA: [[0, 0], [0.5, 10], [1.7, 10], [2.2, 0]], ParamAngleX: [[0, 0], [0.5, 10], [1.7, 10], [2.2, 0]], ParamEyeBallX: [[0, 0], [0.5, 0.8], [1.7, 0.8], [2.2, 0]], ParamBodyAngleX: [[0, 0], [0.5, 4], [1.7, 4], [2.2, 0]] } },
};
// Additive expressions: small changes on top of the running pose.
const expressions = {
  neutral: [],
  smile: [['ParamMouthForm', 1, 'Add'], ['ParamEyeLOpen', 0.85, 'Multiply'], ['ParamEyeROpen', 0.85, 'Multiply']],
  sad: [['ParamMouthForm', -0.8, 'Add'], ['ParamBrowLY', -0.5, 'Add'], ['ParamBrowRY', -0.5, 'Add'], ['ParamEyeLOpen', 0.8, 'Multiply'], ['ParamEyeROpen', 0.8, 'Multiply']],
  angry: [['ParamMouthForm', -0.6, 'Add'], ['ParamBrowLY', -0.9, 'Add'], ['ParamBrowRY', -0.9, 'Add']],
  blush: [['ParamCheek', 1, 'Add'], ['ParamMouthForm', 0.4, 'Add']],
  surprised: [['ParamBrowLY', 0.9, 'Add'], ['ParamBrowRY', 0.9, 'Add'], ['ParamMouthOpenY', 0.7, 'Add']],
};

function motion3(m) {
  const curves = Object.entries(m.t).map(([id, pts]) => {
    const seg = [pts[0][0], pts[0][1]];
    for (const [t, v] of pts.slice(1)) seg.push(0, t, v); // 0 = linear segment
    return { Target: 'Parameter', Id: id, Segments: seg };
  });
  const points = curves.reduce((n, c) => n + 1 + (c.Segments.length - 2) / 3, 0);
  return { Version: 3, Meta: { Duration: m.d, Fps: FPS, Loop: !!m.loop, AreBeziersRestricted: true, CurveCount: curves.length, TotalSegmentCount: points - curves.length, TotalPointCount: points, UserDataCount: 0, TotalUserDataSize: 0 }, Curves: curves };
}
const exp3 = list => ({ Type: 'Live2D Expression', Parameters: list.map(([Id, Value, Blend]) => ({ Id, Value, Blend })) });
const write = (rel, obj) => { const f = join(target, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(obj, null, 1) + '\n'); };

for (const [name, m] of Object.entries(motions)) write(`motions/${name}.motion3.json`, motion3(m));
for (const [name, list] of Object.entries(expressions)) write(`expressions/${name}.exp3.json`, exp3(list));
copyFileSync(join(root, 'src/model/motions.default.json'), join(target, 'motions.json'));

if (process.argv[2]) {
  const mf = readdirSync(target).find(f => f.endsWith('.model3.json'));
  if (!mf) throw new Error('no *.model3.json in ' + target);
  const model = JSON.parse(readFileSync(join(target, mf), 'utf8'));
  const refs = (model.FileReferences ??= {});
  refs.Motions = Object.fromEntries(Object.keys(motions).map(n => [n, [{ File: `motions/${n}.motion3.json`, FadeInTime: 0.3, FadeOutTime: 0.3 }]]));
  refs.Expressions = Object.keys(expressions).map(n => ({ Name: n, File: `expressions/${n}.exp3.json` }));
  writeFileSync(join(target, mf), JSON.stringify(model, null, 2) + '\n');
  console.log('registered motions and expressions in', mf);
}
console.log(`wrote ${Object.keys(motions).length} motions and ${Object.keys(expressions).length} expressions to ${target}`);
