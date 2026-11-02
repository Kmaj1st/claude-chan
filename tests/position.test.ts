import { describe, expect, it, vi } from 'vitest';
import { clampToArea, fromFraction, parseStored, snapToEdges, toFraction } from '../src/position';
import { parseCommand } from '../src/validate';
import { runCommand } from '../src/bridge';
import { cleanArgs, createDispatcher } from '../server/dispatch';
import type { ClaudeChanController } from '../src/types';

const A = { left: 0, top: 0, width: 1000, height: 800 };

describe('position geometry', () => {
 it('clamps inside the area with a margin', () => {
 expect(clampToArea(-5, 900, 200, 300, A, 8)).toEqual({ x: 8, y: 492 });
 expect(clampToArea(400, 300, 200, 300, A, 8)).toEqual({ x: 400, y: 300 });
 expect(clampToArea(NaN, Infinity, 200, 300, A, 8)).toEqual({ x: 8, y: 8 });
 });

 it('clamps into an offset area (visual viewport band above a phone keyboard)', () => {
 expect(clampToArea(10, 700, 200, 300, { left: 0, top: 50, width: 1000, height: 400 }, 8)).toEqual({ x: 10, y: 142 });
 });

 it('pins a box larger than the area to its top-left plus margin', () => {
 expect(clampToArea(50, 50, 500, 500, { left: 0, top: 0, width: 300, height: 300 }, 8)).toEqual({ x: 8, y: 8 });
 });

 it('fractions round-trip and stay in 0..1', () => {
 expect(toFraction(8, 200, 1000, 8)).toBe(0);
 expect(toFraction(792, 200, 1000, 8)).toBe(1);
 expect(toFraction(5000, 200, 1000, 8)).toBe(1);
 expect(fromFraction(0.5, 200, 1000, 8)).toBe(400);
 expect(fromFraction(2, 200, 1000, 8)).toBe(792);
 expect(toFraction(100, 900, 800, 8)).toBe(0);
 expect(fromFraction(0.5, 900, 800, 8)).toBe(8);
 });

 it('snaps only within the threshold', () => {
 expect(snapToEdges({ x: 20, y: 470 }, 200, 300, A, 8, 24)).toEqual({ x: 8, y: 492 });
 expect(snapToEdges({ x: 100, y: 200 }, 200, 300, A, 8, 24)).toEqual({ x: 100, y: 200 });
 expect(snapToEdges({ x: 780, y: 10 }, 200, 300, A, 8, 24)).toEqual({ x: 792, y: 8 });
 });

 it('reads v2 fractions and legacy px, rejects junk', () => {
 expect(parseStored({ v: 2, fx: 0.3, fy: 7 }, 200, 300, 1000, 800, 8)).toEqual({ fx: 0.3, fy: 1 });
 expect(parseStored({ x: 400, y: 8 }, 200, 300, 1000, 800, 8)).toEqual({ fx: 0.5, fy: 0 });
 expect(parseStored({ x: 'a', y: 1 }, 200, 300, 1000, 800)).toBeNull();
 expect(parseStored(null, 200, 300, 1000, 800)).toBeNull();
 expect(parseStored(5, 200, 300, 1000, 800)).toBeNull();
 });
});

describe('position commands', () => {
 it('validates set_position as fractions 0..1 and reset_position without args', () => {
 expect(parseCommand('claude_chan_set_position', { x: 0.25, y: 1 })).toEqual({ ok: true, command: { tool: 'claude_chan_set_position', fx: 0.25, fy: 1 } });
 expect(parseCommand('claude_chan_set_position', { x: 1.5, y: 0 }).ok).toBe(false);
 expect(parseCommand('claude_chan_set_position', { x: 0.5 }).ok).toBe(false);
 expect(parseCommand('claude_chan_set_position', { x: 0.5, y: 0.5, z: 1 }).ok).toBe(false);
 expect(parseCommand('claude_chan_reset_position', {}).ok).toBe(true);
 expect(parseCommand('claude_chan_reset_position', { x: 1 }).ok).toBe(false);
 });

 it('runCommand calls the controller', () => {
 const ctrl = { setPosition: vi.fn(), resetPosition: vi.fn() } as unknown as ClaudeChanController;
 const p = parseCommand('claude_chan_set_position', { x: 0, y: 0.5 });
 if (!p.ok) throw new Error(p.error);
 expect(runCommand(ctrl, p.command)).toEqual({ ok: true });
 expect(ctrl.setPosition).toHaveBeenCalledWith({ fx: 0, fy: 0.5 });
 const r = parseCommand('claude_chan_reset_position', undefined);
 if (!r.ok) throw new Error(r.error);
 runCommand(ctrl, r.command);
 expect(ctrl.resetPosition).toHaveBeenCalled();
 });

 it('the hub dispatcher forwards them to pages with clean args', () => {
 const sent: unknown[] = [];
 const d = createDispatcher({ broadcast: (m: unknown) => (sent.push(m), 1) });
 expect(d('claude_chan_set_position', { x: 1, y: 0 }).ok).toBe(true);
 expect(d('claude_chan_reset_position', {}).ok).toBe(true);
 expect(sent).toEqual([
 { type: 'claude-chan', id: 1, tool: 'claude_chan_set_position', args: { x: 1, y: 0 } },
 { type: 'claude-chan', id: 2, tool: 'claude_chan_reset_position', args: {} },
 ]);
 expect(cleanArgs({ tool: 'claude_chan_set_mood', mood: 'happy' })).toEqual({ mood: 'happy' });
 });
});
