# Roadmap

## Done
- Sprite renderer (src/sprite/, renderer option, default via auto): 21 MIT-licensed anime poses in assets/chars with poses.json and motions.json (pose sequences per motion and expression), cross-fade/slide, blink frame, talk pose swap, lazy loading, fallback to the procedural puppet
- Skeleton, types, validation, queue with priorities, motion engine
- Procedural puppet, Web Component, vanilla mount API, postMessage bridge, text markers
- WebSocket hub (loopback, token, origin check, rate limit, bounded sizes)
- MCP server (stdio + streamable HTTP), CLI (server/dist/cli.js)
- Generated JSON schema schema/claude_chan_act.json
- Docs: README embed guide, CHARACTER.md, MCP.md, ART-PIPELINE.md, LICENSES.md
- Headless browser asserts (npm run test:e2e: mount, drag, clamp, persist)
- Live2D Cubism 4 loader (src/live2d.ts, lazy, self-hosted Core via coreUrl) and default motions map (src/model/motions.default.json)
- SSR-safe import (no DOM needed to import; mount() throws a clear error on the server), tests/ssr.test.ts
- docs/API.md: stable public contract; bridge and marker helpers exported from the package entry
- Lip-sync from an audio/video element or AnalyserNode: controller.lipSync(source) (src/lipsync.ts), tests/lipsync.test.ts

- Unit tests for the bridge (error replies, wildcard origin rejected), prefers-reduced-motion, and host clamping/corner vars
- Model folder validator: npm run check:model -- <folder> (server/modelcheck.ts, tests/modelcheck.test.ts)
- Agent states: applyState/setState and the claude_chan_set_state tool (idle, listening, thinking, working, waiting, speaking, success, error, sleeping); all five tools in schema/claude_chan_tools.json (export claude-chan/schema/tools)
- storage-key="false" disables position persistence; README covers agent states and the real Live2D model path (npm run test:live2d is opt-in)
- Demo page (demo/) with renderer select (auto, sprite, procedural, live2d), moods, agent states and model/core-url inputs
- Iframe demo (demo/embed.html + frame.html) showing the postMessage bridge with the ready announce
- Demo lip-sync section: pick an audio file and the mouth follows its level (controller.lipSync)
- Demo logs element ready/error/motion events and has an expressions field; README says how to run it (npm run dev)
- expressions attribute on the element (JSON map of preset to model expression ids); element CustomEvents and mount failure documented in docs/API.md
- Live2D plays motions.json presets via setMotion (motions.json next to the model3.json, or a parsed map option); ART-PIPELINE section 7 describes it
- Iframe embedding: bridge announce option posts claude-chan-ready; demo/embed.html hosts demo/frame.html, which accepts the model, core and expressions query params (docs/INTEGRATION.md)

## Next
1. Test the Live2D loader against a redistributable sample model (none committed; Core file must be downloaded manually, see docs/LICENSES.md)
2. Tell hapi-chan: API contract is stable and written in docs/API.md
3. Real Claude-chan Live2D model from an artist with layered parts (docs/ART-PIPELINE.md); sprites are the current art
4. More sprite poses via docs/ART-REQUESTS.md (an angry bust and a real bow are missing)

## Decisions
- Server is bundled with esbuild into server/dist/ (gitignored); build with npm run build:server.
- Schema is generated from src/tools.ts; run UPDATE_SCHEMA=1 npx vitest run tests/schema.test.ts to refresh.
- Hub token is random per start unless set by env/flag; it is printed to stderr only.
- Code examples in docs use indented blocks where the writer tool drops triple-backtick fences.
