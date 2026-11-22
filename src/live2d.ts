import { PARAMS, type Expression, type Live2DRuntimeUrls, type Motion, type Pose, type Puppet } from './types';

// Live2D Cubism 4/5 renderer (pixi-live2d-display 0.4.0 on pixi.js 6.5.10). Loaded lazily, only when the Live2D
// renderer is chosen, so sprite/simplified users download nothing extra. See docs/LIVE2D.md.
// The proprietary Cubism Core is NOT bundled: it loads at runtime from coreUrl (default: the official Live2D CDN).

// Official Live2D CDN for the Cubism Core (Live2D Proprietary Software License; never commit this file).
export const CUBISM_CORE_CDN = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js';
// Pinned UMD builds for script-tag loading (hot-load, which cannot use import()). Exact versions, keep in step
// with package.json devDependencies.
export const LIVE2D_RUNTIME_CDN = {
 pixi: 'https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js',
 live2d: 'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js',
} as const;

export type { Live2DRuntimeUrls };

export interface Live2DOptions {
 model: string;
 // URL of the Cubism Core script; default CUBISM_CORE_CDN.
 coreUrl?: string;
 // Load pixi.js + pixi-live2d-display as UMD script tags from these URLs instead of import() (hot-load build).
 runtime?: Live2DRuntimeUrls;
 // Parsed motions.json; expressions map preset name -> model expression id.
 map?: { expressions?: Record<string, string>; motions?: Record<string, { group: string; index: number }>; wholeBody?: boolean };
 // prefers-reduced-motion: the whole-body stand-in (see wholeBodyTransform) moves at 30% and does not breathe.
 reducedMotion?: boolean;
}

const DEFAULT_CORE = CUBISM_CORE_CDN;

// One in-flight load per URL, so several puppets do not add duplicate script tags.
const pendingScripts = new Map<string, Promise<void>>();

type W = Record<string, unknown> & { Live2DCubismCore?: unknown; PIXI?: { live2d?: unknown; VERSION?: string }; define?: unknown };

// present(): true when the script's global already exists (default: the Cubism Core).
export function loadScript(src: string, present: () => boolean = () => !!(window as unknown as W).Live2DCubismCore,
 what = 'Cubism Core'): Promise<void> {
 if (present()) return Promise.resolve();
 const existing = pendingScripts.get(src);
 if (existing) return existing;
 const p = new Promise<void>((resolve, reject) => {
 const s = document.createElement('script');
 s.src = src;
 s.onload = () => resolve();
 s.onerror = () => {
 s.remove();
 reject(new Error('Cannot load ' + what + ' from ' + src));
 };
 document.head.appendChild(s);
 });
 // A failed load is not cached, so a later retry can succeed.
 p.catch(() => pendingScripts.delete(src));
 pendingScripts.set(src, p);
 return p;
}

type Runtime = { PIXI: typeof import('pixi.js'); Live2DModel: typeof import('pixi-live2d-display/cubism4').Live2DModel };

// UMD path: pixi.min.js sets window.PIXI, cubism4.min.js adds PIXI.live2d. A page AMD loader (RequireJS, Monaco)
// would swallow both into define(), so window.define is hidden while they run.
export async function loadRuntimeScripts(urls: Live2DRuntimeUrls): Promise<Runtime> {
 const w = window as unknown as W;
 const amd = w.define;
 const hideAmd = typeof amd === 'function' && (amd as { amd?: unknown }).amd;
 if (hideAmd) w.define = undefined;
 try {
 await loadScript(urls.pixi, () => typeof w.PIXI?.VERSION === 'string' && w.PIXI.VERSION.startsWith('6.'), 'pixi.js');
 await loadScript(urls.live2d, () => !!w.PIXI?.live2d, 'pixi-live2d-display');
 } finally {
 if (hideAmd) w.define = amd;
 }
 const PIXI = w.PIXI as unknown as Runtime['PIXI'] & { live2d?: { Live2DModel?: Runtime['Live2DModel'] } };
 const Live2DModel = PIXI?.live2d?.Live2DModel;
 if (!Live2DModel) throw new Error('pixi-live2d-display did not register PIXI.live2d (wrong pixi.js version on the page?)');
 return { PIXI, Live2DModel };
}

