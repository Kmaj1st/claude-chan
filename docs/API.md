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
 position: 'bottom-left', // home corner: bottom-left | bottom-right | top-left | top-right
 home: undefined, // home spot { x, y } in viewport px (box top-left) or () => ({ x, y }) | null; overrides the corner
 size: 220, // character height in px
 dock: 'free', // free = drag anywhere in the viewport | fixed-default = stays at home
 draggable: true, // legacy: false = dock 'fixed-default' (dock wins when both are set)
 margin: 8, // min gap in px to the viewport edges
 snap: false, // edge snapping on drop: true = 24 px, a number = px
 resetOnDoubleClick: true, // double-click on a moved mascot returns it home
 storageKey: 'claude-chan:position', // false disables persistence
 zIndex: 2147483000,
 autoIdle: true,
 });

Web component: <claude-chan renderer="auto" sprites="/chars" model="" core-url="/live2dcubismcore.min.js" expressions='{"smile":"f01"}' position="bottom-left" size="220" dock="free" snap="false" margin="8" storage-key="claude-chan:position"></claude-chan> (draggable="false" still works as dock="fixed-default"; snap is "true", "false" or a px number; storage-key="false" disables position persistence; expressions is a JSON object that maps preset expression names to the model's own ids, and invalid JSON is ignored). The element forwards act, say, setMood, setState, lookAt, stop, lipSync, getPosition, setPosition, resetPosition, setDock and relayout to its controller (el.say('hi')); they do nothing while it is disconnected. ready, motionstart, motionend, error, dragstart and move are re-dispatched as CustomEvents.

## Controller

- act({ motion, expression, say, duration, priority })
- say(text) plain text only (rendered with textContent)
- setMood(mood)
- lookAt(x, y) viewport px; lookAt(null) releases the gaze
- stop() clears the queue and returns to idle
- lipSync(source) drives the mouth from an HTMLMediaElement or AnalyserNode; lipSync(null) returns to text-length lip-sync
- getPosition() returns { x, y, fx, fy, free, dock } (see Position and dragging)
- setPosition({ x, y }) in viewport px, or setPosition({ fx, fy }) as fractions; clamped and remembered; ignored with dock 'fixed-default'
- resetPosition() returns to the home spot and forgets the remembered one
- setDock('free' | 'fixed-default')
- relayout() re-reads the home function and the viewport (call it when the host moved its home slot)
- on('ready' | 'motionstart' | 'motionend' | 'error' | 'dragstart' | 'move', fn) returns an unsubscribe function
- destroy()
- ready promise: resolves once init has finished. It also resolves (never rejects) when init fails, so listen for the error event to detect that

## Tool-call surface

Exported from the package entry:

- TOOLS, actInputSchema, listCapabilities(), MAX_SAY_LENGTH (280), MAX_DURATION_MS (60000)
- parseCommand(tool, args) returns { ok: true, command } | { ok: false, error }
- runCommand(controller, command) applies a validated command
- installPostMessageBridge(controller, { allowedOrigins?, target?, announce? }) returns an uninstall function
- connectHub(controller, { token, port?, host?, reconnect?, onStatus? }) connects to the local MCP hub (docs/MCP.md) and returns a disconnect function
- parseMarkers(text) and createMarkerStream(onAct, onMood?)

Tool names: claude_chan_act, claude_chan_say, claude_chan_set_mood, claude_chan_set_state, claude_chan_list_motions, claude_chan_set_position, claude_chan_reset_position. JSON schema files: claude-chan/schema (claude_chan_act only) and claude-chan/schema/tools (all tools).

claude_chan_set_position args are { x, y }, both fractions from 0 to 1 of the free space (0 = left/top edge, 1 = right/bottom edge), so they mean the same spot on every window size. claude_chan_reset_position takes no args. Both work over the postMessage bridge and the hub WebSocket (connectHub), and both are no-ops while the page keeps the mascot at dock 'fixed-default'.

### postMessage bridge

Request (from a parent or iframe, origin must be allowed; default is the page's own origin, * is never accepted):

 { type: 'claude-chan', id: 1, tool: 'claude_chan_say', args: { text: 'hello' } }

id is optional (string or number; otherwise null in the reply). Messages from other origins or with another type are ignored silently.

Response (posted back to the sender's window, targeted at its origin):

 { type: 'claude-chan-result', id: 1, ok: true, result: { ok: true } }
 { type: 'claude-chan-result', id: 1, ok: false, error: 'message' }

With announce: true, and when the page runs inside a frame, the bridge posts { type: 'claude-chan-ready' } to the parent once per allowed origin right after install, so the host knows it can send commands. Off by default.

claude_chan_list_motions returns the capabilities object as result. An invalid tool or args gives ok false with the validation error.

## Position and dragging

With dock 'free' (the default) the mascot can be picked up and put anywhere inside the viewport:

- Pointer events, so mouse, touch and pen all work. A press becomes a drag only after 4 px (mouse) or 8 px (touch, pen) of travel, so a click or tap on the mascot still reaches the page as a normal click; the click that ends a drag is swallowed. touch-action: none and no text selection apply to the mascot only, and only while it can be dragged. Escape during a drag, or a pointercancel, puts it back where the drag started.
- While carried the character lifts a little and tilts (CSS translate/rotate on the renderer element, so it works for the sprite, procedural and Live2D renderers; off with prefers-reduced-motion). No extra art.
- Keyboard: the mascot is focusable (Tab). Arrow keys move 10 px, Shift+arrow 60 px, Home returns it home. Double-click on a moved mascot also returns it home (resetOnDoubleClick: false turns that off).
- It always stays fully inside the viewport, at least margin px from each edge. It is re-clamped on window resize, orientation change and visual-viewport changes (a phone keyboard shrinks the usable band; pinch zoom does not move it). Re-clamping never overwrites the remembered spot, so it returns there when the space comes back.
- The spot is saved in localStorage under storageKey (per origin) as { v: 2, fx, fy }, fractions of the free space, so it survives other window sizes. The older { x, y } px format is still read. Storage errors are ignored. resetPosition() removes the key.
- snap: true (or a px distance) pulls the mascot flush to an edge when it is dropped within 24 px (or that distance) of it. Off by default.
- Home: the corner from position, 16 px in, or the home option. A host app with its own slot for the mascot passes home as a function (for hapi-chan: the spot next to its chat bar) and calls relayout() when that slot moves; the user can still drag the mascot away, and resetPosition() brings it back to the slot.
- dock 'fixed-default' keeps the mascot at home: no drag, no keyboard focus, setPosition and claude_chan_set_position are ignored, and a remembered spot is kept but not used until dock is 'free' again.
- Events: dragstart (payload: the position) when a drag starts, move (the position plus source: drag | keyboard | api | reset) after every committed change. Re-clamps on resize do not fire move.
- Stacking: the host element is position: fixed with z-index var(--claude-chan-z, 2147483000). Hosts with modals pass zIndex (or set --claude-chan-z) below their modal layer and above their content. Only the character box takes pointer events; the rest of the screen stays clickable.

## Agent states

Hosts report what the agent is doing; Claude-chan picks motion, expression and mood.

- States: idle, listening, thinking, working, waiting, speaking, success, error, sleeping
- applyState(controller, state) sets the mood and plays the mapped motion/expression (STATE_MAP holds the table)
- isAgentState(value) is a type guard for untrusted input

 import { applyState } from 'claude-chan';
 applyState(cc, 'thinking');

The demo page (npm run dev, demo/) has a button per state.

## Element events

<claude-chan> re-dispatches the controller events as DOM CustomEvents on the element: ready, motionstart, motionend, error, dragstart and move. The payload is in event.detail.

If mount() throws (for example renderer="live2d" without a model), the element does not throw; it dispatches error with detail { message: 'mount failed', cause } and shows nothing. Later load failures arrive as the controller's own error event. Listeners on the element survive remounts.

 el.addEventListener('error', (e) => console.warn(e.detail.message, e.detail.cause));
