import { parseCommand, type Command } from '../src/validate';
import { listCapabilities } from '../src/tools';
import type { Hub } from './hub';

// Turns a tool call (from MCP) into a validated, rate-limited broadcast to pages.

export interface DispatchResult {
 ok: boolean;
 result?: unknown;
 error?: string;
}

// Re-serialises a validated command into the args pages expect (only known fields go out).
export function cleanArgs(c: Command): Record<string, unknown> {
 switch (c.tool) {
 case 'claude_chan_act': return { ...c.act };
 case 'claude_chan_say': return { text: c.text };
 case 'claude_chan_set_mood': return { mood: c.mood };
 case 'claude_chan_set_state': return { state: c.state };
 case 'claude_chan_set_position': return { x: c.fx, y: c.fy };
 case 'claude_chan_reset_position':
 case 'claude_chan_list_motions': return {};
 }
}

export function createDispatcher(hub: Pick<Hub, 'broadcast'>, ratePerSecond = 10) {
 let stamps: number[] = [];
 let seq = 0;
 return (tool: string, args: unknown): DispatchResult => {
 const parsed = parseCommand(tool, args);
 if (!parsed.ok) return { ok: false, error: parsed.error };
 if (parsed.command.tool === 'claude_chan_list_motions') {
 return { ok: true, result: listCapabilities() };
 }
 const now = Date.now();
 stamps = stamps.filter((t) => now - t < 1000);
 if (stamps.length >= ratePerSecond) return { ok: false, error: 'rate limit exceeded' };
 stamps.push(now);
 const clean = cleanArgs(parsed.command);
 const delivered = hub.broadcast({ type: 'claude-chan', id: ++seq, tool, args: clean });
 return { ok: true, result: { delivered } };
 };
}
