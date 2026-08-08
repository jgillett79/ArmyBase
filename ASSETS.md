# Art asset spec — Phase 2 art pass

This is the manifest for replacing the placeholder canvas shapes
(`js/render.js`) with real images. It exists so you (or your local AI image
pipeline) can generate everything against a fixed spec, and so a future
Claude Code session can wire the finished files into `render.js` without
guessing filenames or sizes.

**Nothing in this file changes the game yet.** Dropping images into the
paths below won't make them appear on screen — `render.js` still draws
rectangles/circles until a follow-up coding pass swaps those calls for
`drawImage()`. Generate the art first, confirm the look, then ask for the
wiring pass.

## Before you mass-generate: confirm the style

No art direction has been locked yet (this was an open question — see
`CLAUDE.md`). Below is a **recommended default**, chosen to match the dark
military palette already baked into `css/style.css` and the placeholder
colors in `render.js`. If you want something different (pixel art,
painterly, realistic photo-style, cartoon), say so before generating all 13+
images — redoing a whole batch after the fact is wasted generation budget.

**Recommended style:**
- Flat/vector illustrated, not painterly or photorealistic. Clean shapes,
  minimal gradient/shadow — this needs to read clearly at small on-screen
  sizes (buildings render at 144×96px, units at 32×48px).
- Muted military palette: olive, khaki, brown, steel-blue, dark green.
  Roughly matching the existing placeholder hexes: `#5a6450` `#8a9478`
  `#6a5240` `#40605a` `#5a4a6a` `#6a5a30` `#4a5a6a` `#d8d8c8`.
- Buildings: top-down or slight isometric (matches the grid-based base
  layout — buildings are laid out on a flat 20×12 top-down grid).
- Units: simple front-facing stylized character icon, NOT top-down — small
  human figures read better face-on than as a top-down blob at this scale.
  Think "board game piece" more than "realistic soldier portrait."
- No animation frames needed yet. Units currently just glide between two
  points with no walk cycle — a single static pose per sprite is enough for
  this pass. Animated spritesheets can be a later upgrade once static art
  is validated in-engine.

## Technical requirements (all assets)

- **Format:** PNG-24 with alpha transparency. Transparent background outside
  the subject — no white/colored background box.
- **Resolution:** generate at 4× the in-game display size (table below) so
  the art stays crisp if the canvas is ever scaled up for larger screens —
  this is a mobile-first PWA per `CLAUDE.md`, so headroom matters.
- **Naming:** every filename below matches an identifier that already
  exists in the code (`building.type`/`.id` in `js/building.js`,
  `unit.outfit` in `js/unit.js`). Don't rename them — the wiring pass will
  do a direct `id → filename` lookup.

## Character art needs to tint, not just display

In `js/render.js`, `drawUnit()` currently hue-shifts every unit's body color
based on a random `colorSeed` (0-359°) — that's the entire mechanism that
makes 20 recruited soldiers look distinguishable from each other right now,
and it'll keep doing that job even after real art lands (generating 20
fully unique sprites per unit isn't in scope for this pass — see "Not
included" below).

**This means every civilian/soldier sprite needs to be desaturated /
grayscale-leaning at the base** — light neutral tones (grays, muted
khaki/tan), not fully saturated color. A canvas hue-tint over a
already-saturated image looks wrong (fights the original color instead of
replacing it). Buildings are NOT tinted in code, so they should be
generated in full, final color per the palette above.

---

## Buildings (6 files)

Each building renders as a single static image at all levels — the level
number is drawn as a text overlay by existing code (`Lv.1`/`Lv.2`/`Lv.3`),
not baked into the art. Only the "built" appearance needs art; the
"not-built" state (dashed placeholder outline) stays procedural — no asset
needed for that.

In-game display size: **144×96px** (3×2 grid cells @ 48px/cell).
Generate at: **576×384px**.

| Filename | Path | Building | Prompt notes |
|---|---|---|---|
| `barracks.png` | `assets/buildings/barracks.png` | Barracks | Simple military sleeping quarters — long low building, bunk-style, olive/khaki tones (`#5a6450`). Reads as "home base," the first building a player sees. |
| `shooting_range.png` | `assets/buildings/shooting_range.png` | Shooting Range | Open-air firing range — lanes, target silhouettes at the far end, low barrier walls. Brown/tan tones (`#6a5240`). |
| `weight_room.png` | `assets/buildings/weight_room.png` | Weight Room | Enclosed gym structure — visible barbells/weight racks through a window or open front. Muted purple-gray tones (`#5a4a6a`). |
| `obstacle_course.png` | `assets/buildings/obstacle_course.png` | Obstacle Course | Outdoor course — low walls, cargo nets, tires, a climbing frame. Olive-brown tones (`#6a5a30`). |
| `drill_yard.png` | `assets/buildings/drill_yard.png` | Combat Drill Yard | Open paved/dirt yard with training dummies or cone markers — reads as "general combat training," distinct from the Weight Room's indoor-gym feel. Steel-blue tones (`#4a5a6a`). |
| `mess_hall.png` | `assets/buildings/mess_hall.png` | Mess Hall | Dining hall — picnic-style tables or a chow line, a serving window. Teal-green tones (`#40605a`). |

