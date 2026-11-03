import { afterEach, describe, expect, it, vi } from 'vitest';
import { CUBISM_CORE_CDN, LIVE2D_RUNTIME_CDN, loadRuntimeScripts, resolveGroup, withTimeout } from '../src/live2d';
import { CLICK_REACTION, DRAG_REACTION, gazeFrom, installInteraction } from '../src/interact';
import { normalizeRenderer } from '../src/renderer-select';
import pkg from '../package.json';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Live2D runtime contract', () => {
 it('uses the official Cubism Core CDN and runtime URLs pinned to the package.json versions', () => {
 expect(CUBISM_CORE_CDN).toBe('https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js');
 const dev = pkg.devDependencies as Record<string, string>;
 expect(dev['pixi.js']).toMatch(/^\d+\.\d+\.\d+$/);
 expect(dev['pixi-live2d-display']).toMatch(/^\d+\.\d+\.\d+$/);
 expect(LIVE2D_RUNTIME_CDN.pixi).toContain('pixi.js@' + dev['pixi.js'] + '/');
 expect(LIVE2D_RUNTIME_CDN.live2d).toContain('pixi-live2d-display@' + dev['pixi-live2d-display'] + '/');
 });

 it('maps preset names onto model motion groups (exact, any case, Cubism sample names)', () => {
 expect(resolveGroup(['wave', 'Wave'], 'wave')).toBe('wave');
 expect(resolveGroup(['Idle', 'ShakeHead'], 'shake_head')).toBe('ShakeHead');
 expect(resolveGroup(['Idle', 'TapBody'], 'idle')).toBe('Idle');
 expect(resolveGroup(['Idle', 'TapBody'], 'wave')).toBe('TapBody');
 expect(resolveGroup(['Idle'], 'bow')).toBeNull();
 });

 it('normalizes the reported renderer names', () => {
 expect(normalizeRenderer('sprites')).toBe('sprite');
 expect(normalizeRenderer('simplified')).toBe('procedural');
 expect(normalizeRenderer('live2d')).toBe('live2d');
 expect(normalizeRenderer(undefined)).toBe('auto');
 });

 it('withTimeout rejects a load that never settles', async () => {
 vi.useFakeTimers();
 const p = withTimeout(new Promise(() => undefined), 50, 'model');
 vi.advanceTimersByTime(60);
 await expect(p).rejects.toThrow('did not load within 50 ms');
 });

 it('loads pixi then pixi-live2d-display as scripts with a page AMD define hidden, then restores it', async () => {
 const define = Object.assign(() => undefined, { amd: {} });
 const win: Record<string, unknown> = { define };
 const seen: Array<{ src: string; define: unknown }> = [];
 vi.stubGlobal('window', win);
 vi.stubGlobal('document', {
 createElement: () => ({ src: '', remove() {} }),
 head: {
 appendChild: (s: { src: string; onload?: () => void }) => {
 seen.push({ src: s.src, define: win.define });
 if (s.src.includes('pixi.min')) win.PIXI = { VERSION: '6.5.10' };
 else (win.PIXI as Record<string, unknown>).live2d = { Live2DModel: { from: () => null } };
 queueMicrotask(() => s.onload?.());
 },
 },
 });
 const rt = await loadRuntimeScripts({ pixi: 'https://x/pixi.min.js', live2d: 'https://x/cubism4.min.js' });
 expect(seen.map((s) => s.src)).toEqual(['https://x/pixi.min.js', 'https://x/cubism4.min.js']);
 expect(seen.every((s) => s.define === undefined)).toBe(true);
 expect(win.define).toBe(define);
 expect(rt.Live2DModel).toBeTruthy();
 });

 it('fails clearly when the live2d script does not register PIXI.live2d', async () => {
 const win: Record<string, unknown> = { PIXI: { VERSION: '6.5.10', live2d: undefined } };
 vi.stubGlobal('window', win);
 vi.stubGlobal('document', {
 createElement: () => ({ src: '', remove() {} }),
 head: { appendChild: (s: { onload?: () => void }) => queueMicrotask(() => s.onload?.()) },
 });
 await expect(loadRuntimeScripts({ pixi: '/p.js', live2d: '/l-missing.js' })).rejects.toThrow('PIXI.live2d');
 });
});

describe('interaction (gaze follow, click and drag reactions)', () => {
 it('gaze is relative to the character and clamped', () => {
 expect(gazeFrom(300, 100, 100, 100, 200)).toEqual({ x: 1, y: 0 });
 expect(gazeFrom(0, 0, 100, 100, 200)).toEqual({ x: -0.5, y: -0.5 });
 expect(gazeFrom(-900, 900, 0, 0, 200)).toEqual({ x: -1, y: 1 });
 });

 it('follows the cursor, reacts to click and drag, goes idle, and cleans up', () => {
 vi.useFakeTimers();
 const winL: Record<string, (e: unknown) => void> = {};
 vi.stubGlobal('window', {
 innerWidth: 1000, innerHeight: 800,
 addEventListener: (n: string, f: (e: unknown) => void) => { winL[n] = f; },
 removeEventListener: (n: string) => { delete winL[n]; },
 });
 const stageL: Record<string, () => void> = {};
 const stage = {
 getBoundingClientRect: () => ({ left: 0, top: 500, width: 200, height: 300 }),
 addEventListener: (n: string, f: () => void) => { stageL[n] = f; },
 removeEventListener: (n: string) => { delete stageL[n]; },
 } as unknown as HTMLElement;
 const looks: Array<[number | null, number | undefined]> = [];
 const acts: unknown[] = [];
 let dragFn: (() => void) | null = null;
 const off = installInteraction(stage, { lookAt: (x, y) => looks.push([x, y]), act: (r) => acts.push(r) },
 (fn) => { dragFn = fn; return () => { dragFn = null; }; });
 winL.pointermove!({ clientX: 900, clientY: 590 });
 expect(looks[0]![0]).toBe(1);
 expect(looks[0]![1]).toBeCloseTo(0, 5);
 stageL.click!();
 dragFn!();
 expect(acts).toEqual([CLICK_REACTION, DRAG_REACTION]);
 vi.advanceTimersByTime(3000);
 expect(looks.at(-1)).toEqual([null, undefined]);
 off();
 expect(winL.pointermove).toBeUndefined();
 expect(stageL.click).toBeUndefined();
 expect(dragFn).toBeNull();
 });
});
