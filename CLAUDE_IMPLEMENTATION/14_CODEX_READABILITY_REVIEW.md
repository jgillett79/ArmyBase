# Codex review — task 1, 3 October 2026

Reviewed implementation 495ba2f484492e41f7d94ed08d8d950caf22f3ab and committed walk-06 evidence.

## Decision
Keep warm/contrast lighting, identity marker and silhouette outline as a working preview comparison. This is permission to continue the isolated experiment, not final style approval or a production walk release. The figure reads substantially better on the trail with stronger contrast and the outline. The tiny accent alone does not visibly carry identity in this side view; the marker does. Do not enlarge the model or redesign its kit in this task.

I inspected the normal-size comparison PNG and extracted actual frames from both committed WebM clips, including a chronological contact montage from the frame-rule clip. These support the readability comparison; sampled frames are not a full real-time smoothness assessment. The body remains narrow and the outlined version has dark, conspicuous boot edges at zoom. Preserve the untreated comparator for Jason's eventual style judgement.

## Measurements and validation
The reported nearest-frame mean error 0.018 versus 0.456 world px and maximum 0.458 versus 0.918 are consistent with the selection code and committed statistics. Nearest selection centres quantization error; it does not solve foot snapping. Within-stance peak-to-peak creep stays about 0.9 world px, with maximum 1.070 for nearest. Do not describe it as a foot-lock fix.

The measurement uses linearly interpolated recorded foot depth and flat contact only, excluding toe contact. It is a useful quantization estimate, not an independent measurement of every visible boot or of continuous deformed geometry. Wrap/contact-boundary exclusions and unequal sample counts must be disclosed in later comparisons.

Changed paths preserve preview isolation: no js/, normal game entry, asset manifest or offline-cache changes. World and routine tests passed independently here. Asset validation could not be independently completed here because the validator requires Edge/Chrome and this environment has none; Claude reports a clean local asset validation. No visual release gate is changed.

## Task 2 — bounded density experiment
Compare 24 and 48 unique walk phases using nearest-frame selection, in the same isolated right-facing walking/readability preview. Keep the existing 24-phase baseline untouched. See the handoff below. Do not add directions, change speed/stride, widen the body, redesign animation, add a start animation, or roll out game art.

1. Preserve motion baseline, calibration, pivot, 44 world-px height, speed 38 world px/s and stride 22 world px. Keep the same warm/contrast look, silhouette outline and optional identity marker for both panels.
2. Export 48 distinct uniformly spaced phases of the same cycle into a NEW folder. Fractional-time interpolation of the keyed rig is acceptable only after checking deformed planted sole/toe contacts at the intermediate samples; it must not introduce sliding, ground penetration or shoulder/harness distortion. Do not duplicate frames and call that 48 phases. If interpolation fails, report the exact failure rather than repairing gait under this brief.
3. Explicitly map normalized phase to export index and record phase, contact leg, sole coordinates and travel distance for each frame. Preserve loop wrapping. Keep the already-reviewed stop/idle unchanged, and clearly label that only walking density differs.
4. Compare 24-nearest versus 48-nearest on the same route at zoom 1 and 1.6. Report mean/RMS/max phase error and peak-to-peak planted-foot excursion for like-for-like contact intervals, both legs. Separate flat sole and toe-off; report excluded intervals. Inspect actual deformed contacts, not only interpolated report rows. Expected flat-contact quantization is about 0.46 px peak-to-peak for 48 phases, but measure it.
5. Commit a 20–30 second comparison WebM, sharp adjacent-frame stance strips, representative normal-size and zoom PNGs, contact statistics and total frame bytes/export count. A 60-fps capture is useful if available to avoid hiding sprite updates; label capture fps and sprite phase count separately.
6. Re-run local asset validation and world/routine tests, recording exact outcomes. Confirm no manifest/cache/game integration. Write a report and hand back CODEX_REVIEW with implementation commit and committed evidence paths.

Budget: one right-facing cycle only; avoid a second large stop or accent-mask render unless actually required. If renders cannot finish before noon Sydney, record completed and remaining frame counts and render state. No new tasks or automatic integration after the deadline.

Acceptance for further review: 48 phases truly distinct; preserved contact and motion; materially lower measured quantization and no new visible contact pop; comparison evidence complete. This does not approve the model's final appearance or production use.
