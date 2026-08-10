// main.js — glues state, render, and DOM together. No game logic lives here
// beyond input dispatch; anything stateful belongs in state.js/unit.js.

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const cashValueEl = document.getElementById('cashValue');
const foodValueEl = document.getElementById('foodValue');
const rosterValueEl = document.getElementById('rosterValue');
const buyFoodBtn = document.getElementById('buyFoodBtn');
const lumberValueEl = document.getElementById('lumberValue');
const steelValueEl = document.getElementById('steelValue');
const gemsValueEl = document.getElementById('gemsValue');

// One entry per NeedsBuilding (building.js) — the "buy it once, no levels"
// trio. Drives the Build panel the same way trainingBuildingUi below does.
const needsBuildingUi = [
  { key: 'messHall', label: 'Mess Hall' },
  { key: 'showers', label: 'Showers' },
  { key: 'recRoom', label: 'Rec Room' },
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
const closeProfileBtn = document.getElementById('closeProfile');
const recallBtn = document.getElementById('recallBtn');
const profileStatPoints = document.getElementById('profileStatPoints');
const profileStatPointsLeft = document.getElementById('profileStatPointsLeft');
const profileEquippedListEl = document.getElementById('profileEquippedList');
const profileArmoryListEl = document.getElementById('profileArmoryList');

// One entry per TrainingBuilding (building.js) — drives both the assign
// buttons in the profile panel and the Build panel's upgrade rows.
const trainingBuildingUi = [
  { key: 'shootingRange', label: 'Shooting Range', assignBtn: document.getElementById('assignShootingRangeBtn') },
  { key: 'weightRoom', label: 'Weight Room', assignBtn: document.getElementById('assignWeightRoomBtn') },
  { key: 'obstacleCourse', label: 'Obstacle Course', assignBtn: document.getElementById('assignObstacleCourseBtn') },
  { key: 'drillYard', label: 'Combat Drill Yard', assignBtn: document.getElementById('assignDrillYardBtn') },
];

// One entry per allocatable stat (unit.js's ALLOCATABLE_STATS) — drives
// the profile panel's "Allocate stat points" buttons.
const statAllocationUi = [
  { stat: 'strength', btn: document.getElementById('allocateStrengthBtn') },
  { stat: 'accuracy', btn: document.getElementById('allocateAccuracyBtn') },
  { stat: 'endurance', btn: document.getElementById('allocateEnduranceBtn') },
];

const recruitPopup = document.getElementById('recruitPopup');
const recruitText = document.getElementById('recruitText');
const recruitConfirmBtn = document.getElementById('recruitConfirm');
const recruitCancelBtn = document.getElementById('recruitCancel');

const openBuildBtn = document.getElementById('openBuildBtn');
const buildPanel = document.getElementById('buildPanel');
const closeBuildBtn = document.getElementById('closeBuild');
const buildListEl = document.getElementById('buildList');

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
const missionLogListEl = document.getElementById('missionLogList');

let gameState = GameState.load();
let selectedUnitId = null;
let pendingRecruitId = null;
let selectedTierId = null;
let selectedSquadIds = new Set();
let lastFrameTime = performance.now();
let lastSaveTime = Date.now();

const RECRUIT_COST = 50;
const SAVE_INTERVAL_MS = 10000;

// ---------- Selection / profile panel ----------

function openProfile(unit) {
  selectedUnitId = unit.id;
  profileName.value = unit.name;
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
  profilePanel.classList.remove('hidden');

  profileStatPoints.classList.toggle('hidden', unit.unspentStatPoints <= 0);
  profileStatPointsLeft.textContent = unit.unspentStatPoints;
  for (const { btn } of statAllocationUi) {
    btn.disabled = unit.unspentStatPoints <= 0;
  }

  renderProfileEquipment(unit);

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

// Two lists: what this unit currently has equipped (with an Unequip
// button each) and what's sitting unassigned in the base's armory (with
// an Equip button each). Both read live off gameState.armory/unit.equipment
// rather than anything cached, so they always reflect the current state.
//
// openProfile() calls this every frame to keep the rest of the panel
// (HP/energy bars etc.) live, but re-building this innerHTML on every one
// of those calls detaches whatever Equip/Unequip button the player is
// mid-click on — same 60fps-innerHTML-replacement bug already fixed once
// for the Build panel (increment 9) and guarded against proactively for
// the mission log (increment 10). Skip the rebuild unless the equipped/
// available item lists actually changed since the last render.
let profileEquipmentRenderedSignature = null;

function renderProfileEquipment(unit) {
  const equipped = unit.equipment
    .map(id => gameState.armory.find(i => i.id === id))
    .filter(Boolean);
  const available = gameState.armory.filter(i => i.assignedToUnitId === null);

  const signature = unit.id + '|' + equipped.map(i => i.id).join(',') + '|' + available.map(i => i.id).join(',');
  if (signature === profileEquipmentRenderedSignature) return;
  profileEquipmentRenderedSignature = signature;

  profileEquippedListEl.innerHTML = equipped.length
    ? equipped.map(item => {
        const entry = equipmentCatalogEntry(item.type);
        const name = entry ? entry.name : item.type;
        return `<div class="profile-equipment-row"><span>${name}</span><button class="unequip-btn" data-item-id="${item.id}">Unequip</button></div>`;
      }).join('')
    : '<div class="profile-equipment-empty">Nothing equipped</div>';

  profileArmoryListEl.innerHTML = available.length
    ? available.map(item => {
        const entry = equipmentCatalogEntry(item.type);
        const name = entry ? entry.name : item.type;
        return `<div class="profile-equipment-row"><span>${name}</span><button class="equip-btn" data-item-id="${item.id}">Equip</button></div>`;
      }).join('')
    : '<div class="profile-equipment-empty">Armory is empty</div>';
}

closeProfileBtn.addEventListener('click', closeProfile);

profileEquippedListEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.unequip-btn');
  if (!btn || !selectedUnitId) return;
  gameState.unequipUnit(selectedUnitId, btn.dataset.itemId);
  const unit = gameState.units.find(u => u.id === selectedUnitId);
  if (unit) renderProfileEquipment(unit);
});

profileArmoryListEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.equip-btn');
  if (!btn || !selectedUnitId) return;
  gameState.equipUnit(selectedUnitId, btn.dataset.itemId);
  const unit = gameState.units.find(u => u.id === selectedUnitId);
  if (unit) renderProfileEquipment(unit);
});

for (const { key, assignBtn } of trainingBuildingUi) {
  assignBtn.addEventListener('click', () => {
    if (selectedUnitId) gameState.assignToBuilding(selectedUnitId, gameState[key].id);
  });
}

recallBtn.addEventListener('click', () => {
  if (selectedUnitId) gameState.unassignFromTraining(selectedUnitId);
});

for (const { stat, btn } of statAllocationUi) {
  btn.addEventListener('click', () => {
    if (!selectedUnitId) return;
    gameState.allocateStatPoint(selectedUnitId, stat);
    const unit = gameState.units.find(u => u.id === selectedUnitId);
    if (unit) openProfile(unit); // refresh the panel's numbers/remaining points immediately
  });
}

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
  const xp = `${tier.xpReward[0]}-${tier.xpReward[1]} XP`;
  const resource = tier.resourceReward
    ? ` + ${tier.resourceReward.amount[0]}-${tier.resourceReward.amount[1]} ${tier.resourceReward.type}`
    : '';
  const equipment = tier.equipmentReward
    ? ` + ${Math.round(tier.equipmentReward.chance * 100)}% chance of a ${equipmentCatalogEntry(tier.equipmentReward.type).name}`
    : '';
  return `${cash} + ${xp}${resource}${equipment}`;
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
  missionUnitListEl.innerHTML = eligible.length
    ? eligible.map(u => `
        <label class="mission-unit-row">
          <input type="checkbox" data-unit-id="${u.id}" ${selectedSquadIds.has(u.id) ? 'checked' : ''}>
          ${u.name} (Lv${u.level})
        </label>`).join('')
    : '<div class="mission-unit-empty">No eligible units — recruit or train more soldiers.</div>';

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
  // Equipment bonus averaged across the squad, same shape as
  // resolveMissionForUnit()'s per-unit roll — this is just the preview,
  // the actual resolution always rolls per-unit independently.
  const avgEquipmentBonus = squad.length
    ? squad.reduce((sum, u) => sum + gameState.equipmentBonusForUnit(u), 0) / squad.length
    : 0;
  missionChancePreviewEl.textContent = tier && squad.length
    ? `${Math.round(missionSuccessChance(tier, squad, avgEquipmentBonus) * 100)}%`
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
    return;
  }
  const now = Date.now();
  activeMissionsListEl.innerHTML = active.map(u => {
    const tier = missionTierById(u.missionTierId);
    return `<div class="mission-active-row">${u.name} — ${tier ? tier.name : 'Unknown'} — ${formatDuration(u.missionReturnAt - now)} left</div>`;
  }).join('');
}

