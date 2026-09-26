# Command Base — Visual Quality Review

## Verdict

The current art is functional and coherent enough for a prototype/public beta, but it does **not** yet compete visually with the best polished management/simulation games. The biggest gap is not raw image resolution; it is animation, variation, environmental storytelling, lighting, and a unified production pipeline.

## What already works

- Consistent top-down/isometric-inspired military-base theme.
- Building images are transparent and sized consistently for the renderer.
- Directional unit poses exist for soldiers and civilians.
- Terrain set includes ground, apron, grass, road and wall surfaces.
- The game has a usable visual foundation rather than placeholders.

## Highest-priority upgrades

### 1. Real walk cycles

Directional still poses are not enough. Every walking character should have at least 4 frames per direction, preferably 6–8, with believable arm/leg motion, body bob, equipment follow-through and foot planting.

Target set per character archetype:

- idle: 2–4 frames
- walk down: 6 frames
- walk up: 6 frames
- walk right: 6 frames (left can be mirrored where appropriate)
- sit/work/training contextual loops where used

The renderer should choose an animation frame from elapsed movement time instead of swapping a single directional image.

### 2. Stronger environment kit

Current large static building renders make repeated bases feel similar. Add modular props and decals:

- sandbags, bollards, barriers and fencing
- lamps, signs, flagpoles and noticeboards
- crates, pallets, fuel drums and equipment racks
- parked utility vehicles
- drainage, tyre marks, cracks, dirt, puddles and grass-edge transitions
- benches, bins and outdoor tables
- training props and range equipment
- small landscaping/vegetation clusters

These should be layered by the renderer so maps gain variation without requiring a unique painted background.

### 3. Building readability and hierarchy

Every building should be instantly identifiable at normal play zoom. Strengthen silhouettes, roof detail, entrance placement, signage and unique functional props. Important buildings need more visual prominence than low-value utility spaces.

### 4. Lighting and atmosphere

Add a lightweight lighting pass:

- contact shadows beneath people and props
- stronger directional building shadows
- subtle ambient occlusion around walls/objects
- time-of-day colour grading or at minimum dawn/day/evening presets
- selected-building highlight and interaction glow that fits the art style

### 5. Terrain transitions

The current terrain textures need authored transition tiles/overlays so grass, apron, road and dirt do not meet with obviously rectangular boundaries. Add corner, edge and blend decals plus subtle random variation.

### 6. UI art direction

The UI should feel like the same game as the world. Use one typography system, one icon family, consistent panel materials, restrained military visual motifs, clear information hierarchy and polished hover/pressed/disabled states.

## Asset production standard

All newly generated or commissioned art should follow one locked art bible:

- camera angle and projection
- light direction and softness
- palette and contrast range
- outline/no-outline rule
- material rendering style
- character proportions
- pixel density / target dimensions
- transparent-background requirements
- shadow convention
- naming convention and animation frame order

Do not mix independent AI generations into production without a consistency pass. Character frames should be generated from the same reference sheet and pose pipeline so clothing, face, equipment and proportions do not mutate between frames.

## Public-release bar

Before calling the visuals release-quality, require:

1. All moving humans use actual animated walk cycles.
2. No obvious placeholder or repeated-looking major asset is visible in a normal 10-minute session.
3. At least 20–30 reusable environmental props/decal elements exist.
4. Terrain edges blend naturally.
5. Buildings remain recognizable at gameplay zoom.
6. UI, world art, icons and promotional imagery share a clear art direction.
7. Screenshots from three different bases/areas look meaningfully different.
8. A blind playtester describes the game as polished rather than prototype-like before being prompted about graphics.

## Recommended next visual milestone

Build one **vertical-slice base screen** to final quality first: one road segment, one grass/apron transition, 3–4 buildings, 8–12 animated people, 10+ props, final shadows and final UI. Use that as the benchmark for every remaining asset rather than regenerating the whole game inconsistently.
