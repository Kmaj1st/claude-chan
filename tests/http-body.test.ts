import { afterEach, describe, expect, it } from 'vitest';
import { request, type Server } from 'node:http';
import { createHttpServer, listenHttp, MAX_HTTP_BODY } from '../server/http';

const TOKEN = 'body-token';
let server: Server | undefined;

afterEach(async () => {
 await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
 server = undefined;
});

function post(port: number, chunks: string[], extra: Record<string, string> = {}): Promise<number> {
 return new Promise((resolve, reject) => {
 const headers = { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json', ...extra };
 const req = request({ host: '127.0.0.1', port, path: '/mcp', method: 'POST', headers, agent: false }, (res) => {
 res.resume();
 resolve(res.statusCode ?? 0);
 });
 // The server may close the socket after replying 413; the status is what matters.
 req.on('error', (e) => (req.destroyed ? undefined : reject(e)));
 for (const c of chunks) req.write(c);
 req.end();
 });
}

async function start(): Promise<number> {
 server = createHttpServer((async () => ({})) as never, { port: 0, token: TOKEN });
 return listenHttp(server, { port: 0, token: TOKEN });
}

describe('http body limits', () => {
 it('answers 413 for a chunked body over the limit (no content-length)', async () => {
 const port = await start();
 const big = 'x'.repeat(MAX_HTTP_BODY / 2);
 expect(await post(port, [big, big, big])).toBe(413);
 // Server is still alive afterwards.
 expect(await post(port, ['not json'])).toBe(400);
 });

 it('answers 400 for invalid json within the limit', async () => {
 const port = await start();
 expect(await post(port, ['{nope'])).toBe(400);
 });

 it('answers 413 from content-length alone', async () => {
 const port = await start();
 expect(await post(port, ['{}'], { 'content-length': String(MAX_HTTP_BODY + 1) })).toBe(413);
 });
});
