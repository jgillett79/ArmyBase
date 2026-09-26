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
    card.addEventListener('click', () => unit.isCivilian ? openRecruitPopup(unit) : openProfile(unit));
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

// ---------- Barracks build/upgrade ----------

buildBarracksBtn.addEventListener('click', () => {
  gameState.upgradeBarracks();
});

for (const { key, buildBtn } of trainingBuildingUi) {
  buildBtn.addEventListener('click', () => {
    gameState.upgradeBuilding(key);
  });
}

for (const { key, buildBtn } of needsBuildingUi) {
  buildBtn.addEventListener('click', () => {
    gameState.buildNeedsBuilding(key);
  });
}

buyFoodBtn.addEventListener('click', () => {
  gameState.buyFood(20);
});

function refreshBuildButtons() {
  if (gameState.barracks.isMaxLevel) {
    buildBarracksBtn.disabled = true;
    buildBarracksBtn.textContent = 'Barracks Maxed';
  } else {
    barracksCostEl.textContent = upgradePriceText(gameState.barracks);
    buildBarracksBtn.disabled = !gameState.canBuildOrUpgradeBarracks();
  }

  for (const { key, label, buildBtn, costEl } of trainingBuildingUi) {
    const building = gameState[key];
    if (building.isMaxLevel) {
      buildBtn.disabled = true;
      buildBtn.textContent = `${label} Maxed`;
    } else {
      costEl.textContent = upgradePriceText(building);
      buildBtn.disabled = !gameState.canUpgradeBuilding(building);
    }
  }

  for (const { key, label, buildBtn } of needsBuildingUi) {
    const building = gameState[key];
    if (building.isBuilt) {
      buildBtn.disabled = true;
      buildBtn.textContent = `${label} Built`;
    } else {
      buildBtn.disabled = gameState.cash < building.buildCost();
    }
  }

  buyFoodBtn.disabled = gameState.cash < 30;
  foodValueEl.textContent = Math.floor(gameState.food);
}

function upgradePriceText(building) {
  const price = gameState.upgradePrice(building);
  return `${price.cash}${price.lumber ? ` + ${price.lumber} lumber` : ''}${price.steel ? ` + ${price.steel} steel` : ''}`;
}

// ---------- Canvas input ----------

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const { x: clickX, y: clickY } = screenToWorld((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);

  // find the unit whose sprite box contains the click (nearest center wins
  // when sprites overlap). Box matches the UNIT_W x UNIT_H world-px sprite drawn in render.js.
  let closest = null;
  let closestDist = Infinity;
  for (const unit of gameState.units) {
    if (unit.status === UNIT_STATUS.ON_MISSION) continue; // not rendered, not clickable
    const withinBox = Math.abs(unit.x - clickX) <= UNIT_W / 2 + 2 &&
      clickY >= unit.y - UNIT_H / 2 - 2 && clickY <= unit.y + UNIT_H / 2 + 2;
    if (!withinBox) continue;
    const d = Math.hypot(unit.x - clickX, unit.y - clickY);
    if (d < closestDist) {
      closest = unit;
      closestDist = d;
    }
  }

  if (!closest) return;

  if (closest.isCivilian) {
    openRecruitPopup(closest);
  } else {
    openProfile(closest);
  }
});

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
  renderFrame(ctx, gameState, selectedUnitId);

  if (Date.now() - lastSaveTime > SAVE_INTERVAL_MS) {
    document.getElementById('saveNotice').classList.toggle('hidden', gameState.save());
    lastSaveTime = Date.now();
  }

  requestAnimationFrame(frame);
}

window.addEventListener('beforeunload', () => gameState.save());

requestAnimationFrame(frame);
