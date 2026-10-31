import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShell } from '../src/host';

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
 offsetWidth = 0;
 offsetHeight = 0;
 removed = false;
 setPointerCapture = vi.fn();
 constructor(public tag: string) {}
 attachShadow() { return new El('#root'); }
 append(...c: El[]) { this.children.push(...c); }
 appendChild(c: El) { this.children.push(c); return c; }
 setAttribute(k: string, v: string) { this.attrs[k] = v; }
 addEventListener(t: string, f: (e: any) => void) { (this.listeners[t] ??= []).push(f); }
 getBoundingClientRect() { return this.rect; }
 remove() { this.removed = true; }
 fire(t: string, e: any) { (this.listeners[t] ?? []).forEach((f) => f(e)); }
}

let stage: El;
let bubble: El;
const win = { innerWidth: 1000, innerHeight: 800, addEventListener: vi.fn(), removeEventListener: vi.fn() };
const store = { getItem: vi.fn(), setItem: vi.fn() };

function make(o: Partial<Parameters<typeof createShell>[1]> = {}) {
 const parent = new El('body');
 const sh = createShell(parent as any, { position: 'bottom-left', size: 300, draggable: true, storageKey: 'k', ...o });
 stage = sh.stage as any;
 bubble = stage.children[0]!;
 return { sh, host: sh.host as any as El, parent };
}

const ev = (x: number, y: number, extra = {}) => ({ button: 0, pointerId: 1, clientX: x, clientY: y, ...extra });

describe('createShell', () => {
 beforeEach(() => {
 vi.useFakeTimers();
 vi.stubGlobal('document', { createElement: (t: string) => new El(t) });
 vi.stubGlobal('window', win);
 vi.stubGlobal('localStorage', store);
 store.getItem.mockReset().mockReturnValue(null);
 store.setItem.mockReset();
 win.addEventListener.mockReset();
 win.removeEventListener.mockReset();
 });
 afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

 it('sizes the stage and sets corner variables', () => {
 const { host, parent } = make({ zIndex: 5, storageKey: false });
 expect(parent.children).toContain(host);
 expect(stage.style.height).toBe('300px');
 expect(stage.style.width).toBe('200px');
 expect(host.props['--claude-chan-left']).toBe('16px');
 expect(host.props['--claude-chan-bottom']).toBe('16px');
 expect(host.props['--claude-chan-top']).toBe('auto');
 expect(host.props['--claude-chan-z']).toBe('5');
 expect(bubble.attrs['aria-live']).toBe('polite');
 });

 it('drags, clamps to the viewport and saves on release', () => {
 const { host } = make();
 stage.fire('pointerdown', ev(50, 60));
 expect(stage.classes.has('dragging')).toBe(true);
 stage.fire('pointermove', ev(140, 240));
 expect(host.props['--claude-chan-left']).toBe('100px');
 expect(host.props['--claude-chan-top']).toBe('200px');
 stage.fire('pointermove', ev(-500, 5000));
 expect(host.props['--claude-chan-left']).toBe('0px');
 expect(host.props['--claude-chan-top']).toBe('500px');
 stage.fire('pointerup', ev(0, 0));
 expect(stage.classes.has('dragging')).toBe(false);
 expect(store.setItem).toHaveBeenCalledWith('k', JSON.stringify({ x: 0, y: 500 }));
 });

 it('ignores non-primary buttons and other pointers', () => {
 make();
 stage.fire('pointerdown', ev(50, 60, { button: 2 }));
 expect(stage.classes.has('dragging')).toBe(false);
 stage.fire('pointerdown', ev(50, 60));
 stage.fire('pointerup', ev(0, 0, { pointerId: 9 }));
 expect(stage.classes.has('dragging')).toBe(true);
 });

 it('does not drag when draggable is false', () => {
 make({ draggable: false });
 stage.fire('pointerdown', ev(50, 60));
 expect(stage.classes.has('dragging')).toBe(false);
 });

 it('restores a saved position and ignores corrupt storage', () => {
 store.getItem.mockReturnValue('{"x":30,"y":40}');
 expect(make().host.props['--claude-chan-top']).toBe('40px');
 store.getItem.mockReturnValue('not json');
 expect(make().host.props['--claude-chan-top']).toBe('auto');
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

 it('destroy removes the host and the resize listener', () => {
 const { sh, host } = make();
 sh.destroy();
 expect(host.removed).toBe(true);
 expect(win.removeEventListener).toHaveBeenCalledWith('resize', win.addEventListener.mock.calls[0]![1]);
 });
});
