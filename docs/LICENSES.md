# Licences

This file records the licence position of everything claude-chan ships or loads. It is not legal advice. Check the linked official terms before you redistribute.

Claude-chan is a fan project. It is not affiliated with or endorsed by Anthropic. "Claude" is a trademark of Anthropic and is used here only descriptively.

## claude-chan code

MIT, Copyright (c) 2026 Kmaj1st and Claude-chan contributors. See the LICENSE file in the repository root.

## Character and art

- The Claude-chan design (docs/CHARACTER.md) and the procedural puppet (src/puppet.ts, src/puppet-svg.ts) are original work in this repo.
- The pose sprites in assets/chars come from the MIT-licensed repository Chaosnap/Claude_Overdose (copyright Yuki; commit ecae21b945a8164359de6d983b1b2a5aef71a8fd). Only the 21 images that are used are committed. Attribution and the list are in assets/chars/NOTICE.md. The sprite renderer (src/sprite/) draws them as flat images; they are not rigged.
- The fan-art reference image is reference only. It is not in this repo and nothing is traced or reused from it.
- No Live2D model is committed. Do not commit a model unless its licence allows redistribution.

## Sprite art licence (Chaosnap/Claude_Overdose)

Source: https://github.com/Chaosnap/Claude_Overdose, commit ecae21b945a8164359de6d983b1b2a5aef71a8fd.

The upstream LICENSE reads:

    MIT License

    Copyright (c) 2026 Yuki

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.

    This license covers the source code and the AI-generated images in this
    repository. It does NOT cover the song "INTERNET OVERDOSE", its lyrics, the
    game NEEDY GIRL OVERDOSE, or any trademark (e.g. "Claude", owned by Anthropic);
    none of those are included here.

What this means here:

- The sprite images may be used, copied and modified under MIT, with the copyright and licence notice kept (done in assets/chars/NOTICE.md and this file).
- The song, its lyrics, the game and the Claude trademark are not covered and are not included. The sprites are fan art, not endorsed by Anthropic.
- The sprites are flat images, not a rigged model. A real Live2D model still needs layered parts from an artist (docs/ART-PIPELINE.md).
- If you redistribute the art, re-check the upstream repository for changes.

## Live2D runtime

The Live2D renderer (src/live2d.ts) is loaded lazily, only when a model URL is set. It needs two parts:

| Part | Licence | Note |
| --- | --- | --- |
| Cubism Core (live2dcubismcore.min.js) | Live2D Proprietary Software License Agreement | Download from live2d.com. Do not edit it. Self-host the file, no runtime CDN. |
| pixi-live2d-display 0.4.0 (with pixi.js 6.5.10) | MIT (verify the licence file of the installed version) | Imported dynamically by src/live2d.ts, so the procedural puppet bundle stays small. |

The host page supplies the Core file through the coreUrl option (default ./live2dcubismcore.min.js). The loader never fetches it from a CDN.

Points to verify on the official Live2D site before publishing an app that includes the runtime:

- Whether your use needs a Live2D publication licence (this depends on the size and type of the publisher).
- Whether the Core file may be redistributed in your package. Until this is confirmed, do not commit the Core file. Document a manual download step instead.
- Sample models have their own terms. Use one only if its terms allow your use, and never commit it without that permission.

Official sources: https://www.live2d.com/en/sdk/license/ and https://www.live2d.com/en/terms/live2d-proprietary-software-license-agreement/

The table above is a summary; the official terms are authoritative.

## npm dependencies

Run `npm ls` and check each package licence before you redistribute a build. Direct dependencies are the MCP SDK, a WebSocket library, zod, esbuild, vite, vitest, typescript, puppeteer-core (e2e only), pixi.js and pixi-live2d-display. Each is published under its own licence; check the installed versions.
