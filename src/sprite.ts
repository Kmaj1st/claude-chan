import type { Expression, Pose, Puppet } from './types';

// Sprite renderer: one raster image per expression, cross-faded by opacity.
// The shared pose drives a light transform (head tilt, breathing, sway) of the whole sheet.
// A sprite folder holds <expression>.webp for every Expression plus blink.webp.

const STATES = ['neutral', 'smile', 'sad', 'angry', 'blush', 'surprised', 'blink'] as const;
type SpriteState = (typeof STATES)[number];

const BLINK_BELOW = 0.4;
const BLINKABLE: ReadonlySet<Expression> = new Set<Expression>(['neutral', 'smile']);

export interface SpriteOptions {
 // Folder URL that holds the sprite files (no trailing slash needed).
 baseUrl: string;
 extension?: string;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function spriteStateFor(expression: Expression, eyeOpen: number): SpriteState {
 return eyeOpen < BLINK_BELOW && BLINKABLE.has(expression) ? 'blink' : expression;
}

export class SpritePuppet implements Puppet {
 readonly element: HTMLElement;
 private images = new Map<SpriteState, HTMLImageElement>();
 private sheet: HTMLElement;
 private shown: SpriteState | null = null;

 constructor(private opts: SpriteOptions) {
 this.element = document.createElement('div');
 this.element.style.cssText = 'width:100%;height:100%;display:flex;align-items:flex-end;justify-content:center;';
 this.sheet = document.createElement('div');
 this.sheet.style.cssText = 'position:relative;height:100%;aspect-ratio:4/5;transform-origin:50% 100%;will-change:transform;';
 this.element.appendChild(this.sheet);
 }

 async init(): Promise<void> {
 const base = this.opts.baseUrl.replace(/[/]+$/, '');
 const ext = this.opts.extension ?? 'webp';
 await Promise.all(STATES.map((state) => this.load(state, base + '/' + state + '.' + ext)));
 this.show('neutral');
 }

 private load(state: SpriteState, url: string): Promise<void> {
 return new Promise((resolve, reject) => {
 const img = document.createElement('img');
 img.alt = '';
 img.draggable = false;
 img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:50% 100%;opacity:0;pointer-events:none;';
 img.onload = () => resolve();
 img.onerror = () => reject(new Error('claude-chan: sprite failed to load: ' + url));
 img.src = url;
 this.images.set(state, img);
 this.sheet.appendChild(img);
 });
 }

 private show(state: SpriteState): void {
 if (state === this.shown) return;
 if (this.shown) this.images.get(this.shown)?.style.setProperty('opacity', '0');
 this.images.get(state)?.style.setProperty('opacity', '1');
 this.shown = state;
 }

 render(pose: Pose, expression: Expression): void {
 const eyes = Math.min(pose.ParamEyeLOpen, pose.ParamEyeROpen);
 this.show(spriteStateFor(expression, eyes));
 const tilt = clamp(pose.ParamAngleZ * 0.3 + pose.ParamBodyAngleZ * 0.5 + pose.ParamHairSway * 0.5, -12, 12);
 const lift = pose.ParamBreath * 2;
 const scale = 1 + pose.ParamBreath * 0.01;
 this.sheet.style.transform = 'translate(' + (pose.ParamAngleX * 0.4).toFixed(2) + 'px,' + (-lift).toFixed(2) + 'px) rotate(' + tilt.toFixed(2) + 'deg) scale(' + scale.toFixed(4) + ')';
 }

 destroy(): void {
 this.sheet.replaceChildren();
 this.images.clear();
 this.shown = null;
 }
}
