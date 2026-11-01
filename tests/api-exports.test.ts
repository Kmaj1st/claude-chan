import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Static check (the test env is node, so the entry is not imported): the contract in docs/API.md
// must match what src/types.ts and src/index.ts really expose.
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const doc = read('../docs/API.md');
const index = read('../src/index.ts');
const types = read('../src/types.ts');

function mountOptionKeys(): string[] {
 const start = types.indexOf('export interface MountOptions {');
 if (start < 0) throw new Error('MountOptions not found');
 const body = types.slice(start, types.indexOf('}', start));
 const keys: string[] = [];
 for (const line of body.split(String.fromCharCode(10))) {
 const m = /^\s+(\w+)\??:/.exec(line);
 if (m && m[1]) keys.push(m[1]);
 }
 return keys;
}

describe('docs/API.md exports and options', () => {
 it('documents every MountOptions key in the Mounting section', () => {
 const section = doc.slice(doc.indexOf('## Mounting'), doc.indexOf('## Controller'));
 const keys = mountOptionKeys();
 expect(keys.length).toBeGreaterThan(8);
 for (const k of keys) expect(section, k).toContain(k + ':');
 });

 it('exports every name listed under Tool-call surface from the entry', () => {
 const names = ['TOOLS', 'actInputSchema', 'listCapabilities', 'MAX_SAY_LENGTH', 'MAX_DURATION_MS',
 'parseCommand', 'runCommand', 'installPostMessageBridge', 'parseMarkers', 'createMarkerStream'];
 for (const n of names) {
 expect(doc, n).toContain(n);
 expect(index.includes(n), n).toBe(true);
 }
 });

 it('exports ClaudeChan.mount and the element', () => {
 expect(index).toContain('export const ClaudeChan = { mount }');
 expect(index).toContain('ClaudeChanElement');
 });
});
