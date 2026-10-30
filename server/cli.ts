#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Hub } from './hub';
import { createDispatcher } from './dispatch';
import { createMcpServer } from './mcp';
import { createHttpServer, listenHttp } from './http';

// stdio MCP server + local WebSocket hub for browser pages.
// Validate configuration before opening listeners or logging a generated token.
// stdout carries the MCP protocol; all logging goes to stderr.
async function main(): Promise<void> {
 const port = Number(process.env.CLAUDE_CHAN_PORT || 8765);
 if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('invalid CLAUDE_CHAN_PORT');
 const httpOnly = process.argv.includes('--http-only');
 const httpPort = process.env.CLAUDE_CHAN_HTTP_PORT;
 if (httpOnly && !httpPort) throw new Error('--http-only needs CLAUDE_CHAN_HTTP_PORT');
 const n = httpPort ? Number(httpPort) : undefined;
 if (n !== undefined && (!Number.isInteger(n) || n < 0 || n > 65535)) {
 throw new Error('invalid CLAUDE_CHAN_HTTP_PORT');
 }
 const token = process.env.CLAUDE_CHAN_TOKEN || randomBytes(16).toString('hex');
 const hub = new Hub({ port, token });
 const actual = await hub.listen();
 console.error('claude-chan hub: ws://127.0.0.1:' + actual + '/?token=<token>');
 if (!process.env.CLAUDE_CHAN_TOKEN) console.error('claude-chan token: ' + token);
 const dispatch = createDispatcher(hub);
 let httpServer: ReturnType<typeof createHttpServer> | null = null;
 if (n !== undefined) {
 const http = createHttpServer(dispatch, { port: n, token });
 httpServer = http;
 const p = await listenHttp(http, { port: n, token });
 console.error('claude-chan mcp http: http://127.0.0.1:' + p + '/mcp (Authorization: Bearer <token>)');
 }
 const stop = (): void => {
 httpServer?.close();
 void hub.close().finally(() => process.exit(0));
 };
 process.on('SIGINT', stop);
 process.on('SIGTERM', stop);
 if (!httpOnly) {
 const mcp = createMcpServer(dispatch);
 await mcp.connect(new StdioServerTransport());
 process.stdin.on('close', stop);
 }
}

main().catch((e) => {
 console.error(e instanceof Error ? e.message : String(e));
 process.exit(1);
});
