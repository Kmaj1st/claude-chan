import type { ClaudeChanController, PositionInfo, PositionTarget } from './types';

// Browser-console commands (window.claudeChan by default). They replace the removed UI controls (double-click reset,
// close button): the mascot is always visible on load unless someone explicitly ran hide({ persist: true }).

export interface ConsoleApi {
 // 'sprites' (full version), 'simplified' (code-drawn stand-in) or 'live2d'.
 readonly renderer: ClaudeChanController['renderer'];
 readonly isSimplified: boolean;
 help(): string[];
 getPosition(): PositionInfo;
 // Two numbers 0..1 = fractions of the free space (like claude_chan_set_position); larger numbers = viewport px.
 // An object ({ x, y } px or { fx, fy }) is passed through to the controller.
 setPosition(x: number | PositionTarget, y?: number): PositionInfo;
 resetPosition(): PositionInfo;
 hide(opts?: { persist?: boolean }): void;
 show(): void;
 toggle(): boolean;
 isHidden(): boolean;
}

export const CONSOLE_COMMANDS: readonly string[] = [
 'claudeChan.help()                  this list',
 'claudeChan.getPosition()           { x, y, fx, fy, free, dock }',
 'claudeChan.setPosition(fx, fy)     move to fractions 0..1 of the screen (numbers > 1 are px)',
 'claudeChan.resetPosition()         back to the default (home) spot, forgets the dragged spot',
 'claudeChan.hide()                  hide for this page load',
 'claudeChan.hide({ persist: true }) stay hidden after reloads too (until show())',
 'claudeChan.show()                  show again (also clears a persisted hide)',
 'claudeChan.toggle()                hide/show for this page load; returns true when visible',
 'claudeChan.renderer                "sprites" = full version, "simplified" = code-drawn stand-in (also claudeChan.isSimplified)',
];

export function toTarget(x: number | PositionTarget, y?: number): PositionTarget | null {
 if (x && typeof x === 'object') return x;
 if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
 return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { fx: x, fy: y } : { x, y };
}

export function createConsoleApi(ctrl: ClaudeChanController, name = 'claudeChan'): ConsoleApi {
 const lines = CONSOLE_COMMANDS.map((l) => l.replace(/^claudeChan\./, name + '.'));
 return {
 get renderer() { return ctrl.renderer; },
 get isSimplified() { return ctrl.isSimplified; },
 help() {
 const state = 'Renderer: ' + (ctrl.isSimplified ? 'SIMPLIFIED (code-drawn stand-in, fewer poses; the sprites could not be loaded or simplified:true was set)' : ctrl.renderer === 'live2d' ? 'Live2D' : 'sprites (full version)');
 console.log('Claude-chan console commands:\n  ' + lines.join('\n  ') + '\n' + state);
 return [...lines];
 },
 getPosition: () => ctrl.getPosition(),
 setPosition(x, y) {
 const t = toTarget(x, y);
 if (t) ctrl.setPosition(t);
 else console.warn('claude-chan: setPosition(x, y) needs two numbers');
 return ctrl.getPosition();
 },
 resetPosition() {
 ctrl.resetPosition();
 return ctrl.getPosition();
 },
 hide: (opts) => ctrl.hide(opts),
 show: () => ctrl.show(),
 toggle: () => ctrl.toggle(),
 isHidden: () => ctrl.isHidden(),
 };
}

// Puts the API on window[name] unless that name is already taken (the first mascot wins). Returns the remover.
export function installConsoleApi(ctrl: ClaudeChanController, name = 'claudeChan'): () => void {
 if (typeof window === 'undefined') return () => undefined;
 const w = window as unknown as Record<string, unknown>;
 if (w[name] !== undefined) return () => undefined;
 const api = createConsoleApi(ctrl, name);
 w[name] = api;
 return () => { if (w[name] === api) delete w[name]; };
}
