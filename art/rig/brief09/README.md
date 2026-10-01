# Brief 09 direction guides — Tenth round corrections, 1 October 2026

These are **paint guides, not finished sprites**. Never add them to the runtime manifest or promote the walk release gate. Use the accepted painted down-v3 soldier for face, helmet, proportions and kit; the simple guide rendering is not the style target.

Four PNGs cover six-frame up/right walks and two-frame up/right idle. Source cells: **256×384**, pivot **(128,330)**, source density **300/44 = 6.818 px/world**. Deliver painted sources and same-grid accent masks at this density. Claude makes the runtime exports. Do not shrink or repack character sources to 3×. Facility/station layers alone remain fixed at 3 px/world. Lying/sitting/climbing sources keep 6.818 px/world on wider cells, with an explicit consistent body pivot.

## Corrected geometry

- Anatomical right foot plants in frames 1–3 in every view. In up (back view), it is at screen x148; the left foot is at x108. Rifle stays on the anatomical left shoulder, screen-left from behind. Claude's correction is retained.
- Stance width is 40 source px (5.87 world px) in both views. Up: x108/148. Right: near/right sole ground row350, far/left row310. Idle uses the same spacing.
- Passing swing-foot lift is 80 source px in both guides, close to the down master's measured82. Up passing sole is row263 versus ground343. Right far passing sole row230 versus ground310; near passing sole row270 versus ground350.
- Stance-foot movement remains25 source px per frame: right decreases x; up increases y. Contact frames1 and4 plant opposite anatomical feet. No stride, runtime timing or speed changes.

Run `node tools/render-direction-contact-guides.cjs` with `@napi-rs/canvas` installed. It regenerates the PNGs/JSON and asserts signed cancellation, leg alternation, anatomical up identity,40-pixel width and80-pixel lift. These assertions test geometry, **not painted pixels**. Claude's `node tools/check-direction-guides.cjs` on `brief-09-daily-base` also passes: frame-start drift0, footprint spacing11 world px, runtime density6.818.

The runtime still has3.667 world px of within-frame drift because it moves the body continuously while holding each pose. This occurs in the down master too. No foot-lock change was made. Review the painted cycle in a30-second direction-change/idle clip before deciding on rendering changes or extra frames.

Paint one cell at a time. Preserve the anatomical limb path and sole contact, shared identity, opacity and kit. Reassemble without per-frame resizing. Deliver separate white helmet-band/shoulder accent masks. Run measured-raster foot tracks, asset/gait validation and the game clip before registration. This guide pack does not deliver an approved painted up/right cycle.
