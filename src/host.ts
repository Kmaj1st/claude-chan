import type { Position } from './types';

// DOM shell: fixed-position host in a shadow root, speech bubble, drag and persistence.
// Only the character itself receives pointer events; the host never blocks the page.

export interface Box { x: number; y: number }

// Keep a wh box fully inside a vwvh viewport.
export function clampPosition(x: number, y: number, w: number, h: number, vw: number, vh: number): Box {
 return {
 x: Math.max(0, Math.min(x, Math.max(0, vw - w))),
 y: Math.max(0, Math.min(y, Math.max(0, vh - h))),
 };
}

export const HOST_CSS =
 ':host{position:fixed;display:block;pointer-events:none;z-index:var(--claude-chan-z,2147483000);' +
 'left:var(--claude-chan-left,auto);right:var(--claude-chan-right,auto);' +
 'top:var(--claude-chan-top,auto);bottom:var(--claude-chan-bottom,auto)}' +
 '.stage{position:relative;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none}' +
 '.stage[data-draggable=true]{cursor:grab}.stage.dragging{cursor:grabbing}' +
 '.bubble{position:absolute;left:100%;bottom:70%;max-width:240px;width:max-content;padding:8px 12px;' +
 'background:#FFF4E3;color:#4A2C1A;border:2px solid #4A2C1A;border-radius:14px;font:14px/1.4 system-ui,sans-serif;' +
 'white-space:pre-wrap;overflow-wrap:anywhere;pointer-events:none;opacity:0;transition:opacity .2s}' +
 '.bubble[data-show=true]{opacity:1}' +
 '.bubble[data-side=left]{left:auto;right:100%}' +
 '@media (prefers-reduced-motion:reduce){.bubble{transition:none}}';

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
 destroy(): void;
}

export interface ShellOptions {
 position: Position;
 size: number;
 draggable: boolean;
 zIndex?: number;
 storageKey: string | false;
}

// Width of the character box relative to its height (viewBox 200x300).
const ASPECT = 2 / 3;

export function createShell(parent: HTMLElement, o: ShellOptions): Shell {
 const host = document.createElement('claude-chan-host');
 const root = host.attachShadow({ mode: 'open' });
 const style = document.createElement('style');
 style.textContent = HOST_CSS;
 const stage = document.createElement('div');
 stage.className = 'stage';
 stage.dataset.draggable = String(o.draggable);
 stage.style.height = o.size + 'px';
 stage.style.width = Math.round(o.size * ASPECT) + 'px';
 const bubble = document.createElement('div');
 bubble.className = 'bubble';
 bubble.setAttribute('role', 'status');
 bubble.setAttribute('aria-live', 'polite');
 root.append(style, stage, bubble);
 stage.appendChild(bubble);
 for (const [k, v] of Object.entries(cornerVars(o.position))) host.style.setProperty(k, v);
 if (o.zIndex !== undefined) host.style.setProperty('--claude-chan-z', String(o.zIndex));
 parent.appendChild(host);

 const w = (): number => stage.offsetWidth || Math.round(o.size * ASPECT);
 const h = (): number => stage.offsetHeight || o.size;
 const place = (x: number, y: number): Box => {
 const c = clampPosition(x, y, w(), h(), window.innerWidth, window.innerHeight);
 host.style.setProperty('--claude-chan-left', c.x + 'px');
 host.style.setProperty('--claude-chan-top', c.y + 'px');
 host.style.setProperty('--claude-chan-right', 'auto');
 host.style.setProperty('--claude-chan-bottom', 'auto');
 return c;
 };
 const save = (b: Box): void => {
 if (o.storageKey === false) return;
 try { localStorage.setItem(o.storageKey, JSON.stringify(b)); } catch { void 0; }
 };
 let moved: Box | null = null;
 if (o.draggable && o.storageKey !== false) {
 try {
 const raw = JSON.parse(localStorage.getItem(o.storageKey) ?? 'null') as Box | null;
 if (raw && Number.isFinite(raw.x) && Number.isFinite(raw.y)) moved = place(raw.x, raw.y);
 } catch { moved = null; }
 }

 let drag: { dx: number; dy: number; id: number } | null = null;
 const down = (e: PointerEvent): void => {
 if (!o.draggable || e.button !== 0) return;
 const r = stage.getBoundingClientRect();
 drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId };
 stage.setPointerCapture(e.pointerId);
 stage.classList.add('dragging');
 };
 const move = (e: PointerEvent): void => {
 if (drag && e.pointerId === drag.id) moved = place(e.clientX - drag.dx, e.clientY - drag.dy);
 };
 const up = (e: PointerEvent): void => {
 if (!drag || e.pointerId !== drag.id) return;
 drag = null;
 stage.classList.remove('dragging');
 if (moved) save(moved);
 };
 const resize = (): void => { if (moved) moved = place(moved.x, moved.y); };
 stage.addEventListener('pointerdown', down);
 stage.addEventListener('pointermove', move);
 stage.addEventListener('pointerup', up);
 stage.addEventListener('pointercancel', up);
 window.addEventListener('resize', resize);

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
 destroy() {
 clearTimeout(timer);
 window.removeEventListener('resize', resize);
 host.remove();
 },
 };
}
