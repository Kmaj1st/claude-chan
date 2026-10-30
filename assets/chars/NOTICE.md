# Sprite attribution

The 21 pose images in this folder (idle, blink, beam, happy, giggle, wave, ponder, think, notice, surprised, cheer, cheer_wink, sleepy, typing, explain, pout, idea, sad, blush, wink, away) were made from files of https://github.com/Chaosnap/Claude_Overdose, commit ecae21b945a8164359de6d983b1b2a5aef71a8fd, folder public/assets/chars. poses.json lists the source file of each pose in its "source" field.

Upstream licence: MIT, Copyright (c) 2026 Yuki. The upstream LICENSE says the MIT licence covers the source code and the AI-generated images of that repository. Keep this notice with the files. The MIT text is in docs/LICENSES.md.

Not covered by that licence and not included here: the song "INTERNET OVERDOSE" and its lyrics, the game NEEDY GIRL OVERDOSE, and any trademark such as "Claude" (owned by Anthropic). The sprites are community fan art and are not endorsed by Anthropic.

Changes made by claude-chan: each image was rescaled with sharp so the face has the same height in every pose, and re-encoded as webp (quality 80). Nothing was redrawn or retouched. Run `node scripts/build-sprites.mjs <clone of the art repo>` to rebuild the folder.

The sprites are flat images, not a rigged model: poses change by cross-fading between images, and the small movements (breathing, sway, look-at) move the whole picture.
