import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPuppet, defaultSpriteBase, FallbackPuppet } from '../src/renderer-select';
import { SpritePuppet, sheetTransform } from '../src/sprite';
import { neutralPose, type Pose, type Puppet } from '../src/types';

// Minimal DOM stand-in: enough for the renderers, which only create elements and set styles.
class FakeEl {
 style: Record<string, string> = {};
 children: FakeEl[] = [];
 innerHTML = '';
 alt = ''; draggable = false; decoding = ''; src = '';
 appendChild(c: FakeEl): FakeEl { this.children.push(c); return c; }
 replaceChildren(...c: FakeEl[]): void { this.children = c; }
 querySelectorAll(): FakeEl[] { return []; }
}
const fakeDocument = { createElement: () => new FakeEl() };

const dir = new URL('../assets/chars/', import.meta.url);
const json = (name: string): unknown => JSON.parse(readFileSync(new URL(name, dir), 'utf8'));
const fetchJson = async (url: string): Promise<unknown> => json(url.split('/').pop()!);
const mkImg = (): HTMLImageElement => new FakeEl() as unknown as HTMLImageElement;
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('SpritePuppet', () => {
 it('loads only idle and its blink frame at init, other poses lazily', async () => {
 vi.stubGlobal('document', fakeDocument);
 const loaded: string[] = [];
 const p = new SpritePuppet({ baseUrl: '/chars/', fetchJson, loadImage: async (u) => { loaded.push(u); return mkImg(); } });
 await p.init();
 expect([...loaded].sort()).toEqual(['/chars/blink.webp', '/chars/idle.webp']);
 p.setMotion('wave', 2000);
 await flush();
 expect(loaded).toContain('/chars/wave.webp');
 expect(loaded).not.toContain('/chars/sad.webp');
 });

 it('shows idle first and cross-fades to a lazily loaded pose after it arrives', async () => {
 vi.stubGlobal('document', fakeDocument);
 const imgs = new Map<string, FakeEl>();
 const p = new SpritePuppet({ baseUrl: '/chars', fetchJson, loadImage: async (u) => { const e = new FakeEl(); imgs.set(u, e); return e as unknown as HTMLImageElement; } });
 await p.init();
 const pose = neutralPose();
 p.render(pose, 'neutral', 0);
 expect(imgs.get('/chars/idle.webp')!.style.opacity).toBe('1.000');
 p.render(pose, 'sad', 16); // sad is not loaded yet: idle stays
 expect(imgs.get('/chars/idle.webp')!.style.opacity).toBe('1.000');
 await flush();
 p.render(pose, 'sad', 32);
 p.render(pose, 'sad', 600);
 expect(imgs.get('/chars/sad.webp')!.style.opacity).toBe('1.000');
 expect(imgs.get('/chars/idle.webp')!.style.opacity).toBe('0');
 });

 it('rejects init when poses.json is invalid', async () => {
 vi.stubGlobal('document', fakeDocument);
 const p = new SpritePuppet({ baseUrl: '/x', fetchJson: async () => ({ version: 1 }), loadImage: async () => mkImg() });
 await expect(p.init()).rejects.toThrow(/invalid poses.json/);
 });

 it('rejects init when an image is missing', async () => {
 vi.stubGlobal('document', fakeDocument);
 const p = new SpritePuppet({ baseUrl: '/x', fetchJson, loadImage: async () => { throw new Error('404'); } });
 await expect(p.init()).rejects.toThrow('404');
 });

 it('does not re-request a failed lazy pose on every frame', async () => {
 vi.stubGlobal('document', fakeDocument);
 const calls: string[] = [];
 const loadImage = async (u: string): Promise<HTMLImageElement> => {
 calls.push(u);
 if (!u.endsWith('idle.webp') && !u.endsWith('blink.webp')) throw new Error('404');
 return mkImg();
 };
 const p = new SpritePuppet({ baseUrl: '/chars/', fetchJson, loadImage });
 await p.init();
 p.setMotion('wave', 200);
 await flush();
 for (let i = 0; i < 20; i++) { p.render(neutralPose(), 'neutral', 16 * i); await flush(); }
 const counts = new Map<string, number>();
 for (const u of calls) counts.set(u, (counts.get(u) ?? 0) + 1);
 expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
 });
});

