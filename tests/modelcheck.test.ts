import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import map from '../src/model/motions.default.json';
import { checkModel } from '../server/modelcheck';
import { EXPRESSIONS, MOTIONS } from '../src/types';

function build(mutate?: (m: any, mapJson: any) => void): string {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-model-'));
 const put = (f: string, c: string) => {
 fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
 fs.writeFileSync(path.join(dir, f), c);
 };
 const groups: Record<string, unknown[]> = {};
 for (const m of MOTIONS) {
 groups[m] = [{ File: 'motions/' + m + '.motion3.json' }];
 put('motions/' + m + '.motion3.json', '{}');
 }
 for (const e of EXPRESSIONS) put('expressions/' + e + '.exp3.json', '{}');
 put('claude-chan.moc3', 'x');
 put('textures/texture_00.png', 'x');
 put('claude-chan.physics3.json', '{}');
 const model = {
 Version: 3,
 FileReferences: {
 Moc: 'claude-chan.moc3',
 Textures: ['textures/texture_00.png'],
 Physics: 'claude-chan.physics3.json',
 Expressions: EXPRESSIONS.map((e) => ({ Name: e, File: 'expressions/' + e + '.exp3.json' })),
 Motions: groups,
 },
 };
 const mapJson = JSON.parse(JSON.stringify(map));
 mutate?.(model, mapJson);
 put('claude-chan.model3.json', JSON.stringify(model));
 put('motions.json', JSON.stringify(mapJson));
 return dir;
}

describe('checkModel', () => {
 it('passes a complete folder', () => {
 expect(checkModel(build()).errors).toEqual([]);
 });
 it('reports malformed model3.json structure instead of throwing', () => {
 const dir = build((m) => {
 m.FileReferences.Motions = { wave: 'nope' };
 m.FileReferences.Expressions = [null];
 });
 const r = checkModel(dir);
 expect(r.errors.length).toBeGreaterThan(0);
 expect(r.errors.join()).toContain('malformed');
 });
 it('reports a missing moc file', () => {
 const dir = build();
 fs.rmSync(path.join(dir, 'claude-chan.moc3'));
 expect(checkModel(dir).errors.join()).toContain('Moc not found');
 });
 it('reports an expression missing from model3.json', () => {
 const dir = build((m) => {
 m.FileReferences.Expressions = [];
 });
 expect(checkModel(dir).errors.join()).toContain('not in model3.json');
 });
 it('reports a motion index out of range', () => {
 const dir = build((_m, mj) => {
 mj.motions.wave.index = 5;
 });
 expect(checkModel(dir).errors.join()).toContain('out of range');
 });
 it('rejects a model3.json that is not Version 3', () => {
 const dir = build((m) => {
 m.Version = 2;
 });
 expect(checkModel(dir).errors.join()).toContain('Version must be 3');
 });
 it('warns, but does not fail, when motions.json is absent', () => {
 const dir = build();
 fs.rmSync(path.join(dir, 'motions.json'));
 const r = checkModel(dir);
 expect(r.errors).toEqual([]);
 expect(r.warnings.join()).toContain('no motions.json');
 });
 it('reports a motion whose group is not in model3.json', () => {
 const dir = build((_m, mj) => {
 mj.motions.wave.group = 'nope';
 });
 expect(checkModel(dir).errors.join()).toContain('group nope not in model3.json');
 });
 it('warns about a motion missing from motions.json', () => {
 const dir = build((_m, mj) => {
 delete mj.motions.wave;
 });
 const r = checkModel(dir);
 expect(r.errors).toEqual([]);
 expect(r.warnings.join()).toContain('missing motion wave');
 });
 it('warns when cdi3.json lacks a lip-sync parameter', () => {
 const dir = build((m) => {
 m.FileReferences.DisplayInfo = 'claude-chan.cdi3.json';
 });
 fs.writeFileSync(path.join(dir, 'claude-chan.cdi3.json'), JSON.stringify({ Parameters: [] }));
 const r = checkModel(dir);
 expect(r.errors).toEqual([]);
 expect(r.warnings.join()).toContain('cdi3.json lacks parameter');
 });
 it('errors on a missing folder or model3.json', () => {
 expect(checkModel(path.join(os.tmpdir(), 'cc-nonexistent-xyz')).errors.length).toBe(1);
 const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-empty-'));
 expect(checkModel(empty).errors.join()).toContain('no *.model3.json');
 });
});
