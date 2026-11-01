import { describe, expect, it, vi } from 'vitest';
import { createLevelReader } from '../src/lipsync';

// Fake AnalyserNode: fills the time-domain buffer with a constant byte value.
function fakeAnalyser(value: number): AnalyserNode {
 return {
 fftSize: 64,
 getByteTimeDomainData(buf: Uint8Array) {
 buf.fill(value);
 },
 } as unknown as AnalyserNode;
}

describe('createLevelReader', () => {
 it('reads silence as 0', () => {
 expect(createLevelReader(fakeAnalyser(128)).read()).toBe(0);
 });

 it('reads loud signal as a level in (0, 1]', () => {
 const level = createLevelReader(fakeAnalyser(192)).read();
 expect(level).toBeGreaterThan(0);
 expect(level).toBeLessThanOrEqual(1);
 });

 it('clamps to 1', () => {
 expect(createLevelReader(fakeAnalyser(255)).read()).toBe(1);
 });

 it('dispose is safe to call twice', () => {
 const r = createLevelReader(fakeAnalyser(128));
 r.dispose();
 expect(() => r.dispose()).not.toThrow();
 });
});

describe('createLevelReader media element failure', () => {
 it('closes the AudioContext when graph setup throws', () => {
 class FakeMedia {}
 const close = vi.fn(() => Promise.resolve());
 class FakeCtx {
 state = 'running';
 destination = {};
 createMediaElementSource() {
 throw new Error('already connected');
 }
 close = close;
 }
 vi.stubGlobal('HTMLMediaElement', FakeMedia);
 vi.stubGlobal('AudioContext', FakeCtx);
 try {
 expect(() => createLevelReader(new FakeMedia() as unknown as HTMLMediaElement)).toThrow('already connected');
 expect(close).toHaveBeenCalledTimes(1);
 } finally {
 vi.unstubAllGlobals();
 }
 });
});

describe('createLevelReader media element graph', () => {
 function setup(state: string) {
 class FakeMedia {}
 const resume = vi.fn(() => Promise.resolve());
 const ctors = vi.fn();
 const analyser = {
 fftSize: 0,
 connect: vi.fn(),
 getByteTimeDomainData(buf: Uint8Array) {
 buf.fill(192);
 },
 };
 class FakeCtx {
 state = state;
 destination = {};
 constructor() {
 ctors();
 }
 createMediaElementSource() {
 return { connect: vi.fn() };
 }
 createAnalyser() {
 return analyser;
 }
 resume = resume;
 close = vi.fn(() => Promise.resolve());
 }
 vi.stubGlobal('HTMLMediaElement', FakeMedia);
 vi.stubGlobal('AudioContext', FakeCtx);
 return { FakeMedia, resume, ctors, analyser };
 }

 it('reuses the cached graph for the same element and reads a level', () => {
 const { FakeMedia, ctors, analyser } = setup('running');
 try {
 const el = new FakeMedia() as unknown as HTMLMediaElement;
 const a = createLevelReader(el);
 const b = createLevelReader(el);
 expect(ctors).toHaveBeenCalledTimes(1);
 expect(analyser.fftSize).toBe(512);
 expect(a.read()).toBeGreaterThan(0);
 expect(b.read()).toBeGreaterThan(0);
 } finally {
 vi.unstubAllGlobals();
 }
 });

 it('resumes a suspended AudioContext', () => {
 const { FakeMedia, resume } = setup('suspended');
 try {
 createLevelReader(new FakeMedia() as unknown as HTMLMediaElement);
 expect(resume).toHaveBeenCalledTimes(1);
 } finally {
 vi.unstubAllGlobals();
 }
 });
});

describe('createLevelReader resume rejection', () => {
 it('swallows a rejected resume() instead of leaking an unhandled rejection', async () => {
 class FakeMedia {}
 const resume = vi.fn(() => Promise.reject(new Error('autoplay blocked')));
 const analyser = {
 fftSize: 0,
 connect: vi.fn(),
 getByteTimeDomainData(buf: Uint8Array) {
 buf.fill(128);
 },
 };
 class FakeCtx {
 state = 'suspended';
 destination = {};
 createMediaElementSource() {
 return { connect: vi.fn() };
 }
 createAnalyser() {
 return analyser;
 }
 resume = resume;
 close = vi.fn(() => Promise.resolve());
 }
 vi.stubGlobal('HTMLMediaElement', FakeMedia);
 vi.stubGlobal('AudioContext', FakeCtx);
 try {
 const r = createLevelReader(new FakeMedia() as unknown as HTMLMediaElement);
 await new Promise((res) => setTimeout(res, 0));
 expect(resume).toHaveBeenCalledTimes(1);
 expect(r.read()).toBe(0);
 } finally {
 vi.unstubAllGlobals();
 }
 });
});
