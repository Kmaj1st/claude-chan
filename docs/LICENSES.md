# Licences

This file records the licence position of everything claude-chan ships or loads. It is not legal advice. Check the linked official terms before you publish.

## claude-chan code

Private project. No public licence has been chosen yet.

## Character and art

- The Claude-chan design (docs/CHARACTER.md) and the procedural puppet (src/puppet.ts, src/puppet-svg.ts) are original work in this repo.
- The fan-art reference image is reference only. It is not in this repo and nothing is traced or reused from it.
- No Live2D model is committed. Do not commit a model unless its licence allows redistribution.

## Live2D runtime

The Live2D Cubism renderer is not bundled yet. The planned loader needs two parts:

| Part | Licence | Note |
| --- | --- | --- |
| Cubism Core (live2dcubismcore.min.js) | Live2D Proprietary Software License Agreement | Download from live2d.com. Do not edit it. Self-host the file, no runtime CDN. |
| Cubism Web framework or pixi-live2d-display | Live2D Open Software License / MIT (check the exact version) | Verify the licence file of the version you install. |

Points to verify on the official Live2D site before publishing an app that includes the runtime:

- Whether your use needs a Live2D publication licence (this depends on the size and type of the publisher).
- Whether the Core file may be redistributed in your package. Until this is confirmed, do not commit the Core file. Document a manual download step instead.
- Sample models have their own terms. Use one only if its terms allow your use, and never commit it without that permission.

Official sources: https://www.live2d.com/en/sdk/license/ and https://www.live2d.com/en/terms/live2d-proprietary-software-license-agreement/

I could not check these pages in this session, so the table above reflects general knowledge and may be out of date.

## npm dependencies

Run npm ls and check each package licence before a public release. Current direct dependencies are the MCP SDK, a WebSocket library, esbuild, vite, vitest and typescript. All are expected to be permissive, but this has not been audited.
