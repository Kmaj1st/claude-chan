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
