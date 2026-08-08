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
const buildMessHallBtn = document.getElementById('buildMessHallBtn');
const buyFoodBtn = document.getElementById('buyFoodBtn');

const profilePanel = document.getElementById('profilePanel');
const profileName = document.getElementById('profileName');
const profileLevel = document.getElementById('profileLevel');
const profileXpBar = document.getElementById('profileXpBar');
const profileStatus = document.getElementById('profileStatus');
const profileEnergyBar = document.getElementById('profileEnergyBar');
const profileEnergyText = document.getElementById('profileEnergyText');
const profileHpBar = document.getElementById('profileHpBar');
const profileHpText = document.getElementById('profileHpText');
const profileStrength = document.getElementById('profileStrength');
const profileAccuracy = document.getElementById('profileAccuracy');
const profileEquipment = document.getElementById('profileEquipment');
const closeProfileBtn = document.getElementById('closeProfile');
const assignTrainingBtn = document.getElementById('assignTrainingBtn');
const recallBtn = document.getElementById('recallBtn');

const recruitPopup = document.getElementById('recruitPopup');
const recruitText = document.getElementById('recruitText');
const recruitConfirmBtn = document.getElementById('recruitConfirm');
const recruitCancelBtn = document.getElementById('recruitCancel');

let gameState = GameState.load();
let selectedUnitId = null;
let pendingRecruitId = null;
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
  profileStrength.textContent = unit.strength;
  profileAccuracy.textContent = `${Math.round(unit.accuracy)}%`;
  profileEquipment.textContent = unit.equipment.length ? unit.equipment.join(', ') : 'None';
  profilePanel.classList.remove('hidden');

  const inHospital = unit.status === UNIT_STATUS.HOSPITAL;
  const alreadyAssigned = unit.assignedBuildingId === gameState.shootingRange.id;
  assignTrainingBtn.disabled = inHospital || alreadyAssigned || !gameState.shootingRange.isBuilt
    || gameState.shootingRangeOccupancy() >= gameState.shootingRange.capacity;
  assignTrainingBtn.textContent = alreadyAssigned ? 'Assigned: Shooting Range' : 'Assign: Shooting Range';
  recallBtn.disabled = inHospital || !unit.assignedBuildingId;
}

function closeProfile() {
  selectedUnitId = null;
  profilePanel.classList.add('hidden');
}

closeProfileBtn.addEventListener('click', closeProfile);

assignTrainingBtn.addEventListener('click', () => {
  if (selectedUnitId) gameState.assignToTraining(selectedUnitId);
});

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

// ---------- Barracks build/upgrade ----------

buildBarracksBtn.addEventListener('click', () => {
  gameState.upgradeBarracks();
});

buildRangeBtn.addEventListener('click', () => {
  if (gameState.shootingRange.isMaxLevel) return;
  const cost = gameState.shootingRange.nextUpgradeCost();
  if (gameState.cash < cost) return;
  gameState.cash -= cost;
  gameState.shootingRange.upgrade();
});

buildMessHallBtn.addEventListener('click', () => {
  if (gameState.messHall.isBuilt) return;
  const cost = gameState.messHall.buildCost();
  if (gameState.cash < cost) return;
  gameState.cash -= cost;
  gameState.messHall.build();
});

buyFoodBtn.addEventListener('click', () => {
  gameState.buyFood(20);
});

function refreshBarracksButton() {
  if (gameState.barracks.isMaxLevel) {
    buildBarracksBtn.disabled = true;
    buildBarracksBtn.textContent = 'Barracks Maxed';
  } else {
    const cost = gameState.barracks.nextUpgradeCost();
    barracksCostEl.textContent = Math.round(cost);
    buildBarracksBtn.disabled = gameState.cash < cost;
  }

  if (gameState.shootingRange.isMaxLevel) {
    buildRangeBtn.disabled = true;
    buildRangeBtn.textContent = 'Shooting Range Maxed';
  } else {
    const rCost = gameState.shootingRange.nextUpgradeCost();
    rangeCostEl.textContent = Math.round(rCost);
    buildRangeBtn.disabled = gameState.cash < rCost;
  }

  if (gameState.messHall.isBuilt) {
    buildMessHallBtn.disabled = true;
    buildMessHallBtn.textContent = 'Mess Hall Built';
  } else {
    buildMessHallBtn.disabled = gameState.cash < gameState.messHall.buildCost();
  }

  buyFoodBtn.disabled = gameState.cash < 30;
  foodValueEl.textContent = Math.floor(gameState.food);
}

// ---------- Canvas input ----------

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clickX = (e.clientX - rect.left) * scaleX;
  const clickY = (e.clientY - rect.top) * scaleY;

  // find nearest unit within click tolerance
  let closest = null;
  let closestDist = 16; // px tolerance
  for (const unit of gameState.units) {
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
  refreshBarracksButton();
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
  renderFrame(ctx, gameState, selectedUnitId);

  if (Date.now() - lastSaveTime > SAVE_INTERVAL_MS) {
    gameState.save();
    lastSaveTime = Date.now();
  }

  requestAnimationFrame(frame);
}

window.addEventListener('beforeunload', () => gameState.save());

requestAnimationFrame(frame);
