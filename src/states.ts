import type { Expression, Mood, Motion } from './types';

// Agent state -> character reaction. hapi-chan (or any host) reports what the agent is doing;
// the mascot picks the motion, expression and mood. Names are part of the stable contract.

export const AGENT_STATES = [
 'idle', 'listening', 'thinking', 'working', 'waiting', 'speaking', 'success', 'error', 'sleeping',
] as const;
export type AgentState = (typeof AGENT_STATES)[number];

export interface StateReaction {
 // One-shot motion played when the state is entered (undefined = keep current).
 motion?: Motion;
 expression?: Expression;
 mood: Mood;
 // Priority of the entering motion.
 priority: 'low' | 'normal' | 'high' | 'urgent';
}

export const STATE_MAP: Record<AgentState, StateReaction> = {
 idle: { motion: 'idle', expression: 'neutral', mood: 'neutral', priority: 'low' },
 listening: { motion: 'nod', expression: 'smile', mood: 'happy', priority: 'normal' },
 thinking: { motion: 'think', expression: 'neutral', mood: 'thinking', priority: 'normal' },
 working: { motion: 'typing', expression: 'neutral', mood: 'thinking', priority: 'normal' },
 waiting: { motion: 'point', expression: 'surprised', mood: 'shy', priority: 'high' },
 speaking: { expression: 'smile', mood: 'happy', priority: 'normal' },
 success: { motion: 'cheer', expression: 'smile', mood: 'happy', priority: 'high' },
 error: { motion: 'pout', expression: 'sad', mood: 'sad', priority: 'high' },
 sleeping: { motion: 'sleepy', expression: 'neutral', mood: 'sleepy', priority: 'low' },
};

export function isAgentState(v: unknown): v is AgentState {
 return typeof v === 'string' && (AGENT_STATES as readonly string[]).includes(v);
}

// Applies a state to any controller-like object (act + setMood).
export function applyState(ctrl: { act(r: { motion?: Motion; expression?: Expression; priority?: StateReaction['priority'] }): void; setMood(m: Mood): void }, state: AgentState): void {
 const r = STATE_MAP[state];
 ctrl.setMood(r.mood);
 if (r.motion || r.expression) ctrl.act({ motion: r.motion, expression: r.expression, priority: r.priority });
}
