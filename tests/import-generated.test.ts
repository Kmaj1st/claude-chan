import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

// The script is plain .mjs without types; a non-literal import path keeps tsc from resolving it.
type Mod = {
 keyGreen: (d: Uint8ClampedArray | Uint8Array) => Uint8ClampedArray | Uint8Array;
 validate: (d: Uint8ClampedArray | Uint8Array) => string | null;
};
let mod: Mod;

beforeAll(async () => {
 const href = pathToFileURL(resolve('scripts/import-generated.mjs')).href;
 mod = (await import(href)) as Mod;
});

function px(...pixels: number[][]): Uint8ClampedArray {
 return new Uint8ClampedArray(pixels.flat());
}

describe('keyGreen', () => {
 it('makes flat chroma green fully transparent', () => {
 const out = mod.keyGreen(px([0, 255, 0, 255]));
 expect(out[3]).toBe(0);
 });

 it('keeps non-green colours opaque and unchanged', () => {
 const out = mod.keyGreen(px([200, 80, 90, 255], [20, 30, 220, 255]));
 expect(Array.from(out)).toEqual([200, 80, 90, 255, 20, 30, 220, 255]);
 });

 it('removes green spill from the colour channel on partial keys', () => {
 const out = mod.keyGreen(px([100, 160, 100, 255]));
 expect(out[1]).toBeLessThanOrEqual(100);
 expect(out[3]).toBeLessThan(255);
 });
});

describe('validate', () => {
 const opaque = [10, 10, 10, 255];
 const clear = [0, 0, 0, 0];

 it('flags a cell without any transparency', () => {
 expect(mod.validate(px(opaque, opaque, opaque, opaque))).toMatch(/no transparency/);
 });

 it('flags an almost empty cell', () => {
 expect(mod.validate(px(clear, clear, clear, clear))).toMatch(/almost empty/);
 });

 it('accepts a cell with a character and a transparent background', () => {
 expect(mod.validate(px(opaque, clear))).toBeNull();
 });
});
