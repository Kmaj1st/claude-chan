import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine';
import type { Pose, Puppet } from '../src/types';

const puppet = {
 element: {} as HTMLElement,
 init: async () => {},
 render: (_pose: Pose) => {},
 destroy: () => {},
} as Puppet;

const make = () => new Engine(puppet, { autoIdle: false, random: () => 0.5 });

describe('Engine edge cases', () => {
 it('ignores a non-finite lookAt target', () => {
 const e = make();
 e.lookAt(0.5, 0.2);
 e.lookAt(NaN, 0);
 e.lookAt(0, Infinity);
 const p = e.tick(0);
 expect(p.ParamEyeBallX).toBe(0.5);
 expect(p.ParamEyeBallY).toBe(0.2);
 });

 it('clamps lookAt to -1..1 and releases on null', () => {
 const e = make();
 e.lookAt(5, -5);
 const p = e.tick(0);
 expect(p.ParamEyeBallX).toBe(1);
 expect(p.ParamEyeBallY).toBe(-1);
 e.lookAt(null);
 expect(e.tick(10).ParamEyeBallX).toBe(0);
 });

 it('treats a NaN audio level as silence', () => {
 const e = make();
 e.setAudioLevel(() => NaN);
 expect(e.tick(0).ParamMouthOpenY).toBe(0);
 });

 it('clamps the audio level to 1', () => {
 const e = make();
 e.setAudioLevel(() => 5);
 expect(e.tick(0).ParamMouthOpenY).toBe(1);
 });
});
