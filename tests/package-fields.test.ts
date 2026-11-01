import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
 main: string;
 module: string;
 types: string;
 exports: Record<string, Record<string, string> | string>;
 bin: Record<string, string>;
 scripts: Record<string, string>;
};

const root = pkg.exports['.'] as Record<string, string>;
const built = existsSync('dist/claude-chan.js');

describe('package.json entry fields', () => {
 it('main, module and types agree with exports["."]', () => {
 expect(pkg.main).toBe(root.import);
 expect(pkg.module).toBe(root.import);
 expect(pkg.types).toBe(root.types);
 });

 it('the bin source starts with a node shebang', () => {
 const src = readFileSync('server/cli.ts', 'utf8');
 expect(src.startsWith('#!/usr/bin/env node')).toBe(true);
 });

 it('the bin target is produced by the build:server script', () => {
 const target = Object.values(pkg.bin)[0]!.replace('./', '');
 expect(pkg.scripts['build:server']).toContain('--outfile=' + target);
 });

 it.skipIf(!built)('built dist targets exist and the bin keeps its shebang', () => {
 expect(existsSync('dist/claude-chan.js')).toBe(true);
 expect(existsSync('dist/index.d.ts')).toBe(true);
 const bin = Object.values(pkg.bin)[0]!;
 expect(readFileSync(bin, 'utf8').startsWith('#!/usr/bin/env node')).toBe(true);
 });
});
