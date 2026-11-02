import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShell, DRAG_THRESHOLD, KEY_STEP, KEY_STEP_BIG } from '../src/host';

class El {
 children: El[] = [];
 listeners: Record<string, ((e: any) => void)[]> = {};
 classes = new Set<string>();
 classList = { add: (c: string) => this.classes.add(c), remove: (c: string) => this.classes.delete(c) };
 dataset: Record<string, string> = {};
 props: Record<string, string> = {};
 style: any = { setProperty: (k: string, v: string) => { this.props[k] = v; } };
 attrs: Record<string, string> = {};
 rect = { left: 10, top: 20, right: 100 };
 className = '';
 textContent = '';
 tabIndex = -1;
 offsetWidth = 0;
 offsetHeight = 0;
 removed = false;
 setPointerCapture = vi.fn();
 releasePointerCapture = vi.fn();
 constructor(public tag: string) {}
 attachShadow() { return new El('#root'); }
 append(...c: El[]) { this.children.push(...c); }
 appendChild(c: El) { this.children.push(c); return c; }
 setAttribute(k: string, v: string) { this.attrs[k] = v; }
 removeAttribute(k: string) { delete this.attrs[k]; if (k === 'tabindex') this.tabIndex = -1; }
 addEventListener(t: string, f: (e: any) => void) { (this.listeners[t] ??= []).push(f); }
 getBoundingClientRect() { return this.rect; }
 remove() { this.removed = true; }
 fire(t: string, e: any) { (this.listeners[t] ?? []).forEach((f) => f(e)); }
}

let stage: El;
let bubble: El;
const win = { innerWidth: 1000, innerHeight: 800, addEventListener: vi.fn(), removeEventListener: vi.fn() };
const store = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
const doc = { createElement: (t: string) => new El(t), addEventListener: vi.fn(), removeEventListener: vi.fn() };

function make(o: Partial<Parameters<typeof createShell>[1]> = {}) {
 const parent = new El('body');
 const onMove = vi.fn();
 const onDragStart = vi.fn();
 const sh = createShell(parent as any, { position: 'bottom-left', size: 300, dock: 'free', storageKey: 'k', onMove, onDragStart, ...o });
 stage = sh.stage as any;
 bubble = stage.children[0]!;
 return { sh, host: sh.host as any as El, parent, onMove, onDragStart };
}

const ev = (x: number, y: number, extra = {}) => ({
 button: 0, pointerId: 1, isPrimary: true, pointerType: 'mouse', clientX: x, clientY: y, preventDefault: vi.fn(), type: 'pointermove', ...extra,
});
const at = (host: El) => [host.props['--claude-chan-left'], host.props['--claude-chan-top']];
// Box is 200 x 300 (size 300); viewport 1000 x 800; margin 8 -> x in [8, 792], y in [8, 492]. Home (bottom-left) is (16, 484).

