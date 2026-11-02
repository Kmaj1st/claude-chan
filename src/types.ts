// Public contract of claude-chan. Names here are stable (semver).

export const MOTIONS = [
 'idle', 'wave', 'nod', 'shake_head', 'think', 'happy', 'surprised', 'bow',
 'cheer', 'sleepy', 'typing', 'tea_serve', 'pout', 'wink', 'point',
] as const;
export type Motion = (typeof MOTIONS)[number];

export const EXPRESSIONS = ['neutral', 'smile', 'sad', 'angry', 'blush', 'surprised'] as const;
export type Expression = (typeof EXPRESSIONS)[number];

export const MOODS = ['neutral', 'happy', 'sad', 'angry', 'shy', 'sleepy', 'thinking'] as const;
export type Mood = (typeof MOODS)[number];

export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];
// Numeric rank of a priority; higher interrupts lower.
export const PRIORITY_RANK: Record<Priority, number> = { low: 0, normal: 1, high: 2, urgent: 3 };

export type Position = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

// 'free': the user can drag the mascot anywhere in the viewport (pointer, touch, pen, keyboard) and the spot is
// remembered; 'fixed-default': it stays at its home position (position corner or home option).
export const DOCKS = ['free', 'fixed-default'] as const;
export type Dock = (typeof DOCKS)[number];

// Where the mascot is. x, y: viewport px of the character box's top-left corner. fx, fy: the same spot as
// fractions of the free space (0 = left/top edge, 1 = right/bottom edge). free: moved away from home.
export interface PositionInfo { x: number; y: number; fx: number; fy: number; free: boolean; dock: Dock }
// setPosition target: viewport px ({ x, y }) or fractions of the free space ({ fx, fy }).
export type PositionTarget = { x: number; y: number } | { fx: number; fy: number };
export type MoveSource = 'drag' | 'keyboard' | 'api' | 'reset';

export interface Box { x: number; y: number }

export interface ActRequest {
 motion?: Motion;
 expression?: Expression;
 // Speech bubble text (plain text only).
 say?: string;
 // Milliseconds the expression/bubble stays.
 duration?: number;
 priority?: Priority;
}

export type EventName = 'ready' | 'motionstart' | 'motionend' | 'error' | 'dragstart' | 'move';
export interface MotionEvent { motion: Motion; interrupted?: boolean }
export interface EventMap {
 ready: undefined;
 motionstart: MotionEvent;
 motionend: MotionEvent;
 error: { message: string; cause?: unknown };
 // The user picked the mascot up (drag passed the threshold).
 dragstart: PositionInfo;
 // The position changed by a drop, a keyboard step, setPosition or resetPosition (not by viewport re-clamps).
 move: PositionInfo & { source: MoveSource };
}
export type Unsubscribe = () => void;

export interface ClaudeChanController {
 act(req: ActRequest): void;
 say(text: string): void;
 setMood(mood: Mood): void;
 // x, y in viewport px (clientX/clientY); null releases the gaze.
 lookAt(x: number | null, y?: number): void;
 stop(): void;
 // Drives the mouth from an audio/video element or AnalyserNode; null returns to text-length lip-sync.
 lipSync(source: HTMLMediaElement | AnalyserNode | null): void;
 on<K extends EventName>(name: K, fn: (e: EventMap[K]) => void): Unsubscribe;
 // Current position (see PositionInfo).
 getPosition(): PositionInfo;
 // Moves the mascot (clamped to the viewport) and persists it; ignored with dock 'fixed-default'.
 setPosition(target: PositionTarget): void;
 // Back to the home position; forgets the remembered spot.
 resetPosition(): void;
 // Switches between 'free' and 'fixed-default' at runtime.
 setDock(dock: Dock): void;
 // Re-reads the home position and viewport (call when the host moved the home slot, e.g. its chat bar grew).
 relayout(): void;
 destroy(): void;
 readonly ready: Promise<void>;
}

// Which renderer draws the character. 'auto' = Live2D when model is set, else sprites when the
// pose set loads, else the procedural puppet.
export type RendererName = 'auto' | 'sprite' | 'procedural' | 'live2d';

export interface MountOptions {
 renderer?: RendererName;
 // URL of a model folder/model3.json (Live2D renderer).
 model?: string;
 // URL of the self-hosted Cubism Core script (live2dcubismcore.min.js); only used with model.
 coreUrl?: string;
 // Maps preset expression names to the model's own expression ids (Live2D renderer); unmapped names are used as-is.
 expressions?: Partial<Record<Expression, string>>;
 // URL of a sprite pose folder (poses.json, motions.json and the webp files). Default: the assets/chars folder shipped with the package.
 sprites?: string;
 // Home corner (default bottom-left), used when home is not set.
 position?: Position;
 // Home position in viewport px of the box's top-left corner, or a function returning it (re-read on resize and
 // relayout(); return null to fall back to the corner). Lets a host keep its own slot as the default spot.
 home?: Box | (() => Box | null);
 // Character height in px (default 220).
 size?: number;
 // Legacy switch: false is the same as dock 'fixed-default'. dock wins when both are given.
 draggable?: boolean;
 // 'free' (default) or 'fixed-default'.
 dock?: Dock;
 // Minimum gap in px between the mascot and the viewport edges (default 8).
 margin?: number;
 // Edge snapping on drop: true = 24 px, a number = that many px, false (default) = off.
 snap?: boolean | number;
 // Double-click on the mascot returns it home (default true; only while it is free to move).
 resetOnDoubleClick?: boolean;
 // localStorage key for the remembered position (stored as fractions); false disables persistence.
 storageKey?: string | false;
 zIndex?: number;
 autoIdle?: boolean;
}

// Parameter names follow Live2D Cubism standard IDs so both renderers share them.
export const PARAMS = [
 'ParamAngleX', 'ParamAngleY', 'ParamAngleZ', 'ParamEyeLOpen', 'ParamEyeROpen',
 'ParamEyeBallX', 'ParamEyeBallY', 'ParamBrowLY', 'ParamBrowRY', 'ParamMouthOpenY',
 'ParamMouthForm', 'ParamCheek', 'ParamBodyAngleX', 'ParamBodyAngleZ', 'ParamBreath',
 'ParamArmLA', 'ParamArmRA', 'ParamHairSway',
] as const;
export type ParamId = (typeof PARAMS)[number];
export type Pose = Record<ParamId, number>;

export function neutralPose(): Pose {
 const p = {} as Pose;
 for (const id of PARAMS) p[id] = 0;
 p.ParamEyeLOpen = 1;
 p.ParamEyeROpen = 1;
 return p;
}

// Renderer driven by the motion engine. Procedural puppet and Live2D both implement it.
export interface Puppet {
 readonly element: HTMLElement;
 init(): Promise<void>;
 // nowMs is the engine clock (same value as tick(nowMs)).
 render(pose: Pose, expression: Expression, nowMs?: number): void;
 // Optional: the engine reports the running motion (null when none) so pose-based renderers can pick images.
 setMotion?(motion: Motion | null, durationMs: number): void;
 destroy(): void;
}
