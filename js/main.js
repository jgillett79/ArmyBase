// main.js — glues state, render, and DOM together. No game logic lives here
// beyond input dispatch; anything stateful belongs in state.js/unit.js.

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const cashValueEl = document.getElementById('cashValue');
const foodValueEl = document.getElementById('foodValue');
const rosterValueEl = document.getElementById('rosterValue');
const buildBarracksBtn = document.getElementById('buildBarracksBtn');
const barracksCostEl = document.getElementById('barracksCost');
const buildRangeBtn = document.getElementById('buildRangeBtn');
const rangeCostEl = document.getElementById('rangeCost');
const buildWeightRoomBtn = document.getElementById('buildWeightRoomBtn');
const weightRoomCostEl = document.getElementById('weightRoomCost');
const buildObstacleCourseBtn = document.getElementById('buildObstacleCourseBtn');
const obstacleCourseCostEl = document.getElementById('obstacleCourseCost');
const buildDrillYardBtn = document.getElementById('buildDrillYardBtn');
const drillYardCostEl = document.getElementById('drillYardCost');
const buildMessHallBtn = document.getElementById('buildMessHallBtn');
const buildShowersBtn = document.getElementById('buildShowersBtn');
const buildRecRoomBtn = document.getElementById('buildRecRoomBtn');
const buyFoodBtn = document.getElementById('buyFoodBtn');
const lumberValueEl = document.getElementById('lumberValue');
const steelValueEl = document.getElementById('steelValue');
const gemsValueEl = document.getElementById('gemsValue');

// One entry per NeedsBuilding (building.js) — the "buy it once, no levels"
// trio. Drives the HUD build buttons the same way trainingBuildingUi below
// drives the training buttons.
const needsBuildingUi = [
  { key: 'messHall', label: 'Mess Hall', buildBtn: buildMessHallBtn },
  { key: 'showers', label: 'Showers', buildBtn: buildShowersBtn },
  { key: 'recRoom', label: 'Rec Room', buildBtn: buildRecRoomBtn },
];

const profilePanel = document.getElementById('profilePanel');
const profileName = document.getElementById('profileName');
const profileLevel = document.getElementById('profileLevel');
const profileXpBar = document.getElementById('profileXpBar');
const profileStatus = document.getElementById('profileStatus');
const profileEnergyBar = document.getElementById('profileEnergyBar');
const profileEnergyText = document.getElementById('profileEnergyText');
const profileHpBar = document.getElementById('profileHpBar');
const profileHpText = document.getElementById('profileHpText');
const profileHygieneBar = document.getElementById('profileHygieneBar');
const profileHygieneText = document.getElementById('profileHygieneText');
const profileMoraleBar = document.getElementById('profileMoraleBar');
const profileMoraleText = document.getElementById('profileMoraleText');
const profileStrength = document.getElementById('profileStrength');
const profileAccuracy = document.getElementById('profileAccuracy');
const profileEndurance = document.getElementById('profileEndurance');
const profileEquipment = document.getElementById('profileEquipment');
const closeProfileBtn = document.getElementById('closeProfile');
const recallBtn = document.getElementById('recallBtn');

// One entry per TrainingBuilding (building.js) — drives both the assign
// buttons in the profile panel and the build/upgrade buttons in the HUD.
const trainingBuildingUi = [
  { key: 'shootingRange', label: 'Shooting Range', assignBtn: document.getElementById('assignShootingRangeBtn'), buildBtn: buildRangeBtn, costEl: rangeCostEl },
  { key: 'weightRoom', label: 'Weight Room', assignBtn: document.getElementById('assignWeightRoomBtn'), buildBtn: buildWeightRoomBtn, costEl: weightRoomCostEl },
  { key: 'obstacleCourse', label: 'Obstacle Course', assignBtn: document.getElementById('assignObstacleCourseBtn'), buildBtn: buildObstacleCourseBtn, costEl: obstacleCourseCostEl },
  { key: 'drillYard', label: 'Combat Drill Yard', assignBtn: document.getElementById('assignDrillYardBtn'), buildBtn: buildDrillYardBtn, costEl: drillYardCostEl },
];

const recruitPopup = document.getElementById('recruitPopup');
const recruitText = document.getElementById('recruitText');
const recruitConfirmBtn = document.getElementById('recruitConfirm');
const recruitCancelBtn = document.getElementById('recruitCancel');

