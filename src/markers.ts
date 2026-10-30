import { EXPRESSIONS, MOODS, MOTIONS, PRIORITIES } from './types';
import type { ActRequest, Mood } from './types';

// Text-marker fallback: parses tags like [motion:wave] out of (streamed) assistant text.
// Supported keys: motion, expression, mood, priority. Unknown or invalid tags are left in the text.

export interface MarkerResult {
 // Text with valid markers removed.
 text: string;
 acts: ActRequest[];
 moods: Mood[];
}

const MAX_TAG = 40;
const TAG = /\[(motion|expression|mood|priority):([a-z_]{1,20})\]/g;

const VALID: Record<string, readonly string[]> = {
 motion: MOTIONS,
 expression: EXPRESSIONS,
 mood: MOODS,
 priority: PRIORITIES,
};

// One-shot parse of a complete string.
export function parseMarkers(input: string): MarkerResult {
 const acts: ActRequest[] = [];
 const moods: Mood[] = [];
 let pending: ActRequest = {};
 const text = input.replace(TAG, (whole, key: string, value: string) => {
 if (!VALID[key]?.includes(value)) return whole;
 if (key === 'mood') {
 moods.push(value as Mood);
 } else if (key === 'priority') {
 pending.priority = value as ActRequest['priority'];
 } else {
 if (key === 'motion') pending.motion = value as ActRequest['motion'];
 else pending.expression = value as ActRequest['expression'];
 acts.push(pending);
 pending = {};
 }
 return '';
 });
 // A trailing priority tag applies to the last act.
 const last = acts[acts.length - 1];
 if (pending.priority && last) last.priority = pending.priority;
 return { text, acts, moods };
}

export interface MarkerStream {
 // Feed a chunk; returns the text that is safe to display now.
 push(chunk: string): string;
 // End of stream; returns any held-back text.
 flush(): string;
}

// Streaming parser: holds back a possible partial tag at the end of a chunk.
export function createMarkerStream(
 onAct: (req: ActRequest) => void,
 onMood?: (mood: Mood) => void,
): MarkerStream {
 let held = '';
 const emit = (r: MarkerResult): string => {
 r.acts.forEach((a) => onAct(a));
 r.moods.forEach((m) => onMood?.(m));
 return r.text;
 };
 return {
 push(chunk) {
 const buf = held + chunk;
 const open = buf.lastIndexOf('[');
 let cut = buf.length;
 if (open >= 0 && buf.length - open < MAX_TAG && buf.indexOf(']', open) < 0) cut = open;
 held = buf.slice(cut);
 return emit(parseMarkers(buf.slice(0, cut)));
 },
 flush() {
 const rest = held;
 held = '';
 return emit(parseMarkers(rest));
 },
 };
}
