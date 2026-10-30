import { parseCommand } from '../src/validate';
import { listCapabilities } from '../src/tools';
import type { Hub } from './hub';

// Turns a tool call (from MCP) into a validated, rate-limited broadcast to pages.

export interface DispatchResult {
 ok: boolean;
 result?: unknown;
 error?: string;
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
 const delivered = hub.broadcast({ type: 'claude-chan', id: ++seq, tool, args: args ?? {} });
 return { ok: true, result: { delivered } };
 };
}