const openMissionsBtn = document.getElementById('openMissionsBtn');
const missionsPanel = document.getElementById('missionsPanel');
const closeMissionsBtn = document.getElementById('closeMissions');
const missionTierListEl = document.getElementById('missionTierList');
const missionSquadSelectEl = document.getElementById('missionSquadSelect');
const missionSquadCountEl = document.getElementById('missionSquadCount');
const missionSquadMaxEl = document.getElementById('missionSquadMax');
const missionUnitListEl = document.getElementById('missionUnitList');
const missionChancePreviewEl = document.getElementById('missionChancePreview');
const dispatchMissionBtn = document.getElementById('dispatchMissionBtn');
const activeMissionsListEl = document.getElementById('activeMissionsList');

let gameState = GameState.load();
let selectedUnitId = null;
let pendingRecruitId = null;
let selectedTierId = null;
let selectedSquadIds = new Set();
let lastFrameTime = performance.now();
let lastSaveTime = Date.now();
let lastRosterTime = 0;

const RECRUIT_COST = 50;
const SAVE_INTERVAL_MS = 10000;
const rosterListEl = document.getElementById('rosterList');

document.getElementById('exportSaveBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(gameState.serialize(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `command-base-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

document.getElementById('importSaveInput').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup is too large.');
    // Accepts current and v1 backups; v1 is migrated to the world map first.
    const { data } = parseSaveText(await file.text());
    if (!window.confirm('Restore this backup? Your current progress on this device will be replaced.')) return;
    if (!writeRestoredSave(data)) throw new Error('This browser could not store the backup.');
    location.reload();
  } catch (error) {
    window.alert(error.message || 'The backup could not be restored.');
  } finally {
    event.target.value = '';
  }
});

function renderRoster() {
  rosterListEl.replaceChildren();
  const people = gameState.units.filter(u => u.status !== UNIT_STATUS.ON_MISSION || !u.isCivilian);
  for (const unit of people) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `roster-card${unit.isCivilian ? ' visitor' : ''}`;
    const name = document.createElement('strong');
    name.textContent = unit.name;
    const detail = document.createElement('small');
    detail.textContent = unit.isCivilian ? 'Visitor · Tap to recruit' : `Level ${unit.level} · ${unit.status.replaceAll('_', ' ')}`;
    card.append(name, detail);
    card.addEventListener('click', () => {
      // The roster is the reliable touch fallback; it also brings the person into view.
      camera.centreOn(unit.x, unit.y - UNIT_H / 2);
      if (unit.isCivilian) openRecruitPopup(unit);
      else openProfile(unit);
    });
    rosterListEl.append(card);
  }
  if (!people.length) rosterListEl.textContent = 'Visitors will arrive at the gate. Tap one to recruit your first soldier.';
}

// ---------- Selection / profile panel ----------

function openProfile(unit) {
  const opening = selectedUnitId !== unit.id || profilePanel.classList.contains('hidden');
  selectedUnitId = unit.id;
  if (opening || document.activeElement !== profileName) profileName.value = unit.name;
  profileLevel.textContent = unit.level;
  profileXpBar.style.width = `${Math.round((unit.xp / unit.xpToNext) * 100)}%`;
  profileStatus.textContent = unit.status;
  profileEnergyBar.style.width = `${Math.round((unit.energy / unit.maxEnergy) * 100)}%`;
  profileEnergyText.textContent = `${Math.round(unit.energy)}/${unit.maxEnergy}`;
  profileHpBar.style.width = `${Math.round((unit.hp / unit.maxHp) * 100)}%`;
  profileHpText.textContent = `${unit.hp}/${unit.maxHp}`;
  profileHygieneBar.style.width = `${Math.round(unit.hygiene)}%`;
  profileHygieneText.textContent = `${Math.round(unit.hygiene)}%`;
  profileMoraleBar.style.width = `${Math.round(unit.morale)}%`;
  profileMoraleText.textContent = `${Math.round(unit.morale)}%`;
  profileStrength.textContent = unit.strength;
  profileAccuracy.textContent = `${Math.round(unit.accuracy)}%`;
  profileEndurance.textContent = `${Math.round(unit.endurance)}%`;
  profileEquipment.textContent = unit.equipment.length ? unit.equipment.join(', ') : 'None';
  profilePanel.classList.remove('hidden');

  // Neither a hospitalized unit nor one still walking in to enlist
  // (RECRUITING — see state.js) can be assigned to training.
  const locked = unit.status === UNIT_STATUS.HOSPITAL || unit.status === UNIT_STATUS.RECRUITING;
  for (const { key, label, assignBtn } of trainingBuildingUi) {
    const building = gameState[key];
    const alreadyAssigned = unit.assignedBuildingId === building.id;
    assignBtn.disabled = locked || alreadyAssigned || !building.isBuilt
      || gameState.occupancyOf(building) >= building.capacity;
    assignBtn.textContent = alreadyAssigned ? `Assigned: ${label}` : label;
  }
  recallBtn.disabled = locked || !unit.assignedBuildingId;
}