// Missions used to resolve completely silently — you'd only notice a
// squad was back if you happened to check. This surfaces the outcome
// (with a bit of flavor text — see mission.js's pickMissionFlavor())
// so the system feels like it's actually happening, not a black box.
function missionLogRowHtml(entry) {
  const rewardBits = [];
  if (entry.succeeded) {
    rewardBits.push(`+$${entry.cashEarned}`);
    rewardBits.push(`+${entry.xpEarned} XP`);
    if (entry.resourceEarned) rewardBits.push(`+${entry.resourceEarned.amount} ${entry.resourceEarned.type}`);
    if (entry.equipmentEarned) rewardBits.push(`found a ${entry.equipmentEarned}`);
  }
  const rewardText = rewardBits.length ? ` (${rewardBits.join(', ')})` : '';
  const cls = entry.succeeded ? 'mission-log-success' : 'mission-log-failure';
  return `<div class="mission-log-row ${cls}">${entry.tierName} — ${entry.unitName} ${entry.flavor}${rewardText}</div>`;
}

// Newest entry's timestamp is enough to detect "did anything change" —
// the log only ever grows via unshift(), so a new mission resolving is
// the only thing that can change what entry 0 is. Same
// only-re-render-on-actual-change idea as the Build panel above.
let missionLogRenderedAt = null;

function renderMissionLog() {
  const latest = gameState.missionLog[0]?.timestamp ?? null;
  if (latest === missionLogRenderedAt) return;
  missionLogRenderedAt = latest;
  missionLogListEl.innerHTML = gameState.missionLog.length
    ? gameState.missionLog.map(missionLogRowHtml).join('')
    : '<div class="mission-unit-empty">No missions completed yet.</div>';
}

// ---------- Build panel ----------
// A single "Build" button opening a panel listing every building, instead
// of one HUD button per building — the HUD grew to 8 build buttons across
// the top bar as buildings were added, which doesn't scale and doesn't
// match how similar base-builder games present this (a menu/panel, not a
// row of top-bar tiles — user feedback). Reuses the same
// open/close/render-a-list-into-a-panel pattern already established by the
// Missions panel above, for consistency and less code.

function buildRowHtml({ key, kind, label, statusText, btnText, disabled }) {
  return `
    <div class="build-item">
      <div class="build-item-info">
        <div class="build-item-name">${label}</div>
        <div class="build-item-status">${statusText}</div>
      </div>
      <button class="build-item-btn" data-kind="${kind}" data-key="${key}" ${disabled ? 'disabled' : ''}>${btnText}</button>
    </div>`;
}

function upgradeRowHtml(key, kind, label, building) {
  if (building.isMaxLevel) {
    return buildRowHtml({
      key, kind, label, disabled: true, btnText: 'Maxed',
      statusText: `Lv.${building.level} (maxed)`,
    });
  }
  const cost = Math.round(building.nextUpgradeCost());
  return buildRowHtml({
    key, kind, label,
    statusText: `Lv.${building.level}`,
    btnText: `${building.level === 0 ? 'Build' : 'Upgrade'} ($${cost})`,
    disabled: gameState.cash < cost,
  });
}

