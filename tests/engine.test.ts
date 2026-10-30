import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine';
import type { Expression, Pose, Puppet } from '../src/types';

function fakePuppet() {
 const frames: { pose: Pose; expression: Expression }[] = [];
 const puppet = {
 element: {} as HTMLElement,
 init: async () => {},
 render: (pose: Pose, expression: Expression) => { frames.push({ pose, expression }); },
 destroy: () => {},
 } as Puppet;
 return { puppet, frames };
}

const make = (extra = {}) => {
 const f = fakePuppet();
 const said: string[] = [];
 const engine = new Engine(f.puppet, { autoIdle: false, random: () => 0.5, onSay: (t) => said.push(t), ...extra });
 return { ...f, engine, said };
};

describe('Engine', () => {
 it('plays a motion and emits start/end events', () => {
 const { engine } = make();
 const log: string[] = [];
 engine.on('motionstart', (e) => log.push('start:' + e.motion));
 engine.on('motionend', (e) => log.push('end:' + e.motion + (e.interrupted ? '!' : '')));
 engine.tick(0);
 engine.act({ motion: 'nod' });
 engine.tick(100);
 expect(engine.currentMotion).toBe('nod');
 engine.tick(5000);
 expect(log).toEqual(['start:nod', 'end:nod']);
 expect(engine.currentMotion).toBeNull();
 });

 it('higher priority interrupts and reports it', () => {
 const { engine } = make();
 const log: string[] = [];
 engine.on('motionend', (e) => log.push(e.motion + (e.interrupted ? '!' : '')));
 engine.act({ motion: 'sleepy', priority: 'low' });
 engine.act({ motion: 'surprised', priority: 'high' });
 expect(log).toEqual(['sleepy!']);
 expect(engine.currentMotion).toBe('surprised');
 });

 it('expression reverts to the mood expression after its duration', () => {
 const { engine, frames } = make();
 engine.setMood('happy');
 engine.tick(0);
 engine.act({ expression: 'angry', duration: 500 });
 engine.tick(100);
 expect(frames.at(-1)?.expression).toBe('angry');
 engine.tick(700);
 expect(frames.at(-1)?.expression).toBe('smile');
 });

 it('say forwards plain text to the bubble hook and opens the mouth', () => {
 const { engine, said } = make();
 engine.tick(0);
 engine.say('<b>hi</b>');
 expect(said).toEqual(['<b>hi</b>']);
 const pose = engine.tick(50);
 expect(pose.ParamMouthOpenY).toBeGreaterThan(0);
 expect(engine.tick(5000).ParamMouthOpenY).toBe(0);
 });

 it('ignores unknown motion names', () => {
 const { engine } = make();
 engine.act({ motion: 'moonwalk' as never });
 expect(engine.currentMotion).toBeNull();
 });

 it('stop clears the queue', () => {
 const { engine } = make();
 engine.act({ motion: 'wave' });
 engine.act({ motion: 'nod' });
 engine.stop();
 expect(engine.currentMotion).toBeNull();
 expect(engine.queue.pending.length).toBe(0);
 });

 it('blinks when autoIdle is on', () => {
 const f = fakePuppet();
 const engine = new Engine(f.puppet, { random: () => 0 });
 let min = 1;
 for (let t = 0; t < 6000; t += 16) min = Math.min(min, engine.tick(t).ParamEyeLOpen);
 expect(min).toBeLessThan(0.2);
 });
});