function closeProfile() {
  selectedUnitId = null;
  profilePanel.classList.add('hidden');
}

closeProfileBtn.addEventListener('click', closeProfile);

for (const { key, assignBtn } of trainingBuildingUi) {
  assignBtn.addEventListener('click', () => {
    if (selectedUnitId) gameState.assignToBuilding(selectedUnitId, gameState[key].id);
  });
}

recallBtn.addEventListener('click', () => {
  if (selectedUnitId) gameState.unassignFromTraining(selectedUnitId);
});

profileName.addEventListener('change', () => {
  const unit = gameState.units.find(u => u.id === selectedUnitId);
  if (unit && profileName.value.trim()) {
    unit.name = profileName.value.trim().slice(0, 18);
  }
});

// ---------- Recruit popup ----------

function openRecruitPopup(unit) {
  pendingRecruitId = unit.id;
  recruitText.textContent = `Recruit ${unit.name}? (-$${RECRUIT_COST})`;
  recruitPopup.classList.remove('hidden');
}

recruitConfirmBtn.addEventListener('click', () => {
  if (pendingRecruitId) gameState.recruit(pendingRecruitId);
  pendingRecruitId = null;
  recruitPopup.classList.add('hidden');
});

recruitCancelBtn.addEventListener('click', () => {
  pendingRecruitId = null;
  recruitPopup.classList.add('hidden');
});

// ---------- Missions ----------

function formatDuration(ms) {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function rewardText(tier) {
  const cash = `$${tier.cashReward[0]}-${tier.cashReward[1]}`;
  if (!tier.resourceReward) return cash;
  const { type, amount } = tier.resourceReward;
  return `${cash} + ${amount[0]}-${amount[1]} ${type}`;
}

function openMissionsPanel() {
  missionsPanel.classList.remove('hidden');
  renderMissionTierList();
}

function closeMissionsPanel() {
  missionsPanel.classList.add('hidden');
  selectedTierId = null;
  selectedSquadIds = new Set();
}

openMissionsBtn.addEventListener('click', openMissionsPanel);
closeMissionsBtn.addEventListener('click', closeMissionsPanel);

function renderMissionTierList() {
  missionTierListEl.innerHTML = MISSION_TIERS.map(tier => {
    const eligibleCount = gameState.eligibleUnitsForTier(tier).length;
    const selected = tier.id === selectedTierId ? ' selected' : '';
    return `
      <div class="mission-tier${selected}" data-tier-id="${tier.id}">
        <div class="mission-tier-name">${tier.name} <span class="mission-tier-req">Lv.${tier.minLevel}+, stat ${tier.minStatAvg}+</span></div>
        <div class="mission-tier-meta">${Math.round(tier.baseSuccessChance * 100)}% base &middot; ${formatDuration(tier.durationMs)} &middot; ${rewardText(tier)}</div>
        <div class="mission-tier-eligible">${eligibleCount} eligible unit${eligibleCount === 1 ? '' : 's'}</div>
      </div>`;
  }).join('');

  missionTierListEl.querySelectorAll('.mission-tier').forEach(el => {
    el.addEventListener('click', () => selectMissionTier(el.dataset.tierId));
  });
}

function selectMissionTier(tierId) {
  selectedTierId = tierId;
  selectedSquadIds = new Set();
  renderMissionTierList();
  renderSquadSelect();
}

function renderSquadSelect() {
  const tier = missionTierById(selectedTierId);
  if (!tier) {
    missionSquadSelectEl.classList.add('hidden');
    return;
  }
  missionSquadSelectEl.classList.remove('hidden');
  missionSquadMaxEl.textContent = tier.maxSquadSize;

  const eligible = gameState.eligibleUnitsForTier(tier);
  missionUnitListEl.replaceChildren();
  if (!eligible.length) {
    const empty = document.createElement('div');
    empty.className = 'mission-unit-empty';
    empty.textContent = 'No eligible units — recruit or train more soldiers.';
    missionUnitListEl.append(empty);
  }
  for (const unit of eligible) {
    const row = document.createElement('label');
    row.className = 'mission-unit-row';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.unitId = unit.id;
    checkbox.checked = selectedSquadIds.has(unit.id);
    const label = document.createElement('span');
    label.textContent = `${unit.name} (Lv${unit.level}, ${Math.round(missionSuccessChance(tier, [unit]) * 100)}% success)`;
    row.append(checkbox, label);
    missionUnitListEl.append(row);
  }

  missionUnitListEl.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (selectedSquadIds.size >= tier.maxSquadSize) {
          cb.checked = false;
          return;
        }
        selectedSquadIds.add(cb.dataset.unitId);
      } else {
        selectedSquadIds.delete(cb.dataset.unitId);
      }
      updateMissionPreview();
    });
  });

  updateMissionPreview();
}

