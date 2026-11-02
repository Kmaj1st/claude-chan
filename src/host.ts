import type { Box, Dock, MoveSource, Position, PositionInfo, PositionTarget } from './types';
import { clampToArea, fromFraction, parseStored, snapToEdges, toFraction, type Area, type Fraction } from './position';

// DOM shell: fixed-position host in a shadow root, speech bubble, free drag (pointer + keyboard) and persistence.
// Only the character itself receives pointer events; the host never blocks the page.

export type { Box };

// Keep a wh box fully inside a vwvh viewport.
export function clampPosition(x: number, y: number, w: number, h: number, vw: number, vh: number): Box {
 return clampToArea(x, y, w, h, { left: 0, top: 0, width: vw, height: vh });
}

export const HOST_CSS =
 ':host([hidden]){display:none!important}' +
 ':host{position:fixed;display:block;pointer-events:none;z-index:var(--claude-chan-z,2147483000);' +
 'left:var(--claude-chan-left,auto);right:var(--claude-chan-right,auto);' +
 'top:var(--claude-chan-top,auto);bottom:var(--claude-chan-bottom,auto)}' +
 '.stage{position:relative;pointer-events:auto;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}' +
 '.stage[data-draggable=true]{cursor:grab;touch-action:none}.stage.dragging{cursor:grabbing}' +
 '.stage:focus{outline:none}.stage:focus-visible{outline:2px dashed #4A2C1A;outline-offset:4px;border-radius:12px}' +
 // Gentle pickup/drop: the character lifts and tilts while carried. Individual transform properties keep the
 // renderers' own transform untouched; no extra art.
 '.stage>:not(.bubble){translate:0 0;rotate:0deg;transition:translate .18s ease-out,rotate .18s ease-out}' +
 '.stage.dragging>:not(.bubble){translate:0 -8px;rotate:-3deg}' +
 '.bubble{position:absolute;left:100%;bottom:70%;max-width:240px;width:max-content;padding:8px 12px;' +
 'background:#FFF4E3;color:#4A2C1A;border:2px solid #4A2C1A;border-radius:14px;font:14px/1.4 system-ui,sans-serif;' +
 'white-space:pre-wrap;overflow-wrap:anywhere;pointer-events:none;opacity:0;transition:opacity .2s}' +
 '.bubble[data-show=true]{opacity:1}' +
 '.bubble[data-side=left]{left:auto;right:100%}' +
 '@media (prefers-reduced-motion:reduce){.bubble,.stage>:not(.bubble){transition:none}' +
 '.stage.dragging>:not(.bubble){translate:0 0;rotate:0deg}}';

// Default corner offsets are set through CSS variables so pages can override them.
export function cornerVars(position: Position, offset = 16): Record<string, string> {
 const px = offset + 'px';
 return {
 '--claude-chan-left': position.endsWith('left') ? px : 'auto',
 '--claude-chan-right': position.endsWith('right') ? px : 'auto',
 '--claude-chan-top': position.startsWith('top') ? px : 'auto',
 '--claude-chan-bottom': position.startsWith('bottom') ? px : 'auto',
 };
}

export interface Shell {
 host: HTMLElement;
 stage: HTMLElement;
 setBubble(text: string, ms: number): void;
 getPosition(): PositionInfo;
 setPosition(t: PositionTarget): void;
 resetPosition(): void;
 setDock(d: Dock): void;
 relayout(): void;
 // Hides/shows the whole mascot (host element); persist stores the flag under '<storageKey>:hidden'.
 setHidden(hidden: boolean, persist?: boolean): void;
 isHidden(): boolean;
 destroy(): void;
}

export interface ShellOptions {
 position: Position;
 size: number;
 dock: Dock;
 home?: Box | (() => Box | null);
 margin?: number;
 snap?: boolean | number;
 resetOnDoubleClick?: boolean;
 zIndex?: number;
 storageKey: string | false;
 onDragStart?: (p: PositionInfo) => void;
 onMove?: (p: PositionInfo & { source: MoveSource }) => void;
}

