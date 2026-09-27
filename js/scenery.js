// scenery.js — the landscape around the base: meadow, water, cliffs, rock,
// clearings, paths, fences, and seeded vegetation/props.
//
// Everything static is painted once into an offscreen layer and reused each
// frame; the layer is only repainted when what it shows changes (a facility
// is built, which reveals its clearing and path spur). Trees are the one
// exception: they are drawn per frame in the depth-sorted pass so people can
// walk behind and in front of them.
//
// Placement is seeded (deterministic across reloads and devices) and keeps
// out of every zone footprint, path, entrance and queue lane — future sites
// included, so construction never lands on a tree. Procedural shapes here
// are interim art; brief 04 swaps in the production terrain kit.

const SCENERY_SEED = 20260926;
const STATIC_LAYER_SCALE = 1.5; // offscreen resolution per world px (sharp up to ~1.5x zoom)

function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Distance from a point to the nearest drawn/walked path (all spurs, since
// any zone may be built later).
function distanceToPaths(x, y, edges) {
  let best = Infinity;
  for (const edge of edges) {
    for (let i = 1; i < edge.points.length; i++) {
      const a = edge.points[i - 1], b = edge.points[i];
      best = Math.min(best, pointSegmentDistance(x, y, a.x, a.y, b.x, b.y));
    }
  }
  return best;
}

function distanceToTerrain(x, y) {
  let best = Infinity;
  for (const area of WORLD.terrain) best = Math.min(best, pointPolygonDistance(x, y, area.polygon));
  return best;
}

// Authored placements for the prepared static props (ASSET_MANIFEST.props).
// x/y is the ground pivot in world px; `base` is the ground-contact radius
// that must stay clear (a lamp's pole, a vehicle's wheelbase), not the image
// width. validateScenePropPlacements() proves none blocks a trail (built or
// future spur), build site, slot, entrance, the bridge or the gate.
const SCENE_PROP_PLACEMENTS = [
  { prop: 'scene_lamp', x: 100, y: 642, base: 4 },              // inside the gate
  { prop: 'scene_fence', x: 36, y: 672, base: 12, scale: 0.7 },  // gate wing, south
  { prop: 'scene_fence_post', x: 64, y: 656, base: 4, scale: 0.7 },
  { prop: 'scene_noticeboard', x: 300, y: 574, base: 8 },       // by the Entrance Hall path
  { prop: 'scene_rock_moss', x: 214, y: 580, base: 10 },        // brook bank
  { prop: 'scene_grass_flower', x: 278, y: 652, base: 6 },
  { prop: 'scene_rocks_granite', x: 236, y: 772, base: 14 },
  { prop: 'scene_signpost', x: 462, y: 630, base: 4 },          // junction t2
  { prop: 'scene_utility_vehicle', x: 530, y: 528, base: 26, scale: 0.8 }, // parked below the knoll
  { prop: 'scene_rock_moss', x: 884, y: 542, base: 10 },
  { prop: 'scene_lamp', x: 1122, y: 622, base: 4 },             // junction t6
  { prop: 'scene_rocks_granite', x: 1300, y: 566, base: 14 },   // riverside
];

// Problems with the placements; empty means every prop is clear.
function validateScenePropPlacements(placements = SCENE_PROP_PLACEMENTS) {
  const problems = [];
  const edges = worldEdgeList(null);
  const gate = WORLD.nodes.gate;
  placements.forEach((p, i) => {
    const label = `${p.prop} #${i} at (${p.x}, ${p.y})`;
    if (!ASSET_MANIFEST.props[p.prop]) problems.push(`${label}: unknown prop`);
    if (distanceToPaths(p.x, p.y, edges) < p.base + 20) problems.push(`${label}: on a trail`);
    if (distanceToTerrain(p.x, p.y) < p.base) problems.push(`${label}: in water or rock`);
    for (const zone of WORLD.zones) {
      if (pointPolygonDistance(p.x, p.y, zone.footprint) < p.base + 6) problems.push(`${label}: on ${zone.id}`);
      if (Math.hypot(p.x - zone.entrance.x, p.y - zone.entrance.y) < p.base + 30) problems.push(`${label}: blocks ${zone.id} entrance`);
    }
    for (const bridge of WORLD.bridges) {
      if (pointPolygonDistance(p.x, p.y, bridgeDeckPolygon(bridge)) < p.base + 10) problems.push(`${label}: on ${bridge.id}`);
    }
    if (Math.hypot(p.x - gate.x, p.y - gate.y) < p.base + 36) problems.push(`${label}: blocks the gate`);
    placements.forEach((q, j) => {
      if (j > i && Math.hypot(p.x - q.x, p.y - q.y) < p.base + q.base + 4) problems.push(`${label}: overlaps ${q.prop} #${j}`);
    });
  });
  return problems;
}

function drawSceneProp(ctx, placement) {
  const prop = ASSET_MANIFEST.props[placement.prop];
  const img = FACILITY_SPRITES[prop.file] ||= loadSprite(prop.file);
  if (!spriteReady(img)) return;
  const scale = (placement.scale || 1) / (prop.density || 1); // image px -> world px
  ctx.drawImage(img, placement.x - prop.pivot[0] * scale, placement.y - prop.pivot[1] * scale, prop.size[0] * scale, prop.size[1] * scale);
}

// Free for a prop: on open ground, clear of every footprint, path, placed
// scene prop and the gate. `clearance` is the prop's own radius.
function isOpenGround(x, y, clearance, edges) {
  if (x < 8 || y < 8 || x > WORLD_W - 8 || y > WORLD_H - 8) return false;
  if (SCENE_PROP_PLACEMENTS.some(p => Math.hypot(x - p.x, y - p.y) < clearance + p.base + 10)) return false;
  if (distanceToTerrain(x, y) < clearance * 0.4) return false;
  for (const zone of WORLD.zones) if (pointPolygonDistance(x, y, zone.footprint) < clearance + 18) return false;
  if (distanceToPaths(x, y, edges) < clearance + 26) return false;
  const gate = WORLD.nodes.gate;
  return Math.hypot(x - gate.x, y - gate.y) > 90;
}

// Deterministic vegetation and ground props. Trees crowd the cliffs, river
// and map edges to frame the base, and thin out across the open meadow.
function buildSceneryPlacement() {
  const random = seededRandom(SCENERY_SEED);
  const edges = worldEdgeList(null);
  const trees = [], rocks = [], tufts = [];
  for (let gy = 20; gy < WORLD_H; gy += 34) {
    for (let gx = 20; gx < WORLD_W; gx += 34) {
      const x = gx + (random() - 0.5) * 26, y = gy + (random() - 0.5) * 26;
      const roll = random(), kindRoll = random(), sizeRoll = random();
      const nearFrame = WORLD.terrain.some(a => a.kind !== 'rock' && pointPolygonDistance(x, y, a.polygon) < 110)
        || x < 80 || y > WORLD_H - 70;
      if (roll < (nearFrame ? 0.5 : 0.045) && isOpenGround(x, y, 16, edges)) {
        trees.push({ x, y, kind: kindRoll < 0.72 ? 'conifer' : 'broadleaf', size: 0.75 + sizeRoll * 0.55, variant: Math.floor(random() * 3) });
      } else if (roll > 0.93 && isOpenGround(x, y, 6, edges)) {
        rocks.push({ x, y, size: 5 + sizeRoll * 9, variant: Math.floor(random() * 3) });
      } else if (roll > 0.8 && isOpenGround(x, y, 2, edges)) {
        tufts.push({ x, y, size: 4 + sizeRoll * 5 });
      }
    }
  }
  trees.sort((a, b) => a.y - b.y);
  return { trees, rocks, tufts };
}

let sceneryPlacement = null;
function scenery() {
  if (!sceneryPlacement) sceneryPlacement = buildSceneryPlacement();
  return sceneryPlacement;
}

// --- tree sprites -------------------------------------------------------------

const TREE_PALETTES = [
  { dark: '#2f4a32', mid: '#3f6140', light: '#5d7f4d' },
  { dark: '#2c4638', mid: '#3a5c47', light: '#58795a' },
  { dark: '#3a4a2c', mid: '#4d6337', light: '#6f8448' },
];
const treeSpriteCache = {};

// Tree drawn once per kind/variant into its own canvas (bottom-centre pivot).
function treeSprite(kind, variant) {
  const key = `${kind}_${variant}`;
  if (treeSpriteCache[key]) return treeSpriteCache[key];
  const w = 64, h = 96, canvas = document.createElement('canvas');
  canvas.width = w * 2; canvas.height = h * 2;
  const c = canvas.getContext('2d');
  if (!c || !c.scale) return (treeSpriteCache[key] = canvas);
  c.scale(2, 2);
  const p = TREE_PALETTES[variant % TREE_PALETTES.length];
  c.lineJoin = 'round';
  c.strokeStyle = '#1c261a';
  c.lineWidth = 2;
  c.fillStyle = '#5b4631';
  c.fillRect(w / 2 - 3, h - 18, 6, 16);
  if (kind === 'conifer') {
    const tiers = [[h - 14, 26, 26], [h - 34, 21, 24], [h - 52, 15, 22], [h - 68, 9, 20]];
    for (const [base, half, tall] of tiers) {
      c.beginPath();
      c.moveTo(w / 2 - half, base); c.lineTo(w / 2, base - tall); c.lineTo(w / 2 + half, base);
      c.quadraticCurveTo(w / 2, base + 5, w / 2 - half, base);
      c.fillStyle = p.mid; c.fill(); c.stroke();
      // Upper-left key light.
      c.beginPath();
      c.moveTo(w / 2 - half + 4, base - 1); c.lineTo(w / 2, base - tall + 3); c.lineTo(w / 2 - 2, base - 2);
      c.fillStyle = p.light; c.fill();
    }
  } else {
    const blobs = [[w / 2, h - 34, 20], [w / 2 - 12, h - 26, 14], [w / 2 + 13, h - 27, 14], [w / 2, h - 48, 15]];
    for (const [x, y, r] of blobs) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = p.mid; c.fill(); c.stroke(); }
    for (const [x, y, r] of blobs) { c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.5, 0, Math.PI * 2); c.fillStyle = p.light; c.fill(); }
  }
  return (treeSpriteCache[key] = canvas);
}