async function loadRuntimeModules(): Promise<Runtime> {
 const PIXI = await import('pixi.js');
 // pixi-live2d-display registers its ticker through the global PIXI.
 (window as unknown as { PIXI: unknown }).PIXI = PIXI;
 const { Live2DModel } = await import('pixi-live2d-display/cubism4');
 return { PIXI, Live2DModel };
}

// Finds the model's own motion group for a preset name: exact, then case-insensitive, then the Cubism
// sample convention ('Idle' for idle, 'TapBody' for wave/happy). null when the model has no such group.
export function resolveGroup(groups: readonly string[], name: string): string | null {
 if (groups.includes(name)) return name;
 const lower = name.toLowerCase().replace(/_/g, '');
 const hit = groups.find((g) => g.toLowerCase().replace(/[_\s]/g, '') === lower);
 if (hit) return hit;
 const conv: Record<string, string> = { idle: 'idle', wave: 'tapbody', happy: 'tapbody', cheer: 'tapbody' };
 const c = conv[lower];
 return c ? groups.find((g) => g.toLowerCase() === c) ?? null : null;
}

// Render at the device pixel ratio (capped at 2) so the model is crisp on HiDPI screens; CSS size stays 100%.
export function deviceScale(): number {
 const r = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
 return typeof r === 'number' && r >= 1 ? Math.min(r, 2) : 1;
}

type CoreModel = { setParameterValueById(id: string, v: number): void; getParameterValueById?(id: string): number };

// Whole-body stand-in for a model whose moc has no body deformers (the sprite-based model, docs/ART-PIPELINE.md
// section 11): its motions animate ParamAngle*, ParamBodyAngle* and ParamBreath, but nothing is bound to them, so the
// canvas stays still. With "wholeBody": true in motions.json the renderer moves the model as one piece from those same
// parameters, with the coefficients of the sprite renderer (sprite/renderer.ts sheetTransform), so Live2D never looks
// stiffer than the sprites. Remove the flag once the moc has real deformers, or the motion is applied twice.
export const WHOLE_BODY_PARAMS = ['ParamAngleX', 'ParamAngleY', 'ParamAngleZ', 'ParamBodyAngleX', 'ParamBodyAngleZ', 'ParamBreath'] as const;
// The model is drawn this much smaller so the sway (up to 8 degrees about the feet) stays inside the canvas.
export const WHOLE_BODY_FIT = 0.92;
export type WholeBodyTransform = { rotation: number; dx: number; dy: number; scale: number };

/** rotation in degrees about the feet, dx/dy as fractions of the character box, scale as a factor. */
export function wholeBodyTransform(v: Record<(typeof WHOLE_BODY_PARAMS)[number], number>, reduced: boolean): WholeBodyTransform {
 const k = reduced ? 0.3 : 1;
 const n = (x: number): number => (Number.isFinite(x) ? x : 0);
 return {
  rotation: Math.max(-8, Math.min(8, n(v.ParamAngleZ) * 0.25 + n(v.ParamBodyAngleZ) * 0.4)) * k,
  dx: (n(v.ParamAngleX) * 0.12 + n(v.ParamBodyAngleX) * 0.15) * k / 100,
  dy: (-n(v.ParamBreath) * 0.5 - n(v.ParamAngleY) * 0.18) * k / 100,
  scale: 1 + (reduced ? 0 : n(v.ParamBreath) * 0.012),
 };
}

export const LOAD_TIMEOUT_MS = 20000;

export function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
 return new Promise<T>((resolve, reject) => {
 const t = setTimeout(() => reject(new Error(what + ' did not load within ' + ms + ' ms')), ms);
 p.then((v) => { clearTimeout(t); resolve(v); }, (e: unknown) => { clearTimeout(t); reject(e); });
 });
}

// While an authored model motion plays, only these shared params are written each frame (gaze, blink, lip-sync),
// so the motion's own head/body animation stays visible.
const DURING_MOTION: ReadonlySet<string> = new Set(['ParamEyeLOpen', 'ParamEyeROpen', 'ParamEyeBallX', 'ParamEyeBallY', 'ParamMouthOpenY']);

export class Live2DPuppet implements Puppet {
 readonly kind = 'live2d' as const;
 readonly element = document.createElement('div');
 private app: import('pixi.js').Application | null = null;
 private pose: Pose | null = null;
 private lastExpression: Expression | null = null;
 private destroyed = false;
 private model: import('pixi-live2d-display/cubism4').Live2DModel | null = null;

