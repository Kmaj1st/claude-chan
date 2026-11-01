import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXPRESSIONS, MOTIONS, PARAMS } from '../src/types';

const NL = String.fromCharCode(10);
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const lines = (t: string) => t.split(NL);
const doc = read('../docs/ART-PIPELINE.md');

// 'ParamAngleX / Y / Z' -> ParamAngleX, ParamAngleY, ParamAngleZ
function expand(cell: string): string[] {
 const parts = cell.split(' / ').map((s) => s.trim());
 const first = parts[0] ?? '';
 return parts.map((p, i) => (i === 0 || p.startsWith('Param') ? p : first.slice(0, -1) + p));
}

describe('docs/ART-PIPELINE.md matches the code', () => {
 it('documents exactly the PARAMS ids', () => {
 const ids = lines(doc)
 .filter((l) => l.startsWith('| Param'))
 .flatMap((l) => expand((l.split('|')[1] ?? '').trim()));
 expect([...ids].sort()).toEqual([...PARAMS].sort());
 });

 it('lists exactly the stable motions', () => {
 const line = lines(doc).find((l) => l.startsWith('idle'));
 expect(line).toBeDefined();
 const names = (line ?? '').split(',').map((s) => (s.split(' (')[0] ?? '').trim().replace('.', ''));
 expect(names).toEqual([...MOTIONS]);
 });

 it('lists exactly the expressions', () => {
 const prefix = 'One .exp3.json each:';
 const line = lines(doc).find((l) => l.startsWith(prefix));
 expect(line).toBeDefined();
 const names = (line ?? '').slice(prefix.length).split('.')[0]?.split(',').map((s) => s.trim());
 expect(names).toEqual([...EXPRESSIONS]);
 });
});

describe('demo page', () => {
 it('has every element id that demo/main.ts looks up', () => {
 const html = read('../demo/index.html');
 const main = read('../demo/main.ts');
 const ids = ['cc', 'log', 'motions', 'expressions', 'text', 'say', 'stop', 'run', 'call', 'renderer'];
 for (const id of ids) {
 expect(main.includes("'" + id + "'"), 'main.ts ' + id).toBe(true);
 expect(html.includes('id="' + id + '"'), 'index.html ' + id).toBe(true);
 }
 });
});