function renderBuildList() {
  const rows = [
    upgradeRowHtml('barracks', 'barracks', 'Barracks', gameState.barracks),
    ...trainingBuildingUi.map(({ key, label }) => upgradeRowHtml(key, 'training', label, gameState[key])),
    ...needsBuildingUi.map(({ key, label }) => {
      const building = gameState[key];
      return buildRowHtml({
        key, kind: 'needs', label,
        statusText: building.isBuilt ? 'Built' : 'Not built',
        btnText: building.isBuilt ? 'Built' : `Build ($${building.buildCost()})`,
        disabled: building.isBuilt || gameState.cash < building.buildCost(),
      });
    }),
  ];
  buildListEl.innerHTML = rows.join('');
  buildListRenderedAtCash = Math.floor(gameState.cash);
}

function openBuildPanel() {
  buildPanel.classList.remove('hidden');
  renderBuildList();
}

function closeBuildPanel() {
  buildPanel.classList.add('hidden');
}

openBuildBtn.addEventListener('click', openBuildPanel);
closeBuildBtn.addEventListener('click', closeBuildPanel);

buildListEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.build-item-btn');
  if (!btn || btn.disabled) return;
  const { kind, key } = btn.dataset;
  if (kind === 'barracks') gameState.upgradeBarracks();
  else if (kind === 'training') gameState.upgradeBuilding(key);
  else if (kind === 'needs') gameState.buildNeedsBuilding(key);
  renderBuildList();
});

buyFoodBtn.addEventListener('click', () => {
  gameState.buyFood(20);
});

// Tracks the whole-dollar cash amount the Build panel was last rendered
// at. Affordability only ever changes at whole-dollar boundaries, so this
// avoids re-building the panel's innerHTML 60 times a second from the
// passive cash trickle alone — besides being wasteful, doing it every
// frame was detaching whatever button the player was mid-click on.
let buildListRenderedAtCash = null;

function refreshBuildButtons() {
  buyFoodBtn.disabled = gameState.cash < 30;
  foodValueEl.textContent = Math.floor(gameState.food);
  if (!buildPanel.classList.contains('hidden') && Math.floor(gameState.cash) !== buildListRenderedAtCash) {
    renderBuildList();
  }
}

// ---------- Canvas input ----------

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clickX = (e.clientX - rect.left) * scaleX;
  const clickY = (e.clientY - rect.top) * scaleY;

  // find the unit whose sprite box contains the click (nearest center wins
  // when sprites overlap). Box matches the 32x48 sprite drawn in render.js.
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
  refreshBuildButtons();
}

function frame(now) {
  const dt = clamp((now - lastFrameTime) / 1000, 0, 0.25);
  lastFrameTime = now;
  const nowMs = Date.now();

  // civilian spawn roll — probabilistic so spawns don't clump on a fixed timer
  if (nowMs - gameState.lastCivilianSpawn > CIVILIAN_SPAWN_INTERVAL_MS) {
    gameState.spawnCivilianIfRoom();
    gameState.lastCivilianSpawn = nowMs;
  }

  gameState.tick(dt, nowMs);

  // keep profile panel numbers live if the selected unit is still around
  if (selectedUnitId) {
    const unit = gameState.units.find(u => u.id === selectedUnitId);
    if (unit) openProfile(unit);
    else closeProfile();
  }

  updateHud();
  renderActiveMissions();
  renderMissionLog();
  renderFrame(ctx, gameState, selectedUnitId);

  if (Date.now() - lastSaveTime > SAVE_INTERVAL_MS) {
    gameState.save();
    lastSaveTime = Date.now();
  }

  requestAnimationFrame(frame);
}

window.addEventListener('beforeunload', () => gameState.save());

requestAnimationFrame(frame);
