import { createServer, type Server } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';

// Local WebSocket hub: MCP tool calls in, browser pages out.
// Loopback by default, token required, origin checked, bounded sizes.

export interface HubOptions {
 port?: number; // 0 = pick a free port
 host?: string; // default 127.0.0.1
 token: string;
 // Exact origins allowed. Default: http(s) localhost / 127.0.0.1 on any port.
 allowedOrigins?: string[];
 maxClients?: number;
}

export const MAX_MESSAGE_BYTES = 4096;
const LOOPBACK = { test: (origin: string): boolean => { try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname); } catch { return false; } } };
const CRLF = String.fromCharCode(13, 10);

function tokenOk(given: string | null, expected: string): boolean {
 if (!given) return false;
 const a = Buffer.from(given);
 const b = Buffer.from(expected);
 return a.length === b.length && timingSafeEqual(a, b);
}

export class Hub {
 private http: Server;
 private wss: WebSocketServer;
 private clients = new Set<WebSocket>();

 constructor(private o: HubOptions) {
 if (!o.token || o.token.length < 16) throw new Error('token must be at least 16 characters');
 this.http = createServer((_req, res) => {
 res.writeHead(404).end();
 });
 this.wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
 this.http.on('upgrade', (req, socket, head) => {
 let url: URL | null = null;
 try {
 url = new URL(req.url ?? '/', 'http://localhost');
 } catch {
 url = null;
 }
 const origin = req.headers.origin;
 const originOk =
 origin === undefined || (o.allowedOrigins ? o.allowedOrigins.includes(origin) : LOOPBACK.test(origin));
 const reject = (code: number): void => {
 socket.write('HTTP/1.1 ' + code + ' Rejected' + CRLF + 'Connection: close' + CRLF + CRLF);
 socket.destroy();
 };
 if (url === null) return reject(400);
 if (!originOk) return reject(403);
 if (!tokenOk(url.searchParams.get('token'), o.token)) return reject(401);
 if (this.clients.size >= (o.maxClients ?? 16)) return reject(503);
 this.wss.handleUpgrade(req, socket, head, (ws) => this.attach(ws));
 });
 }

 private attach(ws: WebSocket): void {
 this.clients.add(ws);
 ws.on('close', () => this.clients.delete(ws));
 ws.on('error', () => this.clients.delete(ws));
 ws.on('message', () => undefined); // pages do not send commands
 }

 get clientCount(): number {
 return this.clients.size;
 }

 listen(): Promise<number> {
 return new Promise((resolve, reject) => {
 this.http.once('error', reject);
 this.http.listen(this.o.port ?? 0, this.o.host ?? '127.0.0.1', () => {
 const addr = this.http.address();
 resolve(typeof addr === 'object' && addr ? addr.port : 0);
 });
 });
 }

 // Send an already validated message to every open page; returns the delivery count.
 broadcast(message: unknown): number {
 const data = JSON.stringify(message);
 let delivered = 0;
 for (const ws of this.clients) {
 if (ws.readyState === ws.OPEN) {
 ws.send(data);
 delivered++;
 }
 }
 return delivered;
 }

 close(): Promise<void> {
 for (const ws of this.clients) ws.terminate();
 this.wss.close();
 return new Promise((resolve) => this.http.close(() => resolve()));
 }
}
