import { Live2DPuppet } from './live2d';
import { ProceduralPuppet } from './puppet';
import { SpritePuppet } from './sprite';
import type { Expression, RendererKind, MountOptions, Motion, Pose, Puppet } from './types';

// Chooses the renderer for mount(). auto = Live2D when a model is set, else sprites when the
// pose set loads, else the SIMPLIFIED code-drawn puppet (warns in the console; see Puppet.kind).

// Folder of the sprite poses shipped with the package (assets/chars next to dist/).
export function defaultSpriteBase(): string | null {
 try {
 const rel = '../assets/chars/';
 return new URL(rel, import.meta.url).href;
 } catch {
 return null;
 }
}

export const SIMPLIFIED_WARNING = (where: string): string =>
 'claude-chan: sprites could not be loaded from ' + where + '; showing the SIMPLIFIED code-drawn version';

// Shows the primary puppet; when its init() fails, swaps to a fallback puppet in the same box.
export class FallbackPuppet implements Puppet {
 readonly element: HTMLElement;
 private active: Puppet;
 private usedFallback = false;
 private destroyed = false;

 constructor(private primary: Puppet, private makeFallback: () => Puppet, private onFallback?: (cause: unknown) => void) {
 this.element = document.createElement('div');
 this.element.style.cssText = 'width:100%;height:100%;';
 this.active = primary;
 this.element.appendChild(primary.element);
 }

 get kind(): RendererKind { return this.active.kind ?? 'sprites'; }

 get fellBack(): boolean { return this.usedFallback; }

 async init(): Promise<void> {
 try {
 await this.primary.init();
 } catch (cause) {
 if (this.destroyed) return;
 this.primary.destroy();
 this.element.replaceChildren();
 this.active = this.makeFallback();
 this.usedFallback = true;
 this.element.appendChild(this.active.element);
 this.onFallback?.(cause);
 await this.active.init();
 }
 }

 setMotion(motion: Motion | null, durationMs: number): void { this.active.setMotion?.(motion, durationMs); }
 render(pose: Pose, expression: Expression, nowMs?: number): void { this.active.render(pose, expression, nowMs); }
 destroy(): void { this.destroyed = true; this.active.destroy(); this.element.replaceChildren(); }
}

// Maps the reported names ('sprites', 'simplified') onto the option names.
export function normalizeRenderer(r: MountOptions['renderer']): 'auto' | 'sprite' | 'procedural' | 'live2d' {
 if (r === 'sprites') return 'sprite';
 if (r === 'simplified') return 'procedural';
 return r === 'sprite' || r === 'procedural' || r === 'live2d' ? r : 'auto';
}

export const LIVE2D_FALLBACK_WARNING = 'claude-chan: Live2D model failed to load, showing the sprite version instead.';

export function createPuppet(o: MountOptions, reducedMotion: boolean): Puppet {
 const renderer = normalizeRenderer(o.renderer);
 if (renderer === 'live2d' || (renderer === 'auto' && o.model)) {
 if (!o.model) {
 // Never leave the page without a mascot: no model means the sprite chain.
 console.warn('claude-chan: renderer "live2d" needs the model option (URL of a .model3.json); showing the sprite version.');
 return createPuppet({ ...o, renderer: 'auto' }, reducedMotion);
 }
 const live = new Live2DPuppet({
 model: o.model,
 coreUrl: o.coreUrl,
 runtime: o.live2dRuntime,
 map: o.expressions ? { expressions: o.expressions } : undefined,
 });
 // A failing model or runtime (Cubism Core blocked, bad URL, no WebGL) falls back to the sprite/procedural chain.
 return new FallbackPuppet(
 live,
 () => createPuppet({ ...o, model: undefined, renderer: 'auto' }, reducedMotion),
 (cause) => console.warn(LIVE2D_FALLBACK_WARNING, cause),
 );
 }
 if (renderer === 'procedural') return new ProceduralPuppet();
 const data = o.spriteData;
 if (data) {
 // In-memory pose set (inline hot-load build): no fetch, images come from the map. Falls back like a folder set.
 const inline = new SpritePuppet({
 baseUrl: 'inline:',
 reducedMotion,
 fetchJson: async (url) => (url.endsWith('/poses.json') ? data.poses : data.motions),
 resolveFile: (file) => data.images[file] ?? 'data:,missing',
 });
 if (renderer === 'sprite') return inline;
 return new FallbackPuppet(inline, () => new ProceduralPuppet(),
 (cause) => console.warn(SIMPLIFIED_WARNING('the embedded sprite set'), cause));
 }
 const baseUrl = o.sprites ?? defaultSpriteBase();
 if (renderer === 'sprite') {
 if (!baseUrl) throw new Error('claude-chan: renderer "sprite" needs the sprites option (folder with poses.json).');
 return new SpritePuppet({ baseUrl, reducedMotion });
 }
 if (!baseUrl) {
 console.warn('claude-chan: no sprites folder known (set the sprites option); showing the SIMPLIFIED code-drawn version');
 return new ProceduralPuppet();
 }
 return new FallbackPuppet(
 new SpritePuppet({ baseUrl, reducedMotion }),
 () => new ProceduralPuppet(),
 (cause) => console.warn(SIMPLIFIED_WARNING(baseUrl), cause),
 );
}
