import { Engine } from './engine';
import { createShell } from './host';
import { createLevelReader, type LevelReader } from './lipsync';
import { createPuppet } from './renderer-select';
import type { ClaudeChanController, MountOptions, Puppet } from './types';

// Vanilla entry point: builds shell + puppet + engine and runs the frame loop.

// Drops undefined values so mount(el, { size: props.size }) keeps the defaults.
export function definedOnly<T extends object>(o: T): Partial<T> {
 return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function mount(parent: HTMLElement, options: MountOptions = {}): ClaudeChanController {
 if (typeof document === 'undefined') {
 throw new Error('claude-chan: mount() needs a browser DOM; call it from onMounted/useEffect, not during SSR.');
 }
 const o = {
 position: 'bottom-left' as const,
 size: 220,
 draggable: true,
 storageKey: 'claude-chan:position' as string | false,
 autoIdle: true,
 ...definedOnly(options),
 };
 const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
 const shell = createShell(parent, {
 position: o.position,
 size: o.size,
 draggable: o.draggable,
 storageKey: o.storageKey,
 zIndex: o.zIndex,
 });
 const puppet: Puppet = createPuppet(o, reduced);
 shell.stage.appendChild(puppet.element);
 const engine = new Engine(puppet, {
 autoIdle: o.autoIdle,
 reducedMotion: reduced,
 onSay: (text, ms) => shell.setBubble(text, ms),
 });

 let raf = 0;
 let alive = true;
 let reader: LevelReader | null = null;
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
 lipSync(source) {
 reader?.dispose();
 reader = null;
 if (!source) {
 engine.setAudioLevel(null);
 return;
 }
 const r = createLevelReader(source);
 reader = r;
 engine.setAudioLevel(() => r.read());
 },
 on: (name, fn) => engine.on(name, fn),
 destroy() {
 alive = false;
 reader?.dispose();
 cancelAnimationFrame(raf);
 puppet.destroy();
 shell.destroy();
 },
 };
}