// Contact shadow falls lower-right (upper-left key light).
function drawTree(ctx, tree) {
  const w = 64 * tree.size, h = 96 * tree.size;
  ctx.fillStyle = 'rgba(20, 30, 18, 0.28)';
  ctx.beginPath(); ctx.ellipse(tree.x + 6 * tree.size, tree.y + 2, 20 * tree.size, 7 * tree.size, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(treeSprite(tree.kind, tree.variant), tree.x - w / 2, tree.y - h + 4, w, h);
}

// --- static layer ---------------------------------------------------------------

// Texture fill for the offscreen layer (patterns are made on the context that
// uses them). worldScale sets the tile size in world px per source px.
function scenePattern(ctx, key, worldScale) {
  const img = TERRAIN_SPRITES[key];
  if (!spriteReady(img)) return null;
  const pattern = ctx.createPattern(img, 'repeat');
  if (pattern && pattern.setTransform && typeof DOMMatrix !== 'undefined') {
    pattern.setTransform(new DOMMatrix([worldScale, 0, 0, worldScale, 0, 0]));
  }
  return pattern;
}

function fillSmooth(ctx, polygon, style) {
  traceSmoothPolygon(ctx, polygon);
  ctx.fillStyle = style;
  ctx.fill();
}

// --- terrain edges -----------------------------------------------------------------
//
// Terrain reads as land shaped by rock and water (see
// art/explorations/river-cliff-edge-study.webp for the look — used as a
// reference only; the geometry is the authored WORLD polygons). Every edge
// that faces the camera (outward normal pointing down the screen) gets a
// face: stepped rock columns under cliffs and outcrops, and rock drops into
// water where land sits above a river or pond. Edges seen from above get a
// pebble beach instead.

// Points along the same rounded outline traceSmoothPolygon() draws, each
// with the outward unit normal, about `spacing` world px apart.
function outlineSamples(polygon, spacing) {
  const mid = (a, b) => ({ x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 });
  const curve = [];
  for (let i = 0; i < polygon.length; i++) {
    const start = mid(polygon[(i - 1 + polygon.length) % polygon.length], polygon[i]);
    const end = mid(polygon[i], polygon[(i + 1) % polygon.length]);
    const c = { x: polygon[i][0], y: polygon[i][1] };
    for (let t = 0; t < 1; t += 0.05) {
      curve.push({ x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * c.x + t * t * end.x,
        y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * c.y + t * t * end.y });
    }
  }
  const area = polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0);
  const samples = [];
  let travelled = 0, next = 0;
  for (let i = 0; i < curve.length; i++) {
    const a = curve[i], b = curve[(i + 1) % curve.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!length) continue;
    const nx = (area > 0 ? b.y - a.y : a.y - b.y) / length, ny = (area > 0 ? a.x - b.x : b.x - a.x) / length;
    while (next <= travelled + length) {
      const t = (next - travelled) / length;
      samples.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, nx, ny });
      next += spacing;
    }
    travelled += length;
  }
  return samples;
}

