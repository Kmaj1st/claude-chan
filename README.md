[中文](README.zh-CN.md)

# Claude-chan

An embeddable anime-style mascot for web UIs, driven by AI tool calls. Claude-chan reacts to what an agent does: it waves, thinks, cheers, shows a speech bubble, and can be dragged anywhere on the page.

> Claude-chan is a fan project. It is not affiliated with or endorsed by Anthropic. "Claude" is a trademark of Anthropic and is used here only descriptively.

<!-- SCREENSHOT: docs/images/hero.png — mascot on a page, 1200x700 -->

## Features

- Sprite renderer with 21 MIT-licensed anime poses, cross-faded; a procedural SVG puppet is the fallback when sprites are missing.
- Optional Live2D renderer (Cubism 4) with a self-hosted Core.
- Drag anywhere with mouse, touch or pen; keyboard movement; the spot is remembered per site. `dock` is `free` (default) or `fixed-default`.
- Driven by tool calls: an MCP server, a local WebSocket hub, a postMessage bridge, or plain text markers such as `[motion:wave]`.
- A console API, `window.claudeChan`, for the user (position, hide, show).
- Hot-load onto any page with one line, a bookmarklet or a userscript, without touching the page's source.
- No framework needed; works as a Web Component, a vanilla API, or inside React and Vue.

<!-- SCREENSHOT: docs/images/poses-grid.png — grid of the 21 poses, 1200x900 -->

## Quick start

### a) Embed in 3 lines

```html
<claude-chan position="bottom-left" size="220"></claude-chan>
<script type="module">import { defineClaudeChan } from 'claude-chan'; defineClaudeChan();</script>
```

Or from JavaScript:

```js
import { ClaudeChan } from 'claude-chan';
const cc = ClaudeChan.mount(document.body, { position: 'bottom-left', size: 220 });
await cc.ready;
cc.act({ motion: 'wave', expression: 'smile', say: 'Hello!' });
```

The package is not published to npm yet; build it with `npm run build` and import `dist/claude-chan.js`. Full options and framework notes: [docs/API.md](docs/API.md), [docs/INTEGRATION.md](docs/INTEGRATION.md).

### b) Hot-load onto any page

Run the local loader server, then paste this into the browser console of any page:

```bash
npm run serve:loader   # serves http://127.0.0.1:5179
```

```js
document.head.append(Object.assign(document.createElement('script'),{src:'http://127.0.0.1:5179/hotload/loader.js'}))
```

Once this repository is public you can use the CDN instead: replace the `src` with `https://cdn.jsdelivr.net/gh/Kmaj1st/claude-chan@main/hotload/loader.js`. To remove a hot-loaded mascot, run `claudeChan.unload()`.

<!-- SCREENSHOT: docs/images/hot-load.png — mascot hot-loaded on a third-party site, 1200x700 -->

### c) Bookmarklet

Drag the bookmarklet from [docs/install.html](docs/install.html) to your bookmarks bar and click it on any page.

### d) Userscript

Install `hotload/claude-chan.user.js` in Tampermonkey or Violentmonkey. For sites with a strict Content-Security-Policy use `hotload/claude-chan.inline.user.js`.

More in [docs/HOT-LOAD.md](docs/HOT-LOAD.md) (including CSP limits).

## Dragging and positions

Drag the mascot anywhere; a short press is still a click. Arrow keys move it after focusing it (Shift for big steps, Home goes back). It stays inside the viewport and remembers its spot as fractions of the window. There is no close button and double-click does nothing special; use the console commands below.

<!-- SCREENSHOT: docs/images/drag.png — mascot being dragged (lifted and tilted), 800x600 -->

Motions (stable names): idle, wave, nod, shake_head, think, happy, surprised, bow, cheer, sleepy, typing, tea_serve, pout, wink, point.

Expressions: neutral, smile, sad, angry, blush, surprised.

Moods: neutral, happy, sad, angry, shy, sleepy, thinking. Agent states: idle, listening, thinking, working, waiting, speaking, success, error, sleeping (`applyState(cc, 'thinking')` or `el.setState('thinking')`).

Speech bubbles use `textContent` only, never `innerHTML`, and are capped at 280 characters. Motion respects `prefers-reduced-motion`.

<!-- SCREENSHOT: docs/images/bubble.png — speech bubble, 600x400 -->

## API and commands

Controller: `act`, `say`, `setMood`, `setState`, `lookAt`, `stop`, `lipSync`, `getPosition`, `setPosition`, `resetPosition`, `hide`, `show`, `toggle`, `setDock`, `relayout`, `on`, `destroy`, `ready`. Details: [docs/API.md](docs/API.md).

