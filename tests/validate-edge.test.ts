import { describe, expect, it } from 'vitest';
import { parseCommand } from '../src/validate';

describe('parseCommand edge cases', () => {
 it('duration boundaries and rounding', () => {
 expect(parseCommand('claude_chan_act', { duration: 99 }).ok).toBe(false);
 expect(parseCommand('claude_chan_act', { duration: 100 }).ok).toBe(true);
 expect(parseCommand('claude_chan_act', { duration: NaN }).ok).toBe(false);
 expect(parseCommand('claude_chan_act', { duration: Infinity }).ok).toBe(false);
 expect(parseCommand('claude_chan_act', { duration: '500' }).ok).toBe(false);
 const r = parseCommand('claude_chan_act', { duration: 150.6 });
 expect(r).toEqual({ ok: true, command: { tool: 'claude_chan_act', act: { duration: 151 } } });
 });

 it('say length boundary (280 ok, 281 rejected)', () => {
 expect(parseCommand('claude_chan_say', { text: 'x'.repeat(280) }).ok).toBe(true);
 expect(parseCommand('claude_chan_say', { text: 'x'.repeat(281) }).ok).toBe(false);
 expect(parseCommand('claude_chan_act', { say: '' }).ok).toBe(false);
 });

 it('rejects null, array and primitive args', () => {
 expect(parseCommand('claude_chan_say', null).ok).toBe(false);
 expect(parseCommand('claude_chan_say', []).ok).toBe(false);
 expect(parseCommand('claude_chan_say', 5).ok).toBe(false);
 });

 it('rejects non-string and prototype-ish tool names', () => {
 expect(parseCommand(undefined, {}).ok).toBe(false);
 expect(parseCommand({ toString: () => 'claude_chan_say' }, { text: 'a' }).ok).toBe(false);
 expect(parseCommand('proto', {}).ok).toBe(false);
 expect(parseCommand('constructor', {}).ok).toBe(false);
 });

 it('rejects proto and extra fields on every tool', () => {
 const evil = JSON.parse('{"text":"a","proto":{"x":1}}');
 expect(parseCommand('claude_chan_say', evil).ok).toBe(false);
 expect(parseCommand('claude_chan_set_mood', { mood: 'shy', x: 1 }).ok).toBe(false);
 expect(parseCommand('claude_chan_list_motions', { x: 1 }).ok).toBe(false);
 });
});