function updateMissionPreview() {
  const tier = missionTierById(selectedTierId);
  missionSquadCountEl.textContent = selectedSquadIds.size;
  const squad = [...selectedSquadIds].map(id => gameState.units.find(u => u.id === id)).filter(Boolean);
  missionChancePreviewEl.textContent = tier && squad.length
    ? `${Math.round(squad.reduce((total, unit) => total + missionSuccessChance(tier, [unit]), 0) / squad.length * 100)}% average per soldier`
    : '--';
  dispatchMissionBtn.disabled = !(tier && squad.length > 0 && squad.length <= tier.maxSquadSize);
}

dispatchMissionBtn.addEventListener('click', () => {
  if (!selectedTierId || selectedSquadIds.size === 0) return;
  gameState.dispatchMission(selectedTierId, [...selectedSquadIds]);
  selectedTierId = null;
  selectedSquadIds = new Set();
  renderMissionTierList();
  missionSquadSelectEl.classList.add('hidden');
});

function renderActiveMissions() {
  const active = gameState.units.filter(u => u.status === UNIT_STATUS.ON_MISSION);
  if (active.length === 0) {
    activeMissionsListEl.innerHTML = '<div class="mission-unit-empty">No squads out right now.</div>';
    renderMissionResults();
    return;
  }
  const now = Date.now();
  activeMissionsListEl.replaceChildren();
  for (const u of active) {
    const row = document.createElement('div');
    row.className = 'mission-active-row';
    const tier = missionTierById(u.missionTierId);
    row.textContent = `${u.name} — ${tier ? tier.name : 'Unknown'} — ${formatDuration(u.missionReturnAt - now)} left`;
    activeMissionsListEl.append(row);
  }
  renderMissionResults();
}

function renderMissionResults() {
  const list = document.getElementById('missionResultsList');
  list.replaceChildren();
  for (const entry of gameState.missionLog.slice(0, 5)) {
    const row = document.createElement('div');
    row.className = 'mission-active-row';
    row.textContent = `${entry.name} · ${entry.tier} · ${entry.succeeded ? 'Succeeded' : 'Recovering'} · +${entry.xp} XP`;
    list.append(row);
  }
  if (!gameState.missionLog.length) list.textContent = 'Your squad’s stories will appear here.';
}

// ---------- Build & upgrade ----------
//
// A facility's first level opens build mode: legal sites light up on the
// map, the chosen site shows a ghost of the building, and the bar under the
// map says what it costs or what is still missing. Later levels upgrade in
// place. Prices and resources are the unchanged economy in state.js.

const buildBarEl = document.getElementById('buildBar');
const buildBarTextEl = document.getElementById('buildBarText');
const buildConfirmBtn = document.getElementById('buildConfirmBtn');
const buildCancelBtn = document.getElementById('buildCancelBtn');
let buildMode = null; // { key, buildingId, hoverZoneId, selectedZoneId, affordable, returnView }

