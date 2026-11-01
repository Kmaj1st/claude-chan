import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine';
import { MAX_DURATION_MS } from '../src/tools';
import type { Pose, Puppet } from '../src/types';

const puppet = {
 element: {} as HTMLElement,
 init: async () => {},
 render: (_pose: Pose) => {},
 destroy: () => {},
} as Puppet;

function make() {
 const says: Array<[string, number]> = [];
 const e = new Engine(puppet, { autoIdle: false, random: () => 0.5, onSay: (t, ms) => says.push([t, ms]) });
 return { e, says };
}

describe('Engine duration sanitising', () => {
 it('falls back to the default bubble time for a non-finite duration', () => {
 for (const d of [Infinity, -Infinity, NaN]) {
 const { e, says } = make();
 e.say('hello', d);
 expect(Number.isFinite(says[0]![1])).toBe(true);
 expect(says[0]![1]).toBeGreaterThanOrEqual(2000);
 }
 });

 it('caps an oversized bubble duration', () => {
 const { e, says } = make();
 e.say('hello', 1e12);
 expect(says[0]![1]).toBe(MAX_DURATION_MS);
 });

 it('act() caps duration and ignores non-finite values', () => {
 const a = make();
 a.e.act({ say: 'hi', duration: 1e12 });
 expect(a.says[0]![1]).toBe(MAX_DURATION_MS);
 const b = make();
 b.e.act({ say: 'hi', duration: Infinity });
 expect(Number.isFinite(b.says[0]![1])).toBe(true);
 });
});
