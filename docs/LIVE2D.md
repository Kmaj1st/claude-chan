# Live2D (Cubism) renderer

Claude-chan has three renderers. They share one engine, one public API and the same presets (15 motions, 6 expressions, the standard Cubism parameters):

| renderer | What you see | Extra download |
| --- | --- | --- |
| `sprites` (default) | The 21 sprite poses (full version) | none |
| `simplified` | Code-drawn stand-in | none |
| `live2d` | Your Cubism model (`.model3.json`) | Cubism Core + pixi.js 6 + pixi-live2d-display, loaded only for `live2d` |

`sprite` and `procedural` are older names for `sprites` and `simplified` and still work. `renderer: 'auto'` (the npm default) picks Live2D when `model` is set.

**Never without a mascot:** if the Core, the runtime or the model cannot load (404, CSP, no WebGL, 20 s timeout), the console shows `claude-chan: Live2D model failed to load, showing the sprite version instead.` and the sprites take over in the same box. `claudeChan.renderer` then reports `sprites`. `renderer: 'live2d'` without a model URL warns and shows sprites too.

## Turn it on

npm / ES module:

```js
ClaudeChan.mount(document.body, {
  renderer: 'live2d',
  model: '/assets/live2d/claude-chan/claude-chan.model3.json',
  coreUrl: undefined,             // default: official Live2D CDN; set to a self-hosted copy for offline/CSP
  expressions: { smile: 'f01' },  // optional: preset name -> model expression name
  interactive: undefined,         // default on for live2d: cursor gaze, click = wave, drag = surprised
});
```

pixi.js and pixi-live2d-display are imported with `import()`, so the bundler puts them in lazy chunks (`dist/pixi-*.js`, `dist/cubism4.es-*.js`); sprite users never download them.

Web component: `<claude-chan renderer="live2d" model="/assets/live2d/claude-chan/claude-chan.model3.json" core-url=""></claude-chan>`.

Hot-load (docs/HOT-LOAD.md):

```js
window.claudeChanConfig = { renderer: 'live2d', model: 'https://example.com/live2d/claude-chan/claude-chan.model3.json' };
```

or `data-renderer="live2d" data-model="…" data-core-url="…"` on the loader script tag. Without `model` the loader uses `<base>/assets/live2d/claude-chan/claude-chan.model3.json`. The hot-load files cannot use `import()`, so for `live2d` they add three script tags, in this order: Cubism Core (`coreUrl`), then the pinned UMD builds `https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js` and `https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js` (override with `live2dRuntime: { pixi, live2d }`). A page AMD loader (RequireJS, Monaco) is hidden while they run. With the default `sprites` nothing of this is requested (checked by `npm run test:live2d`, case D).

## Folder layout

The renderer works with any standard Cubism 4/5 runtime folder. Recommended place (not committed, see Licensing):

```
assets/live2d/<name>/
  <name>.model3.json        entry file: the model URL points here
  <name>.moc3
  <name>.physics3.json      optional (hair/cloth physics)
  <name>.pose3.json         optional
  <name>.cdi3.json          optional (parameter names)
  <name>.4096/texture_00.png  (folder name is whatever the Editor wrote; model3.json lists it)
  motions/*.motion3.json
  expressions/*.exp3.json
  motions.json              optional: preset -> group/expression map (docs/ART-PIPELINE.md section 7)
```

All paths inside `model3.json` are relative to it, so the folder can be hosted anywhere (same origin, or a server that sends CORS headers).

## How presets reach the model

- **Motions.** For a preset (for example `wave`) the renderer plays, in this order: the `motions.json` entry next to the model (or the `map` passed in code); else a model motion group with the same name in any case and without `_` (`wave`, `Wave`, `ShakeHead` for `shake_head`); else the Cubism sample names (`Idle` for idle, `TapBody` for wave/happy/cheer). A preset with no group gets only the procedural head/body pose. Easiest: name the motion groups exactly like the presets: idle, wave, nod, shake_head, think, happy, surprised, bow, cheer, sleepy, typing, tea_serve, pout, wink, point.
- **Expressions.** neutral, smile, sad, angry, blush, surprised map through `expressions` (option or `motions.json`); unmapped names are used as the model's expression name. Unknown names keep the current face.
- **Parameters, every frame.** The engine writes the standard IDs (src/types.ts `PARAMS`): `ParamAngleX/Y/Z`, `ParamEyeLOpen/ROpen` (blink), `ParamEyeBallX/Y` (gaze), `ParamMouthOpenY` (lip-sync via `lipSync(audio)` or speech bubble), `ParamMouthForm`, `ParamBreath`, `ParamBodyAngleX/Z`, `ParamBrowLY/RY`, `ParamCheek`, `ParamArmLA/RA`, `ParamHairSway`. While a model motion plays only gaze, blink and mouth are written, so the authored head/body animation stays visible. A model without some ID just ignores it.
- **Interaction** (`interactive`, default on for Live2D): the eyes and head follow the cursor (back to idle glances 2.5 s after the cursor stops), a click plays `wave` with a smile, grabbing her plays `surprised`.

