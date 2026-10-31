import { afterEach, describe, expect, it } from 'vitest';
import { request, type Server } from 'node:http';
import { createHttpServer, listenHttp } from '../server/http';

const TOKEN = 'edge-token';
let server: Server | undefined;

afterEach(async () => {
 await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
 server = undefined;
});

function rawPost(port: number, headers: Record<string, string>): Promise<number> {
 return new Promise((resolve, reject) => {
 const req = request({ host: '127.0.0.1', port, path: '/mcp', method: 'POST', headers }, (res) => {
 res.resume();
 resolve(res.statusCode ?? 0);
 });
 req.on('error', reject);
 req.end('{}');
 });
}

describe('http endpoint edge cases', () => {
 it('refuses to start with an empty token', () => {
 expect(() => createHttpServer((async () => ({})) as never, { port: 0, token: '' })).toThrow();
 });

 it('rejects a non-local Host header (DNS rebinding)', async () => {
 server = createHttpServer((async () => ({})) as never, { port: 0, token: TOKEN });
 const port = await listenHttp(server, { port: 0, token: TOKEN });
 const status = await rawPost(port, { host: 'evil.example', authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' });
 expect(status).toBe(403);
 });
});
