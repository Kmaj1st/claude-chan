import type { ClaudeChanController } from './types';
import { parseCommand } from './validate';
import { runCommand } from './bridge';

// Browser side of the local hub (docs/MCP.md): connects to ws://<host>:<port>/?token=..., validates every
// { type: 'claude-chan', tool, args } message and runs it on the controller. Reconnects with backoff.

export interface HubClientOptions {
 token: string;
 port?: number; // default 8765
 host?: string; // default 127.0.0.1
 reconnect?: boolean; // default true
 onStatus?: (status: 'connecting' | 'open' | 'closed') => void;
 // For tests or non-browser hosts; default globalThis.WebSocket.
 WebSocketImpl?: typeof WebSocket;
}

export const HUB_MAX_MESSAGE = 4096;

export function connectHub(ctrl: ClaudeChanController, opts: HubClientOptions): () => void {
 const Impl = opts.WebSocketImpl ?? (typeof WebSocket !== 'undefined' ? WebSocket : undefined);
 if (!Impl) throw new Error('claude-chan: WebSocket is not available');
 if (!opts.token) throw new Error('claude-chan: hub token is required');
 const url = 'ws://' + (opts.host ?? '127.0.0.1') + ':' + (opts.port ?? 8765) + '/?token=' + encodeURIComponent(opts.token);
 let ws: WebSocket | null = null;
 let timer: ReturnType<typeof setTimeout> | null = null;
 let delay = 1000;
 let stopped = false;

 const open = (): void => {
 if (stopped) return;
 opts.onStatus?.('connecting');
 const s = new Impl(url);
 ws = s;
 s.onopen = (): void => {
 delay = 1000;
 opts.onStatus?.('open');
 };
 s.onmessage = (ev: MessageEvent): void => {
 if (typeof ev.data !== 'string' || ev.data.length > HUB_MAX_MESSAGE) return;
 let d: { type?: unknown; tool?: unknown; args?: unknown } | null = null;
 try {
 d = JSON.parse(ev.data);
 } catch {
 return;
 }
 if (!d || d.type !== 'claude-chan') return;
 const parsed = parseCommand(d.tool, d.args);
 if (!parsed.ok) return;
 try {
 runCommand(ctrl, parsed.command);
 } catch {
 // A failing command must not kill the connection.
 }
 };
 s.onclose = (): void => {
 opts.onStatus?.('closed');
 if (stopped || opts.reconnect === false) return;
 timer = setTimeout(open, delay);
 delay = Math.min(delay * 2, 15000);
 };
 s.onerror = (): void => {
 // onclose follows and handles the retry.
 };
 };

 open();
 return () => {
 stopped = true;
 if (timer) clearTimeout(timer);
 ws?.close();
 };
}
