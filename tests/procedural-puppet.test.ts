import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProceduralPuppet } from '../src/puppet';
import { neutralPose } from '../src/types';

class Part {
 attrs: Record<string, string> = {};
 constructor(public name: string) {}
 getAttribute(k: string): string | null { return k === 'data-part' ? this.name : (this.attrs[k] ?? null); }
 setAttribute(k: string, v: string): void { this.attrs[k] = v; }
}

class Root {
 style: Record<string, string> = {};
 innerHTML = '';
 parts: Part[] = [];
 replaced = 0;
 querySelectorAll(): Part[] { return this.parts; }
 replaceChildren(): void { this.replaced++; this.parts = []; }
}

const NAMES = ['root', 'body', 'head', 'armL', 'armR', 'lidL', 'lidR', 'irisL', 'irisR', 'browL', 'browR', 'cheekL', 'cheekR', 'mouth'] as const;
type Parts = Record<(typeof NAMES)[number], Part>;
let root: Root;

async function make(): Promise<{ p: ProceduralPuppet; by: Parts }> {
 root = new Root();
 vi.stubGlobal('document', { createElement: () => root });
 const p = new ProceduralPuppet();
 root.parts = NAMES.map((n) => new Part(n));
 await p.init();
 return { p, by: Object.fromEntries(root.parts.map((x) => [x.name, x])) as Parts };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('ProceduralPuppet', () => {
 it('init() injects the SVG markup', async () => {
 await make();
 expect(root.innerHTML).toContain('data-part="mouth"');
 });

 it('closed mouth hides the fill; open mouth shows it', async () => {
 const { p, by } = await make();
 p.render(neutralPose(), 'neutral');
 expect(by.mouth.attrs['fill-opacity']).toBe('0');
 p.render({ ...neutralPose(), ParamMouthOpenY: 1 }, 'neutral');
 expect(by.mouth.attrs['fill-opacity']).toBe('1');
 expect(by.mouth.attrs.d).toContain('Q');
 });

 it('blush raises cheek opacity, capped at 0.8', async () => {
 const { p, by } = await make();
 p.render(neutralPose(), 'neutral');
 expect(by.cheekL.attrs.opacity).toBe('0.00');
 p.render({ ...neutralPose(), ParamCheek: 1 }, 'blush');
 expect(by.cheekL.attrs.opacity).toBe('0.80');
 expect(by.cheekR.attrs.opacity).toBe('0.80');
 });

 it('angry expression lowers brows relative to neutral', async () => {
 const { p, by } = await make();
 p.render(neutralPose(), 'neutral');
 const neutral = by.browL.attrs.transform;
 p.render(neutralPose(), 'angry');
 expect(by.browL.attrs.transform).not.toBe(neutral);
 });

 it('eye openness drives lid height and is clamped', async () => {
 const { p, by } = await make();
 p.render({ ...neutralPose(), ParamEyeLOpen: 0, ParamEyeROpen: 5 }, 'neutral');
 expect(by.lidL.attrs.height).toBe('30.00');
 expect(by.lidR.attrs.height).toBe('0.00');
 });

 it('render before init() and with missing parts does not throw', () => {
 vi.stubGlobal('document', { createElement: () => new Root() });
 expect(() => new ProceduralPuppet().render(neutralPose(), 'smile')).not.toThrow();
 });

 it('destroy() clears children and parts', async () => {
 const { p, by } = await make();
 p.destroy();
 expect(root.replaced).toBe(1);
 p.render(neutralPose(), 'neutral');
 expect(by.mouth.attrs.d).toBeUndefined();
 });
});
