import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadScript } from '../src/live2d';

// Minimal DOM stand-in: records script tags and lets the test fire onload/onerror.
interface FakeScript { src: string; onload?: () => void; onerror?: () => void; remove: () => void; removed: boolean }

function setup(): FakeScript[] {
 const scripts: FakeScript[] = [];
 vi.stubGlobal('window', {});
 vi.stubGlobal('document', {
 createElement: () => {
 const s: FakeScript = { src: '', removed: false, remove() { s.removed = true; } };
 return s;
 },
 head: { appendChild: (s: FakeScript) => { scripts.push(s); } },
 });
 return scripts;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('loadScript', () => {
 it('adds one script tag for concurrent loads of the same url', async () => {
 const scripts = setup();
 const a = loadScript('/dedupe.js');
 const b = loadScript('/dedupe.js');
 expect(scripts).toHaveLength(1);
 scripts[0]!.onload?.();
 await Promise.all([a, b]);
 });

 it('removes the tag on error and allows a retry', async () => {
 const scripts = setup();
 const a = loadScript('/retry.js');
 scripts[0]!.onerror?.();
 await expect(a).rejects.toThrow('Cannot load Cubism Core');
 expect(scripts[0]!.removed).toBe(true);
 const b = loadScript('/retry.js');
 expect(scripts).toHaveLength(2);
 scripts[1]!.onload?.();
 await b;
 });

 it('resolves at once when the core is already present', async () => {
 const scripts = setup();
 vi.stubGlobal('window', { Live2DCubismCore: {} });
 await loadScript('/present.js');
 expect(scripts).toHaveLength(0);
 });
});
