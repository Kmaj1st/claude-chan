import type { Motion, Pose } from './types';

// Procedural motion curves. pose(t) gets t in 0..1 and returns parameter offsets
// that the engine adds on top of the idle pose. Real Live2D models use motions.json instead.

export interface MotionDef {
 durationMs: number;
 pose(t: number): Partial<Pose>;
}

const TAU = Math.PI * 2;
// 0 -> 1 -> 0 bump over t in 0..1.
const bump = (t: number): number => Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
// Trapezoid: quick ease in, hold, ease out.
const hold = (t: number, edge = 0.15): number => Math.min(1, t / edge, (1 - t) / edge);
const wave = (t: number, cycles: number): number => Math.sin(t * TAU * cycles);

export const MOTION_DEFS: Record<Motion, MotionDef> = {
 idle: { durationMs: 2400, pose: (t) => ({ ParamAngleZ: 2 * wave(t, 1), ParamHairSway: 0.3 * wave(t, 1) }) },
 wave: {
 durationMs: 2000,
 pose: (t) => ({ ParamArmRA: 1.6 * hold(t), ParamAngleZ: 4 * wave(t, 4) * hold(t), ParamMouthForm: 0.6 * hold(t) }),
 },
 nod: { durationMs: 1200, pose: (t) => ({ ParamAngleY: -14 * Math.abs(wave(t, 1.5)) * hold(t, 0.1) }) },
 shake_head: { durationMs: 1300, pose: (t) => ({ ParamAngleX: 16 * wave(t, 2.5) * hold(t, 0.1), ParamMouthForm: -0.4 * hold(t) }) },
 think: {
 durationMs: 2800,
 pose: (t) => ({ ParamAngleZ: 8 * hold(t), ParamAngleY: 8 * hold(t), ParamEyeBallX: 0.6 * hold(t), ParamEyeBallY: 0.6 * hold(t), ParamArmLA: 1.2 * hold(t), ParamBrowLY: 0.4 * hold(t) }),
 },
 happy: {
 durationMs: 2000,
 pose: (t) => ({ ParamBodyAngleZ: 4 * wave(t, 3) * hold(t), ParamMouthForm: 1 * hold(t), ParamMouthOpenY: 0.4 * hold(t), ParamCheek: 0.6 * hold(t), ParamBreath: 0.5 * hold(t) }),
 },
 surprised: {
 durationMs: 1600,
 pose: (t) => ({ ParamBodyAngleX: -6 * hold(t, 0.08), ParamAngleY: 8 * hold(t, 0.08), ParamMouthOpenY: 0.8 * hold(t, 0.08), ParamBrowLY: 0.8 * hold(t, 0.08), ParamBrowRY: 0.8 * hold(t, 0.08), ParamArmLA: 0.5 * hold(t), ParamArmRA: 0.5 * hold(t) }),
 },
 bow: { durationMs: 2200, pose: (t) => ({ ParamBodyAngleX: 14 * bump(t), ParamAngleY: -18 * bump(t), ParamEyeLOpen: -0.8 * bump(t), ParamEyeROpen: -0.8 * bump(t) }) },
 cheer: {
 durationMs: 2400,
 pose: (t) => ({ ParamArmLA: 1.8 * hold(t), ParamArmRA: 1.8 * hold(t), ParamBreath: Math.abs(wave(t, 3)) * hold(t), ParamMouthOpenY: 0.7 * hold(t), ParamMouthForm: 1 * hold(t), ParamAngleY: 6 * hold(t) }),
 },
 sleepy: {
 durationMs: 3600,
 pose: (t) => ({ ParamEyeLOpen: -0.75 * hold(t, 0.3), ParamEyeROpen: -0.75 * hold(t, 0.3), ParamAngleZ: -8 * hold(t, 0.3) + 2 * wave(t, 2), ParamAngleY: -6 * hold(t, 0.3), ParamMouthOpenY: 0.2 * bump(t) }),
 },
 typing: {
 durationMs: 2600,
 pose: (t) => ({ ParamArmLA: 0.7 * hold(t) + 0.25 * wave(t, 6), ParamArmRA: 0.7 * hold(t) + 0.25 * wave(t, 7), ParamAngleY: -8 * hold(t), ParamEyeBallY: -0.4 * hold(t) }),
 },
 tea_serve: {
 durationMs: 3000,
 pose: (t) => ({ ParamArmLA: 1.0 * hold(t, 0.2), ParamArmRA: 1.0 * hold(t, 0.2), ParamBodyAngleX: 6 * bump(t), ParamAngleY: -4 * bump(t), ParamMouthForm: 0.7 * hold(t), ParamCheek: 0.3 * hold(t) }),
 },
 pout: {
 durationMs: 2200,
 pose: (t) => ({ ParamCheek: 0.4 * hold(t), ParamMouthForm: -0.8 * hold(t), ParamBrowLY: -0.5 * hold(t), ParamBrowRY: -0.5 * hold(t), ParamAngleX: -10 * hold(t), ParamEyeBallX: -0.7 * hold(t) }),
 },
 wink: {
 durationMs: 1400,
 pose: (t) => ({ ParamEyeROpen: -1 * bump(t * 1.2), ParamMouthForm: 0.8 * hold(t), ParamAngleZ: 5 * hold(t), ParamCheek: 0.3 * hold(t) }),
 },
 point: {
 durationMs: 2000,
 pose: (t) => ({ ParamArmRA: 1.3 * hold(t, 0.2), ParamAngleX: 8 * hold(t), ParamBodyAngleX: 4 * hold(t), ParamEyeBallX: 0.5 * hold(t) }),
 },
};
