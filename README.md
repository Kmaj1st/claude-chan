Claude-chan is an embeddable anime-style mascot. By default it shows real anime sprite poses (flat images, cross-faded; MIT-licensed art, see docs/LICENSES.md) and falls back to a procedural SVG puppet when the sprites are missing; a self-hosted Live2D model can be plugged in (see Real Live2D model below). AI tool calls can drive it to play preset motions. It works in any web UI. No framework is required.

The renderer option (or renderer attribute) is auto, sprite, procedural or live2d. The sprites option points to a folder with poses.json and motions.json, so another pose set can be dropped in (docs/ART-PIPELINE.md). The default folder is found relative to the package file (assets/chars next to dist/). If your bundler inlines the package into another chunk, copy assets/chars to a public folder and set sprites to its URL; if the poses cannot be loaded, the procedural puppet is shown and a console warning is logged.

## 5-minute embed

### 1. Plain HTML (web component)

html
<claude-chan position="bottom-left" size="220" dock="free"></claude-chan>
<script type="module">
 import { defineClaudeChan } from 'claude-chan';
 defineClaudeChan();
</script>


### 2. Vanilla API

js
import { ClaudeChan } from 'claude-chan';

const cc = ClaudeChan.mount(document.body, {
 position: 'bottom-left',
 size: 220,
 dock: 'free',
});
await cc.ready;
cc.act({ motion: 'wave', expression: 'smile', say: 'Hello!' });
cc.setMood('happy');
cc.on('motionend', (e) => console.log(e));


Controller: act, say, setMood, lookAt, stop, lipSync, getPosition, setPosition, resetPosition, setDock, relayout, on, destroy, ready.

### Dragging and position

The mascot can be dragged anywhere on the screen with mouse, touch or pen (a short press is still a click), or moved with the arrow keys after focusing it (Shift for big steps, Home to go back). It stays inside the viewport, follows resizes, rotation and the phone keyboard, and remembers its spot per site as fractions of the window. resetPosition() or Home returns it home; a double-click does nothing special. There is no close button: the mascot is always visible on load. From the browser console, claudeChan.help() lists the commands (resetPosition, setPosition, getPosition, hide, show, toggle; see docs/API.md).

Options: dock ('free' default, or 'fixed-default' to keep it at home), home ({ x, y } or a function, for a host's own slot), margin (8), snap (false; true or px to snap to edges on drop), resetOnDoubleClick (false; true opts in to double-click = back home), consoleApi (true = window.claudeChan), storageKey. Events: dragstart, move.

js
// Host app: keep your own slot as the home spot and let the user drag away.
const slot = () => { const r = chatBar.getBoundingClientRect(); return { x: r.left + 8, y: r.top - 228 }; };
const cc = ClaudeChan.mount(document.body, { home: slot, zIndex: 40 });
new ResizeObserver(() => cc.relayout()).observe(chatBar);
cc.setPosition({ fx: 1, fy: 1 }); // bottom-right corner
cc.resetPosition(); // back to the slot


The same works remotely: claude_chan_set_position { x, y } (fractions) and claude_chan_reset_position over postMessage or the hub. Details: docs/API.md (Position and dragging).

### 3. React

jsx
useEffect(() => {
 const cc = ClaudeChan.mount(ref.current ?? document.body, { position: 'bottom-left' });
 return () => cc.destroy();
}, []);


### 4. Vue

Call ClaudeChan.mount in onMounted and destroy() in onBeforeUnmount. The same code works with the <claude-chan> element if you register it with app.config.compilerOptions.isCustomElement.

### SSR (Next.js, Nuxt)

Importing claude-chan is safe on the server. mount() throws on the server, so call it only in useEffect or onMounted. The <claude-chan> element registers in the browser only.

## Motions and expressions

Motions (stable names): idle, wave, nod, shake_head, think, happy, surprised, bow, cheer, sleepy, typing, tea_serve, pout, wink, point.

Expressions: neutral, smile, sad, angry, blush, surprised.

## Agent states

Report what the agent is doing and Claude-chan picks motion, expression and mood. States: idle, listening, thinking, working, waiting, speaking, success, error, sleeping.

 import { applyState } from 'claude-chan';
 applyState(cc, 'thinking'); // vanilla controller
 el.setState('thinking'); // <claude-chan> element

Over MCP or postMessage use the claude_chan_set_state tool (docs/API.md).

## Real Live2D model

Set model to a .model3.json URL and core-url to your self-hosted live2dcubismcore.min.js (the proprietary Core is not bundled, see docs/LICENSES.md). With renderer=auto a model that fails to load falls back to sprites.

 <claude-chan model="/model/claude.model3.json" core-url="/live2dcubismcore.min.js"></claude-chan>

The demo page accepts ?model=...&core=...&expressions=... for a quick try. Map preset expressions to the model's own ids with the expressions option, or on the element with expressions='{"smile":"f01"}' (JSON). Validate a model folder with npm run check:model -- <folder>; run the opt-in headless test with LIVE2D_MODEL_DIR and LIVE2D_CORE set, then npm run test:live2d.

## Driving it from an AI

| Way | Use when | Docs |
| --- | --- | --- |
| MCP server (stdio or streamable HTTP) with claude_chan_act, claude_chan_say, claude_chan_set_mood, claude_chan_set_state, claude_chan_list_motions, claude_chan_set_position, claude_chan_reset_position | Claude Code / HAPI sessions | docs/MCP.md |
| JSON schema schema/claude_chan_act.json | Any tool-calling LLM API | schema/ |
| postMessage bridge | Page inside an iframe | src/bridge.ts |
| Text markers such as [motion:wave] in streamed text | Models without tool calls | src/markers.ts |

Speech bubbles use textContent only, never innerHTML. Motion respects prefers-reduced-motion. Only the character receives pointer events.

## Development


npm install
npx tsc --noEmit
npx vitest run
npm run build:server


The demo page is in demo/ and has a button for every motion, expression, mood and agent state, a lip-sync picker (an audio file drives the mouth), and a tool-call console. A second page, demo/embed.html (http://127.0.0.1:5178/embed.html), embeds demo/frame.html in an iframe and drives it over the postMessage bridge, including the ready announce. Run it with npm run dev and open http://127.0.0.1:5178 (it serves assets/ at the site root). npm run build builds only the library (dist/), not the demo.

## More docs

- docs/API.md: stable API contract (options, attributes, events, tools)
- docs/INTEGRATION.md: packaging and host-app integration (hapi-chan)
- docs/CHARACTER.md: character sheet
- docs/MCP.md: MCP setup and system prompt snippet
- ROADMAP.md: status and next steps
