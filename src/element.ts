import { mount } from './mount';
import type { ClaudeChanController, Position } from './types';

// <claude-chan model="" position="bottom-left" size="220" draggable="false"></claude-chan>
// The element itself is display:contents; the fixed host lives under it.

const POSITIONS: Position[] = ['bottom-left', 'bottom-right', 'top-left', 'top-right'];

// Safe to import during SSR (Node has no HTMLElement); the element only registers in a browser.
const BaseElement = (typeof HTMLElement !== 'undefined' ? HTMLElement : class {}) as typeof HTMLElement;

export class ClaudeChanElement extends BaseElement {
 static observedAttributes = ['model', 'sprites', 'position', 'size', 'draggable', 'storage-key'];

 controller: ClaudeChanController | null = null;
 private remountQueued = false;

 connectedCallback(): void {
 if (this.controller) return;
 this.style.display = 'contents';
 const pos = this.getAttribute('position') as Position | null;
 const size = Number(this.getAttribute('size'));
 this.controller = mount(this, {
 model: this.getAttribute('model') ?? undefined,
 sprites: this.getAttribute('sprites') ?? undefined,
 position: pos && POSITIONS.includes(pos) ? pos : 'bottom-left',
 size: Number.isFinite(size) && size >= 60 && size <= 1000 ? size : 220,
 draggable: this.getAttribute('draggable') !== 'false',
 storageKey: this.getAttribute('storage-key') ?? 'claude-chan:position',
 });
 for (const name of ['ready', 'motionstart', 'motionend', 'error'] as const) {
 this.controller.on(name, (detail) => this.dispatchEvent(new CustomEvent(name, { detail })));
 }
 }

 // Attributes are read once at mount, so a change remounts. Batched per microtask.
 attributeChangedCallback(): void {
 if (!this.controller || this.remountQueued) return;
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
}

export function defineClaudeChan(tag = 'claude-chan'): void {
 if (typeof customElements !== 'undefined' && !customElements.get(tag)) {
 customElements.define(tag, ClaudeChanElement);
 }
}