describe('sheetTransform', () => {
 const breathing: Pose = { ...neutralPose(), ParamBreath: 1, ParamAngleX: 10 };
 it('moves and scales with the pose', () => {
 expect(sheetTransform(breathing, false)).toContain('scale(1.0120)');
 expect(sheetTransform(breathing, false)).toContain('translate(1.20%');
 });
 it('damps movement and drops breathing scale under reduced motion', () => {
 expect(sheetTransform(breathing, true)).toContain('scale(1.0000)');
 expect(sheetTransform(breathing, true)).toContain('translate(0.36%');
 });
});

describe('renderer selection', () => {
 const failing = (): Puppet => ({ element: new FakeEl() as never, init: async () => { throw new Error('no assets'); }, render() {}, destroy() {} });
 const working = (): Puppet & { rendered: number } => {
 const p = { element: new FakeEl() as never, rendered: 0, init: async () => {}, render() { p.rendered++; }, destroy() {} };
 return p;
 };

 it('FallbackPuppet swaps to the fallback when the primary fails (assets missing)', async () => {
 vi.stubGlobal('document', fakeDocument);
 const fb = working();
 const seen: unknown[] = [];
 const f = new FallbackPuppet(failing(), () => fb, (c) => seen.push(c));
 await f.init();
 expect(f.fellBack).toBe(true);
 expect(seen).toHaveLength(1);
 f.render(neutralPose(), 'neutral', 0);
 expect(fb.rendered).toBe(1);
 });

 it('FallbackPuppet keeps the primary when it loads', async () => {
 vi.stubGlobal('document', fakeDocument);
 const primary = working();
 const f = new FallbackPuppet(primary, () => working());
 await f.init();
 expect(f.fellBack).toBe(false);
 f.render(neutralPose(), 'neutral', 0);
 expect(primary.rendered).toBe(1);
 });

 it('auto without assets falls back to the procedural puppet end to end', async () => {
 vi.stubGlobal('document', fakeDocument);
 vi.stubGlobal('fetch', async () => ({ ok: false, status: 404, json: async () => ({}) }));
 vi.spyOn(console, 'warn').mockImplementation(() => {});
 const p = createPuppet({ renderer: 'auto', sprites: '/missing' }, false);
 expect(p).toBeInstanceOf(FallbackPuppet);
 await p.init();
 expect((p as FallbackPuppet).fellBack).toBe(true);
 });

 it('FallbackPuppet does not build or init a fallback after destroy() during a failing primary init', async () => {
 vi.stubGlobal('document', fakeDocument);
 let reject!: (e: unknown) => void;
 const primary: Puppet = { element: new FakeEl() as never, init: () => new Promise<void>((_, r) => { reject = r; }), render() {}, destroy() {} };
 let made = 0;
 const f = new FallbackPuppet(primary, () => { made++; return working(); });
 const init = f.init();
 f.destroy();
 reject(new Error('late'));
 await init;
 expect(made).toBe(0);
 expect(f.fellBack).toBe(false);
 });

 it('explicit renderers pick the matching class', () => {
 vi.stubGlobal('document', fakeDocument);
 expect(createPuppet({ renderer: 'sprite', sprites: '/chars' }, false)).toBeInstanceOf(SpritePuppet);
 expect(createPuppet({ renderer: 'procedural' }, false).constructor.name).toBe('ProceduralPuppet');
 expect(() => createPuppet({ renderer: 'live2d' }, false)).toThrow(/model/);
 expect(createPuppet({ model: '/m/model3.json' }, false).constructor.name).toBe('FallbackPuppet');
 expect(createPuppet({ model: '/m/model3.json', renderer: 'live2d' }, false).constructor.name).toBe('Live2DPuppet');
 });

 it('has a default sprite folder next to the package', () => {
 expect(defaultSpriteBase()).toMatch(/assets\/chars\/$/);
 });
});
