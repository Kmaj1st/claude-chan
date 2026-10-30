import type { ClaudeChanController } from './types';
import { listCapabilities } from './tools';
import { parseCommand } from './validate';
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
 case 'claude_chan_list_motions':
 return listCapabilities();
 }
}

export interface PostMessageBridgeOptions {
 // Accepted origins; '*' is not allowed. Defaults to the page's own origin.
 allowedOrigins?: string[];
 // Window to listen on (default: globalThis window).
 target?: Window;
}

// Request: { type: 'claude-chan', id?, tool, args }
// Response: { type: 'claude-chan-result', id, ok, result? | error? }
export function installPostMessageBridge(
 ctrl: ClaudeChanController,
 opts: PostMessageBridgeOptions = {},
): () => void {
 const target = opts.target ?? window;
 const allowed = new Set(opts.allowedOrigins ?? [target.location.origin]);
 const handler = (ev: MessageEvent): void => {
 if (!allowed.has(ev.origin)) return;
 const d = ev.data as { type?: unknown; id?: unknown; tool?: unknown; args?: unknown } | null;
 if (!d || d.type !== 'claude-chan') return;
 const id = typeof d.id === 'string' || typeof d.id === 'number' ? d.id : null;
 const reply = (body: Record<string, unknown>): void => {
 (ev.source as Window | null)?.postMessage({ type: 'claude-chan-result', id, ...body }, ev.origin);
 };
 const parsed = parseCommand(d.tool, d.args);
 if (!parsed.ok) return reply({ ok: false, error: parsed.error });
 reply({ ok: true, result: runCommand(ctrl, parsed.command) });
 };
 target.addEventListener('message', handler);
 return () => target.removeEventListener('message', handler);
}
