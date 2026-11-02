import type { ClaudeChanController } from './types';
import { listCapabilities } from './tools';
import { parseCommand } from './validate';
import { applyState } from './states';
import type { Command } from './validate';

// Applies a validated command to a controller. Shared by every transport.
export function runCommand(ctrl: ClaudeChanController, cmd: Command): unknown {
 switch (cmd.tool) {
 case 'claude_chan_act':
 ctrl.act(cmd.act);
 return { ok: true };
 case 'claude_chan_say':
 ctrl.say(cmd.text);
 return { ok: true };
 case 'claude_chan_set_mood':
 ctrl.setMood(cmd.mood);
 return { ok: true };
 case 'claude_chan_set_state':
 applyState(ctrl, cmd.state);
 return { ok: true };
 case 'claude_chan_list_motions':
 return listCapabilities();
 }
}

export interface PostMessageBridgeOptions {
 // Accepted origins; '*' is not allowed. Defaults to the page's own origin.
 allowedOrigins?: string[];
 // Window to listen on (default: globalThis window).
 target?: Window;
 // Post { type: 'claude-chan-ready' } to the parent window (once per allowed origin) when installed,
 // so an embedding host knows it can send commands. Off by default; no-op when not in a frame.
 announce?: boolean;
}

// Request: { type: 'claude-chan', id?, tool, args }
// Response: { type: 'claude-chan-result', id, ok, result? | error? }
export function installPostMessageBridge(
 ctrl: ClaudeChanController,
 opts: PostMessageBridgeOptions = {},
): () => void {
 const target = opts.target ?? window;
 const allowed = new Set((opts.allowedOrigins ?? [target.location.origin]).filter((o) => o !== '*'));
 const handler = (ev: MessageEvent): void => {
 if (!allowed.has(ev.origin)) return;
 const d = ev.data as { type?: unknown; id?: unknown; tool?: unknown; args?: unknown } | null;
 if (!d || d.type !== 'claude-chan') return;
 const id = typeof d.id === 'string' || typeof d.id === 'number' ? d.id : null;
 const reply = (body: Record<string, unknown>): void => {
 try {
 (ev.source as Window | null)?.postMessage({ type: 'claude-chan-result', id, ...body }, ev.origin);
 } catch {
 // Source window gone or origin not addressable (e.g. 'null'): drop the reply.
 }
 };
 const parsed = parseCommand(d.tool, d.args);
 if (!parsed.ok) return reply({ ok: false, error: parsed.error });
 try {
 reply({ ok: true, result: runCommand(ctrl, parsed.command) });
 } catch (e) {
 reply({ ok: false, error: e instanceof Error ? e.message : String(e) });
 }
 };
 target.addEventListener('message', handler);
 if (opts.announce) {
 const parent = (target as Window).parent;
 if (parent && parent !== target) {
 for (const origin of allowed) {
 try {
 parent.postMessage({ type: 'claude-chan-ready' }, origin);
 } catch {
 // Parent not addressable for this origin: skip.
 }
 }
 }
 }
 return () => target.removeEventListener('message', handler);
}
