import { afterEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createHttpServer, listenHttp } from '../server/http';

const TOKEN = 'test-token';
let server: Server | undefined;
const sent: unknown[] = [];

async function start(): Promise<number> {
 const dispatch = (async (cmd: unknown) => {
 sent.push(cmd);
 return { ok: true };
 }) as never;
 server = createHttpServer(dispatch, { port: 0, token: TOKEN });
 return listenHttp(server, { port: 0, token: TOKEN });
}

const INIT = {
 jsonrpc: '2.0',
 id: 1,
 method: 'initialize',
 params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '0' } },
};

function post(port: number, headers: Record<string, string>, body: unknown = INIT): Promise<Response> {
 return fetch('http://127.0.0.1:' + port + '/mcp', {
 method: 'POST',
 headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
 body: JSON.stringify(body),
 });
}

afterEach(async () => {
 await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
 server = undefined;
});

describe('http mcp endpoint', () => {
 it('rejects a missing token', async () => {
 const port = await start();
 expect((await post(port, {})).status).toBe(401);
 });

 it('rejects a token without the Bearer prefix', async () => {
 const port = await start();
 expect((await post(port, { authorization: TOKEN })).status).toBe(401);
 });

 it('rejects a foreign origin', async () => {
 const port = await start();
 const res = await post(port, { authorization: 'Bearer ' + TOKEN, origin: 'https://evil.example' });
 expect(res.status).toBe(403);
 });

 it('answers initialize with a valid token', async () => {
 const port = await start();
 const res = await post(port, { authorization: 'Bearer ' + TOKEN });
 expect(res.status).toBe(200);
 expect(await res.text()).toContain('claude-chan');
 });

 it('rejects oversized bodies', async () => {
 const port = await start();
 const big = { ...INIT, pad: 'x'.repeat(70000) };
 const res = await post(port, { authorization: 'Bearer ' + TOKEN }, big).catch(() => undefined);
 expect(res === undefined || res.status >= 400).toBe(true);
 });
});
