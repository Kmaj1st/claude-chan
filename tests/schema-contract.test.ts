import { describe, expect, it } from 'vitest';
import { TOOLS } from '../src/tools';
import { parseCommand } from '../src/validate';

// The published JSON schema must not accept input that parseCommand rejects.
describe('schema and validator agree on say', () => {
 it('act.say requires at least one character', () => {
 const act = TOOLS.find((t) => t.name === 'claude_chan_act') as any;
 expect(act.inputSchema.properties.say.minLength).toBe(1);
 expect(parseCommand('claude_chan_act', { say: '' }).ok).toBe(false);
 expect(parseCommand('claude_chan_act', { say: 'hi' }).ok).toBe(true);
 });
});
