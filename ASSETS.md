# Art asset spec — Phase 2 art pass

This is the manifest for replacing the placeholder canvas shapes
(`js/render.js`) with real images. Every asset below has its own complete,
self-contained prompt — copy one entry's "Prompt" block directly into your
generator, it doesn't depend on reading the rest of this file to make sense.

**Nothing in this file changes the game yet.** Dropping images into the
paths below won't make them appear on screen — `render.js` still draws
rectangles/circles until a follow-up coding pass swaps those calls for
`drawImage()`. Generate the art first, confirm the look, then ask for the
wiring pass.

## Master style guide — applies to every one of the 13 images

Consistency across the set matters more than any single image looking
good in isolation — these all render together on one screen. Every prompt
below repeats these rules so each one still works standalone, but read this
once first:

- **Rendering style:** flat digital illustration / vector-style game art.
  Clean, closed shapes. Minimal-to-no gradient shading — think mobile
  strategy game asset, not concept art or painterly rendering.
- **Outline:** every shape gets a consistent dark outline (`#1a1d14`,
  matching the game's page background), roughly 2-3px at final resolution.
  No outline-free / "glow edge" style.
- **Lighting:** single soft, ambient light source from the upper-left, low
  contrast. No hard directional shadows, no rim lighting, no specular
  highlights. A soft, small contact shadow directly beneath the subject is
  optional but must be subtle (≤15% opacity) and NOT a hard drop shadow.
- **Background:** fully transparent (alpha channel), no background color,
  no ground texture, no vignette, no gradient backdrop. The subject only.
- **Composition:** subject centered, filling roughly 75-85% of the canvas
  on its longest axis, with even transparent padding on all sides. Camera
  square-on (buildings: top-down/slight isometric; characters: front-on) —
  no dramatic angle, no fisheye, no forced perspective.
- **Absolutely avoid:** text, numbers, logos, watermarks, signatures, UI
  chrome, other buildings/characters/props in frame, motion blur, lens
  flare, photorealism, film grain.
- **Format:** PNG-24 (8-bit per channel + alpha), sRGB color space.

Two sub-palettes are used, and it matters which one applies to which asset
— see the tinting note below.

**Building palette (use exact hex, full saturation, this IS the final
color):**
`#5a6450` (olive) · `#8a9478` (khaki-sage) · `#6a5240` (brown) ·
`#40605a` (teal-green) · `#5a4a6a` (muted purple) · `#6a5a30` (olive-brown)
· `#4a5a6a` (steel-blue) · `#d8d8c8` (light khaki, trim/highlight only)

**Character base palette (desaturated — see "why characters must be
desaturated" below):**
`#8a897d` (neutral warm gray, main uniform/clothing) · `#6e6d63` (darker
gray, shading/creases) · `#b8b6a8` (light gray-khaki, skin/highlight) ·
`#4a4942` (near-black gray, boots/straps/small details)

---

## Why characters must be desaturated (read before generating soldiers/civilians)

In `js/render.js`, `drawUnit()` hue-shifts every unit's body color at
render time based on a random per-unit `colorSeed` (0-359°) — that's the
entire mechanism that makes up to 20 recruited soldiers visually
distinguishable from each other today, and it will keep doing that job
after real art replaces the placeholder circles (generating 20 fully
unique character sprites is out of scope for this pass — see "Not
included" below).

A hue-shift filter recolors an image by rotating its existing hue values —
it does **not** replace color like a tint overlay would. If the source art
is already saturated (e.g. olive-drab uniform green), the hue-shift will
produce muddy, unpredictable results because it's rotating a color that's
already "used." If the source art is **desaturated/grayscale-leaning**
(the character base palette above), the hue-shift cleanly produces a wide,
predictable range of clean colors. **This is a hard technical requirement,
not a style preference** — soldiers and civilians must use ONLY the
character base palette (neutral grays/khakis), never the saturated
building palette. Buildings are never hue-shifted in code, so they use the
full building palette as their real, final color.

---

## Buildings (6 files)

Each building renders as a single static image at every level — the level
number (`Lv.1`/`Lv.2`/`Lv.3`) is drawn as a text overlay by existing code,
not baked into the art. Only the "built" appearance needs art; the
"not-built" state stays a procedural dashed outline — no asset for that.

**Shared specs for all 6 buildings:**
- **Save format:** PNG-24, transparent background
- **In-game display size:** 144 × 96 px (3×2 grid cells @ 48px/cell)
- **Generate at:** 576 × 384 px exactly (4× display size — also a clean
  multiple of 64px, which most AI image generators prefer as a native
  output size, so this shouldn't need awkward resizing)
- **Aspect ratio:** 3:2 (landscape)
- **Camera:** top-down with a slight isometric tilt — roughly a 30-40°
  angle down from directly overhead, as if looking down at a base layout
  map. Consistent across all 6 buildings so they sit together visually.
- **Palette:** use the building palette above; each building's dominant
  color is called out individually below

### `barracks.png`
**Path:** `assets/buildings/barracks.png`

**Prompt:** A low, single-story military barracks building, viewed from a
30-40° top-down isometric angle, flat vector game-art illustration style
with a consistent 2-3px dark outline (#1a1d14) on every edge. Rectangular
footprint, slightly wider than deep. Walls in muted khaki-sage (#8a9478),
a shallow-pitched corrugated roof in dark olive (#5a6450). One visible
door centered on the long wall facing the camera, two small square
windows flanking it, a short set of steps or a low concrete stoop at the
entrance. Optional: a stack of sandbags or a folded flag pole beside the
door for military flavor, but keep it minimal. Flat ambient lighting from
upper-left, no hard shadows, an optional soft 10% contact shadow directly
under the building only. Fully transparent background, no ground/grass
underneath, no text, no people, no other structures in frame. Building
fills about 80% of canvas width, centered with even padding.
**Generate at 576×384px, PNG with alpha transparency.**

### `shooting_range.png`
**Path:** `assets/buildings/shooting_range.png`

**Prompt:** An open-air military shooting range, viewed from a 30-40°
top-down isometric angle, flat vector game-art illustration style with a
consistent 2-3px dark outline (#1a1d14) on every edge. Long rectangular
footprint: a low firing-line barrier/counter at the camera-facing end in
brown (#6a5240), 3-4 parallel narrow shooting lanes marked by low wooden
divider walls running away from the camera, simple humanoid target
silhouettes standing at the far end of the lanes, backed by a low earth
berm or sandbag wall in khaki-sage (#8a9478). No roof — this structure is
outdoors. Flat ambient lighting from upper-left, no hard shadows, optional
soft 10% contact shadow directly under the structure only. Fully
transparent background, no ground/grass texture, no text, no people, no
other structures in frame. Structure fills about 80% of canvas width,
centered with even padding.
**Generate at 576×384px, PNG with alpha transparency.**

### `weight_room.png`
**Path:** `assets/buildings/weight_room.png`

**Prompt:** A small enclosed military gym/weight room building, viewed
from a 30-40° top-down isometric angle, flat vector game-art illustration
style with a consistent 2-3px dark outline (#1a1d14) on every edge.
Rectangular footprint, flat roof in muted purple-gray (#5a4a6a), walls in
khaki-sage (#8a9478). One open garage-style front wall or large window
facing the camera revealing the interior: a barbell rack, a couple of
weight plates, and a bench, rendered simply and flatly (no fine detail,
just clear readable silhouettes). Flat ambient lighting from upper-left,
no hard shadows, optional soft 10% contact shadow directly under the
building only. Fully transparent background, no ground/grass texture, no
text, no people, no other structures in frame. Building fills about 80% of
canvas width, centered with even padding.
**Generate at 576×384px, PNG with alpha transparency.**

### `obstacle_course.png`
**Path:** `assets/buildings/obstacle_course.png`

**Prompt:** An outdoor military obstacle course, viewed from a 30-40°
top-down isometric angle, flat vector game-art illustration style with a
consistent 2-3px dark outline (#1a1d14) on every edge. No enclosing
building — a compact training-yard footprint containing 3 simple obstacle
elements arranged left-to-right: a low wooden wall to climb over, a stack
of 3-4 truck tires laid flat for foot-stepping, and a cargo-net frame
(simple crosshatch net between two posts). Ground plane implied only by
where the obstacles sit — do not render grass/dirt texture, keep the
background transparent around and between the obstacles. Colors in
olive-brown (#6a5a30) for the wood/dirt elements, dark gray (#4a4942) for
the tires/net rope. Flat ambient lighting from upper-left, no hard
shadows, optional soft 10% contact shadow directly under each obstacle
element only. No text, no people, no other structures in frame. The three
obstacles together fill about 80% of canvas width, centered with even
padding.
**Generate at 576×384px, PNG with alpha transparency.**

### `drill_yard.png`
**Path:** `assets/buildings/drill_yard.png`

**Prompt:** An open military combat drill yard, viewed from a 30-40%
top-down isometric angle, flat vector game-art illustration style with a
consistent 2-3px dark outline (#1a1d14) on every edge. A paved/packed-dirt
open rectangular area in steel-blue (#4a5a6a) as the dominant tone, marked
with 4-5 small painted formation-marker circles or cones arranged in a
grid pattern (like drill-position markers), and 1-2 simple padded training
dummies (a vertical post with a rounded punching-bag-like top) standing at
one edge. This should read as visually distinct from the Weight Room
(indoor gym) and Obstacle Course (climbing obstacles) — it's about
open-area formation/combat drilling, not equipment. Flat ambient lighting
from upper-left, no hard shadows, optional soft 10% contact shadow
directly under the dummies/markers only. Fully transparent background, no
grass/ground texture beyond the paved area shape itself, no text, no
people, no other structures in frame. Fills about 80% of canvas width,
centered with even padding.
**Generate at 576×384px, PNG with alpha transparency.**

### `mess_hall.png`
**Path:** `assets/buildings/mess_hall.png`

**Prompt:** A military mess hall / dining building, viewed from a 30-40°
top-down isometric angle, flat vector game-art illustration style with a
consistent 2-3px dark outline (#1a1d14) on every edge. Rectangular
footprint, wider than deep, roof and walls in teal-green (#40605a). A
serving window or open hatch on the camera-facing wall with a simple
awning above it, one or two picnic-style tables visible just outside the
building along the same wall. Flat ambient lighting from upper-left, no
hard shadows, optional soft 10% contact shadow directly under the
building only. Fully transparent background, no ground/grass texture, no
text, no people, no other structures in frame. Building fills about 80% of
canvas width, centered with even padding.
**Generate at 576×384px, PNG with alpha transparency.**

---

## Civilians (3 files)

Civilians are units that haven't been recruited yet — they walk toward
the base and can be clicked to recruit. Each `outfit` value in `unit.js`
needs its own sprite (currently just a colored dot + a small emoji
marker; these replace the whole body).

**Shared specs for all 3 civilians:**
- **Save format:** PNG-24, transparent background
- **In-game display size:** 32 × 48 px
- **Generate at:** 128 × 192 px exactly (4× display size, clean multiple
  of 64px)
- **Aspect ratio:** 2:3 (portrait)
- **Camera:** front-facing, full body visible head to feet, straight-on
  (not 3/4, not top-down) — a simple stylized character icon, closer to a
  board-game piece than a realistic portrait.
- **Pose:** standing, mid-stride walking pose (one leg forward), arms in a
  relaxed natural walking position.
- **Proportions:** simplified/stylized game-icon proportions — slightly
  larger head-to-body ratio than realistic (roughly 1:4 head-to-height)
  for readability at 32×48px on screen. Facial detail should be minimal:
  simple dot or short-line eyes, no detailed facial features — it will
  render very small.
- **Palette:** character base palette ONLY (`#8a897d` `#6e6d63` `#b8b6a8`
  `#4a4942`) — see "why characters must be desaturated" above. Do not use
  the saturated building palette or any other colors.

### `civilian.png`
**Path:** `assets/units/civilians/civilian.png`
**Maps to code value:** `unit.outfit === 'civilian'`

**Prompt:** A generic civilian pedestrian, full body, front-facing,
simple stylized flat-vector game-icon character with a consistent 2-3px
dark outline (#1a1d14). Mid-stride walking pose, one leg forward, arms
relaxed. Plain casual clothing — a simple t-shirt/jacket shape and pants,
no distinguishing accessories. Use ONLY these desaturated tones: neutral
warm gray #8a897d for the main clothing, darker gray #6e6d63 for shading
creases, light gray-khaki #b8b6a8 for skin/highlights, near-black gray
#4a4942 for shoes/small details — no other colors, no bright/saturated
colors anywhere, this sprite gets recolored in-engine. Minimal facial
detail (simple dot eyes, no other features). Flat ambient lighting from
upper-left, no hard shadows, optional soft 10% contact shadow directly
under the feet only. Fully transparent background, no ground, no text, no
props, no other characters in frame. Figure fills about 80% of canvas
height, centered with even padding.
**Generate at 128×192px, PNG with alpha transparency.**

### `bus_rider.png`
**Path:** `assets/units/civilians/bus_rider.png`
**Maps to code value:** `unit.outfit === 'bus_rider'`

**Prompt:** A civilian pedestrian who just got off a bus, full body,
front-facing, simple stylized flat-vector game-icon character with a
consistent 2-3px dark outline (#1a1d14). Mid-stride walking pose, one leg
forward, arms relaxed, carrying a small duffel bag or backpack over one
shoulder (this bag is the ONE visual difference from `civilian.png` —
keep body proportions, pose, and clothing style otherwise identical for
set consistency). Use ONLY these desaturated tones: neutral warm gray
#8a897d for the main clothing, darker gray #6e6d63 for shading/the bag,
light gray-khaki #b8b6a8 for skin/highlights, near-black gray #4a4942 for
shoes/straps — no other colors, no bright/saturated colors anywhere, this
sprite gets recolored in-engine. Minimal facial detail (simple dot eyes,
no other features). Flat ambient lighting from upper-left, no hard
shadows, optional soft 10% contact shadow directly under the feet only.
Fully transparent background, no ground, no text, no other props or
characters in frame. Figure fills about 80% of canvas height, centered
with even padding.
**Generate at 128×192px, PNG with alpha transparency.**

### `taxi.png`
**Path:** `assets/units/civilians/taxi.png`
**Maps to code value:** `unit.outfit === 'taxi'`

**Prompt:** A civilian pedestrian who just arrived by taxi, full body,
front-facing, simple stylized flat-vector game-icon character with a
consistent 2-3px dark outline (#1a1d14). Mid-stride walking pose, one leg
forward, arms relaxed, slightly neater/sharper silhouette than the other
two civilians — a simple collared jacket shape instead of a plain
t-shirt, otherwise same body proportions and pose for set consistency, no
bag. Use ONLY these desaturated tones: neutral warm gray #8a897d for the
main clothing, darker gray #6e6d63 for shading/collar, light gray-khaki
#b8b6a8 for skin/highlights, near-black gray #4a4942 for shoes/small
details — no other colors, no bright/saturated colors anywhere, this
sprite gets recolored in-engine. Minimal facial detail (simple dot eyes,
no other features). Flat ambient lighting from upper-left, no hard
shadows, optional soft 10% contact shadow directly under the feet only.
Fully transparent background, no ground, no text, no other props or
characters in frame. Figure fills about 80% of canvas height, centered
with even padding.
**Generate at 128×192px, PNG with alpha transparency.**

---

## Soldiers (6 files, one variant pack)

Once recruited, a unit becomes a soldier (`outfit: 'uniform'`). Rather
than one single sprite for all 20 possible roster slots (which would make
every soldier's *shape* identical, only the color different), this is a
**6-body-variant pack** — the game will randomly assign one shape per
recruited unit (same pattern already used for civilian outfits) and still
apply the per-unit hue tint on top, so the result is 6 shapes × unlimited
tint colors.

**Shared specs for all 6 soldiers:**
- **Save format:** PNG-24, transparent background
- **In-game display size:** 32 × 48 px
- **Generate at:** 128 × 192 px exactly (4× display size, clean multiple
  of 64px)
- **Aspect ratio:** 2:3 (portrait)
- **Camera:** front-facing, full body visible head to feet, straight-on,
  same simple stylized character-icon style as the civilians.
- **Pose:** standing at ease, facing forward, arms at sides — NOT mid-
  stride (soldiers are more often stationary/training in-game than
  civilians are). All 6 must share this exact pose and scale so swapping
  between them mid-game doesn't look jarring.
- **Proportions:** identical to the civilian sprites — same
  head-to-body ratio, same overall height/width envelope within the
  128×192px canvas, so soldiers and civilians feel like the same "species"
  of character on screen.
- **Palette:** character base palette ONLY (`#8a897d` `#6e6d63` `#b8b6a8`
  `#4a4942`) — see "why characters must be desaturated" above.

### `soldier_01.png` — bare-headed
**Path:** `assets/units/soldiers/soldier_01.png`

**Prompt:** A standard military soldier, full body, front-facing, simple
stylized flat-vector game-icon character with a consistent 2-3px dark
outline (#1a1d14). Standing at ease, facing forward, arms at sides,
wearing a basic uniform (jacket + trousers silhouette, no extra gear). No
headgear — bare head, simple short-hair silhouette. Use ONLY these
desaturated tones: neutral warm gray #8a897d for the uniform, darker gray
#6e6d63 for shading/creases, light gray-khaki #b8b6a8 for skin/highlights,
near-black gray #4a4942 for boots — no other colors, this sprite gets
recolored in-engine. Minimal facial detail (simple dot eyes, no other
features). Flat ambient lighting from upper-left, no hard shadows,
optional soft 10% contact shadow directly under the feet only. Fully
transparent background, no ground, no text, no props or other characters
in frame. Figure fills about 80% of canvas height, centered with even
padding.
**Generate at 128×192px, PNG with alpha transparency.**

### `soldier_02.png` — helmet
**Path:** `assets/units/soldiers/soldier_02.png`

**Prompt:** A standard military soldier, full body, front-facing, simple
stylized flat-vector game-icon character with a consistent 2-3px dark
outline (#1a1d14). Standing at ease, facing forward, arms at sides,
wearing a basic uniform (jacket + trousers silhouette) plus a rounded
combat helmet — this helmet is the ONE visual difference from
`soldier_01.png`; keep body proportions, pose, and uniform style
otherwise identical to the rest of the pack. Use ONLY these desaturated
tones: neutral warm gray #8a897d for the uniform, darker gray #6e6d63 for
the helmet/shading, light gray-khaki #b8b6a8 for skin/highlights,
near-black gray #4a4942 for boots — no other colors, this sprite gets
recolored in-engine. Minimal facial detail. Flat ambient lighting from
upper-left, no hard shadows, optional soft 10% contact shadow directly
under the feet only. Fully transparent background, no ground, no text, no
props or other characters in frame. Figure fills about 80% of canvas
height, centered with even padding.
**Generate at 128×192px, PNG with alpha transparency.**

### `soldier_03.png` — bulkier build
**Path:** `assets/units/soldiers/soldier_03.png`

**Prompt:** A standard military soldier, full body, front-facing, simple
stylized flat-vector game-icon character with a consistent 2-3px dark
outline (#1a1d14). Standing at ease, facing forward, arms at sides,
wearing a basic uniform (jacket + trousers silhouette), no headgear.
Noticeably bulkier/broader-shouldered build than `soldier_01.png` — wider
torso silhouette, same overall height — this build difference is the ONE
visual distinction from the bare-headed variant; keep pose and uniform
style otherwise identical to the rest of the pack. Use ONLY these
desaturated tones: neutral warm gray #8a897d for the uniform, darker gray
#6e6d63 for shading/creases, light gray-khaki #b8b6a8 for skin/highlights,
near-black gray #4a4942 for boots — no other colors, this sprite gets
recolored in-engine. Minimal facial detail. Flat ambient lighting from
upper-left, no hard shadows, optional soft 10% contact shadow directly
under the feet only. Fully transparent background, no ground, no text, no
props or other characters in frame. Figure fills about 80% of canvas
height, centered with even padding.
**Generate at 128×192px, PNG with alpha transparency.**

### `soldier_04.png` — slighter build
**Path:** `assets/units/soldiers/soldier_04.png`

**Prompt:** A standard military soldier, full body, front-facing, simple
stylized flat-vector game-icon character with a consistent 2-3px dark
outline (#1a1d14). Standing at ease, facing forward, arms at sides,
wearing a basic uniform (jacket + trousers silhouette), no headgear.
Noticeably slighter/narrower build than `soldier_01.png` — narrower torso
silhouette, same overall height — this build difference is the ONE visual
distinction from the bare-headed variant; keep pose and uniform style
otherwise identical to the rest of the pack. Use ONLY these desaturated
tones: neutral warm gray #8a897d for the uniform, darker gray #6e6d63 for
shading/creases, light gray-khaki #b8b6a8 for skin/highlights, near-black
gray #4a4942 for boots — no other colors, this sprite gets recolored
in-engine. Minimal facial detail. Flat ambient lighting from upper-left,
no hard shadows, optional soft 10% contact shadow directly under the feet
only. Fully transparent background, no ground, no text, no props or other
characters in frame. Figure fills about 80% of canvas height, centered
with even padding.
**Generate at 128×192px, PNG with alpha transparency.**

### `soldier_05.png` — beret
**Path:** `assets/units/soldiers/soldier_05.png`

**Prompt:** A standard military soldier, full body, front-facing, simple
stylized flat-vector game-icon character with a consistent 2-3px dark
outline (#1a1d14). Standing at ease, facing forward, arms at sides,
wearing a basic uniform (jacket + trousers silhouette) plus a soft beret
angled slightly to one side — this beret is the ONE visual difference
from `soldier_01.png`, and it should read as clearly distinct in
silhouette from `soldier_02.png`'s rounded combat helmet; keep body
proportions, pose, and uniform style otherwise identical to the rest of
the pack. Use ONLY these desaturated tones: neutral warm gray #8a897d for
the uniform, darker gray #6e6d63 for the beret/shading, light gray-khaki
#b8b6a8 for skin/highlights, near-black gray #4a4942 for boots — no other
colors, this sprite gets recolored in-engine. Minimal facial detail. Flat
ambient lighting from upper-left, no hard shadows, optional soft 10%
contact shadow directly under the feet only. Fully transparent
background, no ground, no text, no props or other characters in frame.
Figure fills about 80% of canvas height, centered with even padding.
**Generate at 128×192px, PNG with alpha transparency.**

### `soldier_06.png` — backpack/gear webbing
**Path:** `assets/units/soldiers/soldier_06.png`

**Prompt:** A standard military soldier, full body, front-facing, simple
stylized flat-vector game-icon character with a consistent 2-3px dark
outline (#1a1d14). Standing at ease, facing forward, arms at sides,
wearing a basic uniform (jacket + trousers silhouette), no headgear, plus
visible gear webbing straps across the chest and a small pack on the
back (only the top/sides of the pack visible from the front) — this gear
is the ONE visual difference from `soldier_01.png`; keep body
proportions, pose, and uniform style otherwise identical to the rest of
the pack. Use ONLY these desaturated tones: neutral warm gray #8a897d for
the uniform, darker gray #6e6d63 for the webbing/pack/shading, light
gray-khaki #b8b6a8 for skin/highlights, near-black gray #4a4942 for boots
— no other colors, this sprite gets recolored in-engine. Minimal facial
detail. Flat ambient lighting from upper-left, no hard shadows, optional
soft 10% contact shadow directly under the feet only. Fully transparent
background, no ground, no text, no props or other characters in frame.
Figure fills about 80% of canvas height, centered with even padding.
**Generate at 128×192px, PNG with alpha transparency.**

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
- **Walk-cycle animation frames** — units currently glide between two
  points with no animation; a single static pose per sprite is enough for
  this pass. Animated spritesheets can be a later upgrade once static art
  is validated in-engine.

## Quick-reference table

| # | Filename | Path | Resolution | Format |
|---|---|---|---|---|
| 1 | `barracks.png` | `assets/buildings/barracks.png` | 576×384px | PNG-24 + alpha |
| 2 | `shooting_range.png` | `assets/buildings/shooting_range.png` | 576×384px | PNG-24 + alpha |
| 3 | `weight_room.png` | `assets/buildings/weight_room.png` | 576×384px | PNG-24 + alpha |
| 4 | `obstacle_course.png` | `assets/buildings/obstacle_course.png` | 576×384px | PNG-24 + alpha |
| 5 | `drill_yard.png` | `assets/buildings/drill_yard.png` | 576×384px | PNG-24 + alpha |
| 6 | `mess_hall.png` | `assets/buildings/mess_hall.png` | 576×384px | PNG-24 + alpha |
| 7 | `civilian.png` | `assets/units/civilians/civilian.png` | 128×192px | PNG-24 + alpha |
| 8 | `bus_rider.png` | `assets/units/civilians/bus_rider.png` | 128×192px | PNG-24 + alpha |
| 9 | `taxi.png` | `assets/units/civilians/taxi.png` | 128×192px | PNG-24 + alpha |
| 10 | `soldier_01.png` | `assets/units/soldiers/soldier_01.png` | 128×192px | PNG-24 + alpha |
| 11 | `soldier_02.png` | `assets/units/soldiers/soldier_02.png` | 128×192px | PNG-24 + alpha |
| 12 | `soldier_03.png` | `assets/units/soldiers/soldier_03.png` | 128×192px | PNG-24 + alpha |
| 13 | `soldier_04.png` | `assets/units/soldiers/soldier_04.png` | 128×192px | PNG-24 + alpha |
| 14 | `soldier_05.png` | `assets/units/soldiers/soldier_05.png` | 128×192px | PNG-24 + alpha |
| 15 | `soldier_06.png` | `assets/units/soldiers/soldier_06.png` | 128×192px | PNG-24 + alpha |

(15 files, not 13 — corrected count: 6 buildings + 3 civilians + 6
soldiers.)

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
