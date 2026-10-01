# Brief 09 direction guides — 1 October 2026

These are **anatomical paint guides, not finished sprites**. Never add them to the runtime manifest or promote the walk release gate. Use the approved painted down-v3 soldier for face, helmet, proportions and kit. The simplified guide rendering is not the house-style target.

Four PNGs cover six-frame up/right walks and two-frame up/right idle. Their JSON files record cells, pivot and anatomical foot identity. Right is the near leg in the right-facing view. At contact frame 4 the far/left leg leads; the near/right leg is behind. This must remain visible in the painting.

Source cells are 256×384, pivot (128,330). The original master has 300 source pixels per 44 world pixels (6.818 source px/world). These are source guides, **not fixed-density 3× runtime exports**. A fixed-density runtime figure is 132 pixels tall; preserving a 256×384 runtime cell and pivot requires repacking that smaller figure, rather than labelling the 300-pixel master “3×”. Claude must confirm the source/export mapping in the station contract before changing character exports. Facility offsets remain exactly 3×.

Run `node tools/render-direction-contact-guides.cjs` with `@napi-rs/canvas` installed. It regenerates all guides and asserts signed planted-foot cancellation over stance intervals and opposite lead legs in frames 1 and 4. These assertions test geometry/metadata only, not a painted raster or a game clip. Source stance motion is 25 pixels per frame: right decreases x; up increases y. Two idle frames keep both soles fixed, with only a one-pixel body breath.

Paint one cell at a time, preserving the actual limb path and sole contact. Reject any painting that redraws the second half as the first half, changes the soldier identity, introduces a backpack, moves the helmet/feet unpredictably or makes the body translucent. Reassemble without automatic per-frame scaling. Export white accent masks on exactly the same canvas. Then run the existing asset/gait validator and a 30-second direction-change/idle clip. No completed painted up/right cycle has been delivered by this pack.
