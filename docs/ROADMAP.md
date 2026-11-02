# Roadmap

Current open items. What already works is described in the other docs (see [README.md](README.md)); git holds the history.

## Open
1. Run `npm run test:live2d` (tests/e2e/live2d.mjs, opt-in) against a locally downloaded model and Cubism Core: set `LIVE2D_MODEL_DIR` and `LIVE2D_CORE`. Nothing is committed (docs/LICENSES.md). It has not been run against a real model yet.
2. A real Claude-chan Live2D model from an artist with layered parts ([ART-PIPELINE.md](ART-PIPELINE.md)); the flat sprites are the current art.
3. More sprite poses via [ART-REQUESTS.md](ART-REQUESTS.md) (an angry bust and a real bow are missing).
4. Publish the package to npm (it is `private` for now) and screenshots for the README ([images/README.md](images/README.md)).

## Decisions
- The server is bundled with esbuild into `server/dist/` (gitignored); build with `npm run build:server`.
- The schema is generated from `src/tools.ts`; run `UPDATE_SCHEMA=1 npx vitest run tests/schema.test.ts` to refresh it.
- The hub token is random per start unless set by env or flag; it is printed to stderr only.
