import type { Expression, Motion, Pose, Puppet } from '../types';
import { SpriteDirector } from './director';
import { placePose, validateMotionMap, validatePoseSet, type MotionMap, type PoseSet } from './manifest';

// Sprite renderer: flat pose images (no rig) shown by a SpriteDirector, with breathing, sway,
// look-at parallax and cross-fades. Images load lazily per pose; idle and its blink frame load first.
// The character box has a fixed size, so loading or swapping poses never shifts the page layout.

export interface SpriteOptions {
 // Folder URL that holds poses.json, motions.json and the image files.
 baseUrl: string;
 reducedMotion?: boolean;
 // Test hook: replaces fetch() for the two JSON files.
 fetchJson?: (url: string) => Promise<unknown>;
 // Test hook: replaces image loading (resolves when the image is usable).
 loadImage?: (url: string) => Promise<HTMLImageElement>;
 // Maps a pose file name to its URL (default: baseUrl + '/' + file). The inline hot-load build returns data: URIs.
 resolveFile?: (file: string) => string;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

// Minimum wait before a pose image that failed to load is requested again.
const RETRY_AFTER_MS = 5000;

async function defaultFetchJson(url: string): Promise<unknown> {
 const res = await fetch(url);
 if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
 return res.json() as Promise<unknown>;
}

function defaultLoadImage(url: string): Promise<HTMLImageElement> {
 return new Promise((resolve, reject) => {
 const img = document.createElement('img');
 img.alt = '';
 img.draggable = false;
 img.decoding = 'async';
 img.onload = () => resolve(img);
 img.onerror = () => reject(new Error('claude-chan: sprite failed to load: ' + url));
 img.src = url;
 });
}

// Whole-sheet transform from the shared pose: breathing, sway, look-at parallax, nod and bow dip.
// Percentages are of the character box, so the motion scales with the size option.
export function sheetTransform(pose: Pose, reduced: boolean): string {
 const k = reduced ? 0.3 : 1;
 const rot = clamp(pose.ParamAngleZ * 0.25 + pose.ParamBodyAngleZ * 0.4 + pose.ParamHairSway * 0.5, -8, 8) * k;
 const tx = (pose.ParamAngleX * 0.12 + pose.ParamBodyAngleX * 0.15 + pose.ParamEyeBallX * 0.8) * k;
 const ty = (-pose.ParamBreath * 0.5 - pose.ParamAngleY * 0.18 - pose.ParamEyeBallY * 0.6) * k;
 const scale = 1 + (reduced ? 0 : pose.ParamBreath * 0.012);
 return 'translate(' + tx.toFixed(2) + '%,' + ty.toFixed(2) + '%) rotate(' + rot.toFixed(2) + 'deg) scale(' + scale.toFixed(4) + ')';
}

export class SpritePuppet implements Puppet {
 readonly element: HTMLElement;
 private sheet: HTMLElement;
 private base: string;
 private set!: PoseSet;
 private director!: SpriteDirector;
 private images = new Map<string, HTMLImageElement>();
 private loading = new Map<string, Promise<void>>();
 private ready = new Set<string>();
 private failedAt = new Map<string, number>();
 private applied = new Map<string, string>();
 private destroyed = false;
 private reduced: boolean;

 constructor(private opts: SpriteOptions) {
 this.base = opts.baseUrl.replace(/[/]+$/, '');
 this.reduced = opts.reducedMotion ?? false;
 this.element = document.createElement('div');
 this.element.style.cssText = 'position:relative;width:100%;height:100%;';
 this.sheet = document.createElement('div');
 // Clip only at the bottom edge (busts are cut at the waist); hair and arms may reach beyond the other sides.
 this.sheet.style.cssText = 'position:absolute;inset:0;transform-origin:50% 100%;will-change:transform;pointer-events:none;clip-path:inset(-100% -100% 0 -100%);';
 this.element.appendChild(this.sheet);
 }

