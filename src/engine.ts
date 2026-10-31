import { MotionQueue, type QueueItem } from './queue';
import { MOTION_DEFS } from './motions';
import {
 EXPRESSIONS, MOTIONS, MOODS, PARAMS, neutralPose,
 type ActRequest, type EventMap, type EventName, type Expression, type Mood, type Motion, type Pose, type Puppet, type Unsubscribe,
} from './types';

// Headless motion engine: queue, idle behaviours, expression and lip-sync state.
// Renderers only receive a finished pose through Puppet.render().

export interface EngineOptions {
 autoIdle?: boolean;
 reducedMotion?: boolean;
 random?: () => number;
 // Called when a speech bubble should show (or hide with empty text).
 onSay?: (text: string, durationMs: number) => void;
}

const MOOD_EXPRESSION: Record<Mood, Expression> = {
 neutral: 'neutral', happy: 'smile', sad: 'sad', angry: 'angry', shy: 'blush', sleepy: 'neutral', thinking: 'neutral',
};
const MS_PER_CHAR = 70;
const DEFAULT_EXPRESSION_MS = 3000;

type Listener = (e: never) => void;

export class Engine {
 readonly queue = new MotionQueue();
 private listeners: Record<string, Set<Listener>> = {};
 private mood: Mood = 'neutral';
 private expression: Expression = 'neutral';
 private expressionUntil = 0;
 private motionStart = 0;
 private now = 0;
 private speakingUntil = 0;
 private audioLevel: (() => number) | null = null;
 private gaze: { x: number; y: number } | null = null;
 private nextBlink = 2000;
 private blinkStart = -1;
 private nextIdleMotion = 9000;
 private nextGlance = 4000;
 private glance = { x: 0, y: 0 };
 private rnd: () => number;
 private ticked = false;

 constructor(private puppet: Puppet, private opts: EngineOptions = {}) {
 this.rnd = opts.random ?? Math.random;
 }

 on<K extends EventName>(name: K, fn: (e: EventMap[K]) => void): Unsubscribe {
 (this.listeners[name] ??= new Set()).add(fn as Listener);
 return () => this.listeners[name]?.delete(fn as Listener);
 }

 emit<K extends EventName>(name: K, payload: EventMap[K]): void {
 for (const fn of this.listeners[name] ?? []) {
 try { (fn as (e: EventMap[K]) => void)(payload); } catch { /* listener errors never break the engine */ }
 }
 }

 act(req: ActRequest): void {
 const priority = req.priority ?? 'normal';
 if (req.expression && EXPRESSIONS.includes(req.expression)) {
 this.expression = req.expression;
 this.expressionUntil = this.now + (req.duration ?? DEFAULT_EXPRESSION_MS);
 }
 if (req.motion && MOTIONS.includes(req.motion)) this.play(req.motion, priority, req.duration);
 if (req.say) this.say(req.say, req.duration);
 }

 private play(motion: Motion, priority: QueueItem['priority'], duration?: number): void {
 const durationMs = duration && duration > 0 ? Math.min(duration, 30000) : MOTION_DEFS[motion].durationMs;
 const r = this.queue.push({ motion, priority, durationMs });
 if (r.interrupted) this.emit('motionend', { motion: r.interrupted.motion, interrupted: true });
 if (r.start) this.begin(r.start);
 }

 private begin(item: QueueItem): void {
 this.motionStart = this.now;
 this.puppet.setMotion?.(item.motion, item.durationMs);
 this.emit('motionstart', { motion: item.motion });
 }

 say(text: string, duration?: number): void {
 const clean = String(text).slice(0, 500);
 const ms = duration && duration > 0 ? duration : Math.max(2000, clean.length * MS_PER_CHAR + 1200);
 this.speakingUntil = this.now + clean.length * MS_PER_CHAR;
 this.opts.onSay?.(clean, ms);
 }

 setMood(mood: Mood): void {
 if (!MOODS.includes(mood)) return;
 this.mood = mood;
 if (mood === 'sleepy') this.play('sleepy', 'low');
 else if (mood === 'thinking') this.play('think', 'low');
 }

