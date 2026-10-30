import { describe, expect, it } from 'vitest';
import map from '../src/model/motions.default.json';
import { EXPRESSIONS, MOTIONS, PARAMS } from '../src/types';

// motions.default.json is the contract an artist's model must satisfy (docs/ART-PIPELINE.md).
describe('motions.default.json', () => {
 it('maps every preset motion to a group and index', () => {
 for (const m of MOTIONS) {
 const entry = (map.motions as Record<string, { group: string; index: number }>)[m];
 expect(entry, m).toBeDefined();
 expect(typeof entry?.group).toBe('string');
 expect(Number.isInteger(entry?.index)).toBe(true);
 }
 });

 it('maps every expression and has no unknown motion names', () => {
 for (const e of EXPRESSIONS) expect(map.expressions).toHaveProperty(e);
 for (const k of Object.keys(map.motions)) expect(MOTIONS as readonly string[]).toContain(k);
 });

 it('only renames known parameters', () => {
 for (const k of Object.keys(map.params)) expect(PARAMS as readonly string[]).toContain(k);
 });
});
