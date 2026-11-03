import { beforeAll, describe, expect, it, vi } from 'vitest';
import { FallbackPuppet, SIMPLIFIED_WARNING, createPuppet } from '../src/renderer-select';
import { createConsoleApi } from '../src/console';
import type { ClaudeChanController, Puppet } from '../src/types';

const fake = (kind: Puppet['kind'], fail = false): Puppet => ({
 kind, element: ({ style: {}, appendChild() {}, replaceChildren() {} }) as unknown as HTMLElement, init: async () => { if (fail) throw new Error('x'); }, render() {}, destroy() {},
});

describe('renderer kind / simplified flag', () => {
 beforeAll(() => {
 vi.stubGlobal('document', { createElement: () => ({ style: {}, appendChild() {}, replaceChildren() {} }) });
 });
 it('procedural puppet is the simplified version; sprites are not', () => {
 expect(createPuppet({ renderer: 'procedural' }, false).kind).toBe('simplified');
 expect(createPuppet({ sprites: 'http://x/chars/' }, false).kind).toBe('sprites');
 });
 it('FallbackPuppet reports sprites until the sprites fail, then simplified, with the warning', async () => {
 const warn = vi.fn();
 const fb = new FallbackPuppet(fake('sprites', true), () => fake('simplified'), warn);
 expect(fb.kind).toBe('sprites');
 await fb.init();
 expect(fb.kind).toBe('simplified');
 expect(warn).toHaveBeenCalledTimes(1);
 expect(SIMPLIFIED_WARNING('http://x/chars/')).toBe('claude-chan: sprites could not be loaded from http://x/chars/; showing the SIMPLIFIED code-drawn version');
 });
 it('console help prints the renderer and exposes renderer / isSimplified', () => {
 const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
 const mk = (renderer: 'sprites' | 'simplified') => createConsoleApi({ renderer, isSimplified: renderer === 'simplified' } as unknown as ClaudeChanController);
 const full = mk('sprites');
 expect(full.renderer).toBe('sprites');
 expect(full.isSimplified).toBe(false);
 full.help();
 expect(String(log.mock.calls.at(-1)?.[0])).toContain('Renderer: sprites (full version)');
 const simple = mk('simplified');
 simple.help();
 expect(simple.isSimplified).toBe(true);
 expect(String(log.mock.calls.at(-1)?.[0])).toContain('Renderer: SIMPLIFIED');
 log.mockRestore();
 });
});