 constructor(private readonly opts: Live2DOptions) {
 this.element.style.cssText = 'width:100%;height:100%';
 }

 async init(): Promise<void> {
 // The Core must exist before pixi-live2d-display's cubism4 build runs.
 await loadScript(this.opts.coreUrl ?? DEFAULT_CORE);
 const { PIXI, Live2DModel } = this.opts.runtime ? await loadRuntimeScripts(this.opts.runtime) : await loadRuntimeModules();
 if (this.destroyed) return;
 const canvas = document.createElement('canvas');
 canvas.style.cssText = 'width:100%;height:100%;display:block';
 this.element.appendChild(canvas);
 const w = this.element.clientWidth || 220;
 const h = this.element.clientHeight || 330;
 this.app = new PIXI.Application({ view: canvas, width: w, height: h, backgroundAlpha: 0, autoStart: true, resolution: deviceScale() });
 let model: Awaited<ReturnType<typeof Live2DModel.from>>;
 try {
 // A stalled request (dead host, CORS preflight hanging) must still end in the sprite fallback.
 model = await withTimeout(Live2DModel.from(this.opts.model, { autoInteract: false }), LOAD_TIMEOUT_MS, 'Live2D model ' + this.opts.model);
 } catch (e) {
 // Do not leak the renderer and canvas when the model cannot be loaded.
 this.app?.destroy(true, { children: true });
 this.app = null;
 throw e;
 }
 if (this.destroyed) {
 model.destroy();
 this.app?.destroy(true, { children: true });
 this.app = null;
 return;
 }
 // A model that reports no size (not laid out yet) would give an infinite scale: keep 1.
 const fit = model.width > 0 && model.height > 0 ? Math.min(w / model.width, h / model.height) : 1;
 // Unscaled model size, for the whole-body stand-in (pivot at the feet).
 this.layout = { w, h, fit, lw: model.width, lh: model.height };
 model.scale.set(fit);
 model.x = (w - model.width) / 2;
 model.y = h - model.height;
 this.app.stage.addChild(model as never);
 // Apply the shared pose right before each model update so it wins over built-in idle motions.
 model.internalModel.on('beforeModelUpdate', () => this.apply());
 this.model = model;
 await this.loadMotionMap();
 if (this.opts.map?.wholeBody ?? this.fileWholeBody) this.enableWholeBody();
 // render() may have run before the model loaded: apply the pending expression now.
 if (this.lastExpression) {
 const pending = (this.opts.map?.expressions ?? this.fileExpressions)?.[this.lastExpression] ?? this.lastExpression;
 this.callExpression(model, pending).catch(() => { /* unknown id */ });
 }
 }

 // Optional motions.json next to the model3.json (docs/ART-PIPELINE.md section 7). Without it no preset motions play.
 private motionMap: Record<string, { group: string; index: number }> | undefined;
 private fileExpressions: Record<string, string> | undefined;
 private fileWholeBody = false;
 private layout: { w: number; h: number; fit: number; lw: number; lh: number } | null = null;
 private wholeBody = false;
 private bodyFrame = 0;

 // Stand the model on a pivot at its feet (bottom centre), slightly smaller, so it can sway without being clipped.
 private enableWholeBody(): void {
 const m = this.model;
 const l = this.layout;
 if (!m || !l || !(l.lw > 0) || !(l.lh > 0)) return;
 m.pivot.set(l.lw / 2, l.lh);
 m.scale.set(l.fit * WHOLE_BODY_FIT);
 m.position.set(l.w / 2, l.h);
 this.wholeBody = true;
 this.element.dataset.l2dBody = 'on';
 }

