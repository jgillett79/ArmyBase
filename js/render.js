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

const BUILDING_SPRITES = {
  barracks: loadSprite('assets/buildings/barracks.png'),
  shooting_range: loadSprite('assets/buildings/shooting_range.png'),
  weight_room: loadSprite('assets/buildings/weight_room.png'),
  obstacle_course: loadSprite('assets/buildings/obstacle_course.png'),
  drill_yard: loadSprite('assets/buildings/drill_yard.png'),
  mess_hall: loadSprite('assets/buildings/mess_hall.png'),
};

const UNIT_SPRITES = {
  civilian: loadSprite('assets/units/civilians/civilian.png'),
  bus_rider: loadSprite('assets/units/civilians/bus_rider.png'),
  taxi: loadSprite('assets/units/civilians/taxi.png'),
  soldier_1: loadSprite('assets/units/soldiers/soldier_01.png'),
  soldier_2: loadSprite('assets/units/soldiers/soldier_02.png'),
  soldier_3: loadSprite('assets/units/soldiers/soldier_03.png'),
  soldier_4: loadSprite('assets/units/soldiers/soldier_04.png'),
  soldier_5: loadSprite('assets/units/soldiers/soldier_05.png'),
  soldier_6: loadSprite('assets/units/soldiers/soldier_06.png'),
};

// On-screen unit sprite size (matches the 32x48 spec in ASSETS.md).
const UNIT_W = 32;
const UNIT_H = 48;

function unitSprite(unit) {
  if (unit.isCivilian) return UNIT_SPRITES[unit.outfit] || UNIT_SPRITES.civilian;
  return UNIT_SPRITES['soldier_' + (unit.soldierVariant || 1)];
}

// --- drawers --------------------------------------------------------------

function drawGrid(ctx) {
  ctx.strokeStyle = 'rgba(216, 216, 200, 0.08)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= GRID_COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL_SIZE, 0);
    ctx.lineTo(c * CELL_SIZE, GRID_ROWS * CELL_SIZE);
    ctx.stroke();
  }
  for (let r = 0; r <= GRID_ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL_SIZE);
    ctx.lineTo(GRID_COLS * CELL_SIZE, r * CELL_SIZE);
    ctx.stroke();
  }
}

function drawBuildingBox(ctx, gridX, gridY, isBuilt, label, subLabel, color, spriteKey) {
  const x = gridX * CELL_SIZE;
  const y = gridY * CELL_SIZE;
  const w = CELL_SIZE * BUILDING_FOOTPRINT_CELLS.w;
  const h = CELL_SIZE * BUILDING_FOOTPRINT_CELLS.h;

  if (!isBuilt) {
    ctx.strokeStyle = 'rgba(216, 216, 200, 0.4)';
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(216, 216, 200, 0.5)';
    ctx.font = '12px monospace';
    ctx.fillText(`${label} (not built)`, x + 8, y + h / 2);
    return;
  }

  const img = BUILDING_SPRITES[spriteKey];
  if (spriteReady(img)) {
    ctx.drawImage(img, x, y, w, h);
  } else {
    // fallback: original colored box until the sprite is available
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#8a9478';
    ctx.strokeRect(x, y, w, h);
  }

  // level + status text overlay (drawn on top of the art either way, with a
  // subtle shadow so it stays readable against the sprite)
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 3;
  ctx.fillStyle = '#d8d8c8';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(label, x + 8, y + 20);
  ctx.font = '11px monospace';
  ctx.fillText(subLabel, x + 8, y + 38);
  ctx.restore();
}

function drawBarracks(ctx, barracks) {
  drawBuildingBox(ctx, barracks.gridX, barracks.gridY, barracks.isBuilt,
    `Barracks Lv.${barracks.level}`, `+${barracks.capContribution()} cap`, '#5a6450', 'barracks');
}

// Shared drawer for the 4 TrainingBuilding instances (building.js) — they're
// all boxes with a level + occupancy label, just different labels/colors/art.
function drawTrainingBuilding(ctx, building, occupancy, label, color, spriteKey) {
  drawBuildingBox(ctx, building.gridX, building.gridY, building.isBuilt,
    `${label} Lv.${building.level}`, `${occupancy}/${building.capacity} slots`, color, spriteKey);
}

function drawMessHall(ctx, hall, food) {
  drawBuildingBox(ctx, hall.gridX, hall.gridY, hall.isBuilt,
    'Mess Hall', `Food: ${Math.floor(food)}`, '#40605a', 'mess_hall');
}

