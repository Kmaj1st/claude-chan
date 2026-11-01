import { describe, expect, it, vi } from 'vitest';
import { ClaudeChanElement } from '../src/element';
import type { ClaudeChanController } from '../src/types';

// Node has no HTMLElement, so the element is a plain object here; only the forwarding is tested.
function fake() {
 const controller = {
 act: vi.fn(), say: vi.fn(), setMood: vi.fn(), lookAt: vi.fn(), stop: vi.fn(), lipSync: vi.fn(),
 } as unknown as ClaudeChanController;
 const el = new ClaudeChanElement();
 el.controller = controller;
 return { el, controller };
}

describe('<claude-chan> controller methods', () => {
 it('forwards calls to the controller', () => {
 const { el, controller } = fake();
 el.act({ motion: 'wave' });
 el.say('hi');
 el.setMood('happy');
 el.lookAt(1, 2);
 el.stop();
 el.lipSync(null);
 expect(controller.act).toHaveBeenCalledWith({ motion: 'wave' });
 expect(controller.say).toHaveBeenCalledWith('hi');
 expect(controller.setMood).toHaveBeenCalledWith('happy');
 expect(controller.lookAt).toHaveBeenCalledWith(1, 2);
 expect(controller.stop).toHaveBeenCalled();
 expect(controller.lipSync).toHaveBeenCalledWith(null);
 });

 it('setState applies the agent state mapping', () => {
 const { el, controller } = fake();
 el.setState('thinking');
 expect(controller.setMood).toHaveBeenCalledWith('thinking');
 expect(controller.act).toHaveBeenCalled();
 });

 it('is a no-op while disconnected', () => {
 const el = new ClaudeChanElement();
 expect(() => { el.say('hi'); el.stop(); el.lookAt(null); el.setState('idle'); }).not.toThrow();
 });
});
