# Roadmap

Current open items. What already works is described in the other docs (see [README.md](README.md)); git holds the history.

## Open
1. Export the owner's claude-chan Cubism model to `assets/live2d/claude-chan/` ([LIVE2D.md](LIVE2D.md), export steps), run `npm run check:model` and `npm run test:live2d` on it, then decide whether the model is committed to the public repo and whether `live2d` becomes the default renderer. The renderer itself passes `npm run test:live2d` against the Live2D sample model Haru (not committed).
2. Motion groups and expressions in the model named like the presets ([ART-PIPELINE.md](ART-PIPELINE.md) sections 4, 5 and 7).
3. More sprite poses via [ART-REQUESTS.md](ART-REQUESTS.md) (an angry bust and a real bow are missing).
4. A small browser extension that runs `hotload/claude-chan.inline.js` on chosen sites (the CSP-proof route; see [HOT-LOAD.md](HOT-LOAD.md)).
5. Publish the package to npm (it is `private` for now) and screenshots for the README ([images/README.md](images/README.md)).

## Decisions
- The server is bundled with esbuild into `server/dist/` (gitignored); build with `npm run build:server`.
- The schema is generated from `src/tools.ts`; run `UPDATE_SCHEMA=1 npx vitest run tests/schema.test.ts` to refresh it.
- The hub token is random per start unless set by env or flag; it is printed to stderr only.