describe('createShell', () => {
 beforeEach(() => {
 vi.useFakeTimers();
 vi.stubGlobal('document', doc);
 vi.stubGlobal('window', win);
 vi.stubGlobal('localStorage', store);
 win.innerWidth = 1000;
 win.innerHeight = 800;
 store.getItem.mockReset().mockReturnValue(null);
 store.setItem.mockReset();
 store.removeItem.mockReset();
 win.addEventListener.mockReset();
 win.removeEventListener.mockReset();
 doc.addEventListener.mockReset();
 doc.removeEventListener.mockReset();
 });
 afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

 it('sizes the stage and places it at its home corner', () => {
 const { host, parent, sh } = make({ zIndex: 5, storageKey: false });
 expect(parent.children).toContain(host);
 expect(stage.style.height).toBe('300px');
 expect(stage.style.width).toBe('200px');
 expect(at(host)).toEqual(['16px', '484px']);
 expect(host.props['--claude-chan-bottom']).toBe('auto');
 expect(host.props['--claude-chan-z']).toBe('5');
 expect(bubble.attrs['aria-live']).toBe('polite');
 expect(sh.getPosition()).toMatchObject({ x: 16, y: 484, free: false, dock: 'free' });
 });

 it('top-right home corner', () => {
 expect(at(make({ position: 'top-right' }).host)).toEqual(['784px', '16px']);
 });

 it('a press that moves less than the threshold stays a click', () => {
 const { host, onMove, onDragStart } = make();
 stage.fire('pointerdown', ev(50, 600));
 stage.fire('pointermove', ev(50 + DRAG_THRESHOLD.mouse - 1, 600));
 expect(stage.classes.has('dragging')).toBe(false);
 stage.fire('pointerup', ev(52, 600, { type: 'pointerup' }));
 expect(at(host)).toEqual(['16px', '484px']);
 expect(onMove).not.toHaveBeenCalled();
 expect(onDragStart).not.toHaveBeenCalled();
 const click = { preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
 stage.fire('click', click);
 expect(click.stopImmediatePropagation).not.toHaveBeenCalled();
 });

 it('touch needs a longer travel than mouse before it drags', () => {
 make();
 stage.fire('pointerdown', ev(50, 600, { pointerType: 'touch' }));
 stage.fire('pointermove', ev(50 + DRAG_THRESHOLD.mouse + 1, 600, { pointerType: 'touch' }));
 expect(stage.classes.has('dragging')).toBe(false);
 stage.fire('pointermove', ev(50 + DRAG_THRESHOLD.touch + 1, 600, { pointerType: 'touch' }));
 expect(stage.classes.has('dragging')).toBe(true);
 });

 it('drags, clamps with the margin, saves fractions and swallows the click that ends the drag', () => {
 const { host, onMove, onDragStart, sh } = make();
 stage.fire('pointerdown', ev(50, 600));
 stage.fire('pointermove', ev(150, 400));
 expect(stage.classes.has('dragging')).toBe(true);
 expect(onDragStart).toHaveBeenCalledTimes(1);
 expect(doc.addEventListener).toHaveBeenCalledWith('selectstart', expect.any(Function), true);
 expect(at(host)).toEqual(['116px', '284px']);
 stage.fire('pointermove', ev(-500, 5000));
 expect(at(host)).toEqual(['8px', '492px']);
 stage.fire('pointermove', ev(5000, -5000));
 expect(at(host)).toEqual(['792px', '8px']);
 stage.fire('pointerup', ev(5000, -5000, { type: 'pointerup' }));
 expect(stage.classes.has('dragging')).toBe(false);
 expect(store.setItem).toHaveBeenCalledWith('k', JSON.stringify({ v: 2, fx: 1, fy: 0 }));
 expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ x: 792, y: 8, fx: 1, fy: 0, free: true, source: 'drag' }));
 expect(sh.getPosition().free).toBe(true);
 const click = { preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
 stage.fire('click', click);
 expect(click.stopImmediatePropagation).toHaveBeenCalled();
 });

 it('pointercancel puts the mascot back where the drag started', () => {
 const { host, onMove } = make();
 stage.fire('pointerdown', ev(50, 600));
 stage.fire('pointermove', ev(300, 300));
 stage.fire('pointercancel', ev(300, 300, { type: 'pointercancel' }));
 expect(at(host)).toEqual(['16px', '484px']);
 expect(onMove).not.toHaveBeenCalled();
 expect(store.setItem).not.toHaveBeenCalled();
 });

 it('Escape during a drag cancels it', () => {
 const { host } = make();
 stage.fire('pointerdown', ev(50, 600));
 stage.fire('pointermove', ev(300, 300));
 stage.fire('keydown', { key: 'Escape', preventDefault: vi.fn() });
 expect(at(host)).toEqual(['16px', '484px']);
 expect(stage.classes.has('dragging')).toBe(false);
 });

 it('ignores non-primary buttons and other pointers', () => {
 make();
 stage.fire('pointerdown', ev(50, 600, { button: 2 }));
 stage.fire('pointermove', ev(300, 300, { button: 2 }));
 expect(stage.classes.has('dragging')).toBe(false);
 stage.fire('pointerdown', ev(50, 600, { isPrimary: false, pointerId: 3 }));
 stage.fire('pointermove', ev(300, 300, { pointerId: 3 }));
 expect(stage.classes.has('dragging')).toBe(false);
 stage.fire('pointerdown', ev(50, 600));
 stage.fire('pointermove', ev(300, 300));
 stage.fire('pointerup', ev(0, 0, { pointerId: 9, type: 'pointerup' }));
 expect(stage.classes.has('dragging')).toBe(true);
 });

 it('dock fixed-default: no drag, no keyboard focus, setPosition ignored, stored spot ignored', () => {
 store.getItem.mockReturnValue('{"v":2,"fx":0.5,"fy":0.5}');
 const { host, sh } = make({ dock: 'fixed-default' });
 expect(at(host)).toEqual(['16px', '484px']);
 expect(stage.dataset.draggable).toBe('false');
 expect(stage.attrs.tabindex).toBeUndefined();
 stage.fire('pointerdown', ev(50, 600));
 stage.fire('pointermove', ev(300, 300));
 expect(stage.classes.has('dragging')).toBe(false);
 sh.setPosition({ x: 300, y: 300 });
 stage.fire('keydown', { key: 'ArrowUp', preventDefault: vi.fn() });
 expect(at(host)).toEqual(['16px', '484px']);
 sh.setDock('free');
 expect(stage.dataset.draggable).toBe('true');
 expect(stage.tabIndex).toBe(0);
 expect(at(host)).toEqual(['400px', '250px']);
 sh.setDock('fixed-default');
 expect(at(host)).toEqual(['16px', '484px']);
 });

 it('restores fractions, converts the legacy px format and ignores corrupt storage', () => {
 store.getItem.mockReturnValue('{"v":2,"fx":0.25,"fy":1}');
 expect(at(make().host)).toEqual(['204px', '492px']);
 store.getItem.mockReturnValue('{"x":30,"y":40}');
 expect(at(make().host)).toEqual(['30px', '40px']);
 store.getItem.mockReturnValue('not json');
 expect(at(make().host)).toEqual(['16px', '484px']);
 store.getItem.mockImplementation(() => { throw new Error('denied'); });
 expect(at(make().host)).toEqual(['16px', '484px']);
 });

 it('a saved fraction survives a different window size and resize re-clamps without saving', () => {
 store.getItem.mockReturnValue('{"v":2,"fx":1,"fy":1}');
 const { host } = make();
 expect(at(host)).toEqual(['792px', '492px']);
 win.innerWidth = 500;
 win.innerHeight = 400;
 const resize = win.addEventListener.mock.calls.find((c) => c[0] === 'resize')![1];
 resize();
 expect(at(host)).toEqual(['292px', '92px']);
 expect(store.setItem).not.toHaveBeenCalled();
 win.innerWidth = 150;
 resize();
 expect(at(host)).toEqual(['8px', '92px']);
 });

 it('arrow keys move (Shift = big step), Home resets', () => {
 const { host, onMove } = make();
 expect(stage.tabIndex).toBe(0);
 expect(stage.attrs['aria-label']).toContain('Arrow keys');
 const k = (key: string, shiftKey = false) => { const e = { key, shiftKey, preventDefault: vi.fn() }; stage.fire('keydown', e); return e; };
 expect(k('ArrowUp').preventDefault).toHaveBeenCalled();
 expect(at(host)).toEqual(['16px', 484 - KEY_STEP + 'px']);
 k('ArrowRight', true);
 expect(at(host)).toEqual([16 + KEY_STEP_BIG + 'px', 484 - KEY_STEP + 'px']);
 expect(onMove).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'keyboard', free: true }));
 expect(k('a').preventDefault).not.toHaveBeenCalled();
 k('Home');
 expect(at(host)).toEqual(['16px', '484px']);
 expect(store.removeItem).toHaveBeenCalledWith('k');
 expect(onMove).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'reset', free: false }));
 });

 it('double-click never moves the mascot by default; resetOnDoubleClick: true opts in', () => {
 const { host, sh, onMove } = make();
 sh.setPosition({ x: 300, y: 200 });
 onMove.mockClear();
 const e = { preventDefault: vi.fn() };
 stage.fire('dblclick', e);
 expect(at(host)).toEqual(['300px', '200px']);
 expect(e.preventDefault).not.toHaveBeenCalled();
 expect(onMove).not.toHaveBeenCalled();
 const b = make({ resetOnDoubleClick: true });
 b.sh.setPosition({ x: 300, y: 200 });
 stage.fire('dblclick', { preventDefault: vi.fn() });
 expect(at(b.host)).toEqual(['16px', '484px']);
 });

 it('hide/show: page-load hide by default, persisted only on request, show clears it', () => {
 const { host, sh } = make();
 expect(sh.isHidden()).toBe(false);
 sh.setHidden(true);
 expect((host as any).hidden).toBe(true);
 expect(store.setItem).not.toHaveBeenCalledWith('k:hidden', '1');
 sh.setHidden(false);
 expect(sh.isHidden()).toBe(false);
 expect(store.removeItem).toHaveBeenCalledWith('k:hidden');
 sh.setHidden(true, true);
 expect(store.setItem).toHaveBeenCalledWith('k:hidden', '1');
 // a persisted flag starts the next page hidden (with a console hint), never anything else
 const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
 store.getItem.mockImplementation((k: string) => (k === 'k:hidden' ? '1' : null));
 const c = make();
 expect(c.sh.isHidden()).toBe(true);
 expect(info).toHaveBeenCalled();
 c.sh.setHidden(false);
 expect(store.removeItem).toHaveBeenCalledWith('k:hidden');
 info.mockRestore();
 // storageKey false: nothing is stored
 store.setItem.mockClear();
 const d = make({ storageKey: false });
 d.sh.setHidden(true, true);
 expect(store.setItem).not.toHaveBeenCalled();
 });

 it('setPosition takes px or fractions, clamps and ignores junk', () => {
 const { host, sh, onMove } = make();
 sh.setPosition({ fx: 0.5, fy: 0 });
 expect(at(host)).toEqual(['400px', '8px']);
 expect(onMove).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'api' }));
 sh.setPosition({ x: -50, y: 9999 });
 expect(at(host)).toEqual(['8px', '492px']);
 sh.setPosition({ x: NaN, y: 1 });
 sh.setPosition(null as any);
 expect(at(host)).toEqual(['8px', '492px']);
 });

 it('snaps to a near edge on drop when snap is on', () => {
 const { host } = make({ snap: true });
 stage.fire('pointerdown', ev(50, 600));
 stage.fire('pointermove', ev(55 + 10, 600 - 250));
 stage.fire('pointerup', ev(65, 350, { type: 'pointerup' }));
 // x 31 is within 24 px of the left edge (8); y 234 is far from both edges.
 expect(at(host)).toEqual(['8px', '234px']);
 });

 it('a home function sets the default spot and relayout re-reads it', () => {
 let home = { x: 100, y: 500 };
 const { host, sh } = make({ home: () => home });
 expect(at(host)).toEqual(['100px', '492px']);
 home = { x: 200, y: 100 };
 sh.relayout();
 expect(at(host)).toEqual(['200px', '100px']);
 const bad = make({ home: () => { throw new Error('x'); } });
 expect(at(bad.host)).toEqual(['16px', '484px']);
 });

 it('stays above an on-screen keyboard (visual viewport) and returns when it closes; pinch zoom is ignored', () => {
 const vv = { scale: 1, height: 400, offsetTop: 0, addEventListener: vi.fn(), removeEventListener: vi.fn() };
 (win as any).visualViewport = vv;
 try {
 const { host, sh } = make();
 expect(at(host)).toEqual(['16px', '92px']);
 vv.height = 800;
 vv.addEventListener.mock.calls.find((c) => c[0] === 'resize')![1]();
 expect(at(host)).toEqual(['16px', '484px']);
 vv.scale = 2;
 vv.height = 400;
 sh.relayout();
 expect(at(host)).toEqual(['16px', '484px']);
 sh.destroy();
 expect(vv.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
 } finally {
 delete (win as any).visualViewport;
 }
 });

 it('shows the bubble, hides it after the timeout and flips sides near the edge', () => {
 const { sh } = make();
 sh.setBubble('hi', 1000);
 expect(bubble.textContent).toBe('hi');
 expect(bubble.dataset.show).toBe('true');
 expect(bubble.dataset.side).toBe('right');
 vi.advanceTimersByTime(1000);
 expect(bubble.dataset.show).toBe('false');
 stage.rect.right = 900;
 sh.setBubble('yo', 1000);
 expect(bubble.dataset.side).toBe('left');
 sh.setBubble('', 1000);
 expect(bubble.dataset.show).toBe('false');
 });

 it('destroy removes the host and the viewport listeners', () => {
 const { sh, host } = make();
 sh.destroy();
 expect(host.removed).toBe(true);
 for (const t of ['resize', 'orientationchange']) {
 const added = win.addEventListener.mock.calls.find((c) => c[0] === t)![1];
 expect(win.removeEventListener).toHaveBeenCalledWith(t, added);
 }
 });
});