## Export from Cubism Editor (owner steps)

Cubism Editor 5.3 is installed at `E:\Program Files\Live2D Cubism 5.3\`. Menu names below are from Editor 5.x; they can differ slightly between versions.

1. Open the claude-chan model project (`.cmo3`) in the **Modeling** workspace. Check the parameter IDs: use the standard ones listed above (the Editor's default template already does).
2. **File > Export For Runtime > Export as moc3 file…** In the dialog:
   - moc3 version: the newest is fine with the Core from the Live2D CDN. If the browser console later says the moc version is unsupported, export again with an older version (4.x).
   - Check *Export model settings file (model3.json)*, *Export physics settings file (physics3.json)*, *Export display auxiliary file (cdi3.json)*, and the pose file if the model has one.
   - Texture: 2048 or 4096 atlas, *premultiplied alpha* left on (default).
   - Save into `assets/live2d/claude-chan/` with the file name `claude-chan`.
3. Open the animation file (`.can3`) in the **Animation** workspace. For each scene: **File > Export For Runtime > Export as motion3.json…** into `assets/live2d/claude-chan/motions/`, file name = preset name (`wave.motion3.json`, …).
4. Expressions: in the Animation workspace with an expression scene, **File > Export For Runtime > Export as exp3.json…** into `expressions/` (`smile.exp3.json`, …).
5. Put the motions into groups and register the expressions in `model3.json`: open `claude-chan.model3.json` in **Cubism Viewer 5** (`CubismViewer5.exe` in the same install folder), add the motions with the group name = preset name, add the expressions, then export the model3.json again. (Alternative: write `motions.json` next to the model, docs/ART-PIPELINE.md section 7.)
6. Check the folder: `npm run check:model -- assets/live2d/claude-chan`.
7. Try it: `LIVE2D_MODEL_DIR=assets/live2d/claude-chan npm run test:live2d` (headless smoke), then `npm run dev` and open `http://127.0.0.1:5178/?model=/live2d/claude-chan/claude-chan.model3.json` for the visual check (the dev server serves `assets/` at the site root; leave the Core field empty to use the CDN).

## Licensing

- **Cubism Core** (`live2dcubismcore.min.js`) is proprietary (Live2D Proprietary Software License Agreement). It is never committed here. By default the browser loads it from the official CDN `https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js`; that means the visitor's browser contacts Live2D's server. To avoid that (offline, strict CSP, privacy), download the Core from live2d.com and set `coreUrl` to your copy. `.gitignore` blocks `live2dcubismcore*.js`.
- **pixi-live2d-display 0.4.0** (MIT) bundles the Cubism 4 Framework, which is under the Live2D Open Software License; **pixi.js 6.5.10** is MIT. Both are pinned to exact versions in package.json and in the hot-load CDN URLs.
- **Publishing**: Live2D's SDK release licence may apply to commercial publishers above their revenue threshold; check https://www.live2d.com/en/sdk/license/ before a commercial release.
- **Models**: the claude-chan model is the owner's own work. By default it is not committed (`.gitignore` blocks `assets/live2d/*`); host it next to the page and set `model`. Commit it only if the owner decides the public repo should carry it (then remove the ignore line); the hot-load default path then works from GitHub Pages. Never commit Live2D sample models (Haru, Hiyori…): they are under the Free Material License and are for local testing only.

## Testing

- Unit: `npx vitest run tests/live2d-cubism.test.ts tests/live2d-puppet.test.ts`.
- Headless smoke: `npm run build:loader`, then `LIVE2D_MODEL_DIR=<folder> [LIVE2D_CORE=<local core>] npm run test:live2d`. Without `LIVE2D_MODEL_DIR` it is skipped. It checks mount, model + canvas, a motion group starts, a mapped expression is applied, console API, drag and click reactions, the sprite fallback for a missing model and a blocked Core, and hot-load with and without Live2D. A Live2D sample model (for example Haru from github.com/Live2D/CubismWebSamples, `Samples/Resources/Haru`) can be downloaded outside the repo for this.
- Debug: the Live2D container carries `data-l2d-motion` (last started group) and `data-l2d-expression` (last applied expression).
