import { describe, expect, it, vi } from 'vitest';
import { AGENT_STATES, STATE_MAP, applyState, isAgentState } from '../src/states';
import { EXPRESSIONS, MOODS, MOTIONS, PRIORITIES } from '../src/types';

describe('agent states', () => {
 it('maps every state to valid names', () => {
 for (const s of AGENT_STATES) {
 const r = STATE_MAP[s];
 expect(MOODS).toContain(r.mood);
 expect(PRIORITIES).toContain(r.priority);
 if (r.motion) expect(MOTIONS).toContain(r.motion);
 if (r.expression) expect(EXPRESSIONS).toContain(r.expression);
 }
 expect(Object.keys(STATE_MAP).sort()).toEqual([...AGENT_STATES].sort());
 });

 it('isAgentState accepts only known names', () => {
 expect(isAgentState('thinking')).toBe(true);
 expect(isAgentState('nope')).toBe(false);
 expect(isAgentState(3)).toBe(false);
 });

 it('applyState sets mood and acts', () => {
 const ctrl = { act: vi.fn(), setMood: vi.fn() };
 applyState(ctrl, 'error');
 expect(ctrl.setMood).toHaveBeenCalledWith('sad');
 expect(ctrl.act).toHaveBeenCalledWith({ motion: 'pout', expression: 'sad', priority: 'high' });
 });

 it('exports from the package entry', async () => {
 const m = await import('../src/index');
 expect(m.applyState).toBe(applyState);
 expect(m.AGENT_STATES).toBe(AGENT_STATES);
 });
});
