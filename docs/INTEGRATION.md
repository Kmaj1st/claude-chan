# Integrating Claude-chan into a host app

Contract: docs/API.md (stable under semver). This page covers packaging traps.

## Install paths

1. npm/package: import 'claude-chan'. Default sprites are found at ../assets/chars/ relative to dist/claude-chan.js, so keep dist/ and assets/ side by side.
2. Vendored bundle (a copy of dist inside the host): the relative lookup breaks, and dist/ has lazy chunks next to claude-chan.js (Live2D), so copy every JavaScript file in dist/. Run npm run build, then npm run vendor -- <target-dir>: it copies the JavaScript files in dist/ and assets/chars to the target. Pass the chars URL explicitly.

 import { mount } from './vendor/claude-chan.js';
 mount({ sprites: '/vendor/claude-chan/chars', position: 'bottom-right', size: 220 });

 Web component: <claude-chan sprites="/vendor/claude-chan/chars"></claude-chan>

If the sprites folder is unreachable, auto falls back to the SIMPLIFIED code-drawn puppet (fewer poses, no real art) and logs `claude-chan: sprites could not be loaded from <url>; showing the SIMPLIFIED code-drawn version`; nothing throws. `ctrl.renderer` / `ctrl.isSimplified` tell which one is showing.

## Driving it from the agent

- In the page: postMessage bridge (docs/API.md) or the controller returned by mount().
- Iframe embedding: install the bridge with announce: true. The iframe then posts { type: 'claude-chan-ready' } to its parent, once per allowed origin, so the host knows when to send commands. Off by default. Try it with npm run dev, then open /embed.html (host page) which loads /frame.html (see demo/). frame.html also accepts the real-model deep link: /frame.html?model=<model3.json URL>&core=<self-hosted Core URL>&expressions={"smile":"f01"}; without model it uses the sprite/procedural renderers.
- From a Claude Code (or other MCP client) session: MCP server, see docs/MCP.md. A local page receives those calls by running connectHub(controller, { token }) (src/hubclient.ts); the demo page has a hub row for trying it.
- Tool JSON schemas: claude-chan/schema/tools.

## Home slot and free dragging

A host app with a chat bar can keep the mascot at the bottom-left of that bar (the private HAPI web app does this). Pass that spot as the home option (a function, re-read on resize) and call relayout() when the bar moves; the user can still drag the mascot anywhere, and resetPosition() (or Home, or claudeChan.resetPosition() in the console) brings it back:

 const cc = mount(document.body, { sprites: '/vendor/claude-chan/chars', home: () => { const r = bar.getBoundingClientRect(); return { x: r.left + 8, y: r.top - 228 }; }, zIndex: 40 });
 new ResizeObserver(() => cc.relayout()).observe(bar);

- Global mount (one mascot for the whole app): call mount(document.body, ...) once at the app shell level, outside the router, and never unmount it on navigation. Let home return the slot of the current page when it has one (e.g. a chat bar) and null otherwise (then the position corner, 16 px in, is used), and call relayout() when the slot appears, moves or disappears. A spot the user dragged to is kept on every page; home only applies while the user has never dragged it (or after resetPosition()). The overlay must not hide its container with display: none, which would hide the mascot too.
- Never put the mascot inside an element with transform, filter, perspective, contain or will-change: transform: that element becomes the containing block for position: fixed and the viewport coordinates go wrong.
- Use dock: 'fixed-default' (or setDock) for a mode where the mascot must stay in the slot.
- zIndex: pick a value above your content and below your modals; the default (2147483000) is above everything.
- The remembered spot is per origin under storageKey; give each app its own key if several share an origin.
- From the agent or a parent frame: claude_chan_set_position { x, y } (fractions 0..1) and claude_chan_reset_position (docs/API.md).

## Live2D

Set model (a .model3.json URL) and coreUrl (self-hosted live2dcubismcore.min.js; the proprietary Core is not bundled, see docs/LICENSES.md). On the web component the attributes are model, core-url and expressions (JSON, e.g. {"smile":"f01"} maps preset expressions to model expression ids). They are read at mount, so change them by remounting. With renderer auto a failing model falls back to sprites; the element re-dispatches the load error as an event.

## Checklist

- Serve the sprites folder with poses.json, motions.json and the webp files.
- Same-origin or CORS-enabled sprites URL.
- Give the bridge an explicit origin; wildcard origins are rejected.
- Keep assets/chars/NOTICE.md with the sprites (MIT attribution).
