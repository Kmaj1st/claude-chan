import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../server/mcp';
import { createDispatcher } from '../server/dispatch';

async function setup() {
 const sent: unknown[] = [];
 const dispatch = createDispatcher({ broadcast: (m: unknown) => (sent.push(m), 1) });
 const server = createMcpServer(dispatch);
 const [a, b] = InMemoryTransport.createLinkedPair();
 const client = new Client({ name: 't', version: '0' });
 await Promise.all([server.connect(a), client.connect(b)]);
 return { client, sent };
}

describe('mcp server', () => {
 it('returns isError for an unknown tool without broadcasting', async () => {
 const { client, sent } = await setup();
 const r = await client.callTool({ name: 'claude_chan_nope', arguments: {} });
 expect(r.isError).toBe(true);
 expect(sent).toHaveLength(0);
 });

 it('handles a call with no arguments object', async () => {
 const { client, sent } = await setup();
 const bad = await client.callTool({ name: 'claude_chan_say' });
 expect(bad.isError).toBe(true);
 const ok = await client.callTool({ name: 'claude_chan_list_motions' });
 expect(ok.isError).toBe(false);
 expect(sent).toHaveLength(0);
 });

 it('returns JSON text content for list_motions', async () => {
 const { client } = await setup();
 const r = await client.callTool({ name: 'claude_chan_list_motions', arguments: {} });
 const content = r.content as Array<{ type: string; text: string }>;
 const first = content[0]!;
 expect(first.type).toBe('text');
 expect(() => JSON.parse(first.text)).not.toThrow();
 });

 it('lists every tool', async () => {
 const { client } = await setup();
 const { tools } = await client.listTools();
 expect(tools.map((t) => t.name).sort()).toEqual([
 'claude_chan_act',
 'claude_chan_list_motions',
 'claude_chan_reset_position',
 'claude_chan_say',
 'claude_chan_set_mood',
 'claude_chan_set_position',
 'claude_chan_set_state',
 ]);
 });

 it('broadcasts a valid call', async () => {
 const { client, sent } = await setup();
 const r = await client.callTool({ name: 'claude_chan_say', arguments: { text: 'hi' } });
 expect(r.isError).toBe(false);
 expect(sent).toHaveLength(1);
 });

 it('rejects invalid args without broadcasting', async () => {
 const { client, sent } = await setup();
 const r = await client.callTool({ name: 'claude_chan_say', arguments: { text: '' } });
 expect(r.isError).toBe(true);
 expect(sent).toHaveLength(0);
 });

 it('answers list_motions locally', async () => {
 const { client, sent } = await setup();
 const r = await client.callTool({ name: 'claude_chan_list_motions', arguments: {} });
 expect(r.isError).toBe(false);
 expect(sent).toHaveLength(0);
 });
});
