import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONSOLE_COMMANDS, createConsoleApi, installConsoleApi, toTarget } from '../src/console';
import type { ClaudeChanController } from '../src/types';

const pos = { x: 1, y: 2, fx: 0.1, fy: 0.2, free: true, dock: 'free' as const };
function ctrl() {
 let hidden = false;
 return {
 getPosition: vi.fn(() => pos),
 setPosition: vi.fn(),
 resetPosition: vi.fn(),
 hide: vi.fn(() => { hidden = true; }),
 show: vi.fn(() => { hidden = false; }),
 toggle: vi.fn(() => { hidden = !hidden; return !hidden; }),
 isHidden: vi.fn(() => hidden),
 } as unknown as ClaudeChanController;
}

describe('console API (window.claudeChan)', () => {
 afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

 it('setPosition: two fractions like claude_chan_set_position, px above 1, objects passed through', () => {
 expect(toTarget(0.5, 1)).toEqual({ fx: 0.5, fy: 1 });
 expect(toTarget(300, 0.5)).toEqual({ x: 300, y: 0.5 });
 expect(toTarget({ fx: 0.2, fy: 0.3 })).toEqual({ fx: 0.2, fy: 0.3 });
 expect(toTarget(Number.NaN, 1)).toBeNull();
 expect(toTarget(1)).toBeNull();
 const c = ctrl();
 const api = createConsoleApi(c);
 expect(api.setPosition(0.25, 0.75)).toBe(pos);
 expect(c.setPosition).toHaveBeenCalledWith({ fx: 0.25, fy: 0.75 });
 const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
 api.setPosition('x' as never);
 expect(warn).toHaveBeenCalled();
 expect(c.setPosition).toHaveBeenCalledTimes(1);
 });

 it('reset, hide/show/toggle and help forward to the controller', () => {
 const c = ctrl();
 const api = createConsoleApi(c, 'chan');
 expect(api.resetPosition()).toBe(pos);
 expect(c.resetPosition).toHaveBeenCalled();
 api.hide({ persist: true });
 expect(c.hide).toHaveBeenCalledWith({ persist: true });
 expect(api.isHidden()).toBe(true);
 api.show();
 expect(api.isHidden()).toBe(false);
 expect(api.toggle()).toBe(false);
 expect(api.toggle()).toBe(true);
 const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
 const lines = api.help();
 expect(lines).toHaveLength(CONSOLE_COMMANDS.length);
 expect(lines.every((l) => l.startsWith('chan.'))).toBe(true);
 expect(log).toHaveBeenCalledTimes(1);
 });

 it('install puts the API on window once (first wins) and removes only its own', () => {
 const w: Record<string, unknown> = {};
 vi.stubGlobal('window', w);
 const off1 = installConsoleApi(ctrl());
 const first = w.claudeChan;
 expect(first).toBeTruthy();
 const off2 = installConsoleApi(ctrl());
 expect(w.claudeChan).toBe(first);
 off2();
 expect(w.claudeChan).toBe(first);
 off1();
 expect('claudeChan' in w).toBe(false);
 });
});
