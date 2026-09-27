# First game-scale static kit — 27 September 2026

This kit contains four **prepared** transparent prop sprites in `assets/props/` and loss-minimised original source art under `art/production/source/`. They are separate objects with clean alpha, at two image pixels per default world pixel, four transparent edge pixels and explicit pivots in `static-kit-v1.json`. Run `python tools/prepare-static-kit.py` to regenerate them. The 1× composition beside the game's current 44-pixel soldier is `art/review/static-kit-v1-contact.png`.

| File | Default world size | Pivot meaning | Draw/use |
| --- | --- | --- | --- |
| `range_target.png` | 53 × 66 | Ground contact centre | Draw at a target position **after** the existing range image's baked target is removed or a new range back layer is used. Keep hit effect separate. |
| `lift_barbell.png` | 86 × 36.5 | Centre of object | Attach the separate bar to a rigged soldier's hand grips during a lift. Do not stretch or bounce an entire soldier still. |
| `rec_bench.png` | 90 × 64 | Ground contact centre | Empty two-person seat for rec room; near rail is baked into this static image. A separately matched foreground rail is still needed for convincing seated occlusion. |
| `gate_boom.png` | 92 × 24.5 | Left hinge pin | Rotate this one rigid piece about its hinge. The kiosk hinge must be placed to match it; do not animate its old study's entire plinth. |

These are **ready-to-integrate images, not currently rendered in the game**. Claude owns placement, layer registration and the service-worker list; only after a captured game-scale integration and `node tools/validate-assets.cjs` passes should manifest status become `production`. If the existing range/kiosk composition cannot fit these pivots, use the provided source art as the approved style/pixel source and re-export for the final world anchors rather than distorting it.

Built-in image generation prompts, in summary: isolated three-quarter range target with dark rings and no marks; standalone symmetric liftable barbell with no stand; empty olive-cushioned timber rec bench; isolated striped gate boom with hinge stub and no plinth/road. All use chunky illustrated alpine outlines, warm upper-left lighting and genuine transparency; the range/weight/mess source art guided style. A barbell with a baked stand and a non-matching bench-front edit were rejected and are **not** in the kit.
