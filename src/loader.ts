import { mount } from './mount';
import { connectHub } from './hubclient';
import { installPostMessageBridge } from './bridge';
import type { ClaudeChanController, Dock, MountOptions, Position, SpriteData } from './types';
import { INLINE_SPRITES } from './loader-assets';

// Hot-load entry (docs/HOT-LOAD.md): one self-contained IIFE that puts the mascot on any page.
// - Idempotent: a second run returns the running instance (window.__claudeChanLoader) and mounts nothing.
// - Isolated: the mascot lives in a shadow root inside one <claude-chan-loader> element on <html>, whose inline
//   !important styles host-page CSS cannot override, shown in the top layer (popover) where the browser supports it;
//   SPA route changes that rebuild <body> leave it alone.
// - Top frame only unless frames: true.
// - Full version (sprites) by default; the SIMPLIFIED code-drawn stand-in only if the sprites cannot load or simplified:true.
// - window.claudeChan is the console API plus unload() and version.

export const LOADER_VERSION = '0.1.0';
// Used when the loader cannot tell where it was loaded from (e.g. pasted code): sprites still come from here.
export const DEFAULT_BASE = 'https://kmaj1st.github.io/claude-chan/';
const GLOBAL = '__claudeChanLoader';
const TAG = 'claude-chan-loader';

export interface LoaderConfig {
 // URL of the folder that holds hotload/loader.js (assets are resolved from it); default: the loader's own URL.
 base?: string;
 // Sprite folder URL (poses.json + images); default <base>/assets/chars/. Ignored by the inline build.
 sprites?: string;
 // true = deliberately show the SIMPLIFIED code-drawn stand-in instead of the full sprite version (default false).
 // Without it the simplified version only appears when the sprites cannot be loaded.
 simplified?: boolean;
 position?: Position;
 dock?: Dock;
 size?: number;
 zIndex?: number;
 renderer?: MountOptions['renderer'];
 storageKey?: string | false;
 consoleApi?: string | false;
 // Mount inside iframes too (default false: top frame only).
 frames?: boolean;
 // Local MCP hub (docs/MCP.md): { token, port?, host? }. Off when absent.
 hub?: { token: string; port?: number; host?: string };
 // postMessage bridge: true = same origin, or a list of allowed origins. Off by default.
 postMessage?: boolean | string[];
}

export interface LoaderInstance {
 controller: ClaudeChanController;
 version: string;
 inline: boolean;
 unload(opts?: { forget?: boolean }): void;
}

type Win = Window & { claudeChanConfig?: LoaderConfig; [GLOBAL]?: LoaderInstance };