 lookAt(x: number | null, y = 0): void {
 if (x !== null && (!Number.isFinite(x) || !Number.isFinite(y))) return;
 this.gaze = x === null ? null : { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
 }

 setAudioLevel(fn: (() => number) | null): void { this.audioLevel = fn; }

 stop(): void {
 const was = this.queue.clear();
 if (was) this.puppet.setMotion?.(null, 0);
 if (was) this.emit('motionend', { motion: was.motion, interrupted: true });
 this.speakingUntil = 0;
 this.opts.onSay?.('', 0);
 }

 get currentMotion(): Motion | null { return this.queue.current?.motion ?? null; }

 // Advance to absolute time nowMs (ms) and push a frame to the puppet.
 tick(nowMs: number): Pose {
 if (!this.ticked) {
 // act()/say() before the first frame were timed from now=0; re-anchor them to this clock.
 this.ticked = true;
 if (this.expressionUntil > 0) this.expressionUntil += nowMs;
 if (this.speakingUntil > 0) this.speakingUntil += nowMs;
 this.motionStart = nowMs;
 }
 this.now = nowMs;
 const cur = this.queue.current;
 let motionPose: Partial<Pose> = {};
 if (cur) {
 const t = (nowMs - this.motionStart) / cur.durationMs;
 if (t >= 1) {
 this.emit('motionend', { motion: cur.motion });
 const next = this.queue.finish();
 if (next) this.begin(next);
 else this.puppet.setMotion?.(null, 0);
 } else {
 motionPose = MOTION_DEFS[cur.motion].pose(t);
 }
 }
 if (this.opts.autoIdle !== false) this.idleBehaviour(nowMs);
 const pose = this.compose(nowMs, motionPose);
 if (nowMs > this.expressionUntil) this.expression = MOOD_EXPRESSION[this.mood];
 this.puppet.render(pose, this.expression, nowMs);
 return pose;
 }

 private idleBehaviour(now: number): void {
 if (now >= this.nextBlink) { this.blinkStart = now; this.nextBlink = now + 2000 + this.rnd() * 3500; }
 if (now >= this.nextGlance) {
 this.glance = { x: (this.rnd() - 0.5) * 1.2, y: (this.rnd() - 0.5) * 0.6 };
 this.nextGlance = now + 2500 + this.rnd() * 4000;
 }
 if (now >= this.nextIdleMotion) {
 this.nextIdleMotion = now + 12000 + this.rnd() * 18000;
 if (!this.queue.current && !this.opts.reducedMotion) {
 const pool: Motion[] = ['idle', 'nod', 'wink', 'think'];
 this.play(pool[Math.floor(this.rnd() * pool.length)]!, 'low');
 }
 }
 }

 private compose(now: number, motionPose: Partial<Pose>): Pose {
 const p = neutralPose();
 const k = this.opts.reducedMotion ? 0.3 : 1;
 p.ParamBreath = 0.5 + 0.5 * Math.sin(now / 900);
 p.ParamHairSway = 0.25 * Math.sin(now / 1300);
 const g = this.gaze ?? this.glance;
 p.ParamEyeBallX = g.x;
 p.ParamEyeBallY = g.y;
 p.ParamAngleX = g.x * 8 * k;
 p.ParamAngleY = g.y * 5 * k;
 for (const id of PARAMS) {
 const v = motionPose[id];
 if (v === undefined) continue;
 p[id] += id.startsWith('ParamEye') && id.endsWith('Open') ? v : v * k;
 }
 const blink = this.blinkStart >= 0 ? (now - this.blinkStart) / 160 : 2;
 if (blink < 1) {
 const open = Math.abs(blink * 2 - 1);
 p.ParamEyeLOpen = Math.min(p.ParamEyeLOpen, open);
 p.ParamEyeROpen = Math.min(p.ParamEyeROpen, open);
 }
 for (const id of ['ParamEyeLOpen', 'ParamEyeROpen'] as const) p[id] = Math.max(0, Math.min(1, p[id]));
 const raw = this.audioLevel ? this.audioLevel() : now < this.speakingUntil ? 0.35 + 0.35 * Math.abs(Math.sin(now / 90)) : 0;
 const level = Number.isFinite(raw) ? raw : 0;
 p.ParamMouthOpenY = Math.max(p.ParamMouthOpenY, Math.min(1, level));
 return p;
 }
}