function startBuildMode(key) {
  const building = gameState[key];
  if (!building || building.isBuilt) return;
  buildMode = { key, buildingId: building.id, hoverZoneId: null, selectedZoneId: building.zoneId,
    affordable: true, returnView: { x: camera.x, y: camera.y, zoom: camera.zoom } };
  camera.fitWorld(); // every legal site in view
  if (gameAreaEl.scrollIntoView) gameAreaEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  refreshBuildBar();
}

function endBuildMode(focusZoneId) {
  if (!buildMode) return;
  const { returnView } = buildMode;
  buildMode = null;
  camera.zoom = returnView.zoom;
  if (focusZoneId) {
    const centre = polygonCentroid(zoneById(focusZoneId).footprint);
    camera.centreOn(centre.x, centre.y);
  } else {
    camera.x = returnView.x;
    camera.y = returnView.y;
    camera.clampToWorld();
  }
  refreshBuildBar();
}

function priceText(price) {
  return `$${price.cash}${price.lumber ? ` + ${price.lumber} lumber` : ''}${price.steel ? ` + ${price.steel} steel` : ''}`;
}

function refreshBuildBar() {
  buildBarEl.classList.toggle('hidden', !buildMode);
  if (!buildMode) return;
  const building = gameState[buildMode.key];
  const shortfall = gameState.constructionShortfall(building);
  buildMode.affordable = !shortfall;
  const zone = buildMode.selectedZoneId && zoneById(buildMode.selectedZoneId);
  const where = zone ? zone.label : 'choose a highlighted site';
  buildBarTextEl.textContent = `${BUILDING_LABELS[building.type]} · ${priceText(gameState.constructionPrice(building))} · ${where}`
    + (shortfall ? ` · Need ${shortfall}` : '');
  buildConfirmBtn.disabled = !zone || !!shortfall;
}

buildConfirmBtn.addEventListener('click', () => {
  if (!buildMode || !buildMode.selectedZoneId) return;
  const zoneId = buildMode.selectedZoneId;
  if (gameState.constructAt(buildMode.key, zoneId)) endBuildMode(zoneId);
  else refreshBuildBar();
});
buildCancelBtn.addEventListener('click', () => endBuildMode());

function onBuildButton(key) {
  const building = gameState[key];
  if (!building.isBuilt) startBuildMode(key);
  else if (key === 'barracks') gameState.upgradeBarracks();
  else gameState.upgradeBuilding(key);
}

buildBarracksBtn.addEventListener('click', () => onBuildButton('barracks'));
for (const { key, buildBtn } of trainingBuildingUi) buildBtn.addEventListener('click', () => onBuildButton(key));
for (const { key, buildBtn } of needsBuildingUi) buildBtn.addEventListener('click', () => onBuildButton(key));

buyFoodBtn.addEventListener('click', () => {
  gameState.buyFood(20);
});

// Unbuilt facilities always open build mode (it explains what's missing);
// upgrades stay disabled until affordable.
function refreshBuildButtons() {
  if (gameState.barracks.isMaxLevel) {
    buildBarracksBtn.disabled = true;
    buildBarracksBtn.textContent = 'Barracks Maxed';
  } else {
    barracksCostEl.textContent = upgradePriceText(gameState.barracks);
    buildBarracksBtn.disabled = gameState.barracks.isBuilt && !gameState.canBuildOrUpgradeBarracks();
  }

  for (const { key, label, buildBtn, costEl } of trainingBuildingUi) {
    const building = gameState[key];
    if (building.isMaxLevel) {
      buildBtn.disabled = true;
      buildBtn.textContent = `${label} Maxed`;
    } else {
      costEl.textContent = upgradePriceText(building);
      buildBtn.disabled = building.isBuilt && !gameState.canUpgradeBuilding(building);
    }
  }

  for (const { key, label, buildBtn } of needsBuildingUi) {
    const building = gameState[key];
    if (building.isBuilt) {
      buildBtn.disabled = true;
      buildBtn.textContent = `${label} Built`;
    } else {
      buildBtn.disabled = false;
    }
  }

  buyFoodBtn.disabled = gameState.cash < 30;
  foodValueEl.textContent = Math.floor(gameState.food);
  refreshBuildBar();
}

