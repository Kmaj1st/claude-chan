import { Engine } from './engine';
import { createShell } from './host';
import { Live2DPuppet } from './live2d';
import { ProceduralPuppet } from './puppet';
import type { ClaudeChanController, MountOptions, Puppet } from './types';

// Vanilla entry point: builds shell + puppet + engine and runs the frame loop.

export function mount(parent: HTMLElement, options: MountOptions = {}): ClaudeChanController {
 const o = {
 position: 'bottom-left' as const,
 size: 220,
 draggable: true,
 storageKey: 'claude-chan:position' as string | false,
 autoIdle: true,
 ...options,
 };
 const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
 const shell = createShell(parent, {
 position: o.position,
 size: o.size,
 draggable: o.draggable,
 storageKey: o.storageKey,
 zIndex: o.zIndex,
 });
 const puppet: Puppet = o.model
 ? new Live2DPuppet({ model: o.model, coreUrl: o.coreUrl })
 : new ProceduralPuppet();
 shell.stage.appendChild(puppet.element);
 const engine = new Engine(puppet, {
 autoIdle: o.autoIdle,
 reducedMotion: reduced,
 onSay: (text, ms) => shell.setBubble(text, ms),
 });

 let raf = 0;
 let alive = true;
 const loop = (t: number): void => {
 if (!alive) return;
 engine.tick(t);
 raf = requestAnimationFrame(loop);
 };

 const ready = puppet.init().then(
 () => {
 if (!alive) return;
 raf = requestAnimationFrame(loop);
 engine.emit('ready', undefined);
 },
 (cause: unknown) => {
 engine.emit('error', { message: 'puppet init failed', cause });
 },
 );

 return {
 ready,
 act: (req) => engine.act(req),
 say: (text) => engine.say(text),
 setMood: (mood) => engine.setMood(mood),
 lookAt(x, y) {
 if (x === null) engine.lookAt(null);
 else engine.lookAt(x / window.innerWidth * 2 - 1, (y ?? 0) / window.innerHeight * 2 - 1);
 },
 stop: () => engine.stop(),
 on: (name, fn) => engine.on(name, fn),
 destroy() {
 alive = false;
 cancelAnimationFrame(raf);
 puppet.destroy();
 shell.destroy();
 },
 };
}
