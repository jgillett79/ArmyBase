// render.js — draws the base using the Phase 2 art (assets/). Sprites are
// preloaded below; until an image finishes loading (or if one fails to load)
// each drawer falls back to the original placeholder shape, so the game is
// always visible and never blocks on the art.

// --- sprite loading -------------------------------------------------------

function loadSprite(path) {
  const img = new Image();
  img.src = path;
  return img; // img.complete && naturalWidth>0 tells us when it's usable
}

function spriteReady(img) {
  return img && img.complete && img.naturalWidth > 0;
}

// Facility art comes from js/asset-manifest.js: processed art anchored by
// its pivot (used on zones whose door side it supports), and the older
// fitted sprite as the fallback everywhere else.
const FACILITY_SPRITES = {};
for (const [type, entry] of Object.entries(ASSET_MANIFEST.facilities)) {
  FACILITY_SPRITES[type] = {
    art: entry.crop ? loadSprite(entry.file) : null,
    fallback: loadSprite(entry.crop ? ASSET_MANIFEST.fallbackFacilityFiles[type] : entry.file),
  };
}

const BUILDING_SPRITES = {
  gatehouse: loadSprite(ASSET_MANIFEST.gate.file),
};

// Tileable ground/wall/road textures — see ASSETS.md's "Terrain" section.
// Generated at 4x display size (same convention as every other sprite), so
// each pattern needs a 0.25 scale to tile at its actual in-game size.
// Apron and grass patterns are layered into continuous, uneven clearings.
const TERRAIN_SPRITES = {
  ground: loadSprite('assets/terrain/ground.png'),
  ground_apron: loadSprite('assets/terrain/ground_apron-v2.webp'),
  ground_grass: loadSprite('assets/terrain/ground_grass-v2.webp'),
  wall: loadSprite('assets/terrain/wall.png'),
  road: loadSprite('assets/terrain/road.png'),
};
// Patterns for these are built in scenery.js on the offscreen layer.

// Each identity has 3 directional sprites (down/up/right — see ASSETS.md's
// "Character direction system") plus the original single-pose sprite as a
// fallback for whichever directional file hasn't loaded yet. There's no
// 'left' file — see unitSprite() below, it's the 'right' image mirrored.
// Civilians also get a 'sitting' pose (soldiers never sit — see
// isSeatedCivilian() below) for the Entrance Hall waiting chairs; a single
// fixed orientation, no down/up/right variants, since a seated figure
// doesn't turn to face a direction of travel.
function civilianSpriteSet(outfit) {
  const base = `assets/units/civilians/${outfit}`;
  return {
    down: loadSprite(`${base}_down.png`),
    up: loadSprite(`${base}_up.png`),
    right: loadSprite(`${base}_right.png`),
    sitting: loadSprite(`${base}_sitting.png`),
    fallback: loadSprite(`${base}.png`),
  };
}

function soldierSpriteSet(variant) {
  const padded = String(variant).padStart(2, '0');
  const base = `assets/units/soldiers/soldier_${padded}`;
  return {
    down: loadSprite(`${base}_down.png`),
    up: loadSprite(`${base}_up.png`),
    right: loadSprite(`${base}_right.png`),
    fallback: loadSprite(`assets/units/soldiers/soldier_${padded}.png`),
  };
}

const UNIT_SPRITES = {
  civilian: civilianSpriteSet('civilian'),
  bus_rider: civilianSpriteSet('bus_rider'),
  taxi: civilianSpriteSet('taxi'),
  soldier_1: soldierSpriteSet(1),
  soldier_2: soldierSpriteSet(2),
  soldier_3: soldierSpriteSet(3),
  soldier_4: soldierSpriteSet(4),
  soldier_5: soldierSpriteSet(5),
  soldier_6: soldierSpriteSet(6),
};

// Dispatches on outfit, not isCivilian — a RECRUITING unit (walking to the
// Barracks after being recruited) has isCivilian=false already but still
// wears its civilian outfit visually until it arrives and outfit flips to
// 'uniform' (see state.js's RECRUITING handling in tick()).
function unitSpriteSet(unit) {
  if (unit.outfit !== 'uniform') return UNIT_SPRITES[unit.outfit] || UNIT_SPRITES.civilian;
  return UNIT_SPRITES['soldier_' + (unit.soldierVariant || 1)];
}

// True once a waiting visitor stands on the Entrance Hall chair they
// reserved (not just when it was reserved at the gate).
function isSeatedCivilian(unit) {
  return unit.isCivilian && unit.status === UNIT_STATUS.CIVILIAN_APPROACHING
    && unit.chairIndex !== null && unit.isAtSlot();
}

// Picks the directional image for unit.facing ('left' reuses 'right' — see
// drawUnit(), which mirrors it) and falls back to the older single-pose
// sprite if that specific direction hasn't loaded yet. Seated civilians use
// their fixed sitting pose instead, when it's loaded — falls back to the
// normal standing/directional chain otherwise, same graceful-degrade idea
// as every other sprite lookup in this file.
function unitSprite(unit) {
  const set = unitSpriteSet(unit);
  if (isSeatedCivilian(unit) && spriteReady(set.sitting)) {
    return set.sitting;
  }
  const dirKey = unit.facing === 'left' ? 'right' : unit.facing;
  const img = set[dirKey];
  return spriteReady(img) ? img : set.fallback;
}

// --- view helpers --------------------------------------------------------------

// Current camera zoom, so labels and markers can stay a constant screen size
// while sprites scale with the world.
let renderZoom = 1;
const px = n => n / renderZoom;

// Closed polygon with corners rounded through edge midpoints, so authored
// terrain and clearings read as natural shapes rather than straight cuts.
function traceSmoothPolygon(ctx, polygon) {
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(polygon[polygon.length - 1], polygon[0]);
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < polygon.length; i++) {
    const next = mid(polygon[i], polygon[(i + 1) % polygon.length]);
    ctx.quadraticCurveTo(polygon[i][0], polygon[i][1], next[0], next[1]);
  }
  ctx.closePath();
}