// Width of the character box relative to its height (viewBox 200x300).
const ASPECT = 2 / 3;
// Pointer travel (px) before a press becomes a drag; below it the press stays a click/tap.
export const DRAG_THRESHOLD = { mouse: 4, touch: 8 };
// Keyboard steps in px (Shift = big step).
export const KEY_STEP = 10;
export const KEY_STEP_BIG = 60;
const CORNER_OFFSET = 16;

export function createShell(parent: HTMLElement, o: ShellOptions): Shell {
 const host = document.createElement('claude-chan-host');
 const root = host.attachShadow({ mode: 'open' });
 const style = document.createElement('style');
 style.textContent = HOST_CSS;
 const stage = document.createElement('div');
 stage.className = 'stage';
 stage.style.height = o.size + 'px';
 stage.style.width = Math.round(o.size * ASPECT) + 'px';
 const bubble = document.createElement('div');
 bubble.className = 'bubble';
 bubble.setAttribute('role', 'status');
 bubble.setAttribute('aria-live', 'polite');
 root.append(style, stage, bubble);
 stage.appendChild(bubble);
 for (const [k, v] of Object.entries(cornerVars(o.position, CORNER_OFFSET))) host.style.setProperty(k, v);
 if (o.zIndex !== undefined) host.style.setProperty('--claude-chan-z', String(o.zIndex));
 parent.appendChild(host);

 const margin = Math.max(0, o.margin ?? 8);
 const snapPx = o.snap === true ? 24 : typeof o.snap === 'number' && o.snap > 0 ? o.snap : 0;
 let dock: Dock = o.dock;
 const w = (): number => stage.offsetWidth || Math.round(o.size * ASPECT);
 const h = (): number => stage.offsetHeight || o.size;
 // Layout viewport (what position:fixed is relative to), without scrollbars.
 const view = (): { vw: number; vh: number } => {
 const de = document.documentElement;
 return { vw: de?.clientWidth || window.innerWidth, vh: de?.clientHeight || window.innerHeight };
 };
 // Area the mascot must stay inside: the layout viewport, shrunk to the visual viewport's visible band when an
 // on-screen keyboard covers part of it (not while pinch-zoomed, so zooming never shoves the mascot around).
 const area = (): Area => {
 const { vw, vh } = view();
 const vv = typeof window.visualViewport === 'object' ? window.visualViewport : null;
 if (vv && Math.abs(vv.scale - 1) < 0.01 && vv.height > 0 && vv.height < vh - 1) {
 const top = Math.max(0, vv.offsetTop);
 return { left: 0, top, width: vw, height: Math.min(vh - top, vv.height) };
 }
 return { left: 0, top: 0, width: vw, height: vh };
 };
 const homeBox = (): Box => {
 let b: Box | null = null;
 try { b = typeof o.home === 'function' ? o.home() : o.home ?? null; } catch { b = null; }
 if (b && Number.isFinite(b.x) && Number.isFinite(b.y)) return { x: b.x, y: b.y };
 const { vw, vh } = view();
 return {
 x: o.position.endsWith('left') ? CORNER_OFFSET : vw - w() - CORNER_OFFSET,
 y: o.position.startsWith('top') ? CORNER_OFFSET : vh - h() - CORNER_OFFSET,
 };
 };
 const toFrac = (b: Box): Fraction => {
 const { vw, vh } = view();
 return { fx: toFraction(b.x, w(), vw, margin), fy: toFraction(b.y, h(), vh, margin) };
 };
 const fromFrac = (f: Fraction): Box => {
 const { vw, vh } = view();
 return { x: fromFraction(f.fx, w(), vw, margin), y: fromFraction(f.fy, h(), vh, margin) };
 };

 // free: the user-chosen spot as fractions (survives other window sizes); null = at home.
 let free: Fraction | null = null;
 let shown: Box = { x: 0, y: 0 };
 const apply = (b: Box): void => {
 shown = clampToArea(b.x, b.y, w(), h(), area(), margin);
 host.style.setProperty('--claude-chan-left', shown.x + 'px');
 host.style.setProperty('--claude-chan-top', shown.y + 'px');
 host.style.setProperty('--claude-chan-right', 'auto');
 host.style.setProperty('--claude-chan-bottom', 'auto');
 };
 const place = (): void => apply(free && dock === 'free' ? fromFrac(free) : homeBox());
 const info = (): PositionInfo => ({ x: shown.x, y: shown.y, ...toFrac(shown), free: free !== null && dock === 'free', dock });
 const save = (): void => {
 if (o.storageKey === false) return;
 try {
 if (free) localStorage.setItem(o.storageKey, JSON.stringify({ v: 2, fx: free.fx, fy: free.fy }));
 else localStorage.removeItem(o.storageKey);
 } catch { void 0; }
 };
 const commit = (b: Box, source: MoveSource): void => {
 apply(b);
 free = toFrac(shown);
 save();
 o.onMove?.({ ...info(), source });
 };
 const syncDock = (): void => {
 const on = dock === 'free';
 stage.dataset.draggable = String(on);
 if (on) {
 stage.tabIndex = 0;
 stage.setAttribute('aria-label', 'Claude-chan mascot. Arrow keys move it, Shift for bigger steps, Home returns it to its place.');
 } else {
 stage.removeAttribute('tabindex');
 stage.removeAttribute('aria-label');
 }
 };
 syncDock();
 // Explicit hide({ persist: true }) only (never set by any UI); show() always clears it.
 const hiddenKey = o.storageKey === false ? null : o.storageKey + ':hidden';
 const setHidden = (hidden: boolean, persist = false): void => {
 host.hidden = hidden;
 if (!hiddenKey) return;
 try {
 if (hidden && persist) localStorage.setItem(hiddenKey, '1');
 else if (!hidden) localStorage.removeItem(hiddenKey);
 } catch { void 0; }
 };
 if (hiddenKey) {
 try {
 if (localStorage.getItem(hiddenKey) === '1') {
 host.hidden = true;
 console.info('claude-chan: hidden by hide({ persist: true }); run claudeChan.show() to bring her back.');
 }
 } catch { void 0; }
 }
 if (o.storageKey !== false) {
 try {
 const { vw, vh } = view();
 free = parseStored(JSON.parse(localStorage.getItem(o.storageKey) ?? 'null'), w(), h(), vw, vh, margin);
 } catch { free = null; }
 }
 place();

 // Pointer drag with a threshold, so a press that barely moves stays a click/tap.
 let press: { id: number; sx: number; sy: number; dx: number; dy: number; start: Box; limit: number; dragging: boolean } | null = null;
 let swallowClick = false;
 const noSelect = (e: Event): void => e.preventDefault();
 const endDrag = (): void => {
 stage.classList.remove('dragging');
 document.removeEventListener('selectstart', noSelect, true);
 };
 const down = (e: PointerEvent): void => {
 if (dock !== 'free' || press || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
 press = {
 id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: e.clientX - shown.x, dy: e.clientY - shown.y, start: shown,
 limit: e.pointerType === 'mouse' ? DRAG_THRESHOLD.mouse : DRAG_THRESHOLD.touch, dragging: false,
 };
 try { stage.setPointerCapture(e.pointerId); } catch { void 0; }
 };
 const move = (e: PointerEvent): void => {
 if (!press || e.pointerId !== press.id) return;
 if (!press.dragging) {
 if (Math.hypot(e.clientX - press.sx, e.clientY - press.sy) < press.limit) return;
 press.dragging = true;
 stage.classList.add('dragging');
 document.addEventListener('selectstart', noSelect, true);
 o.onDragStart?.(info());
 }
 e.preventDefault();
 apply({ x: e.clientX - press.dx, y: e.clientY - press.dy });
 };
 const up = (e: PointerEvent): void => {
 if (!press || e.pointerId !== press.id) return;
 const p = press;
 press = null;
 try { stage.releasePointerCapture(e.pointerId); } catch { void 0; }
 if (!p.dragging) return;
 endDrag();
 // A cancelled drag (the browser took the pointer) goes back to where it started.
 if (e.type === 'pointercancel') return apply(p.start);
 swallowClick = true;
 setTimeout(() => { swallowClick = false; }, 0);
 commit(snapPx ? snapToEdges(shown, w(), h(), area(), margin, snapPx) : shown, 'drag');
 };
 // The click that ends a drag is not a click for the host.
 const click = (e: MouseEvent): void => {
 if (!swallowClick) return;
 swallowClick = false;
 e.preventDefault();
 e.stopImmediatePropagation();
 };
 const resetPosition = (): void => {
 free = null;
 save();
 place();
 o.onMove?.({ ...info(), source: 'reset' });
 };
 // Opt-in only (resetOnDoubleClick: true): by default a double-click is just two clicks and never moves the mascot.
 const dbl = (e: MouseEvent): void => {
 if (dock !== 'free' || o.resetOnDoubleClick !== true || !free) return;
 e.preventDefault();
 resetPosition();
 };
 const key = (e: KeyboardEvent): void => {
 if (dock !== 'free') return;
 if (e.key === 'Escape' && press?.dragging) {
 const p = press;
 press = null;
 endDrag();
 apply(p.start);
 return;
 }
 if (e.altKey || e.ctrlKey || e.metaKey) return;
 const step = e.shiftKey ? KEY_STEP_BIG : KEY_STEP;
 const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
 const v = d[e.key];
 if (v) {
 e.preventDefault();
 commit({ x: shown.x + v[0], y: shown.y + v[1] }, 'keyboard');
 } else if (e.key === 'Home') {
 e.preventDefault();
 resetPosition();
 }
 };
 // Viewport changes (resize, rotation, on-screen keyboard) re-clamp without touching the remembered spot.
 const relayout = (): void => { if (!press?.dragging) place(); };
 const vv = typeof window.visualViewport === 'object' ? window.visualViewport : null;
 stage.addEventListener('pointerdown', down);
 stage.addEventListener('pointermove', move);
 stage.addEventListener('pointerup', up);
 stage.addEventListener('pointercancel', up);
 stage.addEventListener('click', click, true);
 stage.addEventListener('dblclick', dbl);
 stage.addEventListener('keydown', key);
 window.addEventListener('resize', relayout);
 window.addEventListener('orientationchange', relayout);
 vv?.addEventListener('resize', relayout);
 vv?.addEventListener('scroll', relayout);

 let timer: ReturnType<typeof setTimeout> | undefined;
 return {
 host,
 stage,
 setBubble(text, ms) {
 clearTimeout(timer);
 bubble.textContent = text;
 // Flip to the left when the right side lacks room for the bubble.
 bubble.dataset.side = stage.getBoundingClientRect().right + 250 > window.innerWidth ? 'left' : 'right';
 bubble.dataset.show = String(text.length > 0);
 if (text) timer = setTimeout(() => { bubble.dataset.show = 'false'; }, ms);
 },
 getPosition: info,
 setPosition(t) {
 if (dock !== 'free' || !t || typeof t !== 'object') return;
 const b = 'fx' in t ? fromFrac({ fx: t.fx, fy: t.fy }) : { x: t.x, y: t.y };
 if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) return;
 commit(b, 'api');
 },
 resetPosition,
 setDock(d) {
 if (d === dock || (d !== 'free' && d !== 'fixed-default')) return;
 dock = d;
 if (press?.dragging) endDrag();
 press = null;
 syncDock();
 place();
 },
 relayout,
 setHidden,
 isHidden: () => host.hidden === true,
 destroy() {
 clearTimeout(timer);
 endDrag();
 window.removeEventListener('resize', relayout);
 window.removeEventListener('orientationchange', relayout);
 vv?.removeEventListener('resize', relayout);
 vv?.removeEventListener('scroll', relayout);
 host.remove();
 },
 };
}
