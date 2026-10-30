import type { Expression, Motion } from '../types';
import { EXPRESSION_TOKEN, type MotionMap, type PoseSet, type TransitionKind } from './manifest';

// Chooses which pose images to show and how they cross-fade. No DOM and no timers:
// the caller passes the clock, so everything is testable with a fake clock.

export const DEFAULT_FADE_MS = 180;
// Blink and talk frames swap faster than a pose change so they read as part of the same pose.
export const QUICK_FADE_MS = 50;
const BLINK_BELOW = 0.4;
const TALK_ON = 0.55;
const TALK_OFF = 0.3;
const SLIDE_SHIFT = 5; // percent of the reference width a sliding pose travels

export interface DirectorOptions {
 reducedMotion?: boolean;
}

export interface Layer {
 pose: string;
 // 0..1, bottom layers are listed first.
 opacity: number;
 // Horizontal offset in percent of the reference width (slide transitions).
 dx: number;
}

export interface Frame {
 layers: Layer[];
 // Poses the director wants but whose images are not ready yet (the renderer loads them).
 need: string[];
 // The pose the director is showing or moving to.
 target: string | null;
}

interface Active {
 pose: string;
 alpha: number;
 fadeMs: number;
 kind: TransitionKind;
}

export class SpriteDirector {
 private layers: Active[] = [];
 private motion: Motion | null = null;
 private motionMs = 0;
 private motionStart: number | null = null;
 private talking = false;
 private lastNow: number | null = null;
 private target: string | null = null;

 constructor(private set: PoseSet, private map: MotionMap, private opts: DirectorOptions = {}) {}

 // Called by the engine when a motion starts (or null when it ends). Timing starts at the next update().
 setMotion(motion: Motion | null, durationMs: number): void {
 this.motion = motion;
 this.motionMs = durationMs;
 this.motionStart = null;
 }

 // Pose ids a motion can show; the renderer prefetches them when the motion starts.
 posesFor(motion: Motion): string[] {
 const steps = this.map.motions[motion].steps ?? [];
 const out = new Set<string>();
 for (const s of steps) if (s.pose !== EXPRESSION_TOKEN) out.add(s.pose);
 return [...out];
 }

 expressionPose(expression: Expression): string {
 return this.map.expressions[expression];
 }

 // Pose id wanted right now, plus how to change to it.
 wanted(now: number, expression: Expression, eyeOpen: number, mouth: number): { pose: string; kind: TransitionKind; ms: number } {
 let base = this.map.expressions[expression];
 let kind: TransitionKind = 'fade';
 let ms = DEFAULT_FADE_MS;
 if (this.motion) {
 if (this.motionStart === null) this.motionStart = now;
 const steps = this.map.motions[this.motion].steps;
 const t = this.motionMs > 0 ? (now - this.motionStart) / this.motionMs : 1;
 if (steps && t < 1) {
 let cur = steps[0]!;
 for (const s of steps) if (s.at <= t) cur = s;
 if (cur.pose !== EXPRESSION_TOKEN) base = cur.pose;
 kind = cur.transition ?? 'fade';
 ms = cur.ms ?? DEFAULT_FADE_MS;
 }
 }
 const def = this.set.poses[base];
 if (def?.blink && eyeOpen < BLINK_BELOW) return { pose: def.blink, kind: 'fade', ms: QUICK_FADE_MS };
 if (mouth > TALK_ON) this.talking = true;
 else if (mouth < TALK_OFF) this.talking = false;
 if (def?.talk && this.talking) return { pose: def.talk, kind: 'fade', ms: QUICK_FADE_MS };
 return { pose: base, kind, ms };
 }

 update(now: number, expression: Expression, eyeOpen: number, mouth: number, isReady: (pose: string) => boolean): Frame {
 const dt = this.lastNow === null ? 0 : Math.max(0, now - this.lastNow);
 this.lastNow = now;
 const want = this.wanted(now, expression, eyeOpen, mouth);
 const need: string[] = [];
 if (!isReady(want.pose)) {
 need.push(want.pose);
 } else if (want.pose !== this.target) {
 this.target = want.pose;
 const instant = this.opts.reducedMotion || want.kind === 'cut' || this.layers.length === 0;
 // A pose already on its way out is brought back on top instead of being stacked twice.
 this.layers = this.layers.filter((l) => l.pose !== want.pose);
 this.layers.push({ pose: want.pose, alpha: instant ? 1 : 0, fadeMs: want.ms, kind: want.kind });
 }
 const top = this.layers[this.layers.length - 1];
 if (top && top.alpha < 1) {
 top.alpha = top.fadeMs <= 0 ? 1 : Math.min(1, top.alpha + dt / top.fadeMs);
 }
 // The new pose is opaque: everything below it can go.
 if (top && top.alpha >= 1 && this.layers.length > 1) this.layers = [top];
 const out: Layer[] = this.layers.map((l) => ({
 pose: l.pose,
 opacity: l.alpha,
 dx: l.kind === 'slide' && !this.opts.reducedMotion ? (1 - l.alpha) * SLIDE_SHIFT : 0,
 }));
 return { layers: out, need, target: this.target };
 }
}
