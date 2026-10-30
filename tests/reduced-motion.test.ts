import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine';
import type { Expression, Pose, Puppet } from '../src/types';

const puppet = {
 element: {} as HTMLElement,
 init: async () => {},
 render: (_pose: Pose, _expression: Expression) => {},
 destroy: () => {},
} as Puppet;

// Simulates one minute of idle time and returns the motions that started on their own.
function idleMotions(reducedMotion: boolean): string[] {
 const engine = new Engine(puppet, { random: () => 0, reducedMotion });
 const started: string[] = [];
 engine.on('motionstart', (e) => started.push(e.motion));
 for (let t = 0; t <= 60000; t += 16) engine.tick(t);
 return started;
}

describe('prefers-reduced-motion', () => {
 it('plays occasional idle motions by default', () => {
 expect(idleMotions(false).length).toBeGreaterThan(0);
 });

 it('plays no automatic idle motions when reduced motion is on', () => {
 expect(idleMotions(true)).toEqual([]);
 });

 it('still plays motions requested explicitly', () => {
 const engine = new Engine(puppet, { autoIdle: false, reducedMotion: true });
 engine.tick(0);
 engine.act({ motion: 'wave' });
 expect(engine.currentMotion).toBe('wave');
 });
});
