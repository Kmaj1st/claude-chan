import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Spec = { cols: number; rows: number; dir: string; items: string[] };
const specs = JSON.parse(readFileSync(resolve('scripts/art-items.json'), 'utf8')) as Record<string, Spec>;
const names = Object.values(specs).flatMap((s) => s.items);

describe('art-items.json', () => {
 it('fills every sheet row, at most cols*rows items', () => {
 for (const [id, s] of Object.entries(specs)) {
 expect(s.items.length, id).toBeLessThanOrEqual(s.cols * s.rows);
 expect(s.items.length, id).toBeGreaterThan(s.cols * (s.rows - 1));
 }
 });

 it('has unique item names', () => {
 expect(new Set(names).size).toBe(names.length);
 });

 it('has no item name that is a prefix of another (importer matches by startsWith)', () => {
 for (const a of names) for (const b of names) if (a !== b) expect(b.startsWith(a), a + ' vs ' + b).toBe(false);
 });

 it('has no item name that looks like a sheet id', () => {
 for (const n of names) for (const id of Object.keys(specs)) expect(n.toUpperCase().startsWith(id), n).toBe(false);
 });
});
