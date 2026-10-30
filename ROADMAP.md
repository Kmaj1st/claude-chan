# Roadmap

## Done
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

## Next
1. Test the Live2D loader against a redistributable sample model (none committed; Core file must be downloaded manually, see docs/LICENSES.md)
2. Notify hapi-chan lead: API contract is stable and written in docs/API.md; only the lead session id is missing (no other session exists yet)
3. Real Claude-chan model from an artist (docs/ART-PIPELINE.md)

## Decisions
- Server is bundled with esbuild into server/dist/ (gitignored); build with npm run build:server.
- Schema is generated from src/tools.ts; run UPDATE_SCHEMA=1 npx vitest run tests/schema.test.ts to refresh.
- Hub token is random per start unless set by env/flag; it is printed to stderr only.
- Code examples in docs use indented blocks where the writer tool drops triple-backtick fences.
