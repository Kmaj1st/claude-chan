#!/usr/bin/env node
// Checks every relative link in tracked *.md and *.html files: the target file must exist, and for
// .md targets a #anchor must match a heading slug (GitHub style). http(s), mailto and links inside
// HTML comments are ignored. Exits 1 and lists the broken links.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const files = execFileSync('git', ['ls-files', '*.md', '*.html'], { encoding: 'utf8' })
  .split('\n').map((s) => s.trim()).filter(Boolean).filter((f) => existsSync(f));

const stripComments = (t) => t.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
const stripCode = (t) => t.replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' ')).replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));

// GitHub heading slug: lower case, drop punctuation except - and _, spaces to dashes.
function slug(h) {
  return h.trim().toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
}

const anchorCache = new Map();
function anchors(file) {
  if (anchorCache.has(file)) return anchorCache.get(file);
  const set = new Set();
  const seen = new Map();
  const text = stripCode(stripComments(readFileSync(file, 'utf8')));
  for (const line of text.split('\n')) {
    const m = /^ {0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const base = slug(m[1].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, (c) => (c === '_' ? '_' : '')));
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    set.add(n === 0 ? base : base + '-' + n);
  }
  for (const m of text.matchAll(/\sid="([^"]+)"/g)) set.add(m[1]);
  anchorCache.set(file, set);
  return set;
}

function linksOf(file) {
  const raw = readFileSync(file, 'utf8');
  const text = file.endsWith('.md') ? stripCode(stripComments(raw)) : stripComments(raw);
  const out = [];
  const add = (target, index) => out.push({ target, line: raw.slice(0, index).split('\n').length });
  if (file.endsWith('.md')) {
    for (const m of text.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) add(m[1], m.index);
  }
  for (const m of text.matchAll(/\b(?:href|src)\s*=\s*"([^"]*)"/g)) add(m[1], m.index);
  return out;
}

const broken = [];
for (const file of files) {
  for (const { target, line } of linksOf(file)) {
    if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) continue; // http, https, mailto, data, javascript ...
    if (target.startsWith('{') || target.includes('${')) continue;
    const [pathPart, rawAnchor] = target.split('#');
    const anchor = rawAnchor ? decodeURIComponent(rawAnchor) : '';
    const resolved = pathPart === '' ? file : normalize(join(dirname(file), decodeURIComponent(pathPart)));
    if (!existsSync(resolved)) {
      broken.push(`${file}:${line}  missing target ${target}`);
      continue;
    }
    if (anchor && resolved.endsWith('.md') && statSync(resolved).isFile() && !anchors(resolved).has(anchor.toLowerCase())) {
      broken.push(`${file}:${line}  missing anchor ${target}`);
    }
  }
}

if (broken.length) {
  console.error(`check-links: ${broken.length} broken link(s)`);
  for (const b of broken) console.error('  ' + b);
  process.exit(1);
}
console.log(`check-links: ${files.length} files, all relative links ok`);