function upgradePriceText(building) {
  const price = gameState.upgradePrice(building);
  return `${price.cash}${price.lumber ? ` + ${price.lumber} lumber` : ''}${price.steel ? ` + ${price.steel} steel` : ''}`;
}

// ---------- Map view: camera, pointer, touch ----------

const gameAreaEl = document.getElementById('gameArea');
const camera = new Camera(960, 576);
let devicePixelScale = 1;
let revealedBuildingId = null; // indoor facility opened up by a tap
let debugScene = typeof location !== 'undefined' && /[?&]debug=scene\b/.test(location.search || '');

// Canvas fills the map column: landscape 5:3 (960 x 576 on desktop); on a
// portrait phone it gets taller so the base isn't a thin strip. Backing
// store follows devicePixelRatio for crisp art.
function resizeCanvas() {
  const width = Math.round(gameAreaEl.clientWidth || 960);
  const innerW = window.innerWidth || width, innerH = window.innerHeight || 0;
  const portrait = innerH > innerW && width < 700;
  const height = portrait ? Math.round(Math.min(innerH * 0.62, width * 1.35)) : Math.round(width * 0.6);
  devicePixelScale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * devicePixelScale);
  canvas.height = Math.round(height * devicePixelScale);
  camera.setViewport(width, height);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
camera.home();

document.getElementById('zoomInBtn').addEventListener('click', () => camera.zoomAt(camera.viewW / 2, camera.viewH / 2, 1.25));
document.getElementById('zoomOutBtn').addEventListener('click', () => camera.zoomAt(camera.viewW / 2, camera.viewH / 2, 0.8));
document.getElementById('homeViewBtn').addEventListener('click', () => camera.home());

window.addEventListener('keydown', event => {
  const typing = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName || '');
  if (event.key === 'Escape' && buildMode) endBuildMode();
  else if (!typing && (event.key === 'g' || event.key === 'G')) debugScene = !debugScene;
});

function localPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

// Indoor facilities currently shown opened up (matches renderFrame()).
function revealedFacilities() {
  const revealed = new Set();
  if (revealedBuildingId) revealed.add(revealedBuildingId);
  const selected = gameState.units.find(u => u.id === selectedUnitId);
  const inside = selected && indoorFacilityAt(selected, gameState);
  if (inside) revealed.add(inside.id);
  return revealed;
}

// The drawn person under a world point (feet at unit.y, sprite above it);
// the nearest body centre wins when sprites overlap.
function unitAtWorld(point) {
  const revealed = revealedFacilities();
  let closest = null, closestDist = Infinity;
  for (const unit of gameState.units) {
    if (!isUnitVisible(unit, gameState, revealed) || unit.status === UNIT_STATUS.ON_MISSION) continue;
    const within = Math.abs(unit.x - point.x) <= UNIT_W / 2 + 4
      && point.y >= unit.y - UNIT_H - 4 && point.y <= unit.y + 8;
    if (!within) continue;
    const d = Math.hypot(unit.x - point.x, unit.y - UNIT_H / 2 - point.y);
    if (d < closestDist) { closest = unit; closestDist = d; }
  }
  return closest;
}

function zoneAtWorld(point) {
  const zone = WORLD.zones.find(z => pointInPolygon(point.x, point.y, z.footprint));
  return zone ? zone.id : null;
}

function handleTap(screenX, screenY) {
  const point = camera.screenToWorld(screenX, screenY);
  if (buildMode) {
    const zoneId = zoneAtWorld(point);
    const building = gameState[buildMode.key];
    if (zoneId && gameState.zonePlacementState(building, zoneId) !== 'blocked') buildMode.selectedZoneId = zoneId;
    refreshBuildBar();
    return;
  }
  const unit = unitAtWorld(point);
  if (unit) {
    if (unit.isCivilian) openRecruitPopup(unit);
    else openProfile(unit);
    return;
  }
  // Tapping an indoor facility lifts its roof to show who's inside.
  const zoneId = zoneAtWorld(point);
  const building = zoneId && gameState.allBuildings.find(b => b.zoneId === zoneId && b.isBuilt);
  const indoor = building && facilityKind(building.type) === 'indoor';
  revealedBuildingId = indoor && revealedBuildingId !== building.id ? building.id : null;
}