 async init(): Promise<void> {
 const fetchJson = this.opts.fetchJson ?? defaultFetchJson;
 const [rawPoses, rawMap] = await Promise.all([fetchJson(this.base + '/poses.json'), fetchJson(this.base + '/motions.json')]);
 const poses = validatePoseSet(rawPoses);
 if (!poses.ok) throw new Error('claude-chan: invalid poses.json: ' + poses.errors.join('; '));
 const map = validateMotionMap(rawMap, poses.value);
 if (!map.ok) throw new Error('claude-chan: invalid motions.json: ' + map.errors.join('; '));
 this.set = poses.value;
 this.map = map.value;
 this.director = new SpriteDirector(this.set, this.map, { reducedMotion: this.reduced });
 // Only idle (and its blink frame) is needed before the first frame.
 const idle = this.map.expressions.neutral;
 const first = [idle];
 const blink = this.set.poses[idle]?.blink;
 if (blink) first.push(blink);
 await Promise.all(first.map((id) => this.ensure(id)));
 }

 private map!: MotionMap;

 // Starts loading a pose image once; resolves when it can be shown. A failed load is retried at most every RETRY_AFTER_MS.
 private ensure(id: string): Promise<void> {
 const have = this.loading.get(id);
 if (have) return have;
 const failed = this.failedAt.get(id);
 if (failed !== undefined && performance.now() - failed < RETRY_AFTER_MS) return Promise.reject(new Error('claude-chan: pose load failed recently ' + id));
 const def = this.set.poses[id];
 if (!def) return Promise.reject(new Error('claude-chan: unknown pose ' + id));
 const load = this.opts.loadImage ?? defaultLoadImage;
 const p = load(this.opts.resolveFile ? this.opts.resolveFile(def.file) : this.base + '/' + def.file).then((img) => {
 if (this.destroyed) return;
 const pl = placePose(def, this.set.ref);
 img.style.cssText =
 'position:absolute;pointer-events:none;user-select:none;opacity:0;' +
 'left:' + pl.left.toFixed(3) + '%;top:' + pl.top.toFixed(3) + '%;width:' + pl.width.toFixed(3) + '%;height:' + pl.height.toFixed(3) + '%;';
 this.images.set(id, img);
 this.sheet.appendChild(img);
 this.ready.add(id);
 });
 // A failed lazy load must not stay cached forever, so a later request can retry.
 p.catch(() => {
 this.loading.delete(id);
 this.failedAt.set(id, performance.now());
 });
 this.loading.set(id, p);
 return p;
 }

 setMotion(motion: Motion | null, durationMs: number): void {
 if (!this.director) return;
 this.director.setMotion(motion, durationMs);
 if (motion) for (const id of this.director.posesFor(motion)) this.ensure(id).catch(() => undefined);
 }

 render(pose: Pose, expression: Expression, nowMs: number = performance.now()): void {
 if (!this.director || this.destroyed) return;
 const eyes = Math.min(pose.ParamEyeLOpen, pose.ParamEyeROpen);
 const frame = this.director.update(nowMs, expression, eyes, pose.ParamMouthOpenY, (id) => this.ready.has(id));
 for (const id of frame.need) this.ensure(id).catch(() => undefined);
 const live = new Map(frame.layers.map((l) => [l.pose, l]));
 for (const [id, img] of this.images) {
 const l = live.get(id);
 const opacity = l ? l.opacity.toFixed(3) : '0';
 const shift = l && l.dx !== 0 ? 'translateX(' + l.dx.toFixed(2) + '%)' : '';
 const key = opacity + '|' + shift + '|' + (l ? frame.layers.indexOf(l) : -1);
 if (this.applied.get(id) === key) continue;
 this.applied.set(id, key);
 img.style.opacity = opacity;
 img.style.transform = shift;
 img.style.zIndex = l ? String(frame.layers.indexOf(l) + 1) : '0';
 }
 this.sheet.style.transform = sheetTransform(pose, this.reduced);
 }

 destroy(): void {
 this.destroyed = true;
 this.sheet.replaceChildren();
 this.images.clear();
 this.ready.clear();
 this.loading.clear();
 this.applied.clear();
 }
}
