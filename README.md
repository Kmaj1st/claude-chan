# claude-chan

Claude-chan is an embeddable anime-style mascot (procedural 2D puppet now, Live2D model later). AI tool calls can drive it to play preset motions. It works in any web UI. No framework is required.

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

## Motions and expressions

Motions (stable names): idle, wave, nod, shake_head, think, happy, surprised, bow, cheer, sleepy, typing, tea_serve, pout, wink, point.

Expressions: neutral, smile, sad, angry, blush, surprised.

## Driving it from an AI

| Way | Use when | Docs |
| --- | --- | --- |
| MCP server (stdio or streamable HTTP) with claude_chan_act, claude_chan_say, claude_chan_set_mood, claude_chan_list_motions | Claude Code / HAPI sessions | docs/MCP.md |
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
