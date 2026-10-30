#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Hub } from './hub';
import { createDispatcher } from './dispatch';
import { createMcpServer } from './mcp';

// claude-chan-mcp: stdio MCP server + local WebSocket hub for browser pages.
// Env: CLAUDE_CHAN_TOKEN (default: random), CLAUDE_CHAN_PORT (default 8765).
// stdout carries the MCP protocol, so all logging goes to stderr.

async function main(): Promise<void> {
 const token = process.env.CLAUDE_CHAN_TOKEN || randomBytes(16).toString('hex');
 const port = Number(process.env.CLAUDE_CHAN_PORT ?? 8765);
 if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('invalid CLAUDE_CHAN_PORT');
 const hub = new Hub({ port, token });
 const actual = await hub.listen();
 console.error('claude-chan hub: ws://127.0.0.1:' + actual + '/?token=<token>');
 if (!process.env.CLAUDE_CHAN_TOKEN) console.error('claude-chan token: ' + token);
 const mcp = createMcpServer(createDispatcher(hub));
 await mcp.connect(new StdioServerTransport());
 const stop = (): void => {
 void hub.close().finally(() => process.exit(0));
 };
 process.on('SIGINT', stop);
 process.on('SIGTERM', stop);
 process.stdin.on('close', stop);
}

main().catch((e) => {
 console.error(e instanceof Error ? e.message : String(e));
 process.exit(1);
});
