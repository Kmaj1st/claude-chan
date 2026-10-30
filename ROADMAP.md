# Roadmap

## Done
- Skeleton, types, validation, queue with priorities, motion engine
- Procedural puppet, Web Component, vanilla mount API, postMessage bridge, text markers
- WebSocket hub (loopback, token, origin check, rate limit, bounded sizes)
- MCP server (stdio + streamable HTTP), CLI (server/dist/cli.js)
- Generated JSON schema schema/claude_chan_act.json
- Docs: README embed guide, CHARACTER.md, MCP.md, ART-PIPELINE.md, LICENSES.md

## Next
1. Headless browser asserts (mount, drag, clamp)
2. Live2D Cubism 4 loader + motions.json mapping (self-hosted runtime, no CDN; Core file is not committed, see docs/LICENSES.md)
3. Tell hapi-chan: API contract stable

## Decisions
- Server is bundled with esbuild into server/dist/ (gitignored); build with npm run build:server.
- Schema is generated from src/tools.ts; run UPDATE_SCHEMA=1 npx vitest run tests/schema.test.ts to refresh.
- Hub token is random per start unless set by env/flag; it is printed to stderr only.
- Code examples in docs use indented blocks where the writer tool drops triple-backtick fences.
