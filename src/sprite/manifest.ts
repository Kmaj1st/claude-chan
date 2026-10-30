import { EXPRESSIONS, MOTIONS, type Expression, type Motion } from '../types';

// Sprite pose set: poses.json (images) and motions.json (which pose each motion or expression shows).
// Any set that follows these shapes can be dropped into a folder and passed as the sprites option.

export interface PoseRef {
 // Reference box every pose is placed in (px units of the manifest, not screen px).
 w: number;
 h: number;
 // Face box height the images were normalised to; informational.
 faceH: number;
 // Where the face centre of every pose sits, measured from the top of the box.
 faceY: number;
 // Optional scale of all poses around the bottom centre of the box (default 1). Below 1 keeps wide poses inside the box.
 zoom?: number;
}

export interface PoseDef {
 file: string;
 w: number;
 h: number;
 // Face centre inside the image (px of the image). Poses are aligned on this point.
 anchor: [number, number];
 tags?: string[];
 // Pose shown while the eyes are closed (blink frame of the same pose).
 blink?: string;
 // Pose swapped in while talking (mouth-open stand-in).
 talk?: string;
}

export interface PoseSet {
 version: 1;
 ref: PoseRef;
 poses: Record<string, PoseDef>;
}

export type TransitionKind = 'fade' | 'slide' | 'cut';

export interface Step {
 // Position in the motion, 0..1 of its duration.
 at: number;
 // Pose id, or "$expression" for the pose of the current expression.
 pose: string;
 transition?: TransitionKind;
 ms?: number;
}

export interface MotionMap {
 version: 1;
 // Expression -> pose id.
 expressions: Record<Expression, string>;
 // Motion -> pose sequence. A motion without steps keeps showing the expression pose.
 motions: Record<Motion, { steps?: Step[] }>;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const EXPRESSION_TOKEN = '$expression';

export function validatePoseSet(raw: unknown): Checked<PoseSet> {
 const errors: string[] = [];
 if (!isObj(raw)) return { ok: false, errors: ['poses.json: not an object'] };
 if (raw.version !== 1) errors.push('poses.json: version must be 1');
 const ref = raw.ref;
 if (!isObj(ref) || !num(ref.w) || !num(ref.h) || !num(ref.faceH) || !num(ref.faceY) || ref.w <= 0 || ref.h <= 0) {
 errors.push('poses.json: ref needs positive numbers w, h, faceH and faceY');
 }
 if (isObj(ref) && ref.zoom !== undefined && (!num(ref.zoom) || ref.zoom <= 0 || ref.zoom > 2)) errors.push('poses.json: ref.zoom must be in (0, 2]');
 const poses = raw.poses;
 if (!isObj(poses) || Object.keys(poses).length === 0) {
 errors.push('poses.json: poses must be a non-empty object');
 return { ok: false, errors };
 }
 const files = new Set<string>();
 for (const [id, p] of Object.entries(poses)) {
 const at = 'poses.' + id;
 if (!isObj(p)) { errors.push(at + ': not an object'); continue; }
 if (typeof p.file !== 'string' || !/^[\w.-]+$/.test(p.file)) errors.push(at + ': file must be a plain file name');
 else if (files.has(p.file)) errors.push(at + ': file ' + p.file + ' is used twice');
 else files.add(p.file);
 if (!num(p.w) || !num(p.h) || p.w <= 0 || p.h <= 0) errors.push(at + ': w and h must be positive numbers');
 const a = p.anchor;
 if (!Array.isArray(a) || a.length !== 2 || !num(a[0]) || !num(a[1])) errors.push(at + ': anchor must be [x, y]');
 else if (num(p.w) && num(p.h) && (a[0] < 0 || a[0] > p.w || a[1] < 0 || a[1] > p.h)) errors.push(at + ': anchor lies outside the image');
 if (p.tags !== undefined && (!Array.isArray(p.tags) || p.tags.some((t) => typeof t !== 'string'))) errors.push(at + ': tags must be strings');
 for (const key of ['blink', 'talk'] as const) {
 const target = p[key];
 if (target === undefined) continue;
 if (typeof target !== 'string' || !(target in poses)) errors.push(at + ': ' + key + ' refers to an unknown pose');
 else if (target === id) errors.push(at + ': ' + key + ' refers to itself');
 }
 }
 return errors.length ? { ok: false, errors } : { ok: true, value: raw as unknown as PoseSet };
}

export function validateMotionMap(raw: unknown, set: PoseSet): Checked<MotionMap> {
 const errors: string[] = [];
 if (!isObj(raw)) return { ok: false, errors: ['motions.json: not an object'] };
 if (raw.version !== 1) errors.push('motions.json: version must be 1');
 const known = (id: unknown): boolean => typeof id === 'string' && id in set.poses;
 const ex = raw.expressions;
 if (!isObj(ex)) errors.push('motions.json: expressions must be an object');
 else {
 for (const name of EXPRESSIONS) {
 if (!known(ex[name])) errors.push('motions.json: expression ' + name + ' needs a known pose id');
 }
 }
 const mo = raw.motions;
 if (!isObj(mo)) errors.push('motions.json: motions must be an object');
 else {
 for (const name of MOTIONS) {
 const m = mo[name];
 if (!isObj(m)) { errors.push('motions.json: motion ' + name + ' is missing'); continue; }
 if (m.steps === undefined) continue;
 const steps = m.steps;
 if (!Array.isArray(steps) || steps.length === 0) { errors.push('motions.' + name + ': steps must be a non-empty array'); continue; }
 let prev = -1;
 steps.forEach((s: unknown, i: number) => {
 const at = 'motions.' + name + '.steps[' + i + ']';
 if (!isObj(s)) { errors.push(at + ': not an object'); return; }
 if (!num(s.at) || s.at < 0 || s.at >= 1) errors.push(at + ': at must be in 0..1 (1 excluded)');
 else if (s.at <= prev) errors.push(at + ': at must increase');
 else prev = s.at;
 if (i === 0 && s.at !== 0) errors.push(at + ': the first step must start at 0');
 if (s.pose !== EXPRESSION_TOKEN && !known(s.pose)) errors.push(at + ': unknown pose ' + String(s.pose));
 if (s.transition !== undefined && s.transition !== 'fade' && s.transition !== 'slide' && s.transition !== 'cut') errors.push(at + ': transition must be fade, slide or cut');
 if (s.ms !== undefined && (!num(s.ms) || s.ms < 0 || s.ms > 5000)) errors.push(at + ': ms must be 0..5000');
 });
 }
 }
 return errors.length ? { ok: false, errors } : { ok: true, value: raw as unknown as MotionMap };
}

// Placement of a pose image inside the reference box, as CSS percentages of that box.
export interface Placement { left: number; top: number; width: number; height: number }

export function placePose(def: PoseDef, ref: PoseRef): Placement {
 const z = ref.zoom ?? 1;
 let top = ref.faceY - def.anchor[1];
 // Busts are cut at the waist: never leave a gap under the character.
 if (top + def.h < ref.h) top = ref.h - def.h;
 const left = ref.w / 2 - def.anchor[0];
 // Zoom about the bottom centre of the box, so the bottom edge stays covered.
 const zl = ref.w / 2 + (left - ref.w / 2) * z;
 const zt = ref.h + (top - ref.h) * z;
 return { left: (zl / ref.w) * 100, top: (zt / ref.h) * 100, width: (def.w * z / ref.w) * 100, height: (def.h * z / ref.h) * 100 };
}
