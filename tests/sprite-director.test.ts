import { describe, expect, it } from 'vitest';
import { SpriteDirector, DEFAULT_FADE_MS, QUICK_FADE_MS } from '../src/sprite/director';
import type { MotionMap, PoseSet } from '../src/sprite/manifest';
import { MOTIONS, type Expression } from '../src/types';

const def = (file: string, extra: object = {}) => ({ file, w: 10, h: 10, anchor: [5, 5] as [number, number], ...extra });
const set: PoseSet = {
 version: 1,
 ref: { w: 10, h: 10, faceH: 2, faceY: 5 },
 poses: {
 idle: def('idle.webp', { blink: 'blink', talk: 'talk' }),
 blink: def('blink.webp'),
 talk: def('talk.webp'),
 wave: def('wave.webp'),
 beam: def('beam.webp'),
 sad: def('sad.webp'),
 },
};
const map = (): MotionMap => ({
 version: 1,
 expressions: { neutral: 'idle', smile: 'beam', sad: 'sad', angry: 'sad', blush: 'beam', surprised: 'idle' },
 motions: {
 ...Object.fromEntries(MOTIONS.map((m) => [m, {}])),
 wave: { steps: [{ at: 0, pose: 'wave' }, { at: 0.5, pose: '$expression', transition: 'slide', ms: 100 }] },
 bow: { steps: [{ at: 0, pose: 'blink', transition: 'cut' }] },
 } as MotionMap['motions'],
});
const allReady = (): boolean => true;

interface RunOpts { expr?: Expression; eyes?: number; mouth?: number; ready?: (id: string) => boolean }

// Runs frames every 16 ms from t0 to t1 and returns the last frame.
function run(d: SpriteDirector, t0: number, t1: number, o: RunOpts = {}) {
 let f = d.update(t0, o.expr ?? 'neutral', o.eyes ?? 1, o.mouth ?? 0, o.ready ?? allReady);
 for (let t = t0 + 16; t <= t1; t += 16) f = d.update(t, o.expr ?? 'neutral', o.eyes ?? 1, o.mouth ?? 0, o.ready ?? allReady);
 return f;
}

describe('SpriteDirector', () => {
 it('shows the expression pose at once on the first frame', () => {
 const f = new SpriteDirector(set, map()).update(0, 'neutral', 1, 0, allReady);
 expect(f.layers).toEqual([{ pose: 'idle', opacity: 1, dx: 0 }]);
 });

 it('cross-fades to a new expression: old pose stays opaque below until the new one is fully in', () => {
 const d = new SpriteDirector(set, map());
 run(d, 0, 100);
 const mid = d.update(116, 'smile', 1, 0, allReady);
 expect(mid.layers.map((l) => l.pose)).toEqual(['idle', 'beam']);
 expect(mid.layers[0]!.opacity).toBe(1);
 expect(mid.layers[1]!.opacity).toBeLessThan(0.2);
 const half = d.update(116 + DEFAULT_FADE_MS / 2, 'smile', 1, 0, allReady);
 expect(half.layers[1]!.opacity).toBeCloseTo(0.61, 1);
 const done = d.update(116 + DEFAULT_FADE_MS + 16, 'smile', 1, 0, allReady);
 expect(done.layers).toEqual([{ pose: 'beam', opacity: 1, dx: 0 }]);
 });

 it('holds the current pose until the wanted image is ready, and reports it as needed', () => {
 const d = new SpriteDirector(set, map());
 run(d, 0, 50);
 const f = run(d, 66, 400, { expr: 'sad', ready: (id) => id !== 'sad' });
 expect(f.target).toBe('idle');
 expect(f.need).toEqual(['sad']);
 expect(f.layers.map((l) => l.pose)).toEqual(['idle']);
 const after = d.update(416, 'sad', 1, 0, allReady);
 expect(after.target).toBe('sad');
 });

 it('walks through motion steps on the motion clock and returns to the expression pose', () => {
 const d = new SpriteDirector(set, map());
 d.setMotion('wave', 2000);
 // The motion clock starts at the first update after setMotion, whatever the absolute time.
 expect(d.update(50000, 'smile', 1, 0, allReady).target).toBe('wave');
 expect(d.update(50990, 'smile', 1, 0, allReady).target).toBe('wave');
 const slid = d.update(51004, 'smile', 1, 0, allReady);
 expect(slid.target).toBe('beam');
 expect(slid.layers[slid.layers.length - 1]!.dx).toBeGreaterThan(0);
 const fin = run(d, 51020, 51400, { expr: 'smile' });
 expect(fin.layers[0]!.dx).toBe(0);
 });

 it('falls back to the expression pose when the motion ran past its duration', () => {
 const d = new SpriteDirector(set, map());
 d.setMotion('wave', 1000);
 d.update(0, 'neutral', 1, 0, allReady);
 expect(d.update(1100, 'neutral', 1, 0, allReady).target).toBe('idle');
 d.setMotion(null, 0);
 expect(d.update(1200, 'neutral', 1, 0, allReady).target).toBe('idle');
 });

 it('cut transitions and reduced motion switch instantly', () => {
 const d = new SpriteDirector(set, map());
 run(d, 0, 50);
 d.setMotion('bow', 1000);
 expect(d.update(66, 'neutral', 1, 0, allReady).layers).toEqual([{ pose: 'blink', opacity: 1, dx: 0 }]);
 const r = new SpriteDirector(set, map(), { reducedMotion: true });
 run(r, 0, 50);
 r.setMotion('wave', 2000);
 const first = r.update(66, 'neutral', 1, 0, allReady);
 expect(first.layers).toEqual([{ pose: 'wave', opacity: 1, dx: 0 }]);
 });

 it('swaps to the blink pose while the eyes are closed, quickly', () => {
 const d = new SpriteDirector(set, map());
 run(d, 0, 50);
 const f = d.update(66, 'neutral', 0.1, 0, allReady);
 expect(f.target).toBe('blink');
 expect(d.update(66 + QUICK_FADE_MS + 16, 'neutral', 0.1, 0, allReady).layers).toEqual([{ pose: 'blink', opacity: 1, dx: 0 }]);
 expect(d.update(200, 'neutral', 1, 0, allReady).target).toBe('idle');
 });

 it('does not blink poses that have no blink partner', () => {
 const d = new SpriteDirector(set, map());
 expect(run(d, 0, 50, { expr: 'sad', eyes: 0 }).target).toBe('sad');
 });

 it('talk pose follows the mouth with hysteresis (no flicker between the thresholds)', () => {
 const d = new SpriteDirector(set, map());
 run(d, 0, 50);
 expect(d.update(66, 'neutral', 1, 0.7, allReady).target).toBe('talk');
 expect(d.update(82, 'neutral', 1, 0.4, allReady).target).toBe('talk');
 expect(d.update(98, 'neutral', 1, 0.2, allReady).target).toBe('idle');
 expect(d.update(114, 'neutral', 1, 0.4, allReady).target).toBe('idle');
 });

 it('lists the poses a motion needs for prefetching, without the expression token', () => {
 const d = new SpriteDirector(set, map());
 expect(d.posesFor('wave')).toEqual(['wave']);
 expect(d.posesFor('idle')).toEqual([]);
 });
});
