import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { Hub } from '../server/hub';
import { createDispatcher } from '../server/dispatch';

const TOKEN = 'a-long-enough-test-token';
let hub: Hub | undefined;

afterEach(async () => {
 await hub?.close();
 hub = undefined;
});

function status(port: number, query: string, origin?: string): Promise<string> {
 return new Promise((resolve) => {
 const ws = new WebSocket('ws://127.0.0.1:' + port + '/' + query, { headers: origin ? { origin } : {} });
 ws.on('open', () => resolve('open'));
 ws.on('unexpected-response', (_req, res) => resolve(String(res.statusCode)));
 ws.on('error', () => undefined);
 ws.on('open', () => ws.close());
 });
}

describe('hub', () => {
 it('rejects short tokens', () => {
 expect(() => new Hub({ token: 'short' })).toThrow();
 });

 it('checks token and origin', async () => {
 hub = new Hub({ token: TOKEN });
 const port = await hub.listen();
 expect(await status(port, '?token=wrong')).toBe('401');
 expect(await status(port, '')).toBe('401');
 expect(await status(port, '?token=' + TOKEN, 'https://evil.example')).toBe('403');
 expect(await status(port, '?token=' + TOKEN, 'http://localhost:5173')).toBe('open');
 });

 it('delivers validated tool calls and rate limits', async () => {
 hub = new Hub({ token: TOKEN });
 const port = await hub.listen();
 const ws = new WebSocket('ws://127.0.0.1:' + port + '/?token=' + TOKEN);
 const got = new Promise<string>((res) => ws.on('message', (d) => res(String(d))));
 await new Promise((res) => ws.on('open', res));
 const send = createDispatcher(hub, 2);
 expect(send('claude_chan_act', { motion: 'wave' })).toEqual({ ok: true, result: { delivered: 1 } });
 expect(JSON.parse(await got).tool).toBe('claude_chan_act');
 expect(send('claude_chan_act', { motion: 'nope' }).ok).toBe(false);
 send('claude_chan_say', { text: 'hi' });
 expect(send('claude_chan_say', { text: 'hi' }).error).toBe('rate limit exceeded');
 ws.close();
 });
});