// Open polyline rounded through midpoints; endpoints stay exact so paths
// still meet their nodes and entrances.
function traceSmoothLine(ctx, points) {
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const last = i === points.length - 2;
    const toX = last ? points[i + 1].x : (points[i].x + points[i + 1].x) / 2;
    const toY = last ? points[i + 1].y : (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, toX, toY);
  }
  if (points.length === 2) ctx.lineTo(points[1].x, points[1].y);
}

// --- facilities: the layered draw contract ---------------------------------------
//
// Every facility draws through the same layers, back to front:
//   shadow — contact shadow cast lower-right (upper-left key light)
//   ground — its clearing, painted in the static layer (scenery.js)
//   back   — structure behind anyone using it
//   (people and trees, depth-sorted by ground-contact y)
//   front  — pieces that must cover people standing at its slots: the
//            manifest's `front` occluder polygons redrawn over them
// `kind` (js/asset-manifest.js) decides what happens to people inside:
//   open   — outdoor station or porch: occupants stay visible and sorted
//   indoor — occupants are under the roof and hidden (a count badge shows
//            who's inside); while revealed — selected, or holding the
//            selected soldier — the roof lifts: floor, low walls, people,
//            then a front rail. Never a person drawn on top of a roof.
// Art is still one bitmap per facility, so `back` is the whole image and
// `front` re-draws parts of it; split roof/front files slot in here later.
function facilityKind(type) {
  return ASSET_MANIFEST.facilities[type].kind;
}
const CONSTRUCTION_MS = 1600;

const BUILDING_FALLBACK_COLORS = {
  entrance_hall: '#6a5a4a', barracks: '#5a6450', shooting_range: '#6a5240', mess_hall: '#40605a',
  weight_room: '#5a4a6a', obstacle_course: '#6a5a30', drill_yard: '#4a5a6a', showers: '#4a7a8a', rec_room: '#8a6a4a',
};

// Image and world rectangle for a facility on a zone: manifest-anchored art
// where it fits the zone, otherwise the older 3:2 sprite fitted to the
// zone width and grounded on its lower edge.
function facilityDrawable(building, zoneId = building.zoneId) {
  const zone = zoneById(zoneId);
  const sprites = FACILITY_SPRITES[building.type];
  const art = facilityArtFor(building.type, zone);
  if (art && spriteReady(sprites.art)) {
    const transform = facilityArtTransform(art, zone);
    return { img: sprites.art, rect: transform.rect, art, transform };
  }
  const bounds = polygonBounds(zone.footprint);
  const centre = polygonCentroid(zone.footprint);
  const fileName = ASSET_MANIFEST.facilities[building.type].crop
    ? ASSET_MANIFEST.fallbackFacilityFiles[building.type] : ASSET_MANIFEST.facilities[building.type].file;
  const content = ASSET_MANIFEST.contentBounds[fileName];
  const targetW = (bounds.maxX - bounds.minX) * 1.08; // overhangs the site a little, like the anchored art
  if (content) {
    // Fit the building itself (not its padded canvas) to the site, grounded
    // on the footprint's lower edge; never taller than 1.3x the site depth.
    const [imgW, imgH, x0, y0, x1, y1] = content;
    const scale = Math.min(targetW / (x1 - x0), (bounds.maxY - bounds.minY) * 1.3 / (y1 - y0));
    const bottom = bounds.maxY - 4;
    return { img: sprites.fallback, art: null, transform: null,
      rect: { x: centre.x - ((x0 + x1) / 2) * scale, y: bottom - y1 * scale, w: imgW * scale, h: imgH * scale } };
  }
  const w = targetW, h = w / 1.5;
  return { img: sprites.fallback, rect: { x: centre.x - w / 2, y: bounds.maxY - h - 6, w, h }, art: null, transform: null };
}

function facilitySpriteRect(building, zoneId = building.zoneId) {
  return facilityDrawable(building, zoneId).rect;
}

function drawFacilityImage(ctx, building, rect, zoneId = building.zoneId) {
  const { img } = facilityDrawable(building, zoneId);
  if (spriteReady(img)) ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
  else {
    ctx.fillStyle = BUILDING_FALLBACK_COLORS[building.type];
    ctx.fillRect(rect.x, rect.y + rect.h * 0.3, rect.w, rect.h * 0.7);
  }
}

function drawFacilityShadow(ctx, building) {
  if (!building.isBuilt) return;
  const zone = buildingZone(building);
  ctx.save();
  ctx.translate(10, 6);
  traceSmoothPolygon(ctx, zone.footprint);
  ctx.fillStyle = 'rgba(18, 24, 14, 0.16)';
  ctx.fill();
  ctx.restore();
}

function drawFacilityBack(ctx, building, revealed, now) {
  if (!building.isBuilt) return;
  const rect = facilitySpriteRect(building);
  const zone = buildingZone(building);
  const sinceBuilt = now - (building.constructedAt || -Infinity);

  if (sinceBuilt < CONSTRUCTION_MS) {
    drawConstruction(ctx, building, rect, sinceBuilt / CONSTRUCTION_MS, now);
    return;
  }
  if (revealed && facilityKind(building.type) === 'indoor') {
    // Roof lifted: a floor, then only the lower band of the walls.
    traceSmoothPolygon(ctx, zone.footprint);
    ctx.fillStyle = '#b39a70';
    ctx.fill();
    ctx.save();
    traceSmoothPolygon(ctx, zone.footprint);
    ctx.clip();
    ctx.strokeStyle = 'rgba(96, 72, 44, 0.45)';
    ctx.lineWidth = 2;
    const b = polygonBounds(zone.footprint);
    for (let y = b.minY + 10; y < b.maxY; y += 14) { ctx.beginPath(); ctx.moveTo(b.minX, y); ctx.lineTo(b.maxX, y); ctx.stroke(); }
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x - 10, rect.y + rect.h * 0.62, rect.w + 20, rect.h);
    ctx.clip();
    ctx.globalAlpha = 0.9;
    drawFacilityImage(ctx, building, rect);
    ctx.restore();
    return;
  }
  drawFacilityImage(ctx, building, rect);
}

