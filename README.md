Claude-chan is an embeddable anime-style mascot. By default it shows real anime sprite poses (flat images, cross-faded; MIT-licensed art, see docs/LICENSES.md) and falls back to a procedural SVG puppet when the sprites are missing; a Live2D model can be plugged in later. AI tool calls can drive it to play preset motions. It works in any web UI. No framework is required.

The renderer option (or renderer attribute) is auto, sprite, procedural or live2d. The sprites option points to a folder with poses.json and motions.json, so another pose set can be dropped in (docs/ART-PIPELINE.md).

## 5-minute embed

### 1. Plain HTML (web component)

html
<claude-chan position="bottom-left" size="220" draggable="true"></claude-chan>
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
 draggable: true,
});
await cc.ready;
cc.act({ motion: 'wave', expression: 'smile', say: 'Hello!' });
cc.setMood('happy');
cc.on('motionend', (e) => console.log(e));


Controller: act, say, setMood, lookAt, stop, on, destroy, ready.

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

The demo page accepts ?model=...&core=... for a quick try. Map preset expressions to the model's own ids with the expressions option, or on the element with expressions='{"smile":"f01"}' (JSON). Validate a model folder with npm run check:model -- <folder>; run the opt-in headless test with LIVE2D_MODEL_DIR and LIVE2D_CORE set, then npm run test:live2d.

## Driving it from an AI

| Way | Use when | Docs |
| --- | --- | --- |
| MCP server (stdio or streamable HTTP) with claude_chan_act, claude_chan_say, claude_chan_set_mood, claude_chan_set_state, claude_chan_list_motions | Claude Code / HAPI sessions | docs/MCP.md |
| JSON schema schema/claude_chan_act.json | Any tool-calling LLM API | schema/ |
| postMessage bridge | Page inside an iframe | src/bridge.ts |
| Text markers such as [motion:wave] in streamed text | Models without tool calls | src/markers.ts |

Speech bubbles use textContent only, never innerHTML. Motion respects prefers-reduced-motion. Only the character receives pointer events.

## Development


npm install
npx tsc --noEmit
npx vitest run
npm run build:server


The demo page is in demo/ and has a button for every motion plus a tool-call console.

## More docs

- docs/CHARACTER.md: character sheet
- docs/MCP.md: MCP setup and system prompt snippet
- ROADMAP.md: status and next steps
