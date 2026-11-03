import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Live2DPuppet } from '../src/live2d';
import { neutralPose } from '../src/types';

const h = vi.hoisted(() => {
 const state = {
 model: null as null | {
 expression: (id: string) => Promise<void>;
 destroy: () => void;
 handlers: Record<string, () => void>;
 set: Array<[string, number]>;
 expressions: string[];
 destroyed: boolean;
 },
 appDestroyed: 0,
 fromCalled: false,
 gate: null as null | Promise<void>,
 fail: false,
 size: [100, 200] as [number, number],
 scaled: [] as number[],
 };
 return state;
});

vi.mock('pixi.js', () => ({
 Application: class {
 stage = { addChild: () => {} };
 destroy() { h.appDestroyed++; }
 },
}));

vi.mock('pixi-live2d-display/cubism4', () => ({
 Live2DModel: {
 from: async () => {
 h.fromCalled = true;
 if (h.fail) throw new Error('model load failed');
 if (h.gate) await h.gate;
 const m = {
 width: h.size[0], height: h.size[1], x: 0, y: 0,
 scale: { set: (v: number) => { h.scaled.push(v); } },
 handlers: {} as Record<string, () => void>,
 set: [] as Array<[string, number]>,
 expressions: [] as string[],
 destroyed: false,
 expression: async (id: string) => { m.expressions.push(id); },
 motion: async (group: string, index: number) => { (h as unknown as { motions: Array<[string, number]> }).motions.push([group, index]); },
 destroy: () => { m.destroyed = true; },
 internalModel: {
 on: (name: string, fn: () => void) => { m.handlers[name] = fn; },
 coreModel: { setParameterValueById: (id: string, v: number) => { m.set.push([id, v]); } },
 },
 };
 h.model = m;
 return m;
 },
 },
}));

function fakeEl(): Record<string, unknown> {
 const el: Record<string, unknown> = {
 style: {}, dataset: {}, clientWidth: 0, clientHeight: 0,
 appendChild: () => {}, remove: () => {}, replaceChildren: () => {},
 };
 return el;
}

beforeEach(() => {
 h.model = null; h.appDestroyed = 0; h.gate = null; h.fromCalled = false; h.fail = false; h.size = [100, 200]; h.scaled = [];
 vi.stubGlobal('window', { Live2DCubismCore: {} });
 vi.stubGlobal('document', { createElement: fakeEl, head: { appendChild: () => {} } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('Live2DPuppet', () => {
 it('fits the model to the stage, and keeps scale 1 when the model reports no size', async () => {
 await new Live2DPuppet({ model: '/m.model3.json' }).init();
 expect(h.scaled).toEqual([220 / 100 > 330 / 200 ? 330 / 200 : 220 / 100]);
 h.scaled = []; h.size = [0, 0];
 await new Live2DPuppet({ model: '/m.model3.json' }).init();
 expect(h.scaled).toEqual([1]);
 });

 it('applies an expression rendered before the model loaded, through the map', async () => {
 const p = new Live2DPuppet({ model: '/m.model3.json', map: { expressions: { smile: 'f01' } } });
 p.render(neutralPose(), 'smile');
 await p.init();
 expect(h.model!.expressions).toEqual(['f01']);
 p.render(neutralPose(), 'smile');
 expect(h.model!.expressions).toEqual(['f01']);
 p.render(neutralPose(), 'sad');
 expect(h.model!.expressions).toEqual(['f01', 'sad']);
 });

 it('destroys the PIXI app and rethrows when the model fails to load', async () => {
 h.fail = true;
 const p = new Live2DPuppet({ model: '/bad.model3.json' });
 await expect(p.init()).rejects.toThrow('model load failed');
 expect(h.appDestroyed).toBe(1);
 });

 it('survives an expression call that throws synchronously', async () => {
 const p = new Live2DPuppet({ model: '/m.model3.json' });
 await p.init();
 h.model!.expression = () => { throw new Error('bad expression'); };
 expect(() => p.render(neutralPose(), 'smile')).not.toThrow();
 });

 it('writes the pose into the core model before each update', async () => {
 const p = new Live2DPuppet({ model: '/m.model3.json' });
 await p.init();
 h.model!.handlers['beforeModelUpdate']!();
 expect(h.model!.set).toHaveLength(0);
 const pose = neutralPose();
 p.render(pose, 'neutral');
 h.model!.handlers['beforeModelUpdate']!();
 expect(h.model!.set.length).toBeGreaterThan(0);
 });

 it('plays the model motion that the motion map assigns to a preset', async () => {
 const hh = h as unknown as { motions: Array<[string, number]> };
 hh.motions = [];
 const p = new Live2DPuppet({ model: '/m.model3.json', map: { motions: { wave: { group: 'wave', index: 2 } } } });
 await p.init();
 p.setMotion('wave');
 p.setMotion('nod');
 p.setMotion(null);
 expect(hh.motions).toEqual([['wave', 2]]);
 });

 it('while an authored motion plays, writes only gaze, blink and mouth so the motion shows', async () => {
 const hh = h as unknown as { motions: Array<[string, number]> };
 hh.motions = [];
 const p = new Live2DPuppet({ model: '/m.model3.json', map: { motions: { bow: { group: 'bow', index: 0 } } } });
 await p.init();
 p.render(neutralPose(), 'neutral');
 p.setMotion('bow');
 expect(p.playingAuthoredMotion).toBe(true);
 h.model!.handlers['beforeModelUpdate']!();
 const ids = new Set(h.model!.set.map(([id]) => id));
 expect(ids.has('ParamMouthOpenY')).toBe(true);
 expect(ids.has('ParamAngleX')).toBe(false);
 h.model!.set.length = 0;
 p.setMotion(null);
 h.model!.handlers['beforeModelUpdate']!();
 expect(h.model!.set.some(([id]) => id === 'ParamAngleX')).toBe(true);
 });

 it('reads motions.json next to the model when no map is given', async () => {
 const hh = h as unknown as { motions: Array<[string, number]> };
 hh.motions = [];
 const seen: string[] = [];
 vi.stubGlobal('fetch', async (url: string) => {
 seen.push(url);
 return { ok: true, json: async () => ({ motions: { nod: { group: 'nod', index: 0 } } }) };
 });
 try {
 const p = new Live2DPuppet({ model: 'http://x.test/model/c.model3.json' });
 await p.init();
 p.setMotion('nod');
 expect(seen).toEqual(['http://x.test/model/motions.json']);
 expect(hh.motions).toEqual([['nod', 0]]);
 } finally {
 vi.unstubAllGlobals();
 }
 });

 it('reads expressions from motions.json when no map is given', async () => {
 vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ expressions: { smile: 'f09' } }) }));
 try {
 const p = new Live2DPuppet({ model: 'http://x.test/model/c.model3.json' });
 await p.init();
 p.render(neutralPose(), 'smile');
 expect(h.model!.expressions).toEqual(['f09']);
 } finally {
 vi.unstubAllGlobals();
 }
 });

 it('cleans up when destroyed while the model is still loading', async () => {
 let open!: () => void;
 h.gate = new Promise<void>((r) => { open = r; });
 const p = new Live2DPuppet({ model: '/m.model3.json' });
 const init = p.init();
 await vi.waitFor(() => expect(h.fromCalled).toBe(true));
 p.destroy();
 open();
 await init;
 expect(h.model).not.toBeNull();
 expect(h.model!.destroyed).toBe(true);
 expect(h.appDestroyed).toBeGreaterThanOrEqual(1);
 expect(Object.keys(h.model!.handlers)).toHaveLength(0);
 });
});