function drawFacilityFront(ctx, building, revealed, now) {
  if (!building.isBuilt || now - (building.constructedAt || -Infinity) < CONSTRUCTION_MS) return;
  const drawable = facilityDrawable(building);
  // Manifest occluders: the same bitmap, clipped to each front polygon.
  if (drawable.art && drawable.art.front && drawable.art.front.length && (!revealed || facilityKind(building.type) !== 'indoor')) {
    for (const polygon of drawable.art.front) {
      ctx.save();
      ctx.beginPath();
      polygon.forEach(([x, y], i) => { const p = drawable.transform.toWorld(x, y); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(drawable.img, drawable.rect.x, drawable.rect.y, drawable.rect.w, drawable.rect.h);
      ctx.restore();
    }
  }
  if (!revealed || facilityKind(building.type) !== 'indoor') return;
  // Low front rail of the cutaway, in front of the people inside.
  const b = polygonBounds(buildingZone(building).footprint);
  ctx.save();
  ctx.strokeStyle = '#5a4630';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(b.minX + 18, b.maxY - 10); ctx.lineTo(b.maxX - 18, b.maxY - 10); ctx.stroke();
  ctx.strokeStyle = '#a58a5e';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(b.minX + 18, b.maxY - 12); ctx.lineTo(b.maxX - 18, b.maxY - 12); ctx.stroke();
  ctx.restore();
}

// Targets downrange in world px, from the facility's art (empty if none).
function facilityTargets(building) {
  const drawable = facilityDrawable(building);
  if (!drawable.art || !drawable.art.targets) return [];
  return drawable.art.targets.map(([x, y]) => drawable.transform.toWorld(x, y));
}

// Short build animation: scaffold and dust while the structure rises from
// the ground. Visual only — the purchase already happened.
function drawConstruction(ctx, building, rect, progress, now) {
  const rise = Math.min(1, progress * 1.15);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x - 10, rect.y + rect.h * (1 - rise), rect.w + 20, rect.h * rise + 10);
  ctx.clip();
  drawFacilityImage(ctx, building, rect);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 1 - Math.max(0, progress - 0.75) * 4;
  ctx.strokeStyle = '#8a6a3e';
  ctx.lineWidth = 4;
  for (let i = 0; i <= 4; i++) {
    const x = rect.x + rect.w * (0.1 + i * 0.2);
    ctx.beginPath(); ctx.moveTo(x, rect.y + rect.h); ctx.lineTo(x, rect.y + rect.h * 0.25); ctx.stroke();
  }
  for (const level of [0.45, 0.7]) {
    ctx.beginPath(); ctx.moveTo(rect.x + rect.w * 0.08, rect.y + rect.h * level); ctx.lineTo(rect.x + rect.w * 0.92, rect.y + rect.h * level); ctx.stroke();
  }
  for (let i = 0; i < 7; i++) {
    const phase = (now / 400 + i * 0.7) % 1;
    ctx.fillStyle = `rgba(214, 196, 150, ${0.45 * (1 - phase)})`;
    ctx.beginPath();
    ctx.arc(rect.x + rect.w * (0.1 + (i * 0.137) % 0.8), rect.y + rect.h - phase * 30, 10 + phase * 14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Who is out of sight under a roof right now.
function indoorFacilityAt(unit, gameState) {
  for (const building of gameState.allBuildings) {
    if (!building.isBuilt || facilityKind(building.type) !== 'indoor') continue;
    if (pointInPolygon(unit.x, unit.y, buildingZone(building).footprint)) return building;
  }
  return null;
}

function isUnitVisible(unit, gameState, revealed) {
  if (unit.status === UNIT_STATUS.ON_MISSION && !unit.departing) return false;
  const indoor = indoorFacilityAt(unit, gameState);
  return !indoor || revealed.has(indoor.id);
}

function drawOccupancyBadge(ctx, building, count) {
  const rect = facilitySpriteRect(building);
  const x = rect.x + rect.w - px(18), y = rect.y + rect.h * 0.28;
  ctx.save();
  ctx.fillStyle = 'rgba(24, 36, 30, 0.9)';
  ctx.strokeStyle = '#e7cf93';
  ctx.lineWidth = px(1.5);
  ctx.beginPath(); ctx.arc(x, y, px(13), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f4ead0';
  ctx.font = `bold ${px(12)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(String(count), x, y + px(4));
  ctx.restore();
}

// --- gate checkpoint -------------------------------------------------------------
//
// Kiosk back/front layers and one rigid boom that swings in the ground plane
// about a fixed post (WORLD.checkpoint, ASSET_MANIFEST.checkpoint). The boom
// is presentation only: it opens as a visitor's checkpoint pause ends or
// while anyone walks through the gap, and closes when the gap is clear. Its
// angle is not saved. Until the layers load, the interim gatehouse draws.

const BOOM_SWING_DEG_PER_S = 110;
const boomState = { angle: -90, lastNow: null };

function checkpointSprite(layer) {
  return FACILITY_SPRITES[layer.file] ||= loadSprite(layer.file);
}

function checkpointArtReady() {
  const art = ASSET_MANIFEST.checkpoint;
  return assetInUse(art) && ['kioskBack', 'kioskFront', 'boom', 'post'].every(k => spriteReady(checkpointSprite(art[k])));
}

// Should the boom be open now? Someone crossing the gap, or a visitor whose
// check-in pause is about to end (so the arm is open when they step off).
function boomWantsOpen(gameState, nowMs) {
  const hinge = WORLD.checkpoint.boomHinge;
  return gameState.units.some(u => {
    if (u.checkpointUntil) return u.checkpointUntil - nowMs < 900;
    const moving = u.path.length > 0;
    return moving && Math.abs(u.x - hinge.x) < 46 && Math.abs(u.y - 611) < 30;
  });
}

// Advances the boom toward open (0 deg, east) or closed (-90 deg, north).
function updateBoom(gameState, now) {
  const dt = boomState.lastNow === null ? 0 : Math.min(0.1, (now - boomState.lastNow) / 1000);
  boomState.lastNow = now;
  const target = boomWantsOpen(gameState, Date.now()) ? WORLD.checkpoint.boomOpenAngle : WORLD.checkpoint.boomClosedAngle;
  const step = BOOM_SWING_DEG_PER_S * dt;
  boomState.angle += clamp(target - boomState.angle, -step, step);
  return boomState.angle;
}

// Closed-tip rest fork: fixed, never rotated. Optional (candidate art).
function drawBoomRest(ctx) {
  const rest = ASSET_MANIFEST.checkpoint.rest, at = WORLD.checkpoint.boomRest;
  ctx.drawImage(checkpointSprite(rest), at.x - rest.ground[0] / 3, at.y - rest.ground[1] / 3, rest.size[0] / 3, rest.size[1] / 3);
}

// World point of the boom tip at an angle (pin at the post's height).
function boomTip(angleDeg) {
  const { post, boom } = ASSET_MANIFEST.checkpoint, hinge = WORLD.checkpoint.boomHinge, rad = angleDeg * Math.PI / 180;
  const pin = { x: hinge.x + (post.pin[0] - post.ground[0]) / 3, y: hinge.y - (post.ground[1] - post.pin[1]) / 3 };
  return { x: pin.x + Math.cos(rad) * boom.reachPx / 3, y: pin.y + Math.sin(rad) * boom.reachPx / 3 };
}

function drawKiosk(ctx, layerName) {
  const layer = ASSET_MANIFEST.checkpoint[layerName];
  const { kioskPivot } = WORLD.checkpoint;
  ctx.drawImage(checkpointSprite(layer), kioskPivot.x - layer.pivot[0] / 3, kioskPivot.y - layer.pivot[1] / 3, layer.size[0] / 3, layer.size[1] / 3);
}

// Fixed post, then the boom rotated about the shared hinge pin.
// WORLD.checkpoint.boomHinge is the hinge's GROUND point (the post's foot);
// the pin is drawn `height` above it, and the pole swings at that height, so
// its ground projection spans hinge.y .. hinge.y - reach — across the trail.
function drawBoom(ctx, angleDeg) {
  const { post, boom } = ASSET_MANIFEST.checkpoint;
  const hinge = WORLD.checkpoint.boomHinge;
  const height = (post.ground[1] - post.pin[1]) / 3;
  const pin = { x: hinge.x + (post.pin[0] - post.ground[0]) / 3, y: hinge.y - height };
  const rad = angleDeg * Math.PI / 180, reach = boom.reachPx / 3;
  // Ground shadow of the pole, falling lower-right like every contact shadow.
  ctx.save();
  ctx.strokeStyle = 'rgba(12, 18, 10, 0.3)'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pin.x + 3, hinge.y);
  ctx.lineTo(pin.x + 3 + Math.cos(rad) * reach, hinge.y + Math.sin(rad) * reach);
  ctx.stroke();
  ctx.restore();
  ctx.drawImage(checkpointSprite(post), hinge.x - post.ground[0] / 3, hinge.y - post.ground[1] / 3, post.size[0] / 3, post.size[1] / 3);
  ctx.save();
  ctx.translate(pin.x, pin.y);
  ctx.rotate((angleDeg - boom.axisDeg) * Math.PI / 180);
  ctx.drawImage(checkpointSprite(boom), -boom.pin[0] / 3, -boom.pin[1] / 3, boom.size[0] / 3, boom.size[1] / 3);
  ctx.restore();
}

// Depth-sorted items for the checkpoint (y = ground line of each layer).
function checkpointItems(gameState, now) {
  if (!checkpointArtReady()) return [];
  const { kiosk, boomHinge } = WORLD.checkpoint;
  const angle = updateBoom(gameState, now);
  return [
    { y: Math.min(...kiosk.map(p => p[1])), draw: ctx => drawKiosk(ctx, 'kioskBack') },
    { y: Math.max(...kiosk.map(p => p[1])), draw: ctx => drawKiosk(ctx, 'kioskFront') },
    { y: boomHinge.y, draw: ctx => drawBoom(ctx, angle) },
  ].concat(assetInUse(ASSET_MANIFEST.checkpoint.rest, typeof ALLOW_CANDIDATE_ART !== 'undefined' && ALLOW_CANDIDATE_ART)
    && spriteReady(checkpointSprite(ASSET_MANIFEST.checkpoint.rest))
    ? [{ y: WORLD.checkpoint.boomRest.y, draw: drawBoomRest }] : []);
}

// Interim gate: one sprite in the gap of the west fence, until the
// checkpoint layers are loaded.
function drawGatehouse(ctx) {
  const gate = worldNodePosition('gate');
  const w = 64, h = 128, x = gate.x - w / 2, y = gate.y - h + 36;
  const img = BUILDING_SPRITES.gatehouse;
  if (spriteReady(img)) ctx.drawImage(img, x, y, w, h);
  else { ctx.fillStyle = '#8a7a5a'; ctx.fillRect(x, y, w, h); }
}

// --- people --------------------------------------------------------------------------

// Unit sprite size in world px. unit.x/unit.y is the ground-contact point
// (feet): people stand on paths and slots, and depth sorting and hit testing
// use that same point.
const UNIT_H = ASSET_MANIFEST.unitWorldHeight;
const UNIT_W = Math.round(UNIT_H * 2 / 3);

function drawClock(ctx, hourOfDay, isDaytime, viewW) {
  const h = Math.floor(hourOfDay);
  const m = Math.floor((hourOfDay - h) * 60);
  const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${isDaytime ? '☀' : '☽'}`;
  ctx.fillStyle = 'rgba(16, 26, 22, 0.72)';
  ctx.fillRect(viewW - 92, 8, 84, 22);
  ctx.fillStyle = '#e8e4d0';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(label, viewW - 14, 24);
  ctx.textAlign = 'left';
}

function outfitMarker(outfit) {
  // small visual tag so civilians read as "bus rider / taxi / walking" at a glance
  switch (outfit) {
    case 'bus_rider': return '🚌';
    case 'taxi': return '🚕';
    case 'civilian': return '🚶';
    default: return null;
  }
}

function drawUnit(ctx, unit, isSelected, now = performance.now()) {
  const hue = unit.colorSeed;
  const inHospital = unit.status === UNIT_STATUS.HOSPITAL;
  const img = unitSprite(unit);
  const halfW = UNIT_W / 2;
  const bottom = unit.y;               // feet
  const top = unit.y - UNIT_H;         // sprite top edge
  const moving = !isSeatedCivilian(unit) &&
    (unit.path.length > 0 || Math.hypot(unit.targetX - unit.x, unit.targetY - unit.y) > 1);
  const pose = unitFramePose(unit, now); // activity/walk frames when the art exists (animation.js)

  ctx.save();
  ctx.globalAlpha = unit.status === UNIT_STATUS.CIVILIAN_LEAVING ? 0.6 : 1;
  ctx.fillStyle = 'rgba(8, 20, 17, 0.3)';
  ctx.beginPath();
  ctx.ellipse(unit.x + 3, bottom - 1, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isSelected) {
    ctx.strokeStyle = 'rgba(248, 230, 160, 0.95)';
    ctx.lineWidth = px(2.5);
    ctx.beginPath();
    ctx.ellipse(unit.x, bottom - 1, halfW, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (pose) {
    drawFramePose(ctx, unit, pose);
  } else if (spriteReady(img)) {
    // per-unit hue-shift is what makes each soldier distinguishable — the
    // sprites are intentionally desaturated so this rotates cleanly. In
    // uniform gets a saturation bump to "pop"; still-civilian-looking
    // (including RECRUITING, mid-walk-in) stays muted — dispatch on outfit,
    // not isCivilian, for the same reason as unitSprite() above.
    ctx.save();
    const sat = unit.outfit === 'uniform' ? 1.5 : 0.85;
    // Until real walk frames exist, keep the still's feet on the ground.
    // The previous vertical bounce lifted the whole sprite away from its
    // contact shadow every step and read as flying.
    // The sitting pose is a single fixed orientation, so no left-mirror.
    if (unit.facing === 'left' && !isSeatedCivilian(unit)) {
      // No dedicated 'left' art (see ASSETS.md) — mirror the 'right' sprite.
      ctx.translate(unit.x + halfW, top);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(unit.x - halfW, top);
    }
    drawWalkingSprite(ctx, tintedSprite(img, hue, sat));
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(unit.x, unit.y - UNIT_H / 2, unit.isCivilian ? 8 : 10, 0, Math.PI * 2);
    ctx.fillStyle = unit.isCivilian ? `hsl(${hue}, 25%, 55%)` : `hsl(${hue}, 55%, 50%)`;
    ctx.fill();
  }

  // hospital ring — the only status shown as a ring (a "problem" signal).
  if (inHospital) {
    ctx.lineWidth = px(2);
    ctx.strokeStyle = '#b4444a';
    ctx.setLineDash([px(3), px(3)]);
    ctx.beginPath();
    ctx.ellipse(unit.x, unit.y - UNIT_H / 2, halfW + 3, UNIT_H / 2 + 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

// Labels, drawn after everything else so trees and building fronts never
// hide them, at a constant screen size at any zoom. Soldiers always show a
// name (that's the point) plus status and energy; visitors show their
// outfit marker. When people stand close, a label that would overlap one
// already placed steps up (names) or down (status) instead of printing over
// it — two soldiers side by side at a range mat stay readable.
function drawUnitLabels(ctx, units, selectedUnitId) {
  ctx.save();
  ctx.font = `${px(11)}px monospace`;
  ctx.textAlign = 'center';
  const textW = text => text.length * px(6.6); // 11px monospace advance
  const placed = [];
  const place = (x, y, w, h, step) => {
    for (let k = 0; k < 4; k++) {
      const box = { x0: x - w / 2, x1: x + w / 2, y0: y + k * step - h, y1: y + k * step };
      if (!placed.some(b => box.x0 < b.x1 && b.x0 < box.x1 && box.y0 < b.y1 && b.y0 < box.y1)) { placed.push(box); return k * step; }
    }
    return 0;
  };
  // Selected first, then nearest the camera, so they keep the natural spot.
  const ordered = units.slice().sort((a, b) => (b.id === selectedUnitId) - (a.id === selectedUnitId) || b.y - a.y);
  for (const unit of ordered) {
    const top = unit.y - UNIT_H, bottom = unit.y;
    ctx.globalAlpha = unit.status === UNIT_STATUS.CIVILIAN_LEAVING ? 0.6 : 1;
    if (unit.isCivilian) {
      const marker = outfitMarker(unit.outfit);
      if (marker) ctx.fillText(marker, unit.x, top - px(2) + place(unit.x, top - px(2), px(12), px(11), -px(12)));
      continue;
    }
    // Name as called in the field (callsign when set), with the soldier's
    // accent as a pip before it — the in-world accent until an approved
    // accent mask draws it on the figure itself.
    const name = unit.fieldName, status = statusLabel(unit);
    const accent = accentById(unit.accent);
    const nameDy = place(unit.x, top - px(4), textW(name) + px(14), px(11), -px(12));
    if (accent) {
      ctx.fillStyle = accent.hex;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = px(1);
      ctx.beginPath();
      ctx.arc(unit.x - textW(name) / 2 - px(6), top - px(8) + nameDy, px(3.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const statusDy = place(unit.x, bottom + px(18), Math.max(textW(status), px(24)) + px(4), px(17), px(17));
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillStyle = '#ece6d2';
    ctx.fillText(name, unit.x, top - px(4) + nameDy);
    ctx.fillText(status, unit.x, bottom + px(12) + statusDy);
    ctx.restore();
    // Energy bar: low energy is what sends people to hospital.
    const barW = px(24), barH = px(3);
    const bx = unit.x - barW / 2, by = bottom + px(15) + statusDy;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(bx, by, barW, barH);
    const pct = unit.energy / unit.maxEnergy;
    ctx.fillStyle = pct < 0.25 ? '#b4444a' : '#7fae4a';
    ctx.fillRect(bx, by, barW * pct, barH);
  }
  ctx.restore();
}

// A CSS filter per person per frame is slow (software canvases especially),
// so each person's hue-shifted sprite is rendered once and reused.
const tintedSpriteCache = new Map();
function tintedSprite(img, hue, saturation) {
  const key = `${img.src}|${hue}|${saturation}`;
  let tinted = tintedSpriteCache.get(key);
  if (tinted) return tinted;
  tinted = document.createElement('canvas');
  tinted.width = img.naturalWidth;
  tinted.height = img.naturalHeight;
  const c = tinted.getContext('2d');
  if (!c) return img;
  c.filter = `hue-rotate(${hue}deg) saturate(${saturation})`;
  c.drawImage(img, 0, 0);
  tintedSpriteCache.set(key, tinted);
  return tinted;
}

// Portrait slot (brief 08): head and shoulders from the person's own
// front-facing sprite with their identity tint, so the card, roster, map
// and debrief all show the same person. A stand-in until Codex exports
// dedicated busts per soldier variant (see the brief 08 manifest).
// Returns true once the art was drawn (false while it is still loading).
const PORTRAIT_CROP = { x: 0.14, y: 0.0, size: 0.72 }; // of the sprite width, from its top edge
const portraitImages = new Map();
function portraitArt(variant) {
  const entry = ASSET_MANIFEST.portraits[variant];
  const allowCandidates = typeof ALLOW_CANDIDATE_ART !== 'undefined' && ALLOW_CANDIDATE_ART;
  if (!entry || !assetInUse(entry, allowCandidates)) return null;
  if (!portraitImages.has(entry.file)) portraitImages.set(entry.file, loadSprite(entry.file));
  const img = portraitImages.get(entry.file);
  return spriteReady(img) ? img : null;
}
function drawPortrait(canvas, unit) {
  const g = canvas.getContext && canvas.getContext('2d');
  if (!g) return false;
  const w = canvas.width, h = canvas.height;
  g.clearRect(0, 0, w, h);
  g.fillStyle = `hsl(${unit.colorSeed}, 18%, 26%)`;
  g.fillRect(0, 0, w, h);
  // A painted portrait for this body when one is in use (asset-manifest.js
  // `portraits`: candidates only with ?art=candidates), drawn untinted.
  const painted = unit.outfit === 'uniform' && portraitArt(unit.soldierVariant);
  if (painted) {
    g.drawImage(painted, 0, 0, w, h);
    return true;
  }
  const set = unitSpriteSet(unit);
  const img = spriteReady(set.down) ? set.down : set.fallback;
  if (!spriteReady(img)) {
    g.fillStyle = `hsl(${unit.colorSeed}, 45%, 55%)`;
    g.beginPath(); g.arc(w / 2, h * 0.55, w * 0.3, 0, Math.PI * 2); g.fill();
    return false;
  }
  const art = tintedSprite(img, unit.colorSeed, unit.outfit === 'uniform' ? 1.5 : 0.85);
  const size = img.naturalWidth * PORTRAIT_CROP.size;
  g.drawImage(art, img.naturalWidth * PORTRAIT_CROP.x, img.naturalHeight * PORTRAIT_CROP.y, size, size, 0, 0, w, h);
  return true;
}

// Guidance highlight (first soldier chapter): a pulsing ring and marker on
// the person to act on, and the outline of the facility involved.
function drawGuideHighlight(ctx, gameState, guide, now) {
  if (!guide) return;
  const pulse = 0.5 + 0.5 * Math.sin(now / 260);
  ctx.save();
  if (guide.zoneId) {
    const zone = zoneById(guide.zoneId);
    if (zone) {
      traceSmoothPolygon(ctx, zone.footprint);
      ctx.setLineDash([px(10), px(6)]);
      ctx.lineDashOffset = -now / 60;
      ctx.strokeStyle = `rgba(244, 215, 152, ${0.55 + 0.35 * pulse})`;
      ctx.lineWidth = px(3);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  const unit = guide.unitId && gameState.units.find(u => u.id === guide.unitId);
  if (unit && unit.status !== UNIT_STATUS.ON_MISSION) {
    ctx.strokeStyle = `rgba(244, 215, 152, ${0.6 + 0.4 * pulse})`;
    ctx.lineWidth = px(3);
    ctx.beginPath();
    ctx.ellipse(unit.x, unit.y - 1, UNIT_W / 2 + 6 + pulse * 4, 11 + pulse * 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Marker above the head, clear of the name label.
    const tipY = unit.y - UNIT_H - px(22) - pulse * px(5);
    ctx.fillStyle = '#f4d798';
    ctx.strokeStyle = '#1d2923';
    ctx.lineWidth = px(1.5);
    ctx.beginPath();
    ctx.moveTo(unit.x, tipY);
    ctx.lineTo(unit.x - px(8), tipY - px(12));
    ctx.lineTo(unit.x + px(8), tipY - px(12));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// Keep the figure intact while moving. Cutting two "legs" out of still art
// distorted uniforms and looked like skating; authored frame sets will
// replace this complete-pose fallback in the character production pass.
function drawWalkingSprite(ctx, img) {
  ctx.drawImage(img, 0, 0, UNIT_W, UNIT_H);
}

function statusLabel(unit) {
  if (unit.routePhase === 'queued') return 'queuing';
  switch (unit.status) {
    case UNIT_STATUS.ON_MISSION: return 'deploying';
    case UNIT_STATUS.RECRUITING: return 'enlisting';
    case UNIT_STATUS.TRAINING: return 'training';
    case UNIT_STATUS.EATING: return 'eating';
    case UNIT_STATUS.SLEEPING: return 'sleeping';
    case UNIT_STATUS.HYGIENE: return 'showering';
    case UNIT_STATUS.RECREATION: return 'recreation';
    case UNIT_STATUS.HOSPITAL: return 'hospital';
    default: return `Lv${unit.level}`;
  }
}

// A facility only shows activity once a soldier stands on the slot they
// reserved there — the exact condition the simulation uses for gains
// (GameState.isUsingFacility), so walking, queuing or an unbuilt plot never
// looks like activity.
function activeFacilityFor(unit, gameState) {
  if (unit.isCivilian || !unit.slot) return null;
  const building = gameState.buildingByAnyId(unit.slot.buildingId);
  return gameState.isUsingFacility(unit, building) ? building : null;
}

// Interim activity cues around the working soldier. Brief 04 replaces these
// with authored full-body activity frames keyed on unit.slot.activity.
function drawFacilityActivity(ctx, unit, gameState, now) {
  const building = activeFacilityFor(unit, gameState);
  if (!building) return;
  const phase = now * 0.005 + unit.colorSeed;
  const pulse = (Math.sin(phase) + 1) / 2;
  const x = unit.x, y = unit.y - UNIT_H;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 2;

  if (unit.slot.activity === 'fire') {
    // Muzzle flash in the slot's facing (unless firing frames draw their
    // own), and a hit marker on the nearest target painted in the art.
    const [dx, dy] = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] }[unit.slot.facing] || [1, 0];
    if (pulse > 0.8 && !unitFramePose(unit, now)) {
      ctx.fillStyle = '#ffd47a';
      ctx.beginPath(); ctx.arc(x + dx * 16, y + 16 + dy * 12, 3, 0, Math.PI * 2); ctx.fill();
    }
    const targets = facilityTargets(building);
    const target = targets.reduce((best, t) => !best || Math.hypot(t.x - unit.x, t.y - unit.y) < Math.hypot(best.x - unit.x, best.y - unit.y) ? t : best, null);
    const hitX = target ? target.x : unit.x + dx * 100, hitY = target ? target.y : unit.y - 24 + dy * 100;
    ctx.strokeStyle = 'rgba(233, 213, 170, 0.8)';
    ctx.beginPath(); ctx.arc(hitX, hitY, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ad6050';
    ctx.beginPath(); ctx.arc(hitX, hitY, 1.5 + pulse * 2, 0, Math.PI * 2); ctx.stroke();
  } else if (unit.slot.activity === 'lift' || unit.slot.activity === 'drill') {
    const lift = pulse * 6;
    ctx.strokeStyle = '#d1c7a9';
    ctx.beginPath(); ctx.moveTo(x - 16, y + 8 - lift); ctx.lineTo(x + 16, y + 8 - lift); ctx.stroke();
    ctx.fillStyle = '#465b58';
    ctx.fillRect(x - 18, y + 3 - lift, 4, 10);
    ctx.fillRect(x + 14, y + 3 - lift, 4, 10);
  } else if (unit.slot.activity === 'traverse') {
    ctx.fillStyle = '#d9a35c';
    ctx.beginPath(); ctx.arc(x - 12 + pulse * 24, y - 6, 3, 0, Math.PI * 2); ctx.fill();
  } else if (unit.slot.activity === 'eat') {
    ctx.fillStyle = '#ead7ad';
    ctx.beginPath(); ctx.ellipse(x + 14, y + 26, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
  } else if (unit.slot.activity === 'wash') {
    ctx.fillStyle = '#8ec9c9';
    for (let i = 0; i < 3; i++) {
      const fall = (pulse * 9 + i * 4) % 12;
      ctx.beginPath(); ctx.arc(x - 9 + i * 9, y - 4 + fall, 2, 0, Math.PI * 2); ctx.fill();
    }
  } else if (unit.slot.activity === 'relax') {
    ctx.fillStyle = '#e9ce91';
    ctx.font = `bold ${px(14)}px sans-serif`;
    ctx.fillText('♪', x + 12, y + 4 - pulse * 5);
  } else if (unit.slot.activity === 'rest') {
    ctx.fillStyle = '#c5d5d0';
    ctx.font = `bold ${px(12)}px sans-serif`;
    ctx.fillText('z', x + 12, y + 4 - pulse * 5);
  }
  ctx.restore();
}

// --- overlays --------------------------------------------------------------------

// Build mode: legal sites for the chosen facility, the hovered/selected site
// with a ghost of the building, and red outlines where it can't go.
function drawBuildOverlay(ctx, gameState, buildMode, now) {
  const building = gameState.buildingByAnyId(buildMode.buildingId);
  if (!building) return;
  for (const zone of WORLD.zones) {
    if (!zoneAllowsType(zone, building.type)) continue;
    const state = gameState.zonePlacementState(building, zone.id);
    const focused = zone.id === buildMode.selectedZoneId || zone.id === buildMode.hoverZoneId;
    traceSmoothPolygon(ctx, zone.footprint);
    if (state === 'blocked') {
      ctx.setLineDash([px(8), px(6)]);
      ctx.strokeStyle = 'rgba(214, 96, 80, 0.85)'; ctx.lineWidth = px(2); ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }
    const pulse = 0.18 + 0.08 * Math.sin(now / 300);
    ctx.fillStyle = focused ? `rgba(150, 220, 130, ${pulse + 0.1})` : `rgba(150, 220, 130, ${pulse})`;
    ctx.fill();
    ctx.strokeStyle = focused ? '#e9f7c6' : 'rgba(190, 240, 160, 0.8)';
    ctx.lineWidth = px(focused ? 3 : 2);
    ctx.stroke();
  }
  const ghostZone = buildMode.selectedZoneId || buildMode.hoverZoneId;
  if (ghostZone && gameState.zonePlacementState(building, ghostZone) !== 'blocked') {
    ctx.save();
    ctx.globalAlpha = 0.62;
    if (!buildMode.affordable) ctx.filter = 'grayscale(1) sepia(1) saturate(4) hue-rotate(-40deg)';
    drawFacilityImage(ctx, building, facilitySpriteRect(building, ghostZone), ghostZone);
    ctx.restore();
  }
}

// Developer overlay (?debug=scene or the G key): zones, path graph, slot
// anchors (red = reserved), queue spots and entrances.
function drawDebugOverlay(ctx, gameState) {
  ctx.save();
  ctx.lineWidth = px(1.5);
  for (const zone of WORLD.zones) {
    ctx.beginPath();
    zone.footprint.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.strokeStyle = '#a7f0ff'; ctx.stroke();
    const c = polygonCentroid(zone.footprint);
    ctx.fillStyle = '#e6fbff'; ctx.font = `${px(11)}px monospace`; ctx.textAlign = 'center';
    ctx.fillText(zone.id, c.x, c.y);
    ctx.fillStyle = '#ff5a4a';
    ctx.beginPath(); ctx.arc(zone.entrance.x, zone.entrance.y, px(4), 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255, 170, 60, 0.9)';
  for (const edge of worldEdgeList(null)) {
    ctx.beginPath();
    edge.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke();
  }
  for (const [id, node] of Object.entries(WORLD.nodes)) {
    ctx.fillStyle = '#20231c';
    ctx.beginPath(); ctx.arc(node.x, node.y, px(4), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff4d6'; ctx.textAlign = 'left';
    ctx.fillText(id, node.x + px(6), node.y - px(4));
  }
  for (const building of gameState.allBuildings) {
    for (const slot of gameState.facilitySlots(building, gameState.slotHolders(building))) {
      const taken = gameState.slotOccupants.has(gameState.slotKey(building.id, slot.slotId));
      ctx.fillStyle = taken ? '#ff5a4a' : '#ffffff';
      ctx.beginPath(); ctx.arc(slot.x, slot.y, px(3.5), 0, Math.PI * 2); ctx.fill();
    }
    (gameState.queues.get(building.id) || []).forEach((_, i) => {
      const spot = gameState.queuePosition(building, i);
      ctx.fillStyle = '#ffd84a';
      ctx.fillRect(spot.x - px(3), spot.y - px(3), px(6), px(6));
    });
  }
  ctx.restore();
}

// --- frame -------------------------------------------------------------------------

let fallbackCamera = null;

// view: { camera, dpr, now, buildMode, debug, revealedBuildingId, guide }.
function renderFrame(ctx, gameState, selectedUnitId, view = {}) {
  const camera = view.camera || (fallbackCamera ||= new Camera(960, 576));
  const dpr = view.dpr || 1;
  const now = view.now ?? performance.now();
  renderZoom = camera.zoom;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1a1d14';
  ctx.fillRect(0, 0, camera.viewW * dpr, camera.viewH * dpr);
  const s = dpr * camera.zoom;
  ctx.setTransform(s, 0, 0, s, -camera.x * s, -camera.y * s);

  ctx.drawImage(staticLayer(gameState), WORLD_X0, 0, WORLD_W - WORLD_X0, WORLD_H);
  const bounds = camera.visibleBounds(120);
  drawWaterCurrent(ctx, now, bounds);
  if (!checkpointArtReady()) drawGatehouse(ctx);

  // Facilities opened up for viewing: selected, or holding the selected soldier.
  const selected = gameState.units.find(u => u.id === selectedUnitId);
  const revealed = new Set();
  if (view.revealedBuildingId) revealed.add(view.revealedBuildingId);
  if (selected) { const inside = indoorFacilityAt(selected, gameState); if (inside) revealed.add(inside.id); }

  // Northern facilities first so nearer ones overlap them.
  const buildings = gameState.allBuildings.slice()
    .sort((a, b) => polygonBounds(buildingZone(a).footprint).maxY - polygonBounds(buildingZone(b).footprint).maxY);
  for (const building of buildings) drawFacilityShadow(ctx, building);
  for (const building of buildings) drawFacilityBack(ctx, building, revealed.has(building.id), now);

  // People and trees, depth-sorted by ground contact.
  const inView = (x, y) => x > bounds.minX && x < bounds.maxX && y > bounds.minY && y < bounds.maxY + 100;
  const items = [];
  for (const tree of scenery().trees) if (inView(tree.x, tree.y)) items.push({ y: tree.y, tree });
  for (const bridge of WORLD.bridges) items.push({ y: bridgeFrontDepth(bridge), bridge });
  for (const item of checkpointItems(gameState, now)) items.push(item);
  for (const prop of SCENE_PROP_PLACEMENTS) if (inView(prop.x, prop.y)) items.push({ y: prop.y, prop });
  const hiddenCount = new Map();
  for (const unit of gameState.units) {
    if (!isUnitVisible(unit, gameState, revealed)) {
      const indoor = indoorFacilityAt(unit, gameState);
      if (indoor && !(unit.status === UNIT_STATUS.ON_MISSION)) hiddenCount.set(indoor.id, (hiddenCount.get(indoor.id) || 0) + 1);
      continue;
    }
    if (inView(unit.x, unit.y)) items.push({ y: unit.y, unit });
  }
  items.sort((a, b) => a.y - b.y);
  for (const item of items) {
    if (item.tree) drawTree(ctx, item.tree);
    else if (item.bridge) drawBridgeFront(ctx, item.bridge);
    else if (item.prop) drawSceneProp(ctx, item.prop);
    else if (item.draw) item.draw(ctx);
    else {
      drawUnit(ctx, item.unit, item.unit.id === selectedUnitId, now);
      drawFacilityActivity(ctx, item.unit, gameState, now);
    }
  }

  for (const building of buildings) drawFacilityFront(ctx, building, revealed.has(building.id), now);
  drawUnitLabels(ctx, items.filter(item => item.unit).map(item => item.unit), selectedUnitId);
  for (const [buildingId, count] of hiddenCount) drawOccupancyBadge(ctx, gameState.buildingByAnyId(buildingId), count);
  if (!view.buildMode) drawGuideHighlight(ctx, gameState, view.guide, now);
  if (view.buildMode) drawBuildOverlay(ctx, gameState, view.buildMode, now);
  if (view.debug) drawDebugOverlay(ctx, gameState);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawClock(ctx, gameState.hourOfDay, gameState.isDaytime, camera.viewW);
}