// One rock column: lit face on the left, shade on the right, a pale cap,
// cracks and a dark outline (upper-left key light).
function drawRockColumn(ctx, x, top, width, height, random) {
  const lean = (random() - 0.5) * 3;
  const left = x - width / 2, right = x + width / 2, bottom = top + height;
  const split = left + width * (0.36 + random() * 0.14); // lit facet | shaded facet
  const tone = 150 + Math.floor(random() * 26);
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(left + 1, top + 3);
    ctx.lineTo(split, top);
    ctx.lineTo(right - 1, top + 3);
    ctx.lineTo(right + lean, bottom - 3);
    ctx.lineTo(split + lean, bottom + 1);
    ctx.lineTo(left + lean, bottom - 2);
    ctx.closePath();
  };
  shape();
  ctx.fillStyle = `rgb(${tone - 40}, ${tone - 46}, ${tone - 56})`; // shaded facet
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(left + 1, top + 3); ctx.lineTo(split, top); ctx.lineTo(split + lean, bottom + 1); ctx.lineTo(left + lean, bottom - 2);
  ctx.closePath();
  ctx.fillStyle = `rgb(${tone + 28}, ${tone + 20}, ${tone + 4})`; // lit facet (upper-left light)
  ctx.fill();
  // Horizontal ledges break the column into stacked blocks.
  ctx.strokeStyle = 'rgba(58, 50, 40, 0.55)'; ctx.lineWidth = 1.2;
  for (let y = top + 9 + random() * 6; y < bottom - 6; y += 10 + random() * 9) {
    ctx.beginPath(); ctx.moveTo(left + 2, y); ctx.lineTo(right - 2, y + (random() - 0.5) * 3); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(58, 50, 40, 0.45)';
  ctx.beginPath(); ctx.moveTo(split, top + 1); ctx.lineTo(split + lean, bottom); ctx.stroke();
  shape();
  ctx.strokeStyle = '#342e25'; ctx.lineWidth = 1.8; ctx.stroke();
  ctx.fillStyle = 'rgba(236, 228, 204, 0.75)';
  ctx.beginPath(); ctx.moveTo(left + 3, top + 3); ctx.lineTo(split, top + 1); ctx.lineTo(right - 3, top + 3); ctx.lineTo(split, top + 5); ctx.closePath(); ctx.fill();
}

