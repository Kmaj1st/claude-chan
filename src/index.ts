import { defineClaudeChan } from './element';
import { mount } from './mount';

export * from './types';
export { mount, defineClaudeChan };
export { ClaudeChanElement } from './element';

// Tool-call surface: bridge, text markers, validation and tool definitions.
export { runCommand, installPostMessageBridge } from './bridge';
export type { PostMessageBridgeOptions } from './bridge';
export { parseMarkers, createMarkerStream } from './markers';
export type { MarkerResult, MarkerStream } from './markers';
export { parseCommand } from './validate';
export type { Command, Parsed } from './validate';
export { TOOLS, actInputSchema, listCapabilities, MAX_SAY_LENGTH, MAX_DURATION_MS } from './tools';
export type { ToolName } from './tools';

// Agent state -> reaction mapping for hosts (hapi-chan reports what the agent does).
export { AGENT_STATES, STATE_MAP, isAgentState, applyState } from './states';
export type { AgentState, StateReaction } from './states';

// Vanilla namespace: ClaudeChan.mount(el, options).
export const ClaudeChan = { mount };

defineClaudeChan();
