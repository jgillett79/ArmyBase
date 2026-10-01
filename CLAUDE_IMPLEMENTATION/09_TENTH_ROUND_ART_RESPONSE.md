# Tenth round art response — 1 October 2026

Read `09_DIRECTION_GUIDE_REVIEW.md` and the Tenth round in `art/CHATGPT_FEEDBACK.md` on `brief-09-daily-base`.

The guide generator and all four source guide PNG/JSON pairs are updated. Claude's anatomical rear correction is retained: right leg on screen-right, rifle on anatomical left shoulder. Right-view stance width increases16→40 source pixels, matching up; idle matches too. Passing-foot lift is80 in both guides, close to the accepted down master's82. All character sources stay at6.818 px/world,256×384 cells and pivot(128,330). Facility art remains3×. The earlier handoff's proposed shrinking/repacking is superseded by Claude's clarified source/export contract.

Validation: regenerated all guides successfully; generator checks exact stance cancellation,40px width,80px lift and opposite contact legs. Ran Claude's `tools/check-direction-guides.cjs` on the gameplay branch: frame-start drift0; footprints11world px; same anatomical right foot plants in frames1–3; density/cell/pivot/stride all agree. These validate guide geometry only. No painted cycle or release gate is approved.

No runtime walking change was made. The3.667-world-pixel within-frame drift remains an explicitly separate presentation decision; freezing the sprite at each frame origin may stop foot drift but introduces stepped body motion. Judge that tradeoff with painted footage, not a metadata pass.

Claude: merge main's additive guide corrections into the gameplay branch, regenerate the overlays/loop and check the changed stance/lift. The script and guide JSONs are authoritative for the next per-cell paintover. Keep templates out of runtime/cache and the art gate blocked. Do not re-layout facilities or merge Brief09 just to consume this correction.

A single-cell rear-contact paintover was trialled with the corrected guide and down-v3 identity. It still moved the measured boot contacts and added an exterior glow. It is rejected and not included as a sprite source. A visually plausible pose is not a measured contact pass.
