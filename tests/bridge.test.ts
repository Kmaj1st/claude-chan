import { describe, it, expect } from 'vitest';
import { installPostMessageBridge } from '../src/bridge';
import type { ClaudeChanController } from '../src/types';

function setup(ctrl: Partial<ClaudeChanController>, allowedOrigins?: string[]) {
 let handler: ((ev: unknown) => void) | null = null;
 const target = {
 location: { origin: 'http://a.test' },
 addEventListener: (_t: string, h: (ev: unknown) => void) => { handler = h; },
 removeEventListener: () => { handler = null; },
 };
 const replies: unknown[] = [];
 const source = { postMessage: (m: unknown) => { replies.push(m); } };
 const off = installPostMessageBridge(ctrl as ClaudeChanController, { target: target as never, allowedOrigins });
 const send = (origin: string, data: unknown) => handler?.({ origin, data, source });
 return { send, replies, off, isInstalled: () => handler !== null };
}

describe('postMessage bridge', () => {
 it('runs a valid command and replies ok', () => {
 const said: string[] = [];
 const b = setup({ say: (t: string) => { said.push(t); } });
 b.send('http://a.test', { type: 'claude-chan', id: 1, tool: 'claude_chan_say', args: { text: 'hi' } });
 expect(said).toEqual(['hi']);
 expect(b.replies[0]).toMatchObject({ type: 'claude-chan-result', id: 1, ok: true });
 });

 it('ignores foreign origins and wildcard', () => {
 const b = setup({ say: () => {} }, [String.fromCharCode(42)]);
 b.send(String.fromCharCode(42), { type: 'claude-chan', id: 1, tool: 'claude_chan_say', args: { text: 'x' } });
 b.send('http://evil.test', { type: 'claude-chan', id: 2, tool: 'claude_chan_say', args: { text: 'x' } });
 expect(b.replies).toEqual([]);
 });

 it('replies with an error for invalid input', () => {
 const b = setup({});
 b.send('http://a.test', { type: 'claude-chan', id: 'q', tool: 'nope', args: {} });
 expect(b.replies[0]).toMatchObject({ id: 'q', ok: false });
 });

 it('replies with an error when the controller throws', () => {
 const b = setup({ say: () => { throw new Error('boom'); } });
 b.send('http://a.test', { type: 'claude-chan', id: 3, tool: 'claude_chan_say', args: { text: 'x' } });
 expect(b.replies[0]).toMatchObject({ id: 3, ok: false, error: 'boom' });
 });

 it('does not throw or double-reply when the source cannot be posted to', () => {
 let handler: ((ev: unknown) => void) | null = null;
 const target = {
 location: { origin: 'http://a.test' },
 addEventListener: (_t: string, h: (ev: unknown) => void) => { handler = h; },
 removeEventListener: () => { handler = null; },
 };
 let posts = 0;
 const source = { postMessage: () => { posts++; throw new Error('gone'); } };
 const said: string[] = [];
 installPostMessageBridge({ say: (t: string) => { said.push(t); } } as unknown as ClaudeChanController, { target: target as never });
 const msg = { origin: 'http://a.test', data: { type: 'claude-chan', id: 1, tool: 'claude_chan_say', args: { text: 'hi' } }, source };
 expect(() => handler?.(msg)).not.toThrow();
 expect(said).toEqual(['hi']);
 expect(posts).toBe(1);
 });

 it('uninstalls', () => {
 const b = setup({});
 b.off();
 expect(b.isInstalled()).toBe(false);
 });
});
