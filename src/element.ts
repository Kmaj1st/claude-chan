import { mount } from './mount';
import { applyState, type AgentState } from './states';
import { DOCKS } from './types';
import type { ActRequest, ClaudeChanController, Dock, MountOptions, Mood, Position, PositionInfo, PositionTarget, RendererName } from './types';

// <claude-chan model="" position="bottom-left" size="220" dock="free" snap="false"></claude-chan>
// The element itself is display:contents; the fixed host lives under it.

const RENDERERS: RendererName[] = ['auto', 'sprite', 'procedural', 'live2d'];
const rendererAttr = (v: string | null): RendererName | undefined => RENDERERS.find((r) => r === v);
const storageKeyAttr = (v: string | null): string | false => (v === null ? 'claude-chan:position' : v === 'false' ? false : v);
const marginAttr = (v: string | null): number | undefined => {
 const n = v === null || v === '' ? NaN : Number(v);
 return Number.isFinite(n) && n >= 0 && n <= 200 ? n : undefined;
};
const POSITIONS: Position[] = ['bottom-left', 'bottom-right', 'top-left', 'top-right'];
const dockAttr = (v: string | null): Dock | undefined => DOCKS.find((d) => d === v);
// snap attribute: absent/"false" = off, "true" or "" = default distance, a number = that many px.
export function snapAttr(v: string | null): boolean | number {
 if (v === null || v === 'false') return false;
 const n = Number(v);
 return v !== '' && Number.isFinite(n) && n > 0 ? Math.min(n, 200) : v === 'true' || v === '';
}

// expressions attribute: JSON object mapping preset expression names to model expression ids. Invalid JSON or non-string values are ignored.
export function expressionsAttr(v: string | null): MountOptions['expressions'] {
 if (!v) return undefined;
 try {
 const raw: unknown = JSON.parse(v);
 if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
 const out: Record<string, string> = {};
 for (const [k, id] of Object.entries(raw)) if (typeof id === 'string' && id) out[k] = id;
 return Object.keys(out).length ? out : undefined;
 } catch {
 return undefined;
 }
}

// Safe to import during SSR (Node has no HTMLElement); the element only registers in a browser.
const BaseElement = (typeof HTMLElement !== 'undefined' ? HTMLElement : class {}) as typeof HTMLElement;

export class ClaudeChanElement extends BaseElement {
 static observedAttributes = ['renderer', 'model', 'sprites', 'core-url', 'expressions', 'position', 'size', 'draggable', 'storage-key', 'dock', 'snap', 'margin'];

 controller: ClaudeChanController | null = null;
 private remountQueued = false;
 private mountFailed = false;

 connectedCallback(): void {
 if (this.controller) return;
 this.style.display = 'contents';
 const pos = this.getAttribute('position') as Position | null;
 const size = Number(this.getAttribute('size'));
 this.controller = this.safeMount({
 renderer: rendererAttr(this.getAttribute('renderer')),
 model: this.getAttribute('model') || undefined,
 sprites: this.getAttribute('sprites') || undefined,
 coreUrl: this.getAttribute('core-url') || undefined,
 expressions: expressionsAttr(this.getAttribute('expressions')),
 position: pos && POSITIONS.includes(pos) ? pos : 'bottom-left',
 size: Number.isFinite(size) && size >= 60 && size <= 1000 ? size : 220,
 draggable: this.getAttribute('draggable') !== 'false',
 dock: dockAttr(this.getAttribute('dock')),
 snap: snapAttr(this.getAttribute('snap')),
 margin: marginAttr(this.getAttribute('margin')),
 storageKey: storageKeyAttr(this.getAttribute('storage-key')),
 });
 if (!this.controller) return;
 for (const name of ['ready', 'motionstart', 'motionend', 'error', 'dragstart', 'move'] as const) {
 this.controller.on(name, (detail: unknown) => this.dispatchEvent(new CustomEvent(name, { detail })));
 }
 }

 // A failed mount (e.g. renderer="live2d" without a model) is reported as an 'error' event, not thrown.
 private safeMount(options: MountOptions): ClaudeChanController | null {
 this.mountFailed = false;
 try {
 return mount(this, options);
 } catch (cause) {
 this.mountFailed = true;
 this.dispatchEvent(new CustomEvent('error', { detail: { message: 'mount failed', cause } }));
 return null;
 }
 }

 // Attributes are read once at mount, so a change remounts. Batched per microtask.
 attributeChangedCallback(): void {
 if ((!this.controller && !this.mountFailed) || this.remountQueued) return;
 this.remountQueued = true;
 queueMicrotask(() => {
 this.remountQueued = false;
 if (!this.isConnected) return;
 this.disconnectedCallback();
 this.connectedCallback();
 });
 }

 disconnectedCallback(): void {
 this.controller?.destroy();
 this.controller = null;
 }

 // Controller methods forwarded so el.say('hi') works; no-ops while disconnected.
 act(req: ActRequest): void { this.controller?.act(req); }
 say(text: string): void { this.controller?.say(text); }
 setMood(mood: Mood): void { this.controller?.setMood(mood); }
 lookAt(x: number | null, y?: number): void { this.controller?.lookAt(x, y); }
 stop(): void { this.controller?.stop(); }
 setState(state: AgentState): void { if (this.controller) applyState(this.controller, state); }
 lipSync(source: HTMLMediaElement | AnalyserNode | null): void { this.controller?.lipSync(source); }
 getPosition(): PositionInfo | null { return this.controller?.getPosition() ?? null; }
 setPosition(target: PositionTarget): void { this.controller?.setPosition(target); }
 resetPosition(): void { this.controller?.resetPosition(); }
 setDock(dock: Dock): void { this.controller?.setDock(dock); }
 relayout(): void { this.controller?.relayout(); }
}

export function defineClaudeChan(tag = 'claude-chan'): void {
 if (typeof customElements !== 'undefined' && !customElements.get(tag)) {
 customElements.define(tag, ClaudeChanElement);
 }
}
