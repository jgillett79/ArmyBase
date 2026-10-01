# Brief 09 direction guides — Eleventh round, 1 October 2026

**Paint templates only, never runtime art.** These four PNG/JSON pairs supersede the Tenth round's40/80 measurements. The accepted down-v3 identity is still the paint reference. No finished up/right painting is delivered by this pack.

Cells256×384; pivot(128,330); source density300/44px/world; stride22world px; six walk frames/two idle frames. Characters are not rescaled to3×. Claude makes runtime exports; facility/station layers remain3px/world.

The generator uses exactly `docs/screenshots/2026-10-01-direction-guides/proposed-tracks-tenth-round-followup.json`:

- Stance width52 in both walks/idles. Rear right foot/hip is x154, left x102. Right-facing near ground row356, far304; hip depths follow those rows.
- Passing lift8 at frames3/6, feet at equal forward depth. Mid-swing lift12 at frames2/5.
- Toe-off lift8, with up trailing soles row359 at frames1/4. Near/far boots retain their anatomical identities.
- Planted feet move25source px per frame with the correct sign. Same anatomical foot plants in every direction at every phase. Rifle remains on anatomical left shoulder.

Knees are solved in forward-depth/vertical-height space before projection. A screen row difference includes both ground depth and elevation; it must not be used directly as a lift measurement. Boot sole points remain exactly the proposed tracks.

Regenerate: `node tools/render-direction-contact-guides.cjs` (`@napi-rs/canvas` dependency). Validate: `node tools/check-direction-guides.cjs`. It exits0 and prints **ready to paint one cell at a time**. Generator also checks width52/lift8, signed stance cancellation and alternating contact legs. Geometry checks do not validate painted raster contacts.

The guides remain absent from `js/asset-manifest.js` and `service-worker.js`. No walking speed, stride or foot-lock change. The6-frame renderer still has3.667world px of within-frame drift; that separate behaviour is unchanged.

Paint each cell over these guides using the accepted down-v3 face/helmet/uniform/webbing/rifle identity. Fully opaque interior, no glow/backpack/shadow/effect. Keep boots on recorded contacts. Supply a white helmet-band/shoulder accent mask on identical canvases. Reassemble without individual frame resizing. Claude measures painted boot pixels, runs gait validation and reviews a30-second turn-and-idle clip before registration or gate promotion.
