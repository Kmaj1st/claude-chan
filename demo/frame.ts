import { mount, installPostMessageBridge } from '../src/index';
import type { MountOptions } from '../src/index';

// The page that hosts Claude-chan inside an iframe. announce: true posts
// { type: 'claude-chan-ready' } to the parent so it knows when to send commands.
// Only the page's own origin is accepted; pass allowedOrigins for a cross-origin parent.
// Optional deep link for the real-model path:
// frame.html?model=/model/claude.model3.json&core=/live2dcubismcore.min.js&expressions={"smile":"f01"}
const q = new URLSearchParams(location.search);
const opts: MountOptions = { renderer: 'auto', sprites: '/chars', position: 'bottom-right', size: 220 };
const model = q.get('model');
if (model) {
 opts.model = model;
 const core = q.get('core');
 if (core) opts.coreUrl = core;
 const expr = q.get('expressions');
 if (expr) {
 try {
 opts.expressions = JSON.parse(expr);
 } catch {
 // ignore malformed expressions JSON: unmapped names are used as-is
 }
 }
}
const ctrl = mount(document.body, opts);
installPostMessageBridge(ctrl, { announce: true });
