import { afterEach, describe, expect, it, vi } from 'vitest';
import { deviceScale } from '../src/live2d';

afterEach(() => {
 vi.unstubAllGlobals();
});

describe('deviceScale', () => {
 it('is 1 without a window (SSR)', () => {
 vi.stubGlobal('window', undefined);
 expect(deviceScale()).toBe(1);
 });

 it('follows devicePixelRatio and caps it at 2', () => {
 vi.stubGlobal('window', { devicePixelRatio: 1.5 });
 expect(deviceScale()).toBe(1.5);
 vi.stubGlobal('window', { devicePixelRatio: 3 });
 expect(deviceScale()).toBe(2);
 });

 it('falls back to 1 for invalid values', () => {
 vi.stubGlobal('window', { devicePixelRatio: 0 });
 expect(deviceScale()).toBe(1);
 vi.stubGlobal('window', {});
 expect(deviceScale()).toBe(1);
 });
});
