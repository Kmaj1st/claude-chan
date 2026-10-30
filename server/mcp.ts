import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TOOLS } from '../src/tools';
import type { DispatchResult } from './dispatch';

// MCP server exposing the claude_chan_* tools; every call goes through the dispatcher.

export type Dispatch = (tool: string, args: unknown) => DispatchResult;

export function createMcpServer(dispatch: Dispatch): Server {
 const server = new Server({ name: 'claude-chan', version: '0.1.0' }, { capabilities: { tools: {} } });
 server.setRequestHandler(ListToolsRequestSchema, async () => ({
 tools: TOOLS.map((t) => ({
 name: t.name,
 description: t.description,
 inputSchema: t.inputSchema as unknown as { type: 'object' },
 })),
 }));
 server.setRequestHandler(CallToolRequestSchema, async (req) => {
 const r = dispatch(req.params.name, req.params.arguments);
 return {
 content: [{ type: 'text' as const, text: r.ok ? JSON.stringify(r.result) : (r.error ?? 'error') }],
 isError: !r.ok,
 };
 });
 return server;
}
