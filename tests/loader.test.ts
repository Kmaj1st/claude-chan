import { describe, expect, it } from 'vitest';
import { baseFrom, configFromScript, load } from '../src/loader';
import { INLINE_SPRITES } from '../src/loader-assets';

// Pure parts of the hot-load entry; the browser behaviour is covered by tests/e2e/loader.mjs (npm run test:loader).
describe('hot-load loader helpers', () => {
 it('resolves the repository root from the loader URL', () => {
 expect(baseFrom('https://cdn.jsdelivr.net/gh/Kmaj1st/claude-chan@main/hotload/loader.js')).toBe('https://cdn.jsdelivr.net/gh/Kmaj1st/claude-chan@main/');
 expect(baseFrom('http://127.0.0.1:5179/hotload/loader.js')).toBe('http://127.0.0.1:5179/');
 expect(baseFrom(null)).toBeNull();
 expect(baseFrom('not a url')).toBeNull();
 });

 it('reads valid data-* attributes and drops invalid ones', () => {
 const el = { dataset: { position: 'top-right', dock: 'fixed-default', size: '160', zIndex: '9', sprites: 'https://x/s/', frames: '', renderer: 'live2d' } };
 expect(configFromScript(el as unknown as Element)).toEqual({
 position: 'top-right', dock: 'fixed-default', size: 160, zIndex: 9, sprites: 'https://x/s/', frames: true,
 });
 const bad = { dataset: { position: 'middle', dock: 'x', size: 'big', frames: 'false' } };
 expect(configFromScript(bad as unknown as Element)).toEqual({ frames: false });
 expect(configFromScript(null)).toEqual({});
 });

 it('does nothing without a DOM (SSR) and ships without embedded sprites by default', () => {
 expect(load()).toBeNull();
 expect(INLINE_SPRITES).toBeNull();
 });
});
