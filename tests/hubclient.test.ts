import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectHub } from '../src/hubclient';
import type { ClaudeChanController } from '../src/types';

class FakeWS {
 static all: FakeWS[] = [];
 onopen: (() => void) | null = null;
 onmessage: ((ev: { data: unknown }) => void) | null = null;
 onclose: (() => void) | null = null;
 onerror: (() => void) | null = null;
 closed = false;
 constructor(public url: string) {
 FakeWS.all.push(this);
 }
 close(): void {
 this.closed = true;
 }
}

function sock(i: number): FakeWS {
 const s = FakeWS.all[i];
 if (!s) throw new Error('no socket ' + i);
 return s;
}

function ctrl(): ClaudeChanController {
 return { say: vi.fn(), act: vi.fn(), setMood: vi.fn() } as unknown as ClaudeChanController;
}

const Impl = FakeWS as unknown as typeof WebSocket;

describe('connectHub', () => {
 beforeEach(() => {
 FakeWS.all = [];
 vi.useFakeTimers();
 });
 afterEach(() => vi.useRealTimers());

 it('connects with the token in the query string', () => {
 connectHub(ctrl(), { token: 'a b&c', port: 9000, WebSocketImpl: Impl });
 expect(sock(0).url).toBe('ws://127.0.0.1:9000/?token=a%20b%26c');
 });

 it('requires a token', () => {
 expect(() => connectHub(ctrl(), { token: '', WebSocketImpl: Impl })).toThrow();
 });

 it('runs a valid message and ignores invalid ones', () => {
 const c = ctrl();
 connectHub(c, { token: 't', WebSocketImpl: Impl });
 const ws = sock(0);
 const send = (data: unknown): void => ws.onmessage?.({ data });
 send(JSON.stringify({ type: 'claude-chan', id: 1, tool: 'claude_chan_say', args: { text: 'hi' } }));
 expect(c.say).toHaveBeenCalledWith('hi');
 send('not json');
 send(JSON.stringify({ type: 'other', tool: 'claude_chan_say', args: { text: 'x' } }));
 send(JSON.stringify({ type: 'claude-chan', tool: 'evil', args: {} }));
 send('x'.repeat(5000));
 send(42);
 expect(c.say).toHaveBeenCalledTimes(1);
 });

 it('survives a throwing controller', () => {
 const c = ctrl();
 (c.say as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
 throw new Error('boom');
 });
 connectHub(c, { token: 't', WebSocketImpl: Impl });
 const data = JSON.stringify({ type: 'claude-chan', tool: 'claude_chan_say', args: { text: 'hi' } });
 expect(() => sock(0).onmessage?.({ data })).not.toThrow();
 });

 it('reconnects with backoff and stops on dispose', () => {
 const stop = connectHub(ctrl(), { token: 't', WebSocketImpl: Impl });
 sock(0).onclose?.();
 vi.advanceTimersByTime(1000);
 expect(FakeWS.all.length).toBe(2);
 sock(1).onclose?.();
 vi.advanceTimersByTime(1999);
 expect(FakeWS.all.length).toBe(2);
 vi.advanceTimersByTime(1);
 expect(FakeWS.all.length).toBe(3);
 stop();
 expect(sock(2).closed).toBe(true);
 sock(2).onclose?.();
 vi.advanceTimersByTime(60000);
 expect(FakeWS.all.length).toBe(3);
 });

 it('does not reconnect when disabled', () => {
 connectHub(ctrl(), { token: 't', reconnect: false, WebSocketImpl: Impl });
 sock(0).onclose?.();
 vi.advanceTimersByTime(60000);
 expect(FakeWS.all.length).toBe(1);
 });
});
