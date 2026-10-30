import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
 files: string[];
 exports: Record<string, string | Record<string, string>>;
 bin: Record<string, string>;
};

function norm(path: string): string {
 return path.startsWith('./') ? path.slice(2) : path;
}

function targets(): string[] {
 const out: string[] = [];
 for (const v of Object.values(pkg.exports)) {
 if (typeof v === 'string') out.push(v);
 else out.push(...Object.values(v));
 }
 return out;
}

function covered(path: string): boolean {
 const p = norm(path);
 return pkg.files.some((f) => p === f || p.startsWith(f + '/'));
}

describe('package.json', () => {
 it('ships every export target and bin via files', () => {
 for (const t of [...targets(), ...Object.values(pkg.bin)]) {
 expect(covered(t), t).toBe(true);
 }
 });

 it('has existing source files for exports outside build output', () => {
 for (const t of targets()) {
 const p = norm(t);
 if (p.startsWith('dist/')) continue;
 expect(existsSync(p), p).toBe(true);
 }
 });
});
