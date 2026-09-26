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

// Free for a prop: on open ground, clear of every footprint, path and the
// gate. `clearance` is the prop's own radius.
function isOpenGround(x, y, clearance, edges) {
  if (x < 8 || y < 8 || x > WORLD_W - 8 || y > WORLD_H - 8) return false;
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

function drawWater(ctx, area, random) {
  // Earthy bank, then deep water, then a lighter shallow rim and ripples.
  traceSmoothPolygon(ctx, area.polygon);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#8c7a55'; ctx.lineWidth = 18; ctx.stroke();
  ctx.strokeStyle = '#a9956a'; ctx.lineWidth = 9; ctx.stroke();
  fillSmooth(ctx, area.polygon, '#3f7d8a');
  ctx.save();
  traceSmoothPolygon(ctx, area.polygon);
  ctx.clip();
  traceSmoothPolygon(ctx, area.polygon);
  ctx.strokeStyle = 'rgba(160, 214, 205, 0.55)'; ctx.lineWidth = 14; ctx.stroke();
  const b = polygonBounds(area.polygon);
  ctx.strokeStyle = 'rgba(214, 240, 232, 0.45)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 0; i < (b.maxX - b.minX) * (b.maxY - b.minY) / 2600; i++) {
    const x = b.minX + random() * (b.maxX - b.minX), y = b.minY + random() * (b.maxY - b.minY);
    if (!pointInPolygon(x, y, area.polygon)) continue;
    ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.quadraticCurveTo(x, y - 3, x + 7, y); ctx.stroke();
  }
  ctx.restore();
}

// Cliff/rock: a lit top face plus a darker vertical face along every edge
// that faces the camera (downward normal), giving the three-quarter depth.
function drawRockMass(ctx, area, random) {
  const faceHeight = area.kind === 'cliff' ? 30 : 16;
  const poly = area.polygon;
  const clockwise = poly.reduce((sum, p, i) => {
    const q = poly[(i + 1) % poly.length];
    return sum + (q[0] - p[0]) * (q[1] + p[1]);
  }, 0) < 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const normalY = (clockwise ? dx : -dx) / (Math.hypot(dx, dy) || 1);
    if (normalY <= 0.25) continue;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    ctx.lineTo(b[0], b[1] + faceHeight); ctx.lineTo(a[0], a[1] + faceHeight);
    ctx.closePath();
    ctx.fillStyle = '#4f4b42'; ctx.fill();
    ctx.strokeStyle = 'rgba(25, 24, 20, 0.5)'; ctx.lineWidth = 2; ctx.stroke();
  }
  fillSmooth(ctx, poly, area.kind === 'cliff' ? '#7e7a69' : '#8c887a');
  traceSmoothPolygon(ctx, poly);
  ctx.strokeStyle = '#34322b'; ctx.lineWidth = 3; ctx.stroke();
  // Crack and moss marks, clipped to the top face.
  ctx.save();
  traceSmoothPolygon(ctx, poly);
  ctx.clip();
  const bounds = polygonBounds(poly);
  for (let i = 0; i < (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) / 1800; i++) {
    const x = bounds.minX + random() * (bounds.maxX - bounds.minX), y = bounds.minY + random() * (bounds.maxY - bounds.minY);
    if (random() < 0.5) {
      ctx.strokeStyle = 'rgba(50, 48, 40, 0.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8 + random() * 10, y + 3 + random() * 5); ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(96, 118, 70, 0.45)';
      ctx.beginPath(); ctx.ellipse(x, y, 6 + random() * 8, 3 + random() * 3, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
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

function drawPathEdges(ctx, edges) {
  const trace = () => { ctx.beginPath(); for (const edge of edges) traceSmoothLine(ctx, edge.points); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  trace(); ctx.strokeStyle = 'rgba(70, 58, 38, 0.45)'; ctx.lineWidth = 44; ctx.stroke();
  trace(); ctx.strokeStyle = '#a4814f'; ctx.lineWidth = 36; ctx.stroke();
  trace(); ctx.strokeStyle = 'rgba(206, 172, 116, 0.55)'; ctx.lineWidth = 20; ctx.stroke();
  // Worn wheel ruts.
  ctx.setLineDash([18, 14]);
  trace(); ctx.strokeStyle = 'rgba(120, 92, 58, 0.35)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.setLineDash([]);
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
  drawPathEdges(ctx, edges);

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
  const key = `${[...visible].sort().join(',')}|${[...built].sort().join(',')}|${texturesReady}`;
  if (staticLayerCache.key !== key) staticLayerCache = { key, canvas: paintStaticLayer(visible, built) };
  return staticLayerCache.canvas;
}