// One pointer drags the map, two pinch-zoom; a press that barely moves is a
// tap. Works the same for mouse, pen and touch.
const activePointers = new Map();
let dragDistance = 0;
let pinch = null;
const TAP_SLOP = 6;

function pinchState() {
  const [a, b] = [...activePointers.values()];
  return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
}

canvas.addEventListener('pointerdown', event => {
  if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
  activePointers.set(event.pointerId, localPoint(event));
  if (activePointers.size === 1) dragDistance = 0;
  if (activePointers.size === 2) pinch = pinchState();
});

canvas.addEventListener('pointermove', event => {
  const point = localPoint(event);
  if (!activePointers.has(event.pointerId)) {
    if (buildMode) buildMode.hoverZoneId = zoneAtWorld(camera.screenToWorld(point.x, point.y));
    return;
  }
  const previous = activePointers.get(event.pointerId);
  activePointers.set(event.pointerId, point);
  if (activePointers.size === 1) {
    dragDistance += Math.hypot(point.x - previous.x, point.y - previous.y);
    if (dragDistance > TAP_SLOP) camera.panBy(point.x - previous.x, point.y - previous.y);
  } else if (activePointers.size === 2 && pinch) {
    const next = pinchState();
    camera.zoomAt(next.mid.x, next.mid.y, next.dist / pinch.dist);
    camera.panBy(next.mid.x - pinch.mid.x, next.mid.y - pinch.mid.y);
    pinch = next;
    dragDistance = Infinity; // a pinch never ends in a tap
  }
});

function endPointer(event) {
  const point = activePointers.get(event.pointerId);
  activePointers.delete(event.pointerId);
  if (activePointers.size < 2) pinch = null;
  if (point && activePointers.size === 0 && event.type === 'pointerup' && dragDistance <= TAP_SLOP) handleTap(point.x, point.y);
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

canvas.addEventListener('wheel', event => {
  event.preventDefault();
  const point = localPoint(event);
  camera.zoomAt(point.x, point.y, Math.exp(-event.deltaY * 0.0015));
}, { passive: false });

// ---------- Game loop ----------

function updateHud() {
  cashValueEl.textContent = Math.floor(gameState.cash);
  rosterValueEl.textContent = `${gameState.soldierCount} / ${gameState.unitCap}`;
  lumberValueEl.textContent = Math.floor(gameState.lumber);
  steelValueEl.textContent = Math.floor(gameState.steel);
  gemsValueEl.textContent = Math.floor(gameState.gems);
  document.getElementById('baseProgress').textContent = `Facilities ${gameState.completedFacilities}/8 · Soldiers ${gameState.soldierCount}/20`;
  document.getElementById('baseMilestone').classList.toggle('hidden', !gameState.baseComplete);
  refreshBuildButtons();
}

function frame(now) {
  const dt = clamp((now - lastFrameTime) / 1000, 0, OFFLINE_CATCHUP_CAP_MS / 1000);
  lastFrameTime = now;
  const nowMs = Date.now();

  // civilian spawn roll — probabilistic so spawns don't clump on a fixed timer
  if (nowMs - gameState.lastCivilianSpawn > CIVILIAN_SPAWN_INTERVAL_MS) {
    gameState.spawnCivilianIfRoom();
    gameState.lastCivilianSpawn = nowMs;
  }

  if (dt > 1) gameState.catchUp(dt, nowMs);
  else gameState.tick(dt, nowMs);

  // keep profile panel numbers live if the selected unit is still around
  if (selectedUnitId) {
    const unit = gameState.units.find(u => u.id === selectedUnitId);
    if (unit) openProfile(unit);
    else closeProfile();
  }

  updateHud();
  if (nowMs - lastRosterTime > 1000) {
    renderRoster();
    lastRosterTime = nowMs;
  }
  renderActiveMissions();
  renderFrame(ctx, gameState, selectedUnitId, { camera, dpr: devicePixelScale, now: performance.now(),
    buildMode, debug: debugScene, revealedBuildingId });

  if (Date.now() - lastSaveTime > SAVE_INTERVAL_MS) {
    document.getElementById('saveNotice').classList.toggle('hidden', gameState.save());
    lastSaveTime = Date.now();
  }

  requestAnimationFrame(frame);
}

window.addEventListener('beforeunload', () => gameState.save());

requestAnimationFrame(frame);
