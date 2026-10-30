import { Live2DPuppet } from './live2d';
import { ProceduralPuppet } from './puppet';
import { SpritePuppet } from './sprite';
import type { Expression, MountOptions, Motion, Pose, Puppet } from './types';

// Chooses the renderer for mount(). auto = Live2D when a model is set, else sprites when the
// pose set loads, else the procedural puppet.

// Folder of the sprite poses shipped with the package (assets/chars next to dist/).
export function defaultSpriteBase(): string | null {
 try {
 const rel = '../assets/chars/';
 return new URL(rel, import.meta.url).href;
 } catch {
 return null;
 }
}

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

export function createPuppet(o: MountOptions, reducedMotion: boolean): Puppet {
 const renderer = o.renderer ?? 'auto';
 if (renderer === 'live2d' || (renderer === 'auto' && o.model)) {
 if (!o.model) throw new Error('claude-chan: renderer "live2d" needs the model option.');
 return new Live2DPuppet({ model: o.model, coreUrl: o.coreUrl });
 }
 if (renderer === 'procedural') return new ProceduralPuppet();
 const baseUrl = o.sprites ?? defaultSpriteBase();
 if (renderer === 'sprite') {
 if (!baseUrl) throw new Error('claude-chan: renderer "sprite" needs the sprites option (folder with poses.json).');
 return new SpritePuppet({ baseUrl, reducedMotion });
 }
 if (!baseUrl) return new ProceduralPuppet();
 return new FallbackPuppet(
 new SpritePuppet({ baseUrl, reducedMotion }),
 () => new ProceduralPuppet(),
 (cause) => console.warn('claude-chan: sprite poses not available, using the procedural puppet.', cause),
 );
}
