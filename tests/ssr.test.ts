import { describe, expect, it } from 'vitest';

// vitest runs in the node environment here: importing the package entry must not touch the DOM.
describe('SSR safety', () => {
 it('imports without a DOM', async () => {
 expect(typeof document).toBe('undefined');
 const mod = await import('../src/index');
 expect(typeof mod.mount).toBe('function');
 expect(typeof mod.parseMarkers).toBe('function');
 });

 it('mount() fails with a clear message without a DOM', async () => {
 const { mount } = await import('../src/index');
 expect(() => mount({} as HTMLElement)).toThrow(/browser DOM/);
 });
});
