import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOOLS } from '../src/tools';

// schema/claude_chan_act.json is the published copy of the claude_chan_act tool definition.
// Regenerate with: set UPDATE_SCHEMA=1&& npx vitest run tests/schema.test.ts
const FILE = 'schema/claude_chan_act.json';

describe('published schema', () => {
 it('matches the claude_chan_act tool definition', () => {
 const act = TOOLS.find((t) => t.name === 'claude_chan_act');
 expect(act).toBeDefined();
 const expected = JSON.stringify(act, null, 2);
 if (process.env.UPDATE_SCHEMA) {
 mkdirSync('schema', { recursive: true });
 writeFileSync(FILE, expected + String.fromCharCode(10));
 }
 expect(existsSync(FILE)).toBe(true);
 expect(JSON.parse(readFileSync(FILE, 'utf8'))).toEqual(JSON.parse(expected));
 });
});

// schema/claude_chan_tools.json is the published copy of all tool definitions.
const ALL_FILE = 'schema/claude_chan_tools.json';

describe('published tools schema', () => {
 it('matches the full TOOLS list', () => {
 const expected = JSON.stringify(TOOLS, null, 2);
 if (process.env.UPDATE_SCHEMA) {
 mkdirSync('schema', { recursive: true });
 writeFileSync(ALL_FILE, expected + String.fromCharCode(10));
 }
 expect(existsSync(ALL_FILE)).toBe(true);
 expect(JSON.parse(readFileSync(ALL_FILE, 'utf8'))).toEqual(JSON.parse(expected));
 });
});
