# Public API contract

Stable under semver. hapi-chan and other hosts may rely on everything below. Source of truth: src/types.ts, src/tools.ts.

## Names

- Motions: idle, wave, nod, shake_head, think, happy, surprised, bow, cheer, sleepy, typing, tea_serve, pout, wink, point
- Expressions: neutral, smile, sad, angry, blush, surprised
- Moods: neutral, happy, sad, angry, shy, sleepy, thinking
- Priorities: low, normal, high, urgent (higher interrupts lower)

New names may be added in minor versions; existing names are never renamed or removed before a major version.

## Mounting

 import { ClaudeChan } from 'claude-chan';
 const cc = ClaudeChan.mount(document.body, {
 renderer: 'auto', // auto | sprite | procedural | live2d; auto = live2d if model is set, else sprites, else procedural
 sprites: undefined, // URL of a sprite pose folder (poses.json, motions.json, webp); default is the bundled assets/chars
 model: undefined, // model3.json URL (live2d renderer)
 expressions: undefined, // maps preset expression names to the model's own expression ids
 coreUrl: '/live2dcubismcore.min.js', // only with model
 position: 'bottom-left', // bottom-left | bottom-right | top-left | top-right
 size: 220, // character height in px
 draggable: true,
 storageKey: 'claude-chan:position', // false disables persistence
 zIndex: 2147483000,
 autoIdle: true,
 });

Web component: <claude-chan renderer="auto" sprites="/chars" model="" core-url="/live2dcubismcore.min.js" expressions='{"smile":"f01"}' position="bottom-left" size="220" draggable="false" storage-key="claude-chan:position"></claude-chan> (storage-key="false" disables position persistence; expressions is a JSON object that maps preset expression names to the model's own ids, and invalid JSON is ignored). The element forwards act, say, setMood, setState, lookAt, stop and lipSync to its controller (el.say('hi')); they do nothing while it is disconnected. ready, motionstart, motionend and error are re-dispatched as CustomEvents.

## Controller

- act({ motion, expression, say, duration, priority })
- say(text) plain text only (rendered with textContent)
- setMood(mood)
- lookAt(x, y) viewport px; lookAt(null) releases the gaze
- stop() clears the queue and returns to idle
- lipSync(source) drives the mouth from an HTMLMediaElement or AnalyserNode; lipSync(null) returns to text-length lip-sync
- on('ready' | 'motionstart' | 'motionend' | 'error', fn) returns an unsubscribe function
- destroy()
- ready promise

## Tool-call surface

Exported from the package entry:

- TOOLS, actInputSchema, listCapabilities(), MAX_SAY_LENGTH (280), MAX_DURATION_MS (60000)
- parseCommand(tool, args) returns { ok: true, command } | { ok: false, error }
- runCommand(controller, command) applies a validated command
- installPostMessageBridge(controller, { allowedOrigins?, target? }) returns an uninstall function
- parseMarkers(text) and createMarkerStream(onAct, onMood?)

Tool names: claude_chan_act, claude_chan_say, claude_chan_set_mood, claude_chan_set_state, claude_chan_list_motions. JSON schema files: claude-chan/schema (claude_chan_act only) and claude-chan/schema/tools (all five tools).

### postMessage bridge

Request (from a parent or iframe, origin must be allowed; default is the page's own origin, * is never accepted):

 { type: 'claude-chan', id: 1, tool: 'claude_chan_say', args: { text: 'hello' } }

id is optional (string or number; otherwise null in the reply). Messages from other origins or with another type are ignored silently.

Response (posted back to the sender's window, targeted at its origin):

 { type: 'claude-chan-result', id: 1, ok: true, result: { ok: true } }
 { type: 'claude-chan-result', id: 1, ok: false, error: 'message' }

claude_chan_list_motions returns the capabilities object as result. An invalid tool or args gives ok false with the validation error.

## Agent states

Hosts report what the agent is doing; Claude-chan picks motion, expression and mood.

- States: idle, listening, thinking, working, waiting, speaking, success, error, sleeping
- applyState(controller, state) sets the mood and plays the mapped motion/expression (STATE_MAP holds the table)
- isAgentState(value) is a type guard for untrusted input

 import { applyState } from 'claude-chan';
 applyState(cc, 'thinking');

The demo page (npm run dev, demo/) has a button per state.