function drawClock(ctx, hourOfDay, isDaytime) {
  const h = Math.floor(hourOfDay);
  const m = Math.floor((hourOfDay - h) * 60);
  const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${isDaytime ? '☀' : '☽'}`;
  ctx.fillStyle = '#d8d8c8';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(label, GRID_COLS * CELL_SIZE - 10, 18);
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

function drawUnit(ctx, unit, isSelected) {
  const hue = unit.colorSeed;
  const inHospital = unit.status === UNIT_STATUS.HOSPITAL;
  const img = unitSprite(unit);
  const halfW = UNIT_W / 2;
  const top = unit.y - UNIT_H / 2;      // sprite top edge
  const bottom = unit.y + UNIT_H / 2;   // sprite bottom edge (feet)

  ctx.save();
  ctx.globalAlpha = unit.status === UNIT_STATUS.CIVILIAN_LEAVING ? 0.5 : 1;

  // selection highlight — soft ellipse under the feet
  if (isSelected) {
    ctx.fillStyle = 'rgba(242, 233, 168, 0.55)';
    ctx.beginPath();
    ctx.ellipse(unit.x, bottom - 2, halfW, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (spriteReady(img)) {
    // per-unit hue-shift is what makes each soldier distinguishable — the
    // sprites are intentionally desaturated so this rotates cleanly. Recruited
    // soldiers get a saturation bump to "pop"; civilians stay muted (not yours).
    ctx.save();
    const sat = unit.isCivilian ? 0.85 : 1.5;
    ctx.filter = `hue-rotate(${hue}deg) saturate(${sat})`;
    ctx.drawImage(img, unit.x - halfW, top, UNIT_W, UNIT_H);
    ctx.restore();
  } else {
    // fallback: original colored dot until the sprite loads
    const radius = unit.isCivilian ? 6 : 8;
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = unit.isCivilian
      ? `hsl(${hue}, 25%, 55%)`
      : `hsl(${hue}, 55%, 50%)`;
    ctx.fill();
  }

  // hospital ring — the only status shown as a ring (a "problem" signal);
  // other statuses are shown via the text label so the canvas stays readable.
  if (inHospital) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#b4444a';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.ellipse(unit.x, unit.y, halfW + 3, UNIT_H / 2 + 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // label — soldiers always show name (that's the point); civilians show
  // their outfit marker so you can tell "bus rider" from "taxi" from "walk-in"
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  if (!unit.isCivilian) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillStyle = '#d8d8c8';
    ctx.fillText(unit.name.split(' ')[0], unit.x, top - 4);
    ctx.fillText(statusLabel(unit), unit.x, bottom + 12);
    ctx.restore();

    // tiny energy bar under the unit — low energy should be visible without
    // opening the profile panel, since that's what sends them to hospital.
    const barW = 20, barH = 3;
    const bx = unit.x - barW / 2, by = bottom + 15;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(bx, by, barW, barH);
    const pct = unit.energy / unit.maxEnergy;
    ctx.fillStyle = pct < 0.25 ? '#b4444a' : '#7fae4a';
    ctx.fillRect(bx, by, barW * pct, barH);
  } else {
    const marker = outfitMarker(unit.outfit);
    if (marker) ctx.fillText(marker, unit.x, top - 2);
  }
  ctx.textAlign = 'left';

  ctx.restore();
}

function statusLabel(unit) {
  switch (unit.status) {
    case UNIT_STATUS.TRAINING: return 'training';
    case UNIT_STATUS.EATING: return 'eating';
    case UNIT_STATUS.SLEEPING: return 'sleeping';
    case UNIT_STATUS.HOSPITAL: return 'hospital';
    default: return `Lv${unit.level}`;
  }
}

function renderFrame(ctx, gameState, selectedUnitId) {
  ctx.clearRect(0, 0, GRID_COLS * CELL_SIZE, GRID_ROWS * CELL_SIZE);
  drawGrid(ctx);
  drawBarracks(ctx, gameState.barracks);
  drawTrainingBuilding(ctx, gameState.shootingRange, gameState.occupancyOf(gameState.shootingRange), 'Shooting Range', '#6a5240', 'shooting_range');
  drawTrainingBuilding(ctx, gameState.weightRoom, gameState.occupancyOf(gameState.weightRoom), 'Weight Room', '#5a4a6a', 'weight_room');
  drawTrainingBuilding(ctx, gameState.obstacleCourse, gameState.occupancyOf(gameState.obstacleCourse), 'Obstacle Course', '#6a5a30', 'obstacle_course');
  drawTrainingBuilding(ctx, gameState.drillYard, gameState.occupancyOf(gameState.drillYard), 'Combat Drill Yard', '#4a5a6a', 'drill_yard');
  drawMessHall(ctx, gameState.messHall, gameState.food);
  drawClock(ctx, gameState.hourOfDay, gameState.isDaytime);

  for (const unit of gameState.units) {
    drawUnit(ctx, unit, unit.id === selectedUnitId);
  }
}
