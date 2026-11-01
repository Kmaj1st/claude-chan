import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Hub } from '../server/hub';

// The example token in docs/MCP.md must be accepted by the hub (it needs 16+ characters).
const doc = readFileSync(new URL('../docs/MCP.md', import.meta.url), 'utf8');

describe('docs/MCP.md example tokens', () => {
 it('uses a placeholder token the hub accepts', () => {
 const tokens = [...doc.matchAll(/CLAUDE_CHAN_TOKEN"?[:=]\s*"?([\w-]+)/g)].map((m) => m[1] ?? '');
 expect(tokens.length).toBeGreaterThan(0);
 for (const t of tokens) expect(() => new Hub({ token: t }), t).not.toThrow();
 });

 it('uses an acceptable bearer placeholder in the HTTP example', () => {
 const m = /Bearer ([\w-]+)"/.exec(doc);
 expect(m).not.toBeNull();
 expect((m?.[1] ?? '').length).toBeGreaterThanOrEqual(16);
 });
});
