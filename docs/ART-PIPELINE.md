# Art pipeline: delivering the real Claude-chan Live2D model

The built-in procedural puppet is a stand-in. A real model needs Live2D Cubism Editor and a human artist. Nothing here is faked. This document is the brief for that artist.

Design: see CHARACTER.md (palette, outfit, personality). The fan art reference is for inspiration only and must not be traced or reused.

## 1. Deliverable

A drop-in folder:


claude-chan/
 claude-chan.model3.json
 claude-chan.moc3
 claude-chan.physics3.json
 claude-chan.cdi3.json
 textures/texture_00.png (2048 or 4096 px, premultiplied alpha)
 motions/<name>.motion3.json
 expressions/<name>.exp3.json
 motions.json (maps preset names to the model)


Cubism 4 format. Textures and art must be original and redistributable under a licence the maintainers agree to.

## 2. PSD layers (one PSD, named layers, no merged groups)

| Group | Parts |
| --- | --- |
| Hair back | hair_back_long, hair_back_tips |
| Body | body, neck, arm_L_upper, arm_L_lower, hand_L, arm_R_upper, arm_R_lower, hand_R |
| Outfit | dress, apron, apron_frill, suspender_L, suspender_R, bow_brown, brooch_flower |
| Head | face, ear_L, ear_R, cheek_blush, nose |
| Eyes (per side L/R) | eye_white, iris, pupil, highlight, upper_lash, lower_lash, eyelid_closed |
| Brows | brow_L, brow_R |
| Mouth | mouth_closed, mouth_open, tongue, teeth |
| Hair front | bangs, side_hair_L, side_hair_R, ahoge |
| Accessories | headdress_frill, hairpin_flower, hairpin_tassel_L, hairpin_tassel_R |
| Props | tray, teacup, keyboard (optional, for tea_serve and typing) |

Split every part that moves. Keep overlap under bangs, hair and sleeves so deformation shows no gaps.

## 3. Parameters

Use the standard Cubism IDs. The procedural puppet uses the same IDs, so both renderers share one contract. Ranges are the Cubism defaults unless noted.

| ID | Range | Drives |
| --- | --- | --- |
| ParamAngleX / Y / Z | -30..30 | head turn, nod, tilt |
| ParamEyeLOpen / ParamEyeROpen | 0..1 | blink, wink |
| ParamEyeBallX / Y | -1..1 | gaze |
| ParamBrowLY / ParamBrowRY | -1..1 | brows |
| ParamMouthOpenY | 0..1 | lip-sync |
| ParamMouthForm | -1..1 | frown to smile |
| ParamCheek | 0..1 | blush |
| ParamBodyAngleX / Z | -10..10 | body sway |
| ParamBreath | 0..1 | breathing |
| ParamArmLA / ParamArmRA | -10..10 | arm raise |
| ParamHairSway | -1..1 | hair, driven by physics |

The source of truth is PARAMS in src/types.ts. If the artist needs more parameters, add them there and in motions.json together.

## 4. Motions

One .motion3.json per preset name, loopable where noted. Names are stable and must match exactly:

idle (loop), wave, nod, shake_head, think, happy, surprised, bow, cheer, sleepy (loop), typing (loop), tea_serve, pout, wink, point.

Guidelines: 1 to 4 s each, start and end on the neutral pose so motions chain cleanly, no root-position movement.

## 5. Expressions

One .exp3.json each: neutral, smile, sad, angry, blush, surprised. Use additive blends for small changes.

## 6. Physics

Hair (front, side, back), headdress frill, tassels and the ahoge. Keep it subtle and stable at 30 and 60 fps.

## 7. motions.json

Maps our preset names to Live2D motion groups and expressions. The artist fills it in with the engineer. Example shape:


 {
  "motions": { "wave": { "group": "wave", "index": 0 } },
  "expressions": { "smile": "smile" }
 }


Runtime behaviour (src/live2d.ts):

- The loader fetches motions.json from the folder of the model3.json URL. A parsed map passed in code (map) takes precedence. A missing or invalid file is ignored.
- When the engine starts a preset motion, the loader plays motions[preset] with model.motion(group, index). Presets without an entry only get the procedural pose. An unknown group is ignored.
- expressions[preset] maps a preset expression to a model expression id.
- The shared procedural pose is applied before each model update, so it wins over built-in idle motions.
- The params key in the default file is reserved and ignored by the loader; do not rely on it.

The exact schema is defined by the loader and must be kept in sync with this file.

## 8. Export steps (Cubism Editor)

1. Build the model from the PSD, then set up the parameters and deformers.
2. Add physics and the model settings (File > Export Runtime Files).
3. Export motions and expressions from the Animation workspace.
4. Run npm run check:model -- <folder> (server/modelcheck.ts): it verifies the files named in model3.json exist, motions.json matches the presets and expressions, and cdi3.json has the standard parameters. Then check that the model loads and run the demo and enter the model3.json URL (and the Core URL) in the Live2D row, or open it with ?model=<url>&core=<url>.
5. Check every preset motion and expression, with and without lip-sync.

## 9. Licence checklist

- Art is original, or the licence allows redistribution in this repo.
- No traced or copied reference art.
- The Live2D runtime terms are noted in LICENSES.md.