 private applyWholeBody(core: CoreModel): void {
 const m = this.model;
 const l = this.layout;
 const pose = this.pose;
 if (!m || !l || !pose) return;
 // An authored model motion writes the parameters itself; otherwise they are the shared procedural pose.
 const read = (id: (typeof WHOLE_BODY_PARAMS)[number]): number =>
  (this.authoredMotion && typeof core.getParameterValueById === 'function' ? core.getParameterValueById(id) : pose[id]);
 const values = Object.fromEntries(WHOLE_BODY_PARAMS.map((id) => [id, read(id)])) as Record<(typeof WHOLE_BODY_PARAMS)[number], number>;
 const t = wholeBodyTransform(values, this.opts.reducedMotion === true);
 m.rotation = t.rotation * Math.PI / 180;
 m.scale.set(l.fit * WHOLE_BODY_FIT * t.scale);
 m.position.set(l.w / 2 + t.dx * l.w, l.h + t.dy * l.h);
 // Debug/e2e hook, refreshed a few times per second (not every frame, to keep DOM writes cheap).
 if (this.bodyFrame++ % 12 === 0) this.element.dataset.l2dBody = t.rotation.toFixed(2) + ' ' + t.dx.toFixed(4) + ' ' + t.dy.toFixed(4) + ' ' + t.scale.toFixed(4);
 }

 private async loadMotionMap(): Promise<void> {
 if ((this.opts.map?.motions && this.opts.map?.expressions) || typeof fetch !== 'function') return;
 try {
 const res = await fetch(new URL('motions.json', new URL(this.opts.model, typeof window !== 'undefined' && window.location ? window.location.href : undefined)).href);
 if (!res.ok) return;
 const raw = (await res.json()) as { motions?: Record<string, { group: string; index: number }>; expressions?: Record<string, string>; wholeBody?: unknown };
 if (raw && raw.wholeBody === true) this.fileWholeBody = true;
 if (raw && typeof raw.motions === 'object') this.motionMap = raw.motions;
 if (raw && raw.expressions && typeof raw.expressions === 'object') this.fileExpressions = raw.expressions;
 } catch { return; }
 }

 // Plays the model motion that motions.json assigns to the preset; presets without an entry only get the procedural pose.
 // Without a motions.json entry, a model group named like the preset (any case, see resolveGroup) is used.
 setMotion(motion: Motion | null): void {
 if (!motion) { this.authoredMotion = false; return; }
 if (!this.model) return;
 const mapped = (this.opts.map?.motions ?? this.motionMap)?.[motion];
 const group = mapped?.group ?? resolveGroup(this.modelGroups(), motion);
 if (!group) { this.authoredMotion = false; return; }
 try {
 // Priority 3 = FORCE: a preset interrupts the model's own idle motion.
 const r = this.model.motion(group, mapped?.index ?? 0, 3 as never);
 this.authoredMotion = true;
 // Debug/e2e hook: the model group last started (also handy in devtools).
 this.element.dataset.l2dMotion = group;
 Promise.resolve(r).then((ok) => { if (ok === false) this.authoredMotion = false; }, () => { this.authoredMotion = false; });
 } catch { this.authoredMotion = false; }
 }

 private authoredMotion = false;

 get playingAuthoredMotion(): boolean { return this.authoredMotion; }

 private modelGroups(): string[] {
 const defs = (this.model?.internalModel as unknown as { motionManager?: { definitions?: Record<string, unknown> } } | undefined)
 ?.motionManager?.definitions;
 return defs && typeof defs === 'object' ? Object.keys(defs) : [];
 }

 render(pose: Pose, expression: Expression): void {
 this.pose = pose;
 if (expression !== this.lastExpression) {
 this.lastExpression = expression;
 const id = (this.opts.map?.expressions ?? this.fileExpressions)?.[expression] ?? expression;
 if (this.model) this.callExpression(this.model, id).catch(() => { /* unknown expression id: keep current face */ });
 }
 }

 // A synchronous throw from expression() becomes a rejection, so callers keep the current face.
 private callExpression(model: NonNullable<Live2DPuppet['model']>, id: string): Promise<unknown> {
 try {
 return Promise.resolve(model.expression(id)).then((ok) => {
 if (ok !== false) this.element.dataset.l2dExpression = id;
 return ok;
 });
 } catch (e) {
 return Promise.reject(e);
 }
 }

 private apply(): void {
 const core = this.model?.internalModel.coreModel as unknown as CoreModel | undefined;
 if (!core || !this.pose) return;
 for (const id of PARAMS) {
 if (this.authoredMotion && !DURING_MOTION.has(id)) continue;
 core.setParameterValueById(id, this.pose[id]);
 }
 if (this.wholeBody) this.applyWholeBody(core);
 }

 destroy(): void {
 this.destroyed = true;
 this.app?.destroy(true, { children: true });
 this.app = null;
 this.model = null;
 this.element.remove();
 }
}
