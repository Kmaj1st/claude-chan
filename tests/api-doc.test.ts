import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXPRESSIONS, MOODS, MOTIONS, PRIORITIES } from '../src/types';
import { MAX_DURATION_MS, MAX_SAY_LENGTH } from '../src/tools';

// docs/API.md is the contract hapi-chan relies on: keep it in sync with the code.
const doc = readFileSync(new URL('../docs/API.md', import.meta.url), 'utf8');
const NL = String.fromCharCode(10);

function listed(label: string): string[] {
 const prefix = '- ' + label + ': ';
 const line = doc.split(NL).find((l) => l.startsWith(prefix));
 if (!line) throw new Error('docs/API.md has no ' + label + ' line');
 return line.slice(prefix.length).split(',').map((s) => s.trim());
}

describe('docs/API.md matches the code', () => {
 it('lists every motion', () => expect(listed('Motions')).toEqual([...MOTIONS]));
 it('lists every expression', () => expect(listed('Expressions')).toEqual([...EXPRESSIONS]));
 it('lists every mood', () => expect(listed('Moods')).toEqual([...MOODS]));
 it('lists priorities low to urgent', () => {
 expect(listed('Priorities').slice(0, PRIORITIES.length).map((s) => s.split(' ')[0])).toEqual([...PRIORITIES]);
 });
 it('states the validation limits', () => {
 expect(doc).toContain('MAX_SAY_LENGTH (' + MAX_SAY_LENGTH + ')');
 expect(doc).toContain('MAX_DURATION_MS (' + MAX_DURATION_MS + ')');
 });
 it('names the four tools', () => {
 for (const t of ['claude_chan_act', 'claude_chan_say', 'claude_chan_set_mood', 'claude_chan_list_motions']) {
 expect(doc).toContain(t);
 }
 });
});
