# Command Base: first playable production slice

## Target experience

A new player recruits a visitor, assigns training, launches a local patrol, and sees a meaningful result within a 10-minute session. The base should feel like a lived-in alpine outpost, with legible people and buildings at the actual 960 × 576 canvas size. This is a production target, not a claim about the current beta.

## Current baseline and biggest risks

- The beta has a working recruit/training/mission loop and two passing Node smoke checks. The smoke checks do not assess appearance, browser interaction, phone usability, or long-term balance.
- Character art consists of directional stills. The earlier procedural cutout stride was removed because it looked broken; people still need authored, consistent walk frames and activity loops. Four first-slice buildings now have organic bases, while later facilities retain their older square or cutaway art.
- The first patrol takes three real minutes. Later missions take 30 minutes to four hours; a first-session player may have too little to do while waiting. The 23-hour hospital timer is especially consequential. These values require observed playtests.
- Progress is stored only in localStorage. Backup import/export exists, but corruption handling, migration, and cross-device continuity remain open.

## Locked slice boundary

One base view: gate, entrance, barracks, one training facility, a mission dispatch point, connecting path, and surrounding meadow. Eight to twelve visible people including visitors and soldiers. Add reusable props, ground transitions, consistent shadows and active feedback. Do not scale new assets across all facilities until the reference scene passes review.

## Art bible, first edition

- Camera: fixed three-quarter view for buildings and characters, with consistent viewing angle; ground is a compatible overhead plane. Confirm perspective on a single composite before producing more assets.
- Light: warm upper-left key light; soft lower-right contact shadows. Shadows are drawn by the renderer or on a separate layer, never baked inconsistently into transparent character frames.
- Palette: muted alpine greens, warm earth, olive and khaki uniforms, restrained teal interface accents. Keep actionable silhouettes and faces clear against terrain at gameplay scale.
- Characters: consistent proportions and equipment across directions and frames. Deliver down, up, and right walk cycles with six distinct planted-foot frames each; mirror right for left only after checking insignia and equipment. Idle and one training/activity loop per archetype follow. Use sprite sheets with uniform frame boxes and explicit frame duration metadata.
- Buildings: identifiable silhouette and doorway at normal zoom, compatible footprint, transparent edges, separate ground shadow, and no embedded labels. Make the entrance and active training location recognizable without reading a tooltip.
- Props: first set includes fencing, lamps, crates, benches, noticeboard, signs, grass clumps, rocks, tyre marks, training equipment, and a parked utility vehicle. Reuse with controlled variation; avoid overlapping routes and click targets.
- UI: one heading type treatment, one body type family, one icon family, consistent panel corners and button states. Text contrast and touch targets must be checked on a portrait phone.

## Acceptance scene and checks

1. Capture a fresh-start desktop screenshot and a portrait-phone screenshot of the same scene. Verify that gate, entrance, barracks, training facility, visitors and actionable buttons are immediately identifiable.
2. Record a continuous 30-second clip with at least four people crossing paths. No sliding, foot skating, animation identity changes, depth jumps or clipping through buildings.
3. Play the first 10 minutes without instructions. Observe whether a new player can recruit, train and dispatch; record where they hesitate and whether they want to keep playing. Repeat with at least three people who did not build the game.
4. Test save/reload during a mission, return after a simulated absence, export/restore, and an invalid backup in a real browser. Run Node smoke tests and check console/network errors on desktop and phone.
5. Review the composite beside two currently available genre peers selected at review time, using the same approximate display size. Judge silhouette clarity, movement, environmental variety, UI readability and overall cohesion. Record concrete differences and iterate.

## Implementation order

1. Capture actual browser footage and instrument the first session: recruit, first assignment, first dispatch, first result, and drop-off points. Adjust early pacing from observations.
2. Make one approved composite reference with a building, moving soldier, visitor, terrain transitions and interface. Generate/edit art against this reference and explicitly verify usage rights.
3. Implement sprite-sheet playback and state-based animation, including route-based facing and contact shadows. Add a browser capture for animation review.
4. Add terrain transitions and a small prop/decal layer with seeded placement and walkability checks. Polish the slice buildings and UI in the same composite.
5. Iterate with blind playtests, then expand the approved kit and write save versioning/recovery before describing the game as a public release.

## Release boundary

This import is a beta checkpoint. No claim of top-tier artwork or release readiness follows from passing smoke tests. A public launch needs the hands-on checks above, a complete progression run, and feedback from players outside the team.
