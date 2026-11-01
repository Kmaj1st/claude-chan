import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const eng = vi.hoisted(() => ({
 act: vi.fn(), say: vi.fn(), setMood: vi.fn(), lookAt: vi.fn(), stop: vi.fn(),
 on: vi.fn(), tick: vi.fn(), emit: vi.fn(), setAudioLevel: vi.fn(),
}));
const shellDestroy = vi.fn();
const puppetDestroy = vi.fn();
let init: () => Promise<void>;

vi.mock('../src/host', () => ({
 createShell: () => ({ stage: { appendChild: vi.fn() }, setBubble: vi.fn(), destroy: shellDestroy }),
}));
vi.mock('../src/renderer-select', () => ({
 createPuppet: () => ({ element: {}, init: () => init(), destroy: puppetDestroy }),
}));
vi.mock('../src/engine', () => ({
 Engine: class {
 act = eng.act; say = eng.say; setMood = eng.setMood; lookAt = eng.lookAt; stop = eng.stop;
 on = eng.on; tick = eng.tick; emit = eng.emit; setAudioLevel = eng.setAudioLevel;
 },
}));

import { mount } from '../src/mount';

let frames: Array<(t: number) => void>;
const cancelRaf = vi.fn();

describe('mount controller', () => {
 beforeEach(() => {
 frames = [];
 init = () => Promise.resolve();
 vi.stubGlobal('document', {});
 vi.stubGlobal('window', { innerWidth: 1000, innerHeight: 500 });
 vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => frames.push(cb));
 vi.stubGlobal('cancelAnimationFrame', cancelRaf);
 });
 afterEach(() => {
 vi.unstubAllGlobals();
 for (const f of [...Object.values(eng), shellDestroy, puppetDestroy, cancelRaf]) f.mockReset();
 });

 it('starts the frame loop and emits ready once init resolves', async () => {
 const cc = mount({} as HTMLElement);
 expect(frames).toHaveLength(0);
 await cc.ready;
 expect(eng.emit).toHaveBeenCalledWith('ready', undefined);
 expect(frames).toHaveLength(1);
 frames[0]!(16);
 expect(eng.tick).toHaveBeenCalledWith(16);
 expect(frames).toHaveLength(2);
 });

 it('emits error and still resolves ready when init fails', async () => {
 const cause = new Error('boom');
 init = () => Promise.reject(cause);
 const cc = mount({} as HTMLElement);
 await expect(cc.ready).resolves.toBeUndefined();
 expect(eng.emit).toHaveBeenCalledWith('error', { message: 'puppet init failed', cause });
 expect(frames).toHaveLength(0);
 });

 it('destroy before init resolves starts no loop and emits no ready', async () => {
 const cc = mount({} as HTMLElement);
 cc.destroy();
 await cc.ready;
 expect(frames).toHaveLength(0);
 expect(eng.emit).not.toHaveBeenCalled();
 });

 it('destroy stops the loop, tears down once and is idempotent', async () => {
 const cc = mount({} as HTMLElement);
 await cc.ready;
 cc.destroy();
 cc.destroy();
 expect(cancelRaf).toHaveBeenCalledTimes(1);
 expect(puppetDestroy).toHaveBeenCalledTimes(1);
 expect(shellDestroy).toHaveBeenCalledTimes(1);
 frames[0]!(32);
 expect(eng.tick).not.toHaveBeenCalled();
 });

 it('delegates act, say, setMood, stop and on to the engine', () => {
 const cc = mount({} as HTMLElement);
 const req = { motion: 'wave' } as never;
 const fn = vi.fn();
 cc.act(req);
 cc.say('hi');
 cc.setMood('happy');
 cc.stop();
 cc.on('ready', fn);
 expect(eng.act).toHaveBeenCalledWith(req);
 expect(eng.say).toHaveBeenCalledWith('hi');
 expect(eng.setMood).toHaveBeenCalledWith('happy');
 expect(eng.stop).toHaveBeenCalledTimes(1);
 expect(eng.on).toHaveBeenCalledWith('ready', fn);
 });

 it('lookAt maps viewport pixels to -1..1 and null clears the gaze', () => {
 const cc = mount({} as HTMLElement);
 cc.lookAt(500, 250);
 cc.lookAt(1000, 0);
 cc.lookAt(250);
 cc.lookAt(null);
 expect(eng.lookAt.mock.calls).toEqual([[0, 0], [1, -1], [-0.5, 0], [null]]);
 });
});
