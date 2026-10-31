import { beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

const DIR = join(process.cwd(), 'node_modules', '.cache', 'cli-test');
const OUT = join(DIR, 'cli.mjs');
const TOKEN = 'a-long-enough-test-token';

interface Run {
 code: number | null;
 stderr: string;
}

// Runs the bundled CLI; resolves on exit, or kills it once until appears on stderr.
function run(args: string[], env: Record<string, string>, until?: RegExp): Promise<Run> {
 return new Promise((resolve) => {
 const child = spawn(process.execPath, [OUT, ...args], {
 env: { ...process.env, CLAUDE_CHAN_TOKEN: '', CLAUDE_CHAN_PORT: '', CLAUDE_CHAN_HTTP_PORT: '', ...env },
 stdio: ['ignore', 'ignore', 'pipe'],
 });
 let stderr = '';
 const timer = setTimeout(() => child.kill(), 8000);
 child.stderr.on('data', (d: Buffer) => {
 stderr += d.toString();
 if (until && until.test(stderr)) child.kill();
 });
 child.on('exit', (code) => {
 clearTimeout(timer);
 resolve({ code, stderr });
 });
 });
}

describe('cli', () => {
 beforeAll(async () => {
 mkdirSync(DIR, { recursive: true });
 await build({
 entryPoints: ['server/cli.ts'],
 bundle: true,
 platform: 'node',
 format: 'esm',
 target: 'node20',
 packages: 'external',
 outfile: OUT,
 logLevel: 'silent',
 });
 }, 30000);

 it('exits 1 on an invalid CLAUDE_CHAN_PORT', async () => {
 const r = await run([], { CLAUDE_CHAN_PORT: '99999', CLAUDE_CHAN_TOKEN: TOKEN });
 expect(r.code).toBe(1);
 expect(r.stderr).toContain('invalid CLAUDE_CHAN_PORT');
 });

 it('exits 1 when --http-only has no CLAUDE_CHAN_HTTP_PORT', async () => {
 const r = await run(['--http-only'], { CLAUDE_CHAN_PORT: '0', CLAUDE_CHAN_TOKEN: TOKEN });
 expect(r.code).toBe(1);
 expect(r.stderr).toContain('--http-only needs CLAUDE_CHAN_HTTP_PORT');
 });

 it('exits 1 on an invalid CLAUDE_CHAN_HTTP_PORT', async () => {
 const r = await run([], { CLAUDE_CHAN_PORT: '0', CLAUDE_CHAN_HTTP_PORT: '99999', CLAUDE_CHAN_TOKEN: TOKEN });
 expect(r.code).toBe(1);
 expect(r.stderr).toContain('invalid CLAUDE_CHAN_HTTP_PORT');
 });

 it('generates and prints a random token when none is supplied', async () => {
 const r = await run(['--http-only'], { CLAUDE_CHAN_PORT: '0', CLAUDE_CHAN_HTTP_PORT: '0' }, /mcp http: /);
 expect(r.stderr).toMatch(/claude-chan token: [0-9a-f]{32}/);
 }, 15000);

 it('starts hub and http endpoint without logging a supplied token', async () => {
 const r = await run(['--http-only'], { CLAUDE_CHAN_PORT: '0', CLAUDE_CHAN_HTTP_PORT: '0', CLAUDE_CHAN_TOKEN: TOKEN }, /mcp http: /);
 expect(r.stderr).toContain('claude-chan hub: ws://127.0.0.1:');
 expect(r.stderr).toContain('/mcp');
 expect(r.stderr).not.toContain(TOKEN);
 }, 15000);
});