function drawBoulder(ctx, x, y, r, random) {
  ctx.fillStyle = 'rgba(20, 24, 18, 0.28)';
  ctx.beginPath(); ctx.ellipse(x + r * 0.35, y + r * 0.25, r, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  const tone = 130 + Math.floor(random() * 30);
  ctx.fillStyle = `rgb(${tone}, ${tone - 8}, ${tone - 20})`;
  ctx.strokeStyle = '#3a342b'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.ellipse(x, y - r * 0.35, r, r * 0.72, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(232, 224, 200, 0.55)';
  ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.65, r * 0.42, r * 0.25, -0.3, 0, Math.PI * 2); ctx.fill();
}

function drawBush(ctx, x, y, r, random) {
  const greens = ['#6f8a37', '#8a9c3e', '#5b7432'];
  for (let k = 0; k < 3; k++) {
    ctx.fillStyle = greens[Math.floor(random() * greens.length)];
    ctx.beginPath(); ctx.arc(x + (k - 1) * r * 0.7, y - r * (0.4 + random() * 0.4), r * (0.6 + random() * 0.3), 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(214, 224, 120, 0.45)';
  ctx.beginPath(); ctx.arc(x - r * 0.4, y - r * 0.9, r * 0.35, 0, Math.PI * 2); ctx.fill();
}

// --- terrain strip trial -------------------------------------------------------
//
// Candidate edge strips (ASSET_MANIFEST.terrain.cliff_face etc., shown only
// with ?art=candidates). Faces are vertical in this camera, so a strip is
// never rotated: it is draped one narrow column at a time along the
// contour, each column's edge row on the contour point, its texture taken
// from world x so the 128-world-px repeat stays seamless. Only edges the
// strip was drawn for (camera-facing, gentle slope) use it; the rest keep
// the procedural drawing.

const STRIP_COLUMN_WORLD = 2;

function terrainStrip(id) {
  const entry = ASSET_MANIFEST.terrain[id];
  const allow = typeof ALLOW_CANDIDATE_ART !== 'undefined' && ALLOW_CANDIDATE_ART;
  if (!entry || !entry.file || !assetInUse(entry, allow)) return null;
  const img = FACILITY_SPRITES[entry.file] ||= loadSprite(entry.file);
  return spriteReady(img) ? { entry, img } : null;
}

// Camera-facing (outward normal down the screen) or, with `sign` -1, the
// land-above side of water; gentle enough that columns don't smear.
function stripSamples(polygon, sign) {
  return outlineSamples(polygon, 1.5).filter(s => s.ny * sign > 0.8); // within ~37 deg of horizontal: steeper banks smear (river trial)
}

function drapeStrip(ctx, strip, samples, lift = 0) {
  const { entry, img } = strip;
  const d = entry.density, colPx = STRIP_COLUMN_WORLD * d;
  for (const s of samples.slice().sort((a, b) => a.y - b.y)) {
    const u = Math.min(entry.size[0] - colPx, (((s.x * d) % entry.size[0]) + entry.size[0]) % entry.size[0]);
    ctx.drawImage(img, u, 0, colPx, entry.size[1],
      s.x - STRIP_COLUMN_WORLD / 2, s.y - lift - entry.edgeRow / d, STRIP_COLUMN_WORLD + 0.4, entry.size[1] / d);
  }
}

function terrainStripsReady() {
  return ['cliff_face', 'shore_edge', 'foam_rock_drop'].filter(id => terrainStrip(id)).length;
}

// Cliffs and outcrops. The authored polygon is the FOOT of the rock — the
// ground it excludes — so faces never spill onto paths or build zones. The
// plateau is the same outline raised by `rise`; every side not facing away
// from the camera shows as stepped rock columns between plateau and foot,
// with scree at the foot and bushes along the lip.
function drawRockMass(ctx, area, random) {
  const poly = area.polygon;
  const cliff = area.kind === 'cliff';
  const rise = cliff ? 58 : 26;
  const top = poly.map(([x, y]) => [x, y - rise]);
  const lipSamples = outlineSamples(poly, cliff ? 13 : 11);
  const face = lipSamples.filter(s => s.ny > -0.2);

  // Plateau: warm meadow on cliffs, bare rock on outcrops, darker at the rim.
  fillSmooth(ctx, top, cliff ? (scenePattern(ctx, 'ground_grass', 0.42) || '#6f7c45') : '#8f8b7d');
  if (cliff) fillSmooth(ctx, top, 'rgba(196, 184, 96, 0.14)');
  traceSmoothPolygon(ctx, top);
  ctx.strokeStyle = cliff ? 'rgba(52, 64, 34, 0.55)' : 'rgba(60, 58, 50, 0.6)'; ctx.lineWidth = 6; ctx.stroke();
  const bounds = polygonBounds(top);
  for (let i = 0; i < (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) / (cliff ? 2200 : 600); i++) {
    const x = bounds.minX + random() * (bounds.maxX - bounds.minX), y = bounds.minY + random() * (bounds.maxY - bounds.minY);
    if (!pointInPolygon(x, y, top) || pointPolygonDistance(x, y, top) < 0) continue;
    if (random() < 0.6) drawBoulder(ctx, x, y, cliff ? 5 + random() * 9 : 4 + random() * 7, random);
    else drawBush(ctx, x, y, 5 + random() * 4, random);
  }

  // Faces: columns from the plateau rim down to the foot, sorted so nearer
  // (lower) columns overlap farther ones. Side-facing edges show narrower,
  // shorter steps.
  // Trial: a cliff's camera-facing foot takes the cliff_face strip instead.
  const cliffStrip = cliff ? terrainStrip('cliff_face') : null;
  const stripped = cliffStrip ? stripSamples(poly, 1) : [];
  const nearStrip = s => stripped.some(t => Math.abs(t.x - s.x) < 3 && Math.abs(t.y - s.y) < 3);
  const columns = face.map(s => ({ s, jitter: random(), width: (cliff ? 24 : 16) + random() * 10 }))
    .filter(c => !cliffStrip || !nearStrip(c.s))
    .sort((a, b) => a.s.y - b.s.y);
  if (cliffStrip) drapeStrip(ctx, cliffStrip, stripped, rise);
  for (const { s, jitter, width } of columns) {
    const step = rise * (0.72 + jitter * 0.28); // uneven tops read as stepped rock
    drawRockColumn(ctx, s.x, s.y - step, width * (0.8 + 0.2 * Math.max(0, s.ny)), step + 3, random);
  }
  for (const { s } of columns) {
    if (s.ny > 0.3 && random() < 0.55) drawBoulder(ctx, s.x + (random() - 0.5) * 14, s.y + 2 + random() * 5, 3 + random() * 5, random);
  }
  for (const s of outlineSamples(top, 20)) if (s.ny > -0.2 && random() < 0.5) drawBush(ctx, s.x, s.y + 2, 5 + random() * 4, random);
}

// River/pond: depth-shaded water; rock drops (with foam) where land sits
// above the water; pebble beaches where the bank is seen from above; flow
// streaks and midstream boulders.
function drawWater(ctx, area, random) {
  const poly = area.polygon;
  const bounds = polygonBounds(poly);
  fillSmooth(ctx, poly, '#3c7d8b');
  ctx.save();
  traceSmoothPolygon(ctx, poly);
  ctx.clip();
  traceSmoothPolygon(ctx, poly);
  ctx.strokeStyle = 'rgba(102, 170, 170, 0.8)'; ctx.lineWidth = 26; ctx.stroke();
  traceSmoothPolygon(ctx, poly);
  ctx.strokeStyle = 'rgba(160, 214, 205, 0.55)'; ctx.lineWidth = 10; ctx.stroke();
  // Flow streaks run along the nearest bank.
  const samples = outlineSamples(poly, 9);
  ctx.lineCap = 'round';
  for (let i = 0; i < (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) / 700; i++) {
    const x = bounds.minX + random() * (bounds.maxX - bounds.minX), y = bounds.minY + random() * (bounds.maxY - bounds.minY);
    if (!pointInPolygon(x, y, poly)) continue;
    let nearest = samples[0], best = Infinity;
    for (const s of samples) { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < best) { best = d; nearest = s; } }
    const tx = -nearest.ny, ty = nearest.nx, len = 6 + random() * 12;
    ctx.strokeStyle = `rgba(226, 244, 240, ${0.25 + random() * 0.35})`;
    ctx.lineWidth = 1 + random() * 1.4;
    ctx.beginPath(); ctx.moveTo(x - tx * len, y - ty * len);
    ctx.quadraticCurveTo(x + ty * 2, y - tx * 2, x + tx * len, y + ty * len); ctx.stroke();
  }
  ctx.restore();

  // Banks. Land-above edges (outward normal pointing up the screen) show a
  // rock drop into the water; the rest get pebbles half in the water. Where
  // this water runs into another (brook into pond) there is no bank.
  const otherWater = WORLD.terrain.filter(a => a.kind === 'water' && a !== area);
  const joinsWater = s => otherWater.some(a => pointInPolygon(s.x + s.nx * 6, s.y + s.ny * 6, a.polygon));
  // Trial: north banks (land above the water) take the shore and foam strips.
  const shore = terrainStrip('shore_edge'), foam = terrainStrip('foam_rock_drop');
  const banked = shore && foam ? stripSamples(poly, -1).filter(s => !joinsWater(s)) : [];
  if (banked.length) { drapeStrip(ctx, shore, banked); drapeStrip(ctx, foam, banked); }
  const nearBank = s => banked.some(t => Math.abs(t.x - s.x) < 5 && Math.abs(t.y - s.y) < 5);
  for (const s of samples) {
    if (joinsWater(s) || (banked.length && nearBank(s))) continue;
    if (s.ny < -0.2 && random() < 0.75) {
      const height = 12 + random() * 14;
      drawRockColumn(ctx, s.x, s.y - 1, 12 + random() * 8, height, random);
      ctx.strokeStyle = 'rgba(246, 252, 250, 0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(s.x, s.y + height, 8 + random() * 5, 2.5, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (random() < 0.4) {
      drawBoulder(ctx, s.x + s.nx * 2, s.y + s.ny * 2 + 3, 2.5 + random() * 4, random);
    }
  }
  // A few boulders midstream with foam rings.
  for (let i = 0; i < (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) / 9000; i++) {
    const x = bounds.minX + random() * (bounds.maxX - bounds.minX), y = bounds.minY + random() * (bounds.maxY - bounds.minY);
    if (!pointInPolygon(x, y, poly) || pointPolygonDistance(x, y, poly) > 0) continue;
    const r = 5 + random() * 9;
    ctx.strokeStyle = 'rgba(246, 252, 250, 0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y + 1, r * 1.3, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
    drawBoulder(ctx, x, y, r, random);
  }
}

// Trail: earth base, lighter centre, worn ruts, then a ragged grass fringe
// and pebbles so the edge isn't a clean tube.
function drawPathEdges(ctx, edges, random) {
  const trace = () => { ctx.beginPath(); for (const edge of edges) traceSmoothLine(ctx, edge.points); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  trace(); ctx.strokeStyle = 'rgba(70, 58, 38, 0.4)'; ctx.lineWidth = 42; ctx.stroke();
  trace(); ctx.strokeStyle = '#a4814f'; ctx.lineWidth = 34; ctx.stroke();
  trace(); ctx.strokeStyle = 'rgba(206, 172, 116, 0.55)'; ctx.lineWidth = 18; ctx.stroke();
  ctx.setLineDash([18, 14]);
  trace(); ctx.strokeStyle = 'rgba(120, 92, 58, 0.3)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.setLineDash([]);
  const greens = ['rgba(92, 116, 52, 0.75)', 'rgba(104, 124, 58, 0.7)', 'rgba(80, 100, 46, 0.7)'];
  for (const edge of edges) {
    for (let i = 1; i < edge.points.length; i++) {
      const a = edge.points[i - 1], b = edge.points[i];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (!length) continue;
      const nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length;
      for (let d = 0; d < length; d += 7) {
        const x = a.x + (b.x - a.x) * d / length, y = a.y + (b.y - a.y) * d / length;
        for (const side of [-1, 1]) {
          if (random() < 0.3) {
            const off = 14 + random() * 7;
            ctx.fillStyle = greens[Math.floor(random() * 3)];
            ctx.beginPath(); ctx.ellipse(x + nx * off * side, y + ny * off * side, 1.5 + random() * 3, 1 + random() * 1.6, random(), 0, Math.PI * 2); ctx.fill();
          }
        }
        if (random() < 0.08) {
          ctx.fillStyle = 'rgba(96, 84, 66, 0.7)';
          ctx.beginPath(); ctx.arc(x + nx * (random() - 0.5) * 20, y + ny * (random() - 0.5) * 20, 1.2 + random() * 1.4, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }
}

function drawClearing(ctx, zone, built) {
  if (built) {
    traceSmoothPolygon(ctx, zone.footprint);
    ctx.strokeStyle = 'rgba(96, 78, 48, 0.35)'; ctx.lineWidth = 16; ctx.stroke();
    fillSmooth(ctx, zone.footprint, scenePattern(ctx, 'ground_apron', 0.42) || '#a0916a');
    return;
  }
  // Surveyed site: a faint cleared patch with pegs and string, no text.
  ctx.save();
  ctx.globalAlpha = 0.5;
  fillSmooth(ctx, zone.footprint, scenePattern(ctx, 'ground_apron', 0.42) || '#a0916a');
  ctx.restore();
  traceSmoothPolygon(ctx, zone.footprint);
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = 'rgba(238, 226, 190, 0.6)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.setLineDash([]);
  for (const [x, y] of zone.footprint.filter((_, i) => i % 2 === 0)) {
    ctx.fillStyle = '#7a5d38'; ctx.fillRect(x - 2, y - 10, 4, 12);
    ctx.fillStyle = '#e0873a'; ctx.fillRect(x - 3, y - 12, 6, 4);
  }
}


function drawFenceLines(ctx) {
  for (const fence of WORLD.fences) {
    ctx.beginPath();
    fence.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = 'rgba(42, 48, 31, 0.6)'; ctx.lineWidth = 9; ctx.stroke();
    ctx.strokeStyle = '#a89469'; ctx.lineWidth = 4; ctx.stroke();
    for (let i = 1; i < fence.length; i++) {
      const [x0, y0] = fence[i - 1], [x1, y1] = fence[i];
      const count = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 70));
      for (let j = 0; j <= count; j++) {
        const x = x0 + (x1 - x0) * j / count, y = y0 + (y1 - y0) * j / count;
        ctx.fillStyle = '#5d4a30'; ctx.fillRect(x - 4, y - 14, 8, 18);
        ctx.fillStyle = '#c3af80'; ctx.fillRect(x - 3, y - 14, 3, 16);
      }
    }
  }
}

// Paints meadow, terrain, clearings, paths, ground props and fences for the
// given set of visible zones. Returns the offscreen canvas.
function paintStaticLayer(visibleZones, builtZones) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(WORLD_W * STATIC_LAYER_SCALE);
  canvas.height = Math.round(WORLD_H * STATIC_LAYER_SCALE);
  const ctx = canvas.getContext('2d');
  if (!ctx || !ctx.scale) return canvas; // headless test stub
  ctx.scale(STATIC_LAYER_SCALE, STATIC_LAYER_SCALE);
  const random = seededRandom(SCENERY_SEED + 7);

  ctx.fillStyle = scenePattern(ctx, 'ground_grass', 0.42) || '#78804e';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // Broad tonal variation so the meadow doesn't read as one repeated tile.
  for (let i = 0; i < 38; i++) {
    const x = random() * WORLD_W, y = random() * WORLD_H, r = 80 + random() * 160;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    if (!gradient) continue;
    const tone = random() < 0.5 ? '70, 92, 48' : '150, 150, 88';
    gradient.addColorStop(0, `rgba(${tone}, 0.22)`);
    gradient.addColorStop(1, `rgba(${tone}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  for (const area of WORLD.terrain) if (area.kind === 'water') drawWater(ctx, area, random);
  for (const area of WORLD.terrain) if (area.kind !== 'water') drawRockMass(ctx, area, random);
  for (const zone of WORLD.zones) if (visibleZones.has(zone.id)) drawClearing(ctx, zone, builtZones.has(zone.id));

  const edges = worldEdgeList(visibleZones).filter(edge => edge.to !== 'aid_station');
  // Trails stop at bridge decks; the deck is drawn over the water instead.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, WORLD_W, WORLD_H);
  for (const bridge of WORLD.bridges) bridgeDeckPolygon(bridge).forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.clip('evenodd');
  drawPathEdges(ctx, edges, random);
  ctx.restore();
  for (const bridge of WORLD.bridges) drawBridgeBack(ctx, bridge);

  const { rocks, tufts } = scenery();
  for (const tuft of tufts) {
    ctx.strokeStyle = 'rgba(58, 84, 40, 0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = -1; k <= 1; k++) { ctx.moveTo(tuft.x + k * 2, tuft.y); ctx.lineTo(tuft.x + k * 4, tuft.y - tuft.size); }
    ctx.stroke();
  }
  for (const rock of rocks) {
    ctx.fillStyle = 'rgba(25, 30, 20, 0.3)';
    ctx.beginPath(); ctx.ellipse(rock.x + 3, rock.y + 2, rock.size, rock.size * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ['#8d8a7c', '#9a9684', '#7f7c70'][rock.variant];
    ctx.strokeStyle = '#3c3a33'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(rock.x, rock.y - rock.size * 0.3, rock.size, rock.size * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(230, 226, 205, 0.35)';
    ctx.beginPath(); ctx.ellipse(rock.x - rock.size * 0.35, rock.y - rock.size * 0.55, rock.size * 0.4, rock.size * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  }
  drawFenceLines(ctx);
  return canvas;
}

// --- bridges ---------------------------------------------------------------------
//
// A bridge is two layers around the people on it. The BACK layer — abutments,
// shadow and trestles in the water, the plank deck and the far (north) rail —
// is painted into the static layer, so anyone on the deck stands on it. The
// FRONT layer — the near (south) rail — is a depth-sorted item at the deck's
// south edge (bridgeFrontDepth), so it covers the legs of people on the deck
// and is itself covered by anyone walking south of it. Art listed in
// ASSET_MANIFEST.bridges replaces the procedural drawing once it is in use;
// its two deck-end pivots are pinned to the bridge's west/east points.

const BRIDGE_RAIL_H = 18; // world px; a person is 44

function bridgeArt(bridge) {
  const art = ASSET_MANIFEST.bridges[bridge.id];
  if (!assetInUse(art) || !art.back || !art.front) return null;
  const back = FACILITY_SPRITES[art.back.file] ||= loadSprite(art.back.file);
  const front = FACILITY_SPRITES[art.front.file] ||= loadSprite(art.front.file);
  return spriteReady(back) && spriteReady(front) ? { art, back, front } : null;
}

// Source px -> world: the deck-end pivots land on the bridge's west/east
// points (uniform scale, no rotation — decks run west-east).
function bridgeArtRect(art, bridge, layer) {
  const scale = (bridge.east[0] - bridge.west[0]) / (art.eastPivot[0] - art.westPivot[0]);
  return { x: bridge.west[0] - art.westPivot[0] * scale, y: bridge.west[1] - art.westPivot[1] * scale,
    w: layer.size[0] * scale, h: layer.size[1] * scale };
}

function bridgeFrontDepth(bridge) {
  return Math.max(bridge.west[1], bridge.east[1]) + bridge.halfWidth;
}

// y of the deck's north (side -1), centre (0) or south (+1) edge at x.
function bridgeEdgeY(bridge, x, side) {
  const t = (x - bridge.west[0]) / (bridge.east[0] - bridge.west[0]);
  return bridge.west[1] + (bridge.east[1] - bridge.west[1]) * t + side * bridge.halfWidth;
}

function drawRail(ctx, bridge, side) {
  const [x0] = bridge.west, [x1] = bridge.east;
  const posts = Math.max(2, Math.round((x1 - x0) / 20));
  const railAt = (x, drop) => bridgeEdgeY(bridge, x, side) - BRIDGE_RAIL_H + drop;
  for (const drop of [3, BRIDGE_RAIL_H * 0.55]) {
    ctx.beginPath(); ctx.moveTo(x0 + 2, railAt(x0 + 2, drop)); ctx.lineTo(x1 - 2, railAt(x1 - 2, drop));
    ctx.strokeStyle = '#2e2216'; ctx.lineWidth = 4.6; ctx.stroke();
    ctx.strokeStyle = side > 0 ? '#b88649' : '#9a6d3b'; ctx.lineWidth = 2.6; ctx.stroke();
  }
  for (let i = 0; i <= posts; i++) {
    const x = x0 + 2 + (x1 - x0 - 4) * i / posts, y = bridgeEdgeY(bridge, x, side);
    ctx.fillStyle = '#2e2216'; ctx.fillRect(x - 2.8, y - BRIDGE_RAIL_H - 1, 5.6, BRIDGE_RAIL_H + 3);
    ctx.fillStyle = side > 0 ? '#c4914f' : '#a2733f'; ctx.fillRect(x - 1.8, y - BRIDGE_RAIL_H, 2.4, BRIDGE_RAIL_H + 1);
    ctx.fillStyle = '#7a5530'; ctx.fillRect(x + 0.6, y - BRIDGE_RAIL_H, 1.2, BRIDGE_RAIL_H + 1);
  }
}

function drawBridgeBack(ctx, bridge) {
  const found = bridgeArt(bridge);
  if (found) {
    const r = bridgeArtRect(found.art, bridge, found.art.back);
    ctx.drawImage(found.back, r.x, r.y, r.w, r.h);
    return;
  }
  const random = seededRandom(SCENERY_SEED + 31);
  const [x0] = bridge.west, [x1] = bridge.east;
  const deck = bridgeDeckPolygon(bridge);
  const traceDeck = (dx = 0, dy = 0) => { ctx.beginPath(); deck.forEach(([x, y], i) => i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)); ctx.closePath(); };
  const water = WORLD.terrain.filter(a => bridge.crosses.includes(a.id));
  const overWater = x => water.some(a => pointInPolygon(x, bridgeEdgeY(bridge, x, 0), a.polygon));
  // Shadow on the water, then trestle legs with foam where the deck spans it.
  traceDeck(5, 9); ctx.fillStyle = 'rgba(16, 34, 38, 0.45)'; ctx.fill();
  for (let x = x0 + 12; x < x1 - 8; x += 16) {
    if (!overWater(x)) continue;
    const y = bridgeEdgeY(bridge, x, 1);
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 3, y, 6, 12);
    ctx.fillStyle = '#6e4d2c'; ctx.fillRect(x - 2, y, 2.5, 11);
    ctx.strokeStyle = 'rgba(246, 252, 250, 0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, y + 12, 6, 1.8, 0, 0, Math.PI * 2); ctx.stroke();
  }
  // Stone abutments under each landing.
  for (const [ex, ey] of [bridge.west, bridge.east]) {
    for (let k = 0; k < 7; k++) {
      drawBoulder(ctx, ex + (random() - 0.5) * 18, ey + 6 + (random() - 0.2) * bridge.halfWidth * 1.6, 4 + random() * 3, random);
    }
  }
  // South fascia (the deck's visible thickness), planks, outline, far rail.
  ctx.fillStyle = '#4a3320';
  ctx.beginPath(); ctx.moveTo(deck[3][0], deck[3][1]); ctx.lineTo(deck[2][0], deck[2][1]);
  ctx.lineTo(deck[2][0], deck[2][1] + 5); ctx.lineTo(deck[3][0], deck[3][1] + 5); ctx.closePath(); ctx.fill();
  traceDeck(); ctx.fillStyle = '#b48650'; ctx.fill();
  ctx.save(); traceDeck(); ctx.clip();
  for (let x = x0; x < x1; x += 5.5) {
    const top = bridgeEdgeY(bridge, x, -1) - 1, depth = bridge.halfWidth * 2 + 2;
    ctx.fillStyle = random() < 0.5 ? 'rgba(232, 196, 136, 0.25)' : 'rgba(120, 82, 46, 0.22)';
    ctx.fillRect(x, top, 5, depth);
    ctx.fillStyle = 'rgba(64, 42, 22, 0.55)'; ctx.fillRect(x, top, 0.9, depth);
  }
  ctx.restore();
  traceDeck(); ctx.strokeStyle = '#2e2216'; ctx.lineWidth = 1.6; ctx.stroke();
  drawRail(ctx, bridge, -1);
}

// Near rail, drawn in the depth-sorted pass (see renderFrame).
function drawBridgeFront(ctx, bridge) {
  const found = bridgeArt(bridge);
  if (found) {
    const r = bridgeArtRect(found.art, bridge, found.art.front);
    ctx.drawImage(found.front, r.x, r.y, r.w, r.h);
    return;
  }
  drawRail(ctx, bridge, 1);
}

let staticLayerCache = { key: null, canvas: null };

// Cached static layer; repainted only when visible/built zones change or a
// terrain texture finishes loading.
function staticLayer(gameState) {
  const visible = new Set(), built = new Set();
  for (const building of gameState.allBuildings) {
    if (building.isBuilt) built.add(building.zoneId);
    if (building.isBuilt || buildingZone(building).surveyed) visible.add(building.zoneId);
  }
  const texturesReady = ['ground_grass', 'ground_apron'].filter(k => spriteReady(TERRAIN_SPRITES[k])).length;
  // Bridge back layers are painted in here too, so repaint once their art loads.
  const bridgesReady = WORLD.bridges.filter(b => bridgeArt(b)).length;
  const key = `${[...visible].sort().join(',')}|${[...built].sort().join(',')}|${texturesReady}|${bridgesReady}|${terrainStripsReady()}`;
  if (staticLayerCache.key !== key) staticLayerCache = { key, canvas: paintStaticLayer(visible, built) };
  return staticLayerCache.canvas;
}
