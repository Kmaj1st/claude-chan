import { mount, installPostMessageBridge } from '../src/index';

// The page that hosts Claude-chan inside an iframe. announce: true posts
// { type: 'claude-chan-ready' } to the parent so it knows when to send commands.
// Only the page's own origin is accepted; pass allowedOrigins for a cross-origin parent.
const ctrl = mount(document.body, { renderer: 'auto', sprites: '/chars', position: 'bottom-right', size: 220 });
installPostMessageBridge(ctrl, { announce: true });
