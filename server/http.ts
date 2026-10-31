import { createServer, type IncomingMessage, type Server as HttpServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './mcp';

// Local streamable-HTTP MCP endpoint (POST /mcp). Stateless: one MCP server per request.
// Loopback bind, bearer token, Host/Origin checks, bounded body.

export const MAX_HTTP_BODY = 64 * 1024;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

type Dispatch = Parameters<typeof createMcpServer>[0];

export interface HttpOptions {
 port: number;
 token: string;
 host?: string;
}

function hostnameOf(value: string): string {
 try {
 return new URL(value).hostname;
 } catch {
 return '';
 }
}

// Pathname of a request target; '' when it cannot be parsed (for example '//').
function pathnameOf(target: string | undefined): string {
 try {
 return new URL(target ?? '', 'http://localhost').pathname;
 } catch {
 return '';
 }
}

function tokenOk(header: string | undefined, expected: string): boolean {
 const value = header ?? '';
 if (!value.startsWith('Bearer ')) return false;
 const given = Buffer.from(value.slice(7));
 const want = Buffer.from(expected);
 return given.length === want.length && timingSafeEqual(given, want);
}

function readBody(req: IncomingMessage): Promise<unknown> {
 return new Promise((resolve, reject) => {
 let size = 0;
 const chunks: Buffer[] = [];
 req.on('data', (c: Buffer) => {
 size += c.length;
 if (size > MAX_HTTP_BODY) {
 reject(new Error('body too large'));
 req.destroy();
 return;
 }
 chunks.push(c);
 });
 req.on('end', () => {
 try {
 resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
 } catch {
 reject(new Error('invalid json'));
 }
 });
 req.on('error', reject);
 });
}

export function createHttpServer(dispatch: Dispatch, opts: HttpOptions): HttpServer {
 if (!opts.token) throw new Error('http token must be a non-empty string');
 return createServer((req, res) => {
 const fail = (code: number, msg: string): void => {
 res.writeHead(code, { 'content-type': 'text/plain' }).end(msg);
 };
 const host = hostnameOf('http://' + (req.headers.host ?? ''));
 if (!LOCAL_HOSTS.has(host)) return fail(403, 'bad host');
 const origin = req.headers.origin;
 if (origin && !LOCAL_HOSTS.has(hostnameOf(origin))) return fail(403, 'bad origin');
 if (!tokenOk(req.headers.authorization, opts.token)) return fail(401, 'unauthorized');
 if (pathnameOf(req.url) !== '/mcp') return fail(404, 'not found');
 if (req.method !== 'POST') return fail(405, 'POST only');
 if (Number(req.headers['content-length'] ?? 0) > MAX_HTTP_BODY) return fail(413, 'body too large');
 readBody(req).then(async (body) => {
 const server = createMcpServer(dispatch);
 const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
 res.on('close', () => {
 void transport.close();
 void server.close();
 });
 await server.connect(transport);
 await transport.handleRequest(req, res, body);
 }).catch((e: Error) => {
 if (!res.headersSent) fail(400, e.message);
 });
 });
}

export function listenHttp(server: HttpServer, opts: HttpOptions): Promise<number> {
 return new Promise((resolve, reject) => {
 server.once('error', reject);
 server.listen(opts.port, opts.host ?? '127.0.0.1', () => {
 const addr = server.address();
 resolve(typeof addr === 'object' && addr ? addr.port : opts.port);
 });
 });
}
