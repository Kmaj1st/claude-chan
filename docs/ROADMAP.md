# Roadmap

Current open items. What already works is described in the other docs (see [README.md](README.md)); git holds the history.

## Open
1. Deepen the claude-chan Cubism model in `assets/live2d/claude-chan/`: it has eyelid and mouth rigging, motions, expressions and passes `npm run check:model` and `npm run test:live2d`, but no deformers (head turn, body sway, breathing) or physics yet ([ART-PIPELINE.md](ART-PIPELINE.md) section 11). Then decide whether the model is committed to the public repo and whether `live2d` becomes the default renderer.
2. Replace the sprite-cut overlays with a real layered model from an artist ([ART-PIPELINE.md](ART-PIPELINE.md) sections 2 to 7).
3. More sprite poses via [ART-REQUESTS.md](ART-REQUESTS.md) (an angry bust and a real bow are missing).
4. A small browser extension that runs `hotload/claude-chan.inline.js` on chosen sites (the CSP-proof route; see [HOT-LOAD.md](HOT-LOAD.md)).
5. Publish the package to npm (it is `private` for now) and screenshots for the README ([images/README.md](images/README.md)).

## Decisions
- The server is bundled with esbuild into `server/dist/` (gitignored); build with `npm run build:server`.
- The schema is generated from `src/tools.ts`; run `UPDATE_SCHEMA=1 npx vitest run tests/schema.test.ts` to refresh it.
- The hub token is random per start unless set by env or flag; it is printed to stderr only.
