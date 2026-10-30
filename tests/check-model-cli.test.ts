import { beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
import map from '../src/model/motions.default.json';
import { EXPRESSIONS, MOTIONS } from '../src/types';

const DIR = path.join(process.cwd(), 'node_modules', '.cache', 'check-model-test');
const OUT = path.join(DIR, 'check-model.mjs');

function run(args: string[]) {
 const r = spawnSync(process.execPath, [OUT, ...args], { encoding: 'utf8', timeout: 15000 });
 return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

function validFolder(): string {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-model-cli-'));
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
 put(
 'claude-chan.model3.json',
 JSON.stringify({
 Version: 3,
 FileReferences: {
 Moc: 'claude-chan.moc3',
 Textures: ['textures/texture_00.png'],
 Physics: 'claude-chan.physics3.json',
 Expressions: EXPRESSIONS.map((e) => ({ Name: e, File: 'expressions/' + e + '.exp3.json' })),
 Motions: groups,
 },
 }),
 );
 put('motions.json', JSON.stringify(map));
 return dir;
}

describe('check-model cli', () => {
 beforeAll(async () => {
 fs.mkdirSync(DIR, { recursive: true });
 await build({
 entryPoints: ['server/check-model.ts'],
 bundle: true,
 platform: 'node',
 format: 'esm',
 target: 'node20',
 packages: 'external',
 outfile: OUT,
 logLevel: 'silent',
 });
 }, 30000);

 it('exits 2 with usage when no folder is given', () => {
 const r = run([]);
 expect(r.code).toBe(2);
 expect(r.stderr).toContain('usage:');
 });

 it('exits 1 and prints ERROR/FAIL for a missing folder', () => {
 const r = run([path.join(os.tmpdir(), 'cc-nonexistent-cli-xyz')]);
 expect(r.code).toBe(1);
 expect(r.stdout).toContain('ERROR ');
 expect(r.stdout).toContain('FAIL: 1 error(s)');
 });

 it('exits 0 and prints OK for a complete folder', () => {
 const r = run([validFolder()]);
 expect(r.code).toBe(0);
 expect(r.stdout).toContain('OK: model folder passes');
 });
});
