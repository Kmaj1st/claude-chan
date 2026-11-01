import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXPRESSIONS, MOODS, MOTIONS } from '../src/types';
import { MAX_SAY_LENGTH } from '../src/tools';

const NL = String.fromCharCode(10);
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const lines = (t: string) => t.split(NL);
const readme = read('../README.md');
const character = read('../docs/CHARACTER.md');
const toolsSrc = read('../src/tools.ts');

function listAfter(text: string, prefix: string): string[] {
 const line = lines(text).find((l) => l.startsWith(prefix));
 expect(line, prefix).toBeDefined();
 return (line ?? '').slice(prefix.length).replace('.', '').split(',').map((s) => s.trim()).filter(Boolean);
}

describe('README.md matches the code', () => {
 it('lists exactly the stable motions', () => {
 expect(listAfter(readme, 'Motions (stable names):')).toEqual([...MOTIONS]);
 });

 it('lists exactly the expressions', () => {
 expect(listAfter(readme, 'Expressions:')).toEqual([...EXPRESSIONS]);
 });

 it('mentions every tool name defined in src/tools.ts', () => {
 const names = lines(toolsSrc)
 .filter((l) => l.includes("name: 'claude_chan_"))
 .map((l) => l.split("'")[1] ?? '');
 expect(names.length).toBeGreaterThanOrEqual(4);
 for (const n of names) expect(readme.includes(n), n).toBe(true);
 });

 it('links only docs that exist', () => {
 for (const p of ['docs/CHARACTER.md', 'docs/MCP.md', 'docs/LICENSES.md', 'docs/ART-PIPELINE.md', 'ROADMAP.md']) {
 expect(() => read('../' + p), p).not.toThrow();
 }
 });
});

describe('docs/CHARACTER.md matches the code', () => {
 it('has a mood mapping row for every mood', () => {
 const rows = lines(character).filter((l) => l.startsWith('| ')).map((l) => (l.split('|')[1] ?? '').trim());
 for (const m of MOODS) expect(rows.includes(m), m).toBe(true);
 });

 it('states the bubble cap used by the code', () => {
 expect(character.includes(String(MAX_SAY_LENGTH))).toBe(true);
 });
});
