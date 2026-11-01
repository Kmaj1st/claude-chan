import { EXPRESSIONS, MOODS, MOTIONS, PRIORITIES } from './types';
import { AGENT_STATES } from './states';

// JSON-schema tool definitions shared by the MCP server, the postMessage bridge and host apps.
// Names and shapes are part of the stable contract.

export const MAX_SAY_LENGTH = 280;
export const MAX_DURATION_MS = 60000;

export const actInputSchema = {
 type: 'object',
 properties: {
 motion: { type: 'string', enum: [...MOTIONS], description: 'Preset motion to play.' },
 expression: { type: 'string', enum: [...EXPRESSIONS], description: 'Facial expression.' },
 say: { type: 'string', minLength: 1, maxLength: MAX_SAY_LENGTH, description: 'Short speech bubble text (plain text).' },
 duration: { type: 'integer', minimum: 100, maximum: MAX_DURATION_MS, description: 'Milliseconds the expression/bubble stays.' },
 priority: { type: 'string', enum: [...PRIORITIES], description: 'Queue priority; higher interrupts lower. Default normal.' },
 },
 additionalProperties: false,
} as const;

export const TOOLS = [
 {
 name: 'claude_chan_act',
 description: 'Make the Claude-chan mascot play a motion, show an expression and/or say a short line. Use sparingly.',
 inputSchema: actInputSchema,
 },
 {
 name: 'claude_chan_say',
 description: 'Show a short speech bubble next to the mascot.',
 inputSchema: {
 type: 'object',
 properties: { text: { type: 'string', minLength: 1, maxLength: MAX_SAY_LENGTH } },
 required: ['text'],
 additionalProperties: false,
 },
 },
 {
 name: 'claude_chan_set_mood',
 description: 'Set the long-lived mood that colours idle behaviour.',
 inputSchema: {
 type: 'object',
 properties: { mood: { type: 'string', enum: [...MOODS] } },
 required: ['mood'],
 additionalProperties: false,
 },
 },
 {
 name: 'claude_chan_set_state',
 description: 'Report what the agent is doing (idle, thinking, working, success, error ...); the mascot reacts with a fitting motion, expression and mood.',
 inputSchema: {
 type: 'object',
 properties: { state: { type: 'string', enum: [...AGENT_STATES] } },
 required: ['state'],
 additionalProperties: false,
 },
 },
 {
 name: 'claude_chan_list_motions',
 description: 'List available motions, expressions, moods and priorities.',
 inputSchema: { type: 'object', properties: {}, additionalProperties: false },
 },
] as const;

export type ToolName = (typeof TOOLS)[number]['name'];

export function listCapabilities(): { motions: readonly string[]; expressions: readonly string[]; moods: readonly string[]; priorities: readonly string[] } {
 return { motions: MOTIONS, expressions: EXPRESSIONS, moods: MOODS, priorities: PRIORITIES };
}
