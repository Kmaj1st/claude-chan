import { EXPRESSIONS, MOODS, MOTIONS, PRIORITIES } from './types';
import type { ActRequest, Mood } from './types';
import { AGENT_STATES } from './states';
import type { AgentState } from './states';
import { MAX_DURATION_MS, MAX_SAY_LENGTH } from './tools';
import type { ToolName } from './tools';

// Strict validation of untrusted tool-call input (MCP, WebSocket, postMessage).

export type Command =
 | { tool: 'claude_chan_act'; act: ActRequest }
 | { tool: 'claude_chan_say'; text: string }
 | { tool: 'claude_chan_set_mood'; mood: Mood }
 | { tool: 'claude_chan_set_state'; state: AgentState }
 | { tool: 'claude_chan_list_motions' };

export type Parsed = { ok: true; command: Command } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> =>
 typeof v === 'object' && v !== null && !Array.isArray(v);

function oneOf<T extends string>(v: unknown, list: readonly T[], key: string): T {
 if (typeof v !== 'string' || !(list as readonly string[]).includes(v)) {
 throw new Error(key + ' must be one of: ' + list.join(', '));
 }
 return v as T;
}

function text(v: unknown, key: string): string {
 if (typeof v !== 'string' || v.length === 0) throw new Error(key + ' must be a non-empty string');
 if (v.length > MAX_SAY_LENGTH) throw new Error(key + ' exceeds ' + MAX_SAY_LENGTH + ' characters');
 return v;
}

function noExtra(o: Record<string, unknown>, allowed: string[]): void {
 for (const k of Object.keys(o)) if (!allowed.includes(k)) throw new Error('unknown field: ' + k);
}

export function parseCommand(tool: unknown, args: unknown): Parsed {
 try {
 const a = args === undefined ? {} : args;
 if (!isObj(a)) throw new Error('arguments must be an object');
 switch (tool as ToolName) {
 case 'claude_chan_act': {
 noExtra(a, ['motion', 'expression', 'say', 'duration', 'priority']);
 const act: ActRequest = {};
 if (a.motion !== undefined) act.motion = oneOf(a.motion, MOTIONS, 'motion');
 if (a.expression !== undefined) act.expression = oneOf(a.expression, EXPRESSIONS, 'expression');
 if (a.say !== undefined) act.say = text(a.say, 'say');
 if (a.priority !== undefined) act.priority = oneOf(a.priority, PRIORITIES, 'priority');
 if (a.duration !== undefined) {
 const d = a.duration;
 if (typeof d !== 'number' || !Number.isFinite(d) || d < 100 || d > MAX_DURATION_MS) {
 throw new Error('duration must be a number between 100 and ' + MAX_DURATION_MS);
 }
 act.duration = Math.round(d);
 }
 if (Object.keys(act).length === 0) throw new Error('act needs at least one field');
 return { ok: true, command: { tool: 'claude_chan_act', act } };
 }
 case 'claude_chan_say':
 noExtra(a, ['text']);
 return { ok: true, command: { tool: 'claude_chan_say', text: text(a.text, 'text') } };
 case 'claude_chan_set_mood':
 noExtra(a, ['mood']);
 return { ok: true, command: { tool: 'claude_chan_set_mood', mood: oneOf(a.mood, MOODS, 'mood') } };
 case 'claude_chan_set_state':
 noExtra(a, ['state']);
 return { ok: true, command: { tool: 'claude_chan_set_state', state: oneOf(a.state, AGENT_STATES, 'state') } };
 case 'claude_chan_list_motions':
 noExtra(a, []);
 return { ok: true, command: { tool: 'claude_chan_list_motions' } };
 default:
 throw new Error('unknown tool: ' + String(tool).slice(0, 40));
 }
 } catch (e) {
 return { ok: false, error: e instanceof Error ? e.message : 'invalid input' };
 }
}
