# Integrating Claude-chan into a host app (hapi-chan)

Contract: docs/API.md (stable under semver). This page covers packaging traps.

## Install paths

1. npm/package: import 'claude-chan'. Default sprites are found at ../assets/chars/ relative to dist/claude-chan.js, so keep dist/ and assets/ side by side.
2. Vendored bundle (a copy of dist inside the host): the relative lookup breaks, and dist/ has lazy chunks next to claude-chan.js (Live2D), so copy every JavaScript file in dist/. Run npm run build, then npm run vendor -- <target-dir>: it copies the JavaScript files in dist/ and assets/chars to the target. Pass the chars URL explicitly.

 import { mount } from './vendor/claude-chan.js';
 mount({ sprites: '/vendor/claude-chan/chars', position: 'bottom-right', size: 220 });

 Web component: <claude-chan sprites="/vendor/claude-chan/chars"></claude-chan>

If the sprites folder is unreachable, auto falls back to the procedural puppet and logs a console warning; nothing throws.

## Driving it from the agent

- In the page: postMessage bridge (docs/API.md) or the controller returned by mount().
- From a Claude Code / HAPI session: MCP server, see docs/MCP.md.
- Tool JSON schemas: claude-chan/schema/tools.

## Live2D

Set model (a .model3.json URL) and coreUrl (self-hosted live2dcubismcore.min.js; the proprietary Core is not bundled, see docs/LICENSES.md). On the web component the attributes are model, core-url and expressions (JSON, e.g. {"smile":"f01"} maps preset expressions to model expression ids). They are read at mount, so change them by remounting. With renderer auto a failing model falls back to sprites; the element re-dispatches the load error as an event.

## Checklist

- Serve the sprites folder with poses.json, motions.json and the webp files.
- Same-origin or CORS-enabled sprites URL.
- Give the bridge an explicit origin; wildcard origins are rejected.
- Keep assets/chars/NOTICE.md with the sprites (MIT attribution).
