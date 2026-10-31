import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setAudioLevel = vi.fn();
const createLevelReader = vi.fn();

vi.mock('../src/host', () => ({
 createShell: () => ({ stage: { appendChild: vi.fn() }, setBubble: vi.fn(), destroy: vi.fn() }),
}));
vi.mock('../src/renderer-select', () => ({
 createPuppet: () => ({ element: {}, init: () => Promise.resolve(), destroy: vi.fn() }),
}));
vi.mock('../src/engine', () => ({
 Engine: class {
 setAudioLevel = setAudioLevel;
 tick = vi.fn();
 emit = vi.fn();
 },
}));
vi.mock('../src/lipsync', () => ({ createLevelReader: (...a: unknown[]) => createLevelReader(...a) }));

import { mount } from '../src/mount';

function reader(level = 0.5) {
 return { read: vi.fn(() => level), dispose: vi.fn() };
}

describe('controller.lipSync', () => {
 beforeEach(() => {
 vi.stubGlobal('document', {});
 vi.stubGlobal('requestAnimationFrame', () => 1);
 vi.stubGlobal('cancelAnimationFrame', () => {});
 });
 afterEach(() => {
 vi.unstubAllGlobals();
 setAudioLevel.mockClear();
 createLevelReader.mockReset();
 });

 const src = {} as AnalyserNode;

 it('feeds the engine a level callback backed by the reader', () => {
 const r = reader(0.7);
 createLevelReader.mockReturnValue(r);
 const cc = mount({} as HTMLElement);
 cc.lipSync(src);
 const fn = setAudioLevel.mock.calls[0]![0] as () => number;
 expect(fn()).toBe(0.7);
 expect(r.read).toHaveBeenCalledTimes(1);
 });

 it('null disposes the reader and clears the level', () => {
 const r = reader();
 createLevelReader.mockReturnValue(r);
 const cc = mount({} as HTMLElement);
 cc.lipSync(src);
 cc.lipSync(null);
 expect(r.dispose).toHaveBeenCalledTimes(1);
 expect(setAudioLevel).toHaveBeenLastCalledWith(null);
 });

 it('replacing the source disposes the previous reader', () => {
 const a = reader();
 const b = reader();
 createLevelReader.mockReturnValueOnce(a).mockReturnValueOnce(b);
 const cc = mount({} as HTMLElement);
 cc.lipSync(src);
 cc.lipSync(src);
 expect(a.dispose).toHaveBeenCalledTimes(1);
 expect(b.dispose).not.toHaveBeenCalled();
 });

 it('falls back to text lip-sync and warns when the reader cannot be created', () => {
 const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
 createLevelReader.mockImplementation(() => {
 throw new Error('already connected');
 });
 const cc = mount({} as HTMLElement);
 expect(() => cc.lipSync(src)).not.toThrow();
 expect(setAudioLevel).toHaveBeenLastCalledWith(null);
 expect(warn).toHaveBeenCalledTimes(1);
 warn.mockRestore();
 });

 it('destroy disposes the reader; lipSync after destroy creates no reader', () => {
 const r = reader();
 createLevelReader.mockReturnValue(r);
 const cc = mount({} as HTMLElement);
 cc.lipSync(src);
 cc.destroy();
 expect(r.dispose).toHaveBeenCalledTimes(1);
 createLevelReader.mockClear();
 cc.lipSync(src);
 expect(createLevelReader).not.toHaveBeenCalled();
 expect(setAudioLevel).toHaveBeenLastCalledWith(null);
 });
});
