import { describe, expect, it } from 'vitest';
import { parseCommand } from '../src/validate';

describe('parseCommand', () => {
 it('accepts a valid act', () => {
 const r = parseCommand('claude_chan_act', { motion: 'wave', duration: 1500, priority: 'high' });
 expect(r).toEqual({ ok: true, command: { tool: 'claude_chan_act', act: { motion: 'wave', duration: 1500, priority: 'high' } } });
 });
 it('rejects unknown motion, extra fields and empty act', () => {
 expect(parseCommand('claude_chan_act', { motion: 'dance' }).ok).toBe(false);
 expect(parseCommand('claude_chan_act', { motion: 'wave', evil: 1 }).ok).toBe(false);
 expect(parseCommand('claude_chan_act', {}).ok).toBe(false);
 });
 it('bounds sizes', () => {
 expect(parseCommand('claude_chan_say', { text: 'x'.repeat(281) }).ok).toBe(false);
 expect(parseCommand('claude_chan_act', { duration: 999999 }).ok).toBe(false);
 });
 it('validates mood and unknown tools', () => {
 expect(parseCommand('claude_chan_set_mood', { mood: 'shy' }).ok).toBe(true);
 expect(parseCommand('claude_chan_set_mood', { mood: 'x' }).ok).toBe(false);
 expect(parseCommand('rm_rf', {}).ok).toBe(false);
 });
 it('rejects non-object args', () => {
 expect(parseCommand('claude_chan_say', 'hi').ok).toBe(false);
 expect(parseCommand('claude_chan_list_motions', undefined).ok).toBe(true);
 });
});
