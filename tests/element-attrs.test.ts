import { afterEach, describe, expect, it, vi } from 'vitest';

const mount = vi.fn();
vi.mock('../src/mount', () => ({ mount: (...a: unknown[]) => mount(...a) }));

import { ClaudeChanElement } from '../src/element';

function ctrl() {
 return { on: vi.fn(), destroy: vi.fn(), say: vi.fn(), act: vi.fn(), setMood: vi.fn(), lookAt: vi.fn(), stop: vi.fn(), lipSync: vi.fn() };
}

function make(attrs: Record<string, string> = {}) {
 const el = new ClaudeChanElement() as any;
 el.style = {};
 el.isConnected = true;
 el.getAttribute = (n: string) => (n in attrs ? attrs[n] : null);
 el.dispatchEvent = vi.fn();
 return el;
}

const optsOf = (i = 0) => (mount.mock.calls[i] as any[])[1];

describe('<claude-chan> attribute parsing', () => {
 afterEach(() => mount.mockReset());

 it('uses defaults when no attributes are set', () => {
 mount.mockReturnValueOnce(ctrl());
 const el = make();
 el.connectedCallback();
 expect(el.style.display).toBe('contents');
 expect(optsOf()).toMatchObject({
 renderer: undefined,
 position: 'bottom-left',
 size: 220,
 draggable: true,
 storageKey: 'claude-chan:position',
 });
 });

 it('passes valid attributes through', () => {
 mount.mockReturnValueOnce(ctrl());
 make({ renderer: 'sprite', position: 'top-right', size: '300', draggable: 'false', 'storage-key': 'k' }).connectedCallback();
 expect(optsOf()).toMatchObject({ renderer: 'sprite', position: 'top-right', size: 300, draggable: false, storageKey: 'k' });
 });

 it('passes core-url and model through, and observes core-url', () => {
 mount.mockReturnValueOnce(ctrl());
 make({ model: '/m/model3.json', 'core-url': '/core.js' }).connectedCallback();
 expect(optsOf()).toMatchObject({ model: '/m/model3.json', coreUrl: '/core.js' });
 expect(ClaudeChanElement.observedAttributes).toContain('core-url');
 });

 it('parses the expressions attribute as a JSON map and ignores bad input', () => {
 mount.mockReturnValue(ctrl());
 make({ expressions: '{"smile":"f01","sad":3,"angry":""}' }).connectedCallback();
 expect(optsOf(0).expressions).toEqual({ smile: 'f01' });
 make({ expressions: 'not json' }).connectedCallback();
 expect(optsOf(1).expressions).toBeUndefined();
 make({ expressions: '["a"]' }).connectedCallback();
 expect(optsOf(2).expressions).toBeUndefined();
 make().connectedCallback();
 expect(optsOf(3).expressions).toBeUndefined();
 expect(ClaudeChanElement.observedAttributes).toContain('expressions');
 });

 it('storage-key="false" disables persistence', () => {
 mount.mockReturnValueOnce(ctrl());
 make({ 'storage-key': 'false' }).connectedCallback();
 expect(optsOf().storageKey).toBe(false);
 });

 it('keeps an empty storage-key (disables persistence key) instead of the default', () => {
 mount.mockReturnValueOnce(ctrl());
 make({ 'storage-key': '' }).connectedCallback();
 expect(optsOf().storageKey).toBe('');
 });

 it.each([['abc'], ['59'], ['1001'], ['']])('falls back to size 220 for %j', (size) => {
 mount.mockReturnValueOnce(ctrl());
 make({ size }).connectedCallback();
 expect(optsOf().size).toBe(220);
 });

 it('accepts the size bounds 60 and 1000', () => {
 mount.mockReturnValue(ctrl());
 make({ size: '60' }).connectedCallback();
 make({ size: '1000' }).connectedCallback();
 expect(optsOf(0).size).toBe(60);
 expect(optsOf(1).size).toBe(1000);
 });

 it('ignores an unknown position and renderer', () => {
 mount.mockReturnValueOnce(ctrl());
 make({ position: 'middle', renderer: 'foo' }).connectedCallback();
 expect(optsOf().position).toBe('bottom-left');
 expect(optsOf().renderer).toBeUndefined();
 });

 it('does not mount twice when already connected', () => {
 mount.mockReturnValue(ctrl());
 const el = make();
 el.connectedCallback();
 el.connectedCallback();
 expect(mount).toHaveBeenCalledTimes(1);
 });
});

describe('<claude-chan> lifecycle', () => {
 afterEach(() => mount.mockReset());

 it('batches several attribute changes into one remount', async () => {
 const first = ctrl();
 const second = ctrl();
 mount.mockReturnValueOnce(first).mockReturnValueOnce(second);
 const el = make();
 el.connectedCallback();
 el.attributeChangedCallback();
 el.attributeChangedCallback();
 el.attributeChangedCallback();
 await Promise.resolve();
 expect(first.destroy).toHaveBeenCalledTimes(1);
 expect(mount).toHaveBeenCalledTimes(2);
 expect(el.controller).toBe(second);
 });

 it('does not remount an element that was disconnected meanwhile', async () => {
 const first = ctrl();
 mount.mockReturnValue(first);
 const el = make();
 el.connectedCallback();
 el.attributeChangedCallback();
 el.isConnected = false;
 await Promise.resolve();
 expect(mount).toHaveBeenCalledTimes(1);
 });

 it('ignores attribute changes before the first connect', async () => {
 const el = make();
 el.attributeChangedCallback();
 await Promise.resolve();
 expect(mount).not.toHaveBeenCalled();
 });

 it('forwards methods to the controller and becomes a no-op after disconnect', () => {
 const c = ctrl();
 mount.mockReturnValueOnce(c);
 const el = make();
 el.connectedCallback();
 el.say('hi');
 el.setMood('happy');
 el.lookAt(1, 2);
 el.stop();
 expect(c.say).toHaveBeenCalledWith('hi');
 expect(c.setMood).toHaveBeenCalledWith('happy');
 expect(c.lookAt).toHaveBeenCalledWith(1, 2);
 expect(c.stop).toHaveBeenCalled();

 el.disconnectedCallback();
 expect(c.destroy).toHaveBeenCalledTimes(1);
 expect(el.controller).toBeNull();
 expect(() => { el.say('x'); el.stop(); el.lipSync(null); }).not.toThrow();
 expect(c.say).toHaveBeenCalledTimes(1);
 });
});
