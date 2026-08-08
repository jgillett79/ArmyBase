// render.js — placeholder art on purpose (see README). Everything here
// gets swapped for sprites once the art pipeline produces them; the
// important thing Phase 0 proves is that units are visually distinguishable
// and clickable, not that they look good yet.

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

function drawBuildingBox(ctx, gridX, gridY, isBuilt, label, subLabel, color) {
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

  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#8a9478';
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#d8d8c8';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(label, x + 8, y + 20);
  ctx.font = '11px monospace';
  ctx.fillText(subLabel, x + 8, y + 38);
}

function drawBarracks(ctx, barracks) {
  drawBuildingBox(ctx, barracks.gridX, barracks.gridY, barracks.isBuilt,
    `Barracks Lv.${barracks.level}`, `+${barracks.capContribution()} cap`, '#5a6450');
}

function drawShootingRange(ctx, range, occupancy) {
  drawBuildingBox(ctx, range.gridX, range.gridY, range.isBuilt,
    `Shooting Range Lv.${range.level}`, `${occupancy}/${range.capacity} slots`, '#6a5240');
}

function drawMessHall(ctx, hall, food) {
  drawBuildingBox(ctx, hall.gridX, hall.gridY, hall.isBuilt,
    'Mess Hall', `Food: ${Math.floor(food)}`, '#40605a');
}

function drawClock(ctx, hourOfDay, isDaytime) {
  const h = Math.floor(hourOfDay);
  const m = Math.floor((hourOfDay - h) * 60);
  const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${isDaytime ? '\u2600' : '\u263D'}`;
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
  const radius = unit.isCivilian ? 6 : 8;
  const hue = unit.colorSeed;
  const inHospital = unit.status === UNIT_STATUS.HOSPITAL;

  ctx.save();
  ctx.globalAlpha = unit.status === UNIT_STATUS.CIVILIAN_LEAVING ? 0.5 : 1;

  // body
  ctx.beginPath();
  ctx.arc(unit.x, unit.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = unit.isCivilian
    ? `hsl(${hue}, 25%, 55%)`   // muted — not "yours" yet
    : `hsl(${hue}, 55%, 50%)`;  // saturated — recruited soldiers pop visually
  ctx.fill();

  if (isSelected) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#f2e9a8';
    ctx.stroke();
  }

  // status ring — hospital is the only one that matters as a "problem" signal,
  // other statuses (training/eating/sleeping) are shown via the label instead
  // so the canvas doesn't turn into a mess of colored rings.
  if (inHospital) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#b4444a';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, radius + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // label — soldiers always show name (that's the point); civilians show
  // their outfit marker so you can tell "bus rider" from "taxi" from "walk-in"
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  if (!unit.isCivilian) {
    ctx.fillStyle = '#d8d8c8';
    ctx.fillText(unit.name.split(' ')[0], unit.x, unit.y - radius - 6);
    ctx.fillText(statusLabel(unit), unit.x, unit.y + radius + 12);

    // tiny energy bar under the unit — low energy should be visible without
    // opening the profile panel, since that's the thing that sends them to hospital
    const barW = 20, barH = 3;
    const bx = unit.x - barW / 2, by = unit.y + radius + 16;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(bx, by, barW, barH);
    const pct = unit.energy / unit.maxEnergy;
    ctx.fillStyle = pct < 0.25 ? '#b4444a' : '#7fae4a';
    ctx.fillRect(bx, by, barW * pct, barH);
  } else {
    const marker = outfitMarker(unit.outfit);
    if (marker) ctx.fillText(marker, unit.x, unit.y - radius - 4);
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
  drawShootingRange(ctx, gameState.shootingRange, gameState.shootingRangeOccupancy());
  drawMessHall(ctx, gameState.messHall, gameState.food);
  drawClock(ctx, gameState.hourOfDay, gameState.isDaytime);

  for (const unit of gameState.units) {
    drawUnit(ctx, unit, unit.id === selectedUnitId);
  }
}
