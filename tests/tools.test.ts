import { describe, expect, it } from 'vitest';
import { MAX_DURATION_MS, MAX_SAY_LENGTH, TOOLS, actInputSchema, listCapabilities } from '../src/tools';
import { EXPRESSIONS, MOODS, MOTIONS, PRIORITIES } from '../src/types';

describe('tools', () => {
 it('exposes the stable tool names, unique', () => {
 const names = TOOLS.map((t) => t.name);
 expect(names).toEqual(['claude_chan_act', 'claude_chan_say', 'claude_chan_set_mood', 'claude_chan_set_state', 'claude_chan_list_motions', 'claude_chan_set_position', 'claude_chan_reset_position']);
 expect(new Set(names).size).toBe(names.length);
 });

 it('every tool has a description and a strict object schema', () => {
 for (const t of TOOLS) {
 expect(t.description.length).toBeGreaterThan(0);
 expect(t.inputSchema.type).toBe('object');
 expect(t.inputSchema.additionalProperties).toBe(false);
 }
 });

 it('act schema enums mirror the type constants', () => {
 const p = actInputSchema.properties;
 expect(p.motion.enum).toEqual([...MOTIONS]);
 expect(p.expression.enum).toEqual([...EXPRESSIONS]);
 expect(p.priority.enum).toEqual([...PRIORITIES]);
 expect(p.say.maxLength).toBe(MAX_SAY_LENGTH);
 expect(p.duration.maximum).toBe(MAX_DURATION_MS);
 });

 it('say and set_mood require their argument', () => {
 const say = TOOLS.find((t) => t.name === 'claude_chan_say')!;
 const mood = TOOLS.find((t) => t.name === 'claude_chan_set_mood')!;
 expect(say.inputSchema).toMatchObject({ required: ['text'] });
 expect(mood.inputSchema).toMatchObject({ required: ['mood'], properties: { mood: { enum: [...MOODS] } } });
 });

 it('listCapabilities returns all constants', () => {
 expect(listCapabilities()).toEqual({ motions: MOTIONS, expressions: EXPRESSIONS, moods: MOODS, priorities: PRIORITIES });
 });
});