Console commands (type `claudeChan.help()` to list them):

| Command | Effect |
| --- | --- |
| `claudeChan.help()` | list the commands |
| `claudeChan.getPosition()` | `{ x, y, fx, fy, free, dock }` |
| `claudeChan.setPosition(fx, fy)` | move to fractions 0..1 of the screen (numbers over 1 are px) |
| `claudeChan.resetPosition()` | back to the home spot |
| `claudeChan.hide()` / `hide({ persist: true })` | hide for this page load / also after reloads |
| `claudeChan.show()` | show again and clear a persisted hide |
| `claudeChan.toggle()` | hide or show for this page load |
| `claudeChan.unload()` | remove a hot-loaded mascot (hot-load only) |

Tools for agents: `claude_chan_act`, `claude_chan_say`, `claude_chan_set_mood`, `claude_chan_set_state`, `claude_chan_list_motions`, `claude_chan_set_position`, `claude_chan_reset_position`. There are deliberately no hide/show tools: only the user hides the mascot. JSON schemas are in `schema/`.

| Way | Use when | Docs |
| --- | --- | --- |
| MCP server (stdio or streamable HTTP) | Claude Code and other MCP clients | [docs/MCP.md](docs/MCP.md) |
| Local WebSocket hub (`connectHub`) | A local page receives the MCP calls | [docs/MCP.md](docs/MCP.md) |
| postMessage bridge | A page inside an iframe, or a parent frame | [docs/API.md](docs/API.md) |
| Text markers such as `[motion:wave]` | Models without tool calls | `src/markers.ts` |
| JSON schema `schema/claude_chan_act.json` | Any tool-calling LLM API | `schema/` |

## MCP setup

```bash
npm run build:server
CLAUDE_CHAN_TOKEN=change-me-to-a-long-random-token node server/dist/cli.js
```

Add it to your `.mcp.json` and connect the page with `connectHub(controller, { token })`. Full setup, HTTP mode and a system prompt snippet: [docs/MCP.md](docs/MCP.md).

## Security

- The hub binds to `127.0.0.1`, requires a token (16+ characters), checks the `Origin` header (loopback by default), rate-limits and bounds message sizes. The token ends up in the page, so use the hub with local pages only.
- The postMessage bridge accepts only an explicit origin allow-list (default: the page's own origin). `*` is never accepted.
- Speech bubbles never render HTML.
- Hot-loading runs a script on the page you load it into. It can be blocked by a page's Content-Security-Policy; see [docs/HOT-LOAD.md](docs/HOT-LOAD.md).

## Real Live2D model

Set `model` to a `.model3.json` URL and `core-url` to your self-hosted `live2dcubismcore.min.js`. The proprietary Core is not bundled ([docs/LICENSES.md](docs/LICENSES.md)). With `renderer=auto` a model that fails to load falls back to sprites.

```html
<claude-chan model="/model/claude.model3.json" core-url="/live2dcubismcore.min.js"></claude-chan>
```

Validate a model folder with `npm run check:model -- <folder>`. Artist brief: [docs/ART-PIPELINE.md](docs/ART-PIPELINE.md).

## Use inside another app

Claude-chan is built to be embedded in host apps, for example inside the HAPI web app (a private host app).

<!-- SCREENSHOT: docs/images/hapi-chan.png — mascot inside the HAPI web app, 1200x700 -->

See [docs/INTEGRATION.md](docs/INTEGRATION.md) for packaging, a home slot next to your own UI, and SSR notes.

## Credits and licence

- Code: MIT, see [LICENSE](LICENSE).
- Sprites in `assets/chars` are derived from [Chaosnap/Claude_Overdose](https://github.com/Chaosnap/Claude_Overdose) (MIT, copyright Yuki); see [assets/chars/NOTICE.md](assets/chars/NOTICE.md). The song "INTERNET OVERDOSE", the game NEEDY GIRL OVERDOSE and the "Claude" trademark are not covered and not included.
- The Live2D Cubism Core is not bundled. No Live2D model is committed.
- Everything else: [docs/LICENSES.md](docs/LICENSES.md).

## Contributing

```bash
npm ci
npm test            # unit tests (vitest)
npm run test:e2e    # headless browser tests
npm run check:links # relative links and anchors in the docs
npx tsc --noEmit
```

One pull request per change. Run `npm run dev` for the demo page (http://127.0.0.1:5178): a button for every motion, expression, mood and state, lip-sync, and a tool-call console.

## Status

Early (0.1). The API is documented in [docs/API.md](docs/API.md); open items are in [docs/ROADMAP.md](docs/ROADMAP.md). All docs: [docs/README.md](docs/README.md).