## Civilians (3 files)

Civilians are units that haven't been recruited yet — they walk toward the
base and can be clicked to recruit. Each `outfit` value in `unit.js` needs
its own sprite (currently these are just a colored dot + a small emoji
marker; this replaces the whole body).

In-game display size: **32×48px**. Generate at: **128×192px**.
Desaturated base tones (see tinting note above) — final on-screen color
comes from the in-code hue tint, not the art.

| Filename | Path | `outfit` value | Prompt notes |
|---|---|---|---|
| `civilian.png` | `assets/units/civilians/civilian.png` | `'civilian'` | Generic pedestrian, walking pose, casual clothes. The "just walked by" civilian. |
| `bus_rider.png` | `assets/units/civilians/bus_rider.png` | `'bus_rider'` | Pedestrian with a small bag/duffel, slightly more "just arrived" look — was on the bus that drops recruits near the base. |
| `taxi.png` | `assets/units/civilians/taxi.png` | `'taxi'` | Pedestrian with a slightly sharper/neater look — arrived by taxi, reads as marginally more put-together than the bus rider. |

## Soldiers (6 files, one variant pack)

Once recruited, a unit becomes a soldier (`outfit: 'uniform'`). Rather than
one single sprite for all 20 possible roster slots (which would make every
soldier's *shape* identical, only the tint different), generate **6 body
variants** — the game will pick one per recruited unit (same random-pick
pattern already used for civilian outfits) and still apply the hue tint on
top, so you get 6 shapes × effectively unlimited hues.

In-game display size: **32×48px**. Generate at: **128×192px**.
Desaturated base tones (tinting note above applies).

| Filename | Path | Prompt notes |
|---|---|---|
| `soldier_01.png` | `assets/units/soldiers/soldier_01.png` | Standard uniform, standing/walking pose, no headgear. |
| `soldier_02.png` | `assets/units/soldiers/soldier_02.png` | Standard uniform + helmet. |
| `soldier_03.png` | `assets/units/soldiers/soldier_03.png` | Standard uniform, slightly bulkier/taller build. |
| `soldier_04.png` | `assets/units/soldiers/soldier_04.png` | Standard uniform, slighter/shorter build. |
| `soldier_05.png` | `assets/units/soldiers/soldier_05.png` | Standard uniform + beret or soft cap (visual variety vs. the helmet variant). |
| `soldier_06.png` | `assets/units/soldiers/soldier_06.png` | Standard uniform + backpack/gear webbing, reads as slightly more "equipped." |

All six should share the same silhouette scale/proportions and pose
(standing, facing forward, arms at sides or a neutral walking stance) so
swapping between them mid-game doesn't look jarring as a unit moves.

---

## Not included in this pass (intentionally)

- **"Not built" building ghost state** — stays the existing dashed-outline
  procedural render. No asset.
- **Status overlays** — the hospital ring, energy bar, name/status text
  labels above units. These are small, dynamic (change every frame), and
  drawn procedurally on top of whatever sprite ends up there — baking them
  into static art would mean regenerating art every time a number changes.
  No asset needed.
- **Per-unit unique portraits** — the profile panel currently shows text
  stats only, no image slot exists in `index.html` yet. Fully unique art
  per one of up to 20 individually-named soldiers would need either 20x the
  generation work or a runtime generation pipeline wired into the recruit
  flow — that's a bigger, separate decision (ties into the "art pipeline"
  open question in `CLAUDE.md`), not something to fold into this batch.
- **Walk-cycle animation frames** — see style note above.

## Folder structure (already created, empty except placeholders)

```
assets/
  buildings/
    barracks.png
    shooting_range.png
    weight_room.png
    obstacle_course.png
    drill_yard.png
    mess_hall.png
  units/
    civilians/
      civilian.png
      bus_rider.png
      taxi.png
    soldiers/
      soldier_01.png
      soldier_02.png
      soldier_03.png
      soldier_04.png
      soldier_05.png
      soldier_06.png
```

Drop each generated file at the exact path above (overwriting nothing else
— the `.gitkeep` placeholders can be deleted once real files land in each
folder). When they're all in place, come back and ask for the `render.js`
wiring pass to switch from procedural shapes to `drawImage()` calls.
