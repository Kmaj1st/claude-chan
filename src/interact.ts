import type { ActRequest } from './types';

// Cursor gaze follow plus click/drag reactions (MountOptions.interactive; default on for Live2D only).
// The gaze is relative to the character: the cursor right of her turns her head right, whatever her place.

export interface InteractTarget {
 lookAt(x: number | null, y?: number): void;
 act(req: ActRequest): void;
}

// After this long without pointer movement she goes back to her own idle glances.
export const GAZE_IDLE_MS = 2500;

export const CLICK_REACTION: ActRequest = { motion: 'wave', expression: 'smile', priority: 'normal' };
// Being grabbed beats a normal tool-call motion; a high/urgent one keeps playing and the reaction queues.
export const DRAG_REACTION: ActRequest = { motion: 'surprised', expression: 'surprised', priority: 'high' };

// Normalised gaze (-1..1) of point (px, py) seen from box centre (cx, cy); reach = px distance for full turn.
export function gazeFrom(px: number, py: number, cx: number, cy: number, reach: number): { x: number; y: number } {
 const r = reach > 0 ? reach : 1;
 const clamp = (v: number): number => Math.max(-1, Math.min(1, v));
 return { x: clamp((px - cx) / r), y: clamp((py - cy) / r) };
}

export function installInteraction(stage: HTMLElement, target: InteractTarget,
 onDragStart: (fn: () => void) => () => void): () => void {
 let idle: ReturnType<typeof setTimeout> | undefined;
 const move = (e: PointerEvent): void => {
 const b = stage.getBoundingClientRect();
 if (b.width === 0 && b.height === 0) return;
 const reach = Math.max(200, Math.min(window.innerWidth, window.innerHeight) / 2);
 const g = gazeFrom(e.clientX, e.clientY, b.left + b.width / 2, b.top + b.height * 0.3, reach);
 target.lookAt(g.x, g.y);
 clearTimeout(idle);
 idle = setTimeout(() => target.lookAt(null), GAZE_IDLE_MS);
 };
 // The host swallows the click that ends a drag before this listener runs (stopImmediatePropagation).
 const click = (): void => target.act(CLICK_REACTION);
 window.addEventListener('pointermove', move, { passive: true });
 stage.addEventListener('click', click);
 const offDrag = onDragStart(() => target.act(DRAG_REACTION));
 return () => {
 clearTimeout(idle);
 window.removeEventListener('pointermove', move);
 stage.removeEventListener('click', click);
 offDrag();
 target.lookAt(null);
 };
}
