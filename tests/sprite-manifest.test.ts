import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EXPRESSION_TOKEN, placePose, validateMotionMap, validatePoseSet, type PoseSet } from '../src/sprite/manifest';
import { EXPRESSIONS, MOTIONS } from '../src/types';

const dir = new URL('../assets/chars/', import.meta.url);
const read = (name: string): unknown => JSON.parse(readFileSync(new URL(name, dir), 'utf8'));

const tiny = (): PoseSet => ({
 version: 1,
 ref: { w: 100, h: 200, faceH: 40, faceY: 50 },
 poses: { a: { file: 'a.webp', w: 100, h: 160, anchor: [50, 40] }, b: { file: 'b.webp', w: 80, h: 200, anchor: [40, 50] } },
});

describe('shipped pose set', () => {
 const raw = read('poses.json');
 const poses = validatePoseSet(raw);

 it('validates', () => {
 expect(poses.ok ? [] : poses.errors).toEqual([]);
 });

 it('has an existing image of the declared size for every pose, and no unused image', async () => {
 if (!poses.ok) throw new Error('invalid');
 const sharp = createRequire(import.meta.url)('sharp') as (p: string) => { metadata(): Promise<{ width: number; height: number }> };
 for (const [id, p] of Object.entries(poses.value.poses)) {
 const path = fileURLToPath(new URL(p.file, dir));
 expect(existsSync(path), id).toBe(true);
 const m = await sharp(path).metadata();
 expect([m.width, m.height], id).toEqual([p.w, p.h]);
 }
 const files = readdirSync(dir).filter((f) => f.endsWith('.webp')).sort();
 expect(files).toEqual(Object.values(poses.value.poses).map((p) => p.file).sort());
 });

 it('maps every motion and expression, and uses every pose', () => {
 if (!poses.ok) throw new Error('invalid');
 const map = validateMotionMap(read('motions.json'), poses.value);
 expect(map.ok ? [] : map.errors).toEqual([]);
 if (!map.ok) return;
 expect(Object.keys(map.value.motions).sort()).toEqual([...MOTIONS].sort());
 expect(Object.keys(map.value.expressions).sort()).toEqual([...EXPRESSIONS].sort());
 const used = new Set<string>(Object.values(map.value.expressions));
 for (const m of Object.values(map.value.motions)) for (const s of m.steps ?? []) if (s.pose !== EXPRESSION_TOKEN) used.add(s.pose);
 for (const p of Object.values(poses.value.poses)) { if (p.blink) used.add(p.blink); if (p.talk) used.add(p.talk); }
 expect(Object.keys(poses.value.poses).filter((id) => !used.has(id))).toEqual([]);
 });

 it('keeps every pose bottom-aligned so no gap shows under the character', () => {
 if (!poses.ok) throw new Error('invalid');
 for (const [id, p] of Object.entries(poses.value.poses)) {
 const pl = placePose(p, poses.value.ref);
 expect(pl.top + pl.height, id).toBeGreaterThanOrEqual(100 - 1e-9);
 }
 });
});

describe('validatePoseSet', () => {
 it('accepts a minimal set', () => expect(validatePoseSet(tiny()).ok).toBe(true));

 it('rejects bad shapes with readable errors', () => {
 expect(validatePoseSet(null).ok).toBe(false);
 expect(validatePoseSet({ version: 2, ref: {}, poses: {} }).ok).toBe(false);
 const dup = tiny();
 dup.poses.b!.file = 'a.webp';
 expect(JSON.stringify(validatePoseSet(dup))).toContain('used twice');
 const away = tiny();
 away.poses.a!.anchor = [500, 40];
 expect(JSON.stringify(validatePoseSet(away))).toContain('outside');
 const path = tiny();
 path.poses.a!.file = '../x.webp';
 expect(validatePoseSet(path).ok).toBe(false);
 const ref = tiny();
 ref.poses.a!.blink = 'nope';
 expect(JSON.stringify(validatePoseSet(ref))).toContain('unknown pose');
 const self = tiny();
 self.poses.a!.talk = 'a';
 expect(JSON.stringify(validatePoseSet(self))).toContain('itself');
 });
});

describe('validateMotionMap', () => {
 const full = (): Record<string, unknown> => ({
 version: 1,
 expressions: Object.fromEntries(EXPRESSIONS.map((e) => [e, 'a'])),
 motions: Object.fromEntries(MOTIONS.map((m) => [m, {}])),
 });
 const motions = (m: Record<string, unknown>): Record<string, unknown> => m.motions as Record<string, unknown>;

 it('accepts poses and the $expression token', () => {
 const m = full();
 motions(m).wave = { steps: [{ at: 0, pose: 'b' }, { at: 0.5, pose: '$expression', transition: 'slide', ms: 100 }] };
 expect(validateMotionMap(m, tiny()).ok).toBe(true);
 });

 it('rejects missing motions, unknown poses and bad step timing', () => {
 const set = tiny();
 const missing = full();
 delete motions(missing).wave;
 expect(JSON.stringify(validateMotionMap(missing, set))).toContain('motion wave is missing');
 const unknown = full();
 (unknown.expressions as Record<string, unknown>).sad = 'zzz';
 expect(JSON.stringify(validateMotionMap(unknown, set))).toContain('expression sad');
 const late = full();
 motions(late).wave = { steps: [{ at: 0.2, pose: 'a' }] };
 expect(JSON.stringify(validateMotionMap(late, set))).toContain('first step');
 const order = full();
 motions(order).wave = { steps: [{ at: 0, pose: 'a' }, { at: 0.5, pose: 'b' }, { at: 0.4, pose: 'a' }] };
 expect(JSON.stringify(validateMotionMap(order, set))).toContain('must increase');
 const edge = full();
 motions(edge).wave = { steps: [{ at: 0, pose: 'a' }, { at: 1, pose: 'b' }] };
 expect(validateMotionMap(edge, set).ok).toBe(false);
 const trans = full();
 motions(trans).wave = { steps: [{ at: 0, pose: 'a', transition: 'wipe' }] };
 expect(validateMotionMap(trans, set).ok).toBe(false);
 });
});

describe('placePose', () => {
 const ref = tiny().ref;
 it('aligns the anchor on the face point', () => {
 const pl = placePose(tiny().poses.b!, ref);
 expect(pl).toEqual({ left: 10, top: 0, width: 80, height: 100 });
 });
 it('zooms about the bottom centre and keeps the bottom edge covered', () => {
 const pl = placePose(tiny().poses.b!, { ...ref, zoom: 0.5 });
 expect(pl).toEqual({ left: 30, top: 50, width: 40, height: 50 });
 expect(validatePoseSet({ ...tiny(), ref: { ...ref, zoom: 3 } }).ok).toBe(false);
 });
 it('pushes a short pose down to the bottom edge', () => {
 const pl = placePose(tiny().poses.a!, ref);
 expect(pl.top + pl.height).toBeCloseTo(100);
 });
});