// The loader's own URL: currentScript for <script src>, else the first URL in the stack (import(), userscripts).
export function scriptUrl(): string | null {
 const cs = typeof document !== 'undefined' ? document.currentScript : null;
 if (cs && 'src' in cs && (cs as HTMLScriptElement).src) return (cs as HTMLScriptElement).src;
 const stack = new Error().stack ?? '';
 const m = stack.match(/(https?:\/\/[^\s)'"]+?\.js)(?::\d+)*/);
 return m ? m[1]! : null;
}

const POSITIONS: readonly Position[] = ['bottom-left', 'bottom-right', 'top-left', 'top-right'];
const num = (v: string | undefined): number | undefined => {
 if (v === undefined || v === '') return undefined;
 const n = Number(v);
 return Number.isFinite(n) ? n : undefined;
};

// data-* attributes on the loader's <script> tag (data-position, data-dock, data-size, data-z-index, data-sprites,
// data-base, data-frames, data-renderer, data-simplified). window.claudeChanConfig wins over them.
export function configFromScript(el: Element | null): LoaderConfig {
 const d = (el as HTMLElement | null)?.dataset;
 if (!d) return {};
 const c: LoaderConfig = {};
 if (d.position && (POSITIONS as readonly string[]).includes(d.position)) c.position = d.position as Position;
 if (d.dock === 'free' || d.dock === 'fixed-default') c.dock = d.dock;
 const size = num(d.size);
 if (size !== undefined) c.size = size;
 const z = num(d.zIndex);
 if (z !== undefined) c.zIndex = z;
 if (d.sprites) c.sprites = d.sprites;
 if (d.base) c.base = d.base;
 if (d.simplified !== undefined) c.simplified = d.simplified !== 'false';
 if (d.frames !== undefined) c.frames = d.frames !== 'false';
 if (d.renderer === 'sprite' || d.renderer === 'procedural' || d.renderer === 'auto') c.renderer = d.renderer;
 return c;
}

// Folder that holds the repository root (…/hotload/loader.js -> …/).
export function baseFrom(url: string | null): string | null {
 if (!url) return null;
 try {
 return new URL('../', url).href;
 } catch {
 return null;
 }
}

const HOST_STYLE =
 'all:initial!important;display:block!important;position:fixed!important;left:0!important;top:0!important;' +
 'right:auto!important;bottom:auto!important;margin:0!important;padding:0!important;border:0!important;background:none!important;' +
 'width:0!important;height:0!important;overflow:visible!important;pointer-events:none!important;' +
 'transform:none!important;filter:none!important;opacity:1!important;visibility:visible!important;contain:none!important;';

// script/url: captured by the IIFE while it runs (document.currentScript is null later and inside modules).
export function load(cfgIn?: LoaderConfig, ctx: { script?: Element | null; url?: string | null } = {}): LoaderInstance | null {
 if (typeof window === 'undefined' || typeof document === 'undefined') return null;
 const w = window as Win;
 const existing = w[GLOBAL];
 if (existing) return existing;
 const script = ctx.script ?? null;
 const cfg: LoaderConfig = { ...configFromScript(script), ...(w.claudeChanConfig ?? {}), ...(cfgIn ?? {}) };
 let top = true;
 try { top = window.top === window; } catch { top = false; }
 if (!top && cfg.frames !== true) return null;
 const consoleName = cfg.consoleApi === false ? false : cfg.consoleApi || 'claudeChan';
 if (consoleName && (w as unknown as Record<string, unknown>)[consoleName] !== undefined) {
 console.warn('claude-chan: window.' + consoleName + ' already exists (embedded mascot?); hot-load skipped.');
 return null;
 }

 const inline: SpriteData | null = INLINE_SPRITES;
 const base = cfg.base ? cfg.base.replace(/\/?$/, '/') : baseFrom(ctx.url ?? null) ?? DEFAULT_BASE;
 const sprites = cfg.sprites ?? new URL('assets/chars/', base).href;

 // Isolation: page CSS can only reach the outer element, and its inline !important styles win over the page.
 const outer = document.createElement(TAG);
 outer.setAttribute('style', HOST_STYLE + (cfg.zIndex !== undefined ? 'z-index:' + cfg.zIndex + '!important;' : 'z-index:2147483000!important;'));
 const root = outer.attachShadow({ mode: 'open' });
 const reset = document.createElement('style');
 reset.textContent = ':host{all:initial}';
 const mountPoint = document.createElement('div');
 root.append(reset, mountPoint);
 (document.documentElement || document.body).appendChild(outer);
 // Top layer (popover API) when available: then even transform/filter on <html> or <body> (dark-mode extensions,
 // zoom hacks) cannot move, shrink or tint her, and no page z-index can cover her. Plain fixed element otherwise.
 const lift = (): void => {
 const el = outer as HTMLElement & { showPopover?: () => void };
 if (typeof el.showPopover !== 'function') return;
 try {
 if (!el.hasAttribute('popover')) el.setAttribute('popover', 'manual');
 if (!el.matches(':popover-open')) el.showPopover();
 } catch { void 0; }
 };
 lift();

 let ctrl: ClaudeChanController;
 try {
 ctrl = mount(mountPoint, {
 position: cfg.position,
 dock: cfg.dock,
 size: cfg.size,
 zIndex: cfg.zIndex,
 renderer: cfg.simplified === true ? 'procedural' : cfg.renderer,
 storageKey: cfg.storageKey,
 consoleApi: consoleName,
 ...(inline ? { spriteData: inline } : { sprites }),
 });
 } catch (err) {
 outer.remove();
 console.warn('claude-chan: hot-load failed', err);
 return null;
 }

 const cleanups: Array<() => void> = [];
 if (cfg.hub && cfg.hub.token) {
 try { cleanups.push(connectHub(ctrl, cfg.hub)); } catch (err) { console.warn('claude-chan: hub not connected', err); }
 }
 if (cfg.postMessage) {
 cleanups.push(installPostMessageBridge(ctrl, Array.isArray(cfg.postMessage) ? { allowedOrigins: cfg.postMessage } : {}));
 }

 // A framework that replaces <html> children (rare; most SPAs only touch <body>/#app) would drop the mascot:
 // put the same element back (no remount, state and position kept).
 let alive = true;
 const keep = new MutationObserver(() => {
 if (alive && !outer.isConnected) {
 (document.documentElement || document.body).appendChild(outer);
 lift();
 }
 });
 keep.observe(document.documentElement, { childList: true });

 const storageKey = cfg.storageKey === undefined ? 'claude-chan:position' : cfg.storageKey;
 const instance: LoaderInstance = {
 controller: ctrl,
 version: LOADER_VERSION,
 inline: inline !== null,
 unload(opts) {
 if (!alive) return;
 alive = false;
 keep.disconnect();
 for (const c of cleanups.splice(0)) {
 try { c(); } catch { void 0; }
 }
 ctrl.destroy();
 outer.remove();
 if (opts?.forget && storageKey) {
 try {
 localStorage.removeItem(storageKey);
 localStorage.removeItem(storageKey + ':hidden');
 } catch { void 0; }
 }
 if (w[GLOBAL] === instance) delete w[GLOBAL];
 },
 };
 w[GLOBAL] = instance;
 const api = consoleName ? ((w as unknown as Record<string, unknown>)[consoleName] as Record<string, unknown> | undefined) : undefined;
 if (api && typeof api === 'object') {
 api.unload = (opts?: { forget?: boolean }) => instance.unload(opts);
 api.version = LOADER_VERSION;
 const help = api.help as (() => string[]) | undefined;
 const line = consoleName + '.unload()                 remove the hot-loaded mascot ({ forget: true } also clears its storage)';
 api.help = () => {
 const lines = help ? help() : [];
 console.log('  ' + line);
 return [...lines, line];
 };
 }
 return instance;
}

// Auto-run when bundled as the IIFE (build-loader sets __CLAUDE_CHAN_AUTORUN__).
declare const __CLAUDE_CHAN_AUTORUN__: boolean | undefined;
if (typeof __CLAUDE_CHAN_AUTORUN__ !== 'undefined' && __CLAUDE_CHAN_AUTORUN__) {
 const ctx = { script: document.currentScript, url: scriptUrl() };
 const run = (): void => { load(undefined, ctx); };
 if (document.documentElement) run();
 else document.addEventListener('DOMContentLoaded', run, { once: true });
}
