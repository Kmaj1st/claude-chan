import { describe, expect, it } from 'vitest';

describe('public exports', () => {
 it('exposes the documented runtime API', async () => {
 const mod = await import('../src/index');
 const fns = [
 'mount',
 'defineClaudeChan',
 'runCommand',
 'installPostMessageBridge',
 'parseMarkers',
 'createMarkerStream',
 'parseCommand',
 'listCapabilities',
 ];
 for (const name of fns) {
 expect(typeof (mod as Record<string, unknown>)[name], name).toBe('function');
 }
 expect(typeof mod.ClaudeChanElement === 'function' || typeof mod.ClaudeChanElement === 'undefined').toBe(true);
 expect(mod.ClaudeChan.mount).toBe(mod.mount);
 expect(mod.TOOLS).toBeTruthy();
 expect(mod.actInputSchema).toBeTruthy();
 expect(typeof mod.MAX_SAY_LENGTH).toBe('number');
 expect(typeof mod.MAX_DURATION_MS).toBe('number');
 expect(mod.MAX_SAY_LENGTH).toBeGreaterThan(0);
 expect(mod.MAX_DURATION_MS).toBeGreaterThan(0);
 });
});
