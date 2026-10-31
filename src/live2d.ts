import { PARAMS, type Expression, type Pose, type Puppet } from './types';

// Live2D Cubism 4 renderer (pixi-live2d-display). Loaded lazily by mount() only when a model URL is set.
// The proprietary Cubism Core is NOT bundled: the host self-hosts live2dcubismcore.min.js (see docs/LICENSES.md).

export interface Live2DOptions {
 model: string;
 // URL of the self-hosted Cubism Core script.
 coreUrl?: string;
 // Parsed motions.json; expressions map preset name -> model expression id.
 map?: { expressions?: Record<string, string> };
}

const DEFAULT_CORE = './live2dcubismcore.min.js';

// One in-flight load per URL, so several puppets do not add duplicate script tags.
const pendingScripts = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
 if ((window as unknown as { Live2DCubismCore?: unknown }).Live2DCubismCore) return Promise.resolve();
 const existing = pendingScripts.get(src);
 if (existing) return existing;
 const p = new Promise<void>((resolve, reject) => {
 const s = document.createElement('script');
 s.src = src;
 s.onload = () => resolve();
 s.onerror = () => {
 s.remove();
 reject(new Error('Cannot load Cubism Core from ' + src));
 };
 document.head.appendChild(s);
 });
 // A failed load is not cached, so a later retry can succeed.
 p.catch(() => pendingScripts.delete(src));
 pendingScripts.set(src, p);
 return p;
}

type CoreModel = { setParameterValueById(id: string, v: number): void };

export class Live2DPuppet implements Puppet {
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
 await loadScript(this.opts.coreUrl ?? DEFAULT_CORE);
 const PIXI = await import('pixi.js');
 (window as unknown as { PIXI: unknown }).PIXI = PIXI;
 const { Live2DModel } = await import('pixi-live2d-display/cubism4');
 if (this.destroyed) return;
 const canvas = document.createElement('canvas');
 canvas.style.cssText = 'width:100%;height:100%;display:block';
 this.element.appendChild(canvas);
 const w = this.element.clientWidth || 220;
 const h = this.element.clientHeight || 330;
 this.app = new PIXI.Application({ view: canvas, width: w, height: h, backgroundAlpha: 0, autoStart: true });
 const model = await Live2DModel.from(this.opts.model, { autoInteract: false });
 if (this.destroyed) {
 model.destroy();
 this.app?.destroy(true, { children: true });
 this.app = null;
 return;
 }
 model.scale.set(Math.min(w / model.width, h / model.height));
 model.x = (w - model.width) / 2;
 model.y = h - model.height;
 this.app.stage.addChild(model as never);
 // Apply the shared pose right before each model update so it wins over built-in idle motions.
 model.internalModel.on('beforeModelUpdate', () => this.apply());
 this.model = model;
 // render() may have run before the model loaded: apply the pending expression now.
 if (this.lastExpression) {
 const pending = this.opts.map?.expressions?.[this.lastExpression] ?? this.lastExpression;
 Promise.resolve(model.expression(pending)).catch(() => { /* unknown id */ });
 }
 }

 render(pose: Pose, expression: Expression): void {
 this.pose = pose;
 if (expression !== this.lastExpression) {
 this.lastExpression = expression;
 const id = this.opts.map?.expressions?.[expression] ?? expression;
 if (this.model) Promise.resolve(this.model.expression(id)).catch(() => { /* unknown expression id: keep current face */ });
 }
 }

 private apply(): void {
 const core = this.model?.internalModel.coreModel as unknown as CoreModel | undefined;
 if (!core || !this.pose) return;
 for (const id of PARAMS) core.setParameterValueById(id, this.pose[id]);
 }

 destroy(): void {
 this.destroyed = true;
 this.app?.destroy(true, { children: true });
 this.app = null;
 this.model = null;
 this.element.remove();
 }
}
