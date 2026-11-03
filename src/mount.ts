import { Engine } from './engine';
import { createShell } from './host';
import { installConsoleApi } from './console';
import { createLevelReader, type LevelReader } from './lipsync';
import { createPuppet } from './renderer-select';
import { installInteraction } from './interact';
import type { ClaudeChanController, Dock, MountOptions, Puppet } from './types';

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
 // dock wins over the legacy draggable switch.
 const dock: Dock = o.dock === 'free' || o.dock === 'fixed-default' ? o.dock : o.draggable === false ? 'fixed-default' : 'free';
 // The shell exists before the engine; position events are forwarded once the engine is built.
 let emitPos: Pick<Engine, 'emit'> | null = null;
 const shell = createShell(parent, {
 position: o.position,
 size: o.size,
 dock,
 home: o.home,
 margin: o.margin,
 snap: o.snap,
 resetOnDoubleClick: o.resetOnDoubleClick,
 storageKey: o.storageKey,
 zIndex: o.zIndex,
 onDragStart: (p) => emitPos?.emit('dragstart', p),
 onMove: (p) => emitPos?.emit('move', p),
 });
 let puppet: Puppet;
 try {
 puppet = createPuppet(o, reduced);
 shell.stage.appendChild(puppet.element);
 } catch (err) {
 shell.destroy();
 throw err;
 }
 const engine = new Engine(puppet, {
 autoIdle: o.autoIdle,
 reducedMotion: reduced,
 onSay: (text, ms) => shell.setBubble(text, ms),
 });
 emitPos = engine;

 let raf = 0;
 let alive = true;
 let reader: LevelReader | null = null;
 let uninteract: (() => void) | null = null;
 const loop = (t: number): void => {
 if (!alive) return;
 engine.tick(t);
 raf = requestAnimationFrame(loop);
 };

 const ready = puppet.init().then(
 () => {
 if (!alive) return;
 raf = requestAnimationFrame(loop);
 // Decided after init: a Live2D model that fell back to sprites keeps the sprite behaviour.
 const interactive = o.interactive ?? puppet.kind === 'live2d';
 if (interactive && typeof shell.stage?.addEventListener === 'function' && typeof window !== 'undefined') {
 uninteract = installInteraction(shell.stage, engine, (fn) => engine.on('dragstart', fn));
 }
 engine.emit('ready', undefined);
 },
 (cause: unknown) => {
 engine.emit('error', { message: 'puppet init failed', cause });
 },
 );

 const ctrl: ClaudeChanController = {
 ready,
 get renderer() { return puppet.kind ?? 'sprites'; },
 get isSimplified() { return puppet.kind === 'simplified'; },
 act: (req) => engine.act(req),
 say: (text) => engine.say(text),
 setMood: (mood) => engine.setMood(mood),
 lookAt(x, y) {
 if (x === null) engine.lookAt(null);
 else engine.lookAt(x / window.innerWidth * 2 - 1, (y ?? window.innerHeight / 2) / window.innerHeight * 2 - 1);
 },
 stop: () => engine.stop(),
 lipSync(source) {
 reader?.dispose();
 reader = null;
 if (!source || !alive) {
 engine.setAudioLevel(null);
 return;
 }
 let r: LevelReader;
 try {
 r = createLevelReader(source);
 } catch (err) {
 console.warn('claude-chan: lipSync unavailable', err);
 engine.setAudioLevel(null);
 return;
 }
 reader = r;
 engine.setAudioLevel(() => r.read());
 },
 on: (name, fn) => engine.on(name, fn),
 getPosition: () => shell.getPosition(),
 setPosition: (t) => { if (alive) shell.setPosition(t); },
 resetPosition: () => { if (alive) shell.resetPosition(); },
 setDock: (d) => { if (alive) shell.setDock(d); },
 relayout: () => { if (alive) shell.relayout(); },
 hide: (opts) => { if (alive) shell.setHidden(true, opts?.persist === true); },
 show: () => { if (alive) shell.setHidden(false); },
 toggle: () => { if (alive) shell.setHidden(!shell.isHidden()); return !shell.isHidden(); },
 isHidden: () => shell.isHidden(),
 destroy() {
 if (!alive) return;
 alive = false;
 uninstall();
 uninteract?.();
 reader?.dispose();
 cancelAnimationFrame(raf);
 puppet.destroy();
 shell.destroy();
 },
 };
 const uninstall = o.consoleApi === false ? (): void => undefined
 : installConsoleApi(ctrl, typeof o.consoleApi === 'string' && o.consoleApi ? o.consoleApi : 'claudeChan');
 return ctrl;
}
