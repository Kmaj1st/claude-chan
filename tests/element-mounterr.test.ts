import { afterEach, describe, expect, it, vi } from 'vitest';

const mount = vi.fn();
vi.mock('../src/mount', () => ({ mount: (...a: unknown[]) => mount(...a) }));

import { ClaudeChanElement } from '../src/element';

// Node has no DOM, so the element is a plain object with just the DOM bits it uses stubbed.
function make() {
 const el = new ClaudeChanElement() as any;
 el.style = {};
 el.getAttribute = () => null;
 el.dispatchEvent = vi.fn();
 return el;
}

describe('<claude-chan> mount failure', () => {
 afterEach(() => {
 vi.unstubAllGlobals();
 mount.mockReset();
 });

 it('dispatches an error event instead of throwing and allows a later remount', () => {
 vi.stubGlobal('CustomEvent', class { constructor(public type: string, public init: { detail: unknown }) {} });
 const el = make();
 const cause = new Error('no model');
 mount.mockImplementationOnce(() => { throw cause; });
 expect(() => el.connectedCallback()).not.toThrow();
 expect(el.controller).toBeNull();
 const ev = el.dispatchEvent.mock.calls[0][0];
 expect(ev.type).toBe('error');
 expect(ev.init.detail).toEqual({ message: 'mount failed', cause });

 const controller = { on: vi.fn(), destroy: vi.fn() };
 mount.mockReturnValueOnce(controller);
 el.connectedCallback();
 expect(el.controller).toBe(controller);
 });

 it('queues a remount on attribute change after a failed mount', async () => {
 vi.stubGlobal('CustomEvent', class { constructor(public type: string, public init: { detail: unknown }) {} });
 const el = make();
 el.isConnected = true;
 mount.mockImplementationOnce(() => { throw new Error('x'); });
 el.connectedCallback();
 const controller = { on: vi.fn(), destroy: vi.fn() };
 mount.mockReturnValueOnce(controller);
 el.attributeChangedCallback();
 await Promise.resolve();
 expect(el.controller).toBe(controller);
 });
});

describe('<claude-chan> empty attributes', () => {
 afterEach(() => {
 mount.mockReset();
 });

 it('treats empty model/sprites attributes as unset', () => {
 const el = make();
 el.getAttribute = (n: string) => (n === 'model' || n === 'sprites' ? '' : null);
 mount.mockReturnValueOnce({ on: vi.fn(), destroy: vi.fn() });
 el.connectedCallback();
 const opts = (mount.mock.calls[0] as any[])[1];
 expect(opts.model).toBeUndefined();
 expect(opts.sprites).toBeUndefined();
 });

 it('passes non-empty model/sprites attributes through', () => {
 const el = make();
 el.getAttribute = (n: string) => (n === 'model' ? 'm.json' : n === 'sprites' ? '/s' : null);
 mount.mockReturnValueOnce({ on: vi.fn(), destroy: vi.fn() });
 el.connectedCallback();
 const opts = (mount.mock.calls[0] as any[])[1];
 expect(opts.model).toBe('m.json');
 expect(opts.sprites).toBe('/s');
 });
});
