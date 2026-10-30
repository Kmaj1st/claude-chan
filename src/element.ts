import { mount } from './mount';
import type { ClaudeChanController, Position } from './types';

// <claude-chan model="" position="bottom-left" size="220" draggable="false"></claude-chan>
// The element itself is display:contents; the fixed host lives under it.

const POSITIONS: Position[] = ['bottom-left', 'bottom-right', 'top-left', 'top-right'];

export class ClaudeChanElement extends HTMLElement {
 controller: ClaudeChanController | null = null;

 connectedCallback(): void {
 if (this.controller) return;
 this.style.display = 'contents';
 const pos = this.getAttribute('position') as Position | null;
 const size = Number(this.getAttribute('size'));
 this.controller = mount(this, {
 model: this.getAttribute('model') ?? undefined,
 position: pos && POSITIONS.includes(pos) ? pos : 'bottom-left',
 size: Number.isFinite(size) && size >= 60 && size <= 1000 ? size : 220,
 draggable: this.getAttribute('draggable') !== 'false',
 storageKey: this.getAttribute('storage-key') ?? 'claude-chan:position',
 });
 for (const name of ['ready', 'motionstart', 'motionend', 'error'] as const) {
 this.controller.on(name, (detail) => this.dispatchEvent(new CustomEvent(name, { detail })));
 }
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
