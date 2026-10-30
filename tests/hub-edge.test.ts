import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { Hub, MAX_MESSAGE_BYTES } from '../server/hub';

const TOKEN = 'a-long-enough-test-token';
let hub: Hub | undefined;

afterEach(async () => {
 await hub?.close();
 hub = undefined;
});

function connect(port: number, origin?: string): Promise<WebSocket | string> {
 return new Promise((resolve) => {
 const ws = new WebSocket('ws://127.0.0.1:' + port + '/?token=' + TOKEN, { headers: origin ? { origin } : {} });
 ws.on('open', () => resolve(ws));
 ws.on('unexpected-response', (_req, res) => resolve(String(res.statusCode)));
 ws.on('error', () => undefined);
 });
}

function closed(ws: WebSocket): Promise<number> {
 return new Promise((resolve) => ws.on('close', (code) => resolve(code)));
}

async function until(cond: () => boolean): Promise<void> {
 for (let i = 0; i < 100 && !cond(); i++) await new Promise((r) => setTimeout(r, 20));
}

describe('hub edge cases', () => {
 it('allows connections without an Origin header', async () => {
 hub = new Hub({ token: TOKEN });
 const ws = await connect(await hub.listen());
 expect(typeof ws).not.toBe('string');
 (ws as WebSocket).close();
 });

 it('uses exact allowedOrigins when given', async () => {
 hub = new Hub({ token: TOKEN, allowedOrigins: ['https://app.example'] });
 const port = await hub.listen();
 expect(await connect(port, 'http://localhost:5173')).toBe('403');
 const ws = await connect(port, 'https://app.example');
 expect(typeof ws).not.toBe('string');
 (ws as WebSocket).close();
 });

 it('answers 503 above maxClients', async () => {
 hub = new Hub({ token: TOKEN, maxClients: 1 });
 const port = await hub.listen();
 const first = (await connect(port)) as WebSocket;
 expect(await connect(port)).toBe('503');
 first.close();
 });

 it('counts clients and broadcast deliveries', async () => {
 hub = new Hub({ token: TOKEN });
 const port = await hub.listen();
 expect(hub.broadcast({ a: 1 })).toBe(0);
 const ws = (await connect(port)) as WebSocket;
 await until(() => hub!.clientCount === 1);
 expect(hub.clientCount).toBe(1);
 expect(hub.broadcast({ a: 1 })).toBe(1);
 ws.close();
 await until(() => hub!.clientCount === 0);
 expect(hub.clientCount).toBe(0);
 });

 it('closes a client that sends an oversized message', async () => {
 hub = new Hub({ token: TOKEN });
 const ws = (await connect(await hub.listen())) as WebSocket;
 const done = closed(ws);
 ws.send('x'.repeat(MAX_MESSAGE_BYTES + 1));
 expect(await done).toBe(1009);
 });
});
