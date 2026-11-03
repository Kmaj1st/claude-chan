import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The simplified (code-drawn) version must never be presented as the normal / default / standard one.
const FILES = ['README.md', 'README.zh-CN.md', 'docs/HOT-LOAD.md', 'docs/API.md', 'docs/INTEGRATION.md', 'docs/install.html',
 'hotload/claude-chan.user.js', 'hotload/claude-chan.inline.user.js'];
const read = (f: string): string => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

describe('wording: sprites are the full version, the code-drawn one is SIMPLIFIED', () => {
 it('no file calls the simplified/procedural/fallback figure normal, default or standard', () => {
 const bad = /(simplified|procedural|code-drawn|drawn puppet|fallback figure)[^.\n]{0,60}\b(normal|standard|default version)\b|\b(normal|standard)\b[^.\n]{0,40}(simplified|procedural|code-drawn|drawn puppet|fallback figure)/i;
 for (const f of FILES) {
 for (const line of read(f).split('\n')) {
 expect(bad.test(line), f + ': ' + line.slice(0, 160)).toBe(false);
 }
 }
 expect(read('docs/install.html')).not.toMatch(/fallback figure|simple fallback|\(normal,/);
 });
 it('the install page and READMEs state full = sprites (default) vs simplified up front', () => {
 const html = read('docs/install.html');
 expect(html).toContain('Full version = sprites (default).');
 expect(html).toContain('Simplified version = a code-drawn stand-in');
 expect(html).toContain('simplified:true');
 expect(read('README.md')).toMatch(/Full version = sprites \(default\)/);
 expect(read('README.md')).toMatch(/Simplified version = a code-drawn stand-in/);
 expect(read('README.zh-CN.md')).toContain('完整版 = 精灵图（默认）');
 expect(read('README.zh-CN.md')).toContain('简化版 = 代码绘制的替身');
 });
 it('userscript descriptions say FULL and SIMPLIFIED', () => {
 for (const f of ['hotload/claude-chan.user.js', 'hotload/claude-chan.inline.user.js']) {
 const desc = read(f).split('\n').find((l) => l.includes('@description')) ?? '';
 expect(desc, f).toMatch(/FULL sprite version/);
 expect(desc, f).toMatch(/SIMPLIFIED/);
 }
 });
});
