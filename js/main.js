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
const profilePortrait = document.getElementById('profilePortrait');
const profileRole = document.getElementById('profileRole');
const profileActivity = document.getElementById('profileActivity');
const profileRecommendation = document.getElementById('profileRecommendation');
const profileKeyLabel = document.getElementById('profileKeyLabel');
const profileKeyBar = document.getElementById('profileKeyBar');
const profileKeyText = document.getElementById('profileKeyText');
const profileXpText = document.getElementById('profileXpText');
const profileService = document.getElementById('profileService');
const profileServiceTag = document.getElementById('profileServiceTag');
const profileServiceRecord = document.getElementById('profileServiceRecord');
const profileHistory = document.getElementById('profileHistory');
const profileDetails = document.getElementById('profileDetails');
const profileAssignRangeBtn = document.getElementById('profileAssignRangeBtn');
const profileCallsign = document.getElementById('profileCallsign');
const profileAccentBadge = document.getElementById('profileAccentBadge');
const profileAccentsEl = document.getElementById('profileAccents');

// Accent swatches, built once from the shared palette (unit.js).
for (const accent of ACCENT_COLOURS) {
  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = 'accent-swatch';
  swatch.dataset.accent = accent.id;
  swatch.setAttribute('role', 'radio');
  swatch.setAttribute('aria-label', accent.label);
  swatch.title = accent.label;
  swatch.style.background = accent.hex;
  swatch.addEventListener('click', () => {
    if (selectedUnitId && gameState.setAccent(selectedUnitId, accent.id)) gameState.save();
  });
  profileAccentsEl.append(swatch);
}

function paintAccentBadge(el, accentId) {
  const accent = accentById(accentId);
  el.style.background = accent ? accent.hex : 'transparent';
  el.title = accent ? `Accent: ${accent.label}` : '';
}
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
    const guided = guideFocus && guideFocus.unitId === unit.id;
    card.className = `roster-card${unit.isCivilian ? ' visitor' : ''}${guided ? ' guide-target' : ''}`;
    const portrait = document.createElement('canvas');
    portrait.className = 'portrait small';
    portrait.width = portrait.height = 88; // 2x for sharp phones; CSS draws it at 44
    drawPortrait(portrait, unit);
    const text = document.createElement('span');
    text.className = 'roster-text';
    const name = document.createElement('strong');
    name.textContent = unit.name;
    const detail = document.createElement('small');
    if (!unit.isCivilian && unit.callsign) name.textContent = `${unit.name} "${unit.callsign}"`;
    detail.textContent = unit.isCivilian ? 'Visitor · Tap to meet' : `${unit.speciality} · Level ${unit.level}${unit.serviceTag ? ` · ${unit.serviceTag}` : ''}`;
    const doing = document.createElement('small');
    if (!unit.isCivilian) doing.textContent = activityText(unit);
    text.append(name, detail, doing);
    const face = document.createElement('span');
    face.className = 'portrait-button';
    face.append(portrait);
    if (!unit.isCivilian) {
      const badge = document.createElement('span');
      badge.className = 'accent-badge small';
      paintAccentBadge(badge, unit.accent);
      face.append(badge);
    }
    card.dataset.unitId = unit.id;
    card.append(face, text);
    card.addEventListener('click', () => {
      // The roster is the reliable touch fallback; it also brings the person into view.
      locateUnit(unit);
      if (unit.isCivilian) openRecruitPopup(unit);
      else openProfile(unit);
    });
    rosterListEl.append(card);
  }
  if (!people.length) rosterListEl.textContent = 'Visitors will arrive at the gate. Tap one to meet them.';
}

// ---------- Selection / profile panel ----------

// What a person is doing right now, in words.
function activityText(unit) {
  const building = unit.slot && gameState.buildingByAnyId(unit.slot.buildingId);
  const at = building ? ` at the ${BUILDING_LABELS[building.type]}` : '';
  if (unit.routePhase === 'queued') return `Waiting for a place${unit.queuedFor ? ` at the ${BUILDING_LABELS[gameState.buildingByAnyId(unit.queuedFor).type]}` : ''}`;
  switch (unit.status) {
    case UNIT_STATUS.RECRUITING: return 'Walking to the barracks to change into uniform';
    case UNIT_STATUS.TRAINING:
      if (unit.onDrill) return unit.routePhase === 'using' ? 'Range drill at the Shooting Range' : 'Heading to the range drill';
      return unit.routePhase === 'using' ? `Training${at}` : `Heading to training${at}`;
    case UNIT_STATUS.EATING: return gameState.messHall.isBuilt ? `Eating${at}` : 'Hungry — no Mess Hall to eat in';
    case UNIT_STATUS.SLEEPING: return gameState.barracks.isBuilt ? 'Sleeping at the barracks' : 'Resting — no barracks beds yet';
    case UNIT_STATUS.HYGIENE: return gameState.showers.isBuilt ? `Washing${at}` : 'Free time (no showers yet)';
    case UNIT_STATUS.RECREATION: return gameState.recRoom.isBuilt ? `Relaxing${at}` : 'Free time (no rec room yet)';
    case UNIT_STATUS.HOSPITAL: return `At the aid station — back in ${formatClock(unit.hospitalUntil - Date.now())}${unit.hospitalReason === 'energy' ? ' (collapsed from exhaustion)' : ''}`;
    case UNIT_STATUS.ON_MISSION: {
      const tier = missionTierById(unit.missionTierId);
      return `On ${tier ? tier.name : 'a mission'} — back in ${formatClock(unit.missionReturnAt - Date.now())}`;
    }
    default: return unit.assignedBuildingId ? 'Off duty until the next training block' : 'Off duty';
  }
}

// The one or two stats that matter for this soldier's next step.
function keyStat(unit) {
  if (unit.id === gameState.chapter.firstSoldierId && gameState.introAvailable) {
    const target = gameState.chapter.targetAccuracy, start = target - INTRO_READINESS_GAIN;
    return { label: 'Accuracy', text: `${Math.floor(unit.accuracy)} / ${target}`, pct: clamp((unit.accuracy - start) / INTRO_READINESS_GAIN, 0, 1) };
  }
  const stat = { Breacher: 'strength', Pathfinder: 'endurance' }[unit.speciality] || 'accuracy';
  if (stat === 'strength') return { label: 'Strength', text: `${Math.floor(unit.strength)}`, pct: clamp(unit.strength / 95, 0, 1) };
  return { label: stat === 'endurance' ? 'Endurance' : 'Accuracy', text: `${Math.floor(unit[stat])}%`, pct: unit[stat] / 100 };
}

function historyText(entry) {
  if (!entry.unitId) return `${entry.tier} · ${entry.succeeded ? 'Succeeded' : 'Recovered'} · +${entry.xp} XP`;
  const reward = entry.succeeded ? `$${entry.cash}${entry.resource ? ` + ${entry.resource.amount} ${entry.resource.type}` : ''}` : 'hurt, recovered';
  return `${entry.intro ? 'First patrol' : entry.tier} · ${reward} · +${entry.xp} XP`;
}

function locateUnit(unit) {
  if (unit.status === UNIT_STATUS.ON_MISSION && !unit.departing) return; // away; nothing to show
  camera.centreOn(unit.x, unit.y - UNIT_H / 2);
  if (gameAreaEl.scrollIntoView) gameAreaEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function openProfile(unit) {
  const opening = selectedUnitId !== unit.id || profilePanel.classList.contains('hidden');
  selectedUnitId = unit.id;
  if (opening || document.activeElement !== profileName) profileName.value = unit.name;
  if (opening || document.activeElement !== profileCallsign) profileCallsign.value = unit.callsign || '';
  const customizable = !unit.isCivilian && unit.status !== UNIT_STATUS.RECRUITING;
  profileCallsign.disabled = !customizable;
  paintAccentBadge(profileAccentBadge, unit.accent);
  for (const swatch of profileAccentsEl.children) {
    swatch.setAttribute('aria-checked', String(swatch.dataset.accent === unit.accent));
    swatch.disabled = !customizable;
  }
  if (opening) profileDetails.open = false;
  // Redraw until the sprite has loaded, then only when the person changes.
  const portraitKey = `${unit.id}|${unit.outfit}`;
  if (profilePortrait.dataset.drawn !== portraitKey) {
    profilePortrait.dataset.drawn = drawPortrait(profilePortrait, unit) ? portraitKey : '';
  }
  profileRole.textContent = `${unit.speciality} · Level ${unit.level}`;
  profileActivity.textContent = activityText(unit);
  const advice = gameState.recommendationFor(unit);
  profileRecommendation.textContent = advice.text;
  profileRecommendation.dataset.code = advice.code;
  const key = keyStat(unit);
  profileKeyLabel.textContent = key.label;
  profileKeyText.textContent = key.text;
  profileKeyBar.style.width = `${Math.round(key.pct * 100)}%`;
  profileXpText.textContent = `${Math.floor(unit.xp)} / ${unit.xpToNext} to level ${unit.level + 1}`;
  profileService.classList.toggle('hidden', !unit.serviceRecord);
  profileServiceTag.textContent = unit.serviceTag || '';
  profileServiceRecord.textContent = unit.serviceRecord || '';
  const history = gameState.missionHistoryFor(unit).slice(0, 3).map(historyText);
  const historyKey = history.join('|');
  if (profileHistory.dataset.key !== historyKey || opening) {
    profileHistory.replaceChildren();
    for (const line of history) { const row = document.createElement('div'); row.textContent = line; profileHistory.append(row); }
    if (!history.length) profileHistory.textContent = 'No missions yet.';
    profileHistory.dataset.key = historyKey;
  }
  const canTrain = gameState.shootingRange.isBuilt && !unit.assignedBuildingId && !unit.isCivilian
    && unit.status !== UNIT_STATUS.HOSPITAL && unit.status !== UNIT_STATUS.RECRUITING && unit.status !== UNIT_STATUS.ON_MISSION
    && gameState.occupancyOf(gameState.shootingRange) < gameState.shootingRange.capacity;
  profileAssignRangeBtn.classList.toggle('hidden', !canTrain);
  profileLevel.textContent = unit.level;
  profileXpBar.style.width = `${Math.round((unit.xp / unit.xpToNext) * 100)}%`;
  profileStatus.textContent = unit.status.replaceAll('_', ' ');
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

const selectedUnit = () => gameState.units.find(u => u.id === selectedUnitId);
document.getElementById('locateSoldierBtn').addEventListener('click', () => { const u = selectedUnit(); if (u) locateUnit(u); });
document.getElementById('profilePortraitBtn').addEventListener('click', () => { const u = selectedUnit(); if (u) locateUnit(u); });
profileAssignRangeBtn.addEventListener('click', () => {
  if (selectedUnitId) gameState.assignToBuilding(selectedUnitId, gameState.shootingRange.id);
});

// Callsign: optional, committed on change (Enter or leaving the field);
// clearing the field removes it. Never required for the first patrol.
profileCallsign.addEventListener('change', () => {
  if (selectedUnitId && gameState.setCallsign(selectedUnitId, profileCallsign.value)) {
    profileCallsign.value = selectedUnit().callsign || '';
    gameState.save();
  }
});
document.getElementById('profileRandomise').addEventListener('click', () => {
  if (selectedUnitId && gameState.randomiseIdentity(selectedUnitId)) {
    profileCallsign.value = selectedUnit().callsign || '';
    gameState.save();
  }
});

profileName.addEventListener('change', () => {
  const unit = gameState.units.find(u => u.id === selectedUnitId);
  if (unit && profileName.value.trim()) {
    unit.name = profileName.value.trim().slice(0, 18);
    gameState.save();
  }
});

// ---------- Recruit popup ----------

// Meeting a visitor: who they are, what admitting them costs and does.
function openRecruitPopup(unit) {
  pendingRecruitId = unit.id;
  drawPortrait(document.getElementById('recruitPortrait'), unit);
  const full = gameState.soldierCount >= gameState.unitCap;
  const short = gameState.cash < RECRUIT_COST;
  recruitText.textContent = full ? `${unit.name} wants to join, but every bed is taken (${gameState.soldierCount}/${gameState.unitCap}). Build or upgrade the Barracks for more room.`
    : `${unit.name} is at the gate asking to join. Admit them for $${RECRUIT_COST}? They'll walk to the barracks and change into uniform.`
      + (short ? ` You need $${Math.ceil(RECRUIT_COST - gameState.cash)} more.` : '');
  recruitConfirmBtn.disabled = full || short;
  recruitConfirmBtn.textContent = `Admit ${unit.name.split(' ')[0]} · $${RECRUIT_COST}`;
  recruitPopup.classList.remove('hidden');
}

recruitConfirmBtn.addEventListener('click', () => {
  if (pendingRecruitId && gameState.recruit(pendingRecruitId)) {
    const unit = gameState.units.find(u => u.id === pendingRecruitId);
    if (unit) openProfile(unit); // straight to their card: this is who they are now
    gameState.save();
  }
  pendingRecruitId = null;
  recruitPopup.classList.add('hidden');
});

recruitCancelBtn.addEventListener('click', () => {
  pendingRecruitId = null;
  recruitPopup.classList.add('hidden');
});

// ---------- Missions ----------

// m:ss for short real-time countdowns (patrols, recovery).
function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  if (total >= 3600) return formatDuration(ms);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// What a recalled soldier stops doing, for the dispatch list.
function recallText(unit) {
  return { training: 'training', eating: 'their meal break', sleeping: 'sleeping', hygiene: 'their wash break',
    recreation: 'their free time' }[unit.status] || 'what they are doing';
}

function formatDuration(ms) {
  if (ms < 120000) return `${Math.round(ms / 1000)} s`;
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Opens the panel; `tierId` preselects a mission and `unitIds` a squad
// (the objective card uses this for the first soldier's patrol).
function openMissionsPanel(tierId = null, unitIds = []) {
  missionsPanel.classList.remove('hidden');
  if (tierId) {
    selectedTierId = tierId;
    selectedSquadIds = new Set(unitIds);
    renderSquadSelect();
  }
  renderMissionTierList();
}

function closeMissionsPanel() {
  missionsPanel.classList.add('hidden');
  selectedTierId = null;
  selectedSquadIds = new Set();
}

openMissionsBtn.addEventListener('click', () => {
  // During the chapter the button goes straight to the first soldier's patrol.
  const stage = gameState.chapterStage();
  if (gameState.guidanceActive && stage.id === 'patrol') openMissionsPanel('local_patrol', [stage.unit.id]);
  else openMissionsPanel();
});
closeMissionsBtn.addEventListener('click', closeMissionsPanel);

// The intro version of Local Patrol while the first soldier's is unused.
function displayTier(tier) {
  return gameState.introTierFor(tier, [gameState.chapter.firstSoldierId]) || tier;
}

function renderMissionTierList() {
  missionTierListEl.replaceChildren();
  for (const listed of MISSION_TIERS) {
    const tier = displayTier(listed);
    const soldiers = gameState.units.filter(u => !u.isCivilian);
    const eligibleCount = soldiers.filter(u => gameState.deploymentCheck(u, listed).ok).length;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `mission-tier${listed.id === selectedTierId ? ' selected' : ''}`;
    card.dataset.tierId = listed.id;
    const first = gameState.firstSoldier;
    const odds = tier.guaranteed ? 'Guaranteed return (introductory patrol)' : `${Math.round(tier.baseSuccessChance * 100)}% base success`;
    const req = tier.intro ? `${first.name.split(' ')[0]} alone · accuracy ${gameState.chapter.targetAccuracy}+`
      : `Level ${tier.minLevel}+ · stat average ${tier.minStatAvg}+`;
    card.innerHTML = `
      <span class="mission-tier-name"></span>
      <span class="mission-tier-purpose"></span>
      <span class="mission-tier-meta"></span>
      <span class="mission-tier-eligible"></span>`;
    card.querySelector('.mission-tier-name').textContent = tier.intro ? `${tier.name} — ${first.name}'s first patrol` : tier.name;
    card.querySelector('.mission-tier-purpose').textContent = `${tier.purpose}: ${tier.unlocks}`;
    card.querySelector('.mission-tier-meta').textContent = `${formatDuration(tier.durationMs)} · ${rewardText(tier)} · ${odds}`;
    card.querySelector('.mission-tier-eligible').textContent = `${req} · ${eligibleCount} ready`;
    if (gameState.guidanceActive && tier.intro && gameState.chapterStage().id === 'patrol') card.classList.add('guide-target');
    card.addEventListener('click', () => selectMissionTier(listed.id));
    missionTierListEl.append(card);
  }
}

function rewardText(tier) {
  const [lo, hi] = tier.cashReward;
  const cash = lo === hi ? `$${lo}` : `$${lo}-${hi}`;
  const xp = ` + ${tier.xpReward} XP`;
  if (!tier.resourceReward) return cash + xp;
  const { type, amount } = tier.resourceReward;
  return `${cash} + ${amount[0]}-${amount[1]} ${type}${xp}`;
}

function selectMissionTier(tierId) {
  selectedTierId = tierId;
  selectedSquadIds = new Set();
  renderMissionTierList();
  renderSquadSelect();
}

// Every soldier is listed; anyone who can't go says why. Anyone who has to
// stop what they're doing says so, and the dispatch button names the recall.
function renderSquadSelect() {
  const listed = missionTierById(selectedTierId);
  if (!listed) {
    missionSquadSelectEl.classList.add('hidden');
    return;
  }
  missionSquadSelectEl.classList.remove('hidden');
  const introId = gameState.introAvailable ? gameState.chapter.firstSoldierId : null;
  const introPicked = listed.id === 'local_patrol' && introId && selectedSquadIds.has(introId);
  const tier = introPicked ? INTRO_PATROL : listed;
  missionSquadMaxEl.textContent = tier.maxSquadSize;

  missionUnitListEl.replaceChildren();
  const soldiers = gameState.units.filter(u => !u.isCivilian);
  if (!soldiers.length) {
    const empty = document.createElement('div');
    empty.className = 'mission-unit-empty';
    empty.textContent = 'No soldiers yet — admit a visitor at the gate.';
    missionUnitListEl.append(empty);
  }
  for (const unit of soldiers) {
    const check = gameState.deploymentCheck(unit, listed);
    // The intro patrol is solo: picking the first soldier excludes others and vice versa.
    const soloClash = listed.id === 'local_patrol' && introId && selectedSquadIds.size > 0
      && (unit.id === introId ? !selectedSquadIds.has(introId) : selectedSquadIds.has(introId));
    const row = document.createElement('label');
    row.className = `mission-unit-row${check.ok ? '' : ' blocked'}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.unitId = unit.id;
    checkbox.checked = selectedSquadIds.has(unit.id);
    checkbox.disabled = !check.ok || (soloClash && !checkbox.checked);
    const label = document.createElement('span');
    const unitTier = listed.id === 'local_patrol' && unit.id === introId ? INTRO_PATROL : listed;
    const chance = unitTier.guaranteed ? 'guaranteed return' : `${Math.round(missionSuccessChance(unitTier, [unit]) * 100)}% success`;
    const note = !check.ok ? check.reason
      : soloClash ? `${gameState.firstSoldier.name.split(' ')[0]}'s first patrol is solo`
      : check.recall ? `${chance} · will leave ${recallText(unit)}` : chance;
    label.textContent = `${unit.name} (Lv${unit.level}) — ${note}`;
    row.append(checkbox, label);
    missionUnitListEl.append(row);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedSquadIds.add(unit.id);
      else selectedSquadIds.delete(unit.id);
      renderSquadSelect();
    });
  }
  updateMissionPreview(tier);
}

function updateMissionPreview(tier = missionTierById(selectedTierId)) {
  missionSquadCountEl.textContent = selectedSquadIds.size;
  const squad = [...selectedSquadIds].map(id => gameState.units.find(u => u.id === id)).filter(Boolean);
  missionChancePreviewEl.textContent = !tier || !squad.length ? '--'
    : tier.guaranteed ? 'Guaranteed (introductory)'
    : `${Math.round(squad.reduce((total, unit) => total + missionSuccessChance(tier, [unit]), 0) / squad.length * 100)}% average per soldier`;
  const listed = missionTierById(selectedTierId);
  const recalls = squad.filter(u => gameState.deploymentCheck(u, listed).recall);
  dispatchMissionBtn.disabled = !(tier && squad.length > 0 && squad.length <= tier.maxSquadSize);
  dispatchMissionBtn.textContent = recalls.length === 1 ? `Recall ${recalls[0].name.split(' ')[0]} and send on ${tier.name}`
    : recalls.length > 1 ? `Recall ${recalls.length} soldiers and send` : 'Send out';
}

dispatchMissionBtn.addEventListener('click', () => {
  if (!selectedTierId || selectedSquadIds.size === 0) return;
  // The button text names the recall, so pressing it is the explicit consent.
  if (gameState.dispatchMission(selectedTierId, [...selectedSquadIds], { recall: true })) gameState.save();
  selectedTierId = null;
  selectedSquadIds = new Set();
  renderMissionTierList();
  missionSquadSelectEl.classList.add('hidden');
});

function renderActiveMissions() {
  const active = gameState.units.filter(u => u.status === UNIT_STATUS.ON_MISSION);
  const now = Date.now();
  const lines = active.map(u => {
    const tier = missionTierById(u.missionTierId);
    return `${u.name} — ${tier ? tier.name : 'Unknown'} — back in ${formatClock(u.missionReturnAt - now)}`;
  });
  const key = lines.join('|');
  if (activeMissionsListEl.dataset.key === key) return;
  activeMissionsListEl.dataset.key = key;
  activeMissionsListEl.replaceChildren();
  if (!lines.length) activeMissionsListEl.innerHTML = '<div class="mission-unit-empty">No one is out right now.</div>';
  for (const line of lines) {
    const row = document.createElement('div');
    row.className = 'mission-active-row';
    row.textContent = line;
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
    row.textContent = `${entry.name} · ${historyText(entry)}`;
    list.append(row);
  }
  if (!gameState.missionLog.length) list.textContent = 'Your squad’s stories will appear here.';
}

// ---------- Debrief: one soldier's return, shown once ----------

const debriefPanel = document.getElementById('debriefPanel');
let openDebriefId = null;

function showDebrief(report) {
  openDebriefId = report.id;
  const unit = gameState.units.find(u => u.id === report.unitId);
  if (unit) drawPortrait(document.getElementById('debriefPortrait'), unit);
  // The soldier as they are now (same name, callsign and accent as the
  // map and card); the report's own snapshot if they are no longer listed.
  const who = unit || report;
  paintAccentBadge(document.getElementById('debriefAccentBadge'), who.accent);
  document.getElementById('debriefCallsign').textContent = who.callsign ? `Callsign "${who.callsign}"` : '';
  document.getElementById('debriefEyebrow').textContent = report.intro ? 'FIRST PATROL REPORT' : `${report.tier.toUpperCase()} REPORT`;
  document.getElementById('debriefTitle').textContent = report.succeeded ? `${who.name} is back` : `${who.name} was hurt`;
  const lines = [];
  if (report.succeeded) {
    lines.push(report.intro ? `Walked the ${report.tier} route and came home through the gate.` : `Completed ${report.tier}.`);
    lines.push(`Brought back $${report.cash}${report.resource ? ` and ${report.resource.amount} ${report.resource.type}` : ''}.`);
  } else {
    lines.push(`Hurt on ${report.tier}. Recovering at the aid station until ${new Date(report.recoveryUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — level, stats and gear are kept.`);
  }
  lines.push(report.levelTo > report.levelFrom ? `+${report.xp} XP — level ${report.levelFrom} → ${report.levelTo}.` : `+${report.xp} XP.`);
  const list = document.getElementById('debriefLines');
  list.replaceChildren(...lines.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
  const record = document.getElementById('debriefRecord');
  record.classList.toggle('hidden', !(report.intro && unit && unit.serviceRecord));
  record.textContent = unit && unit.serviceRecord ? `${unit.serviceTag}: ${unit.serviceRecord}` : '';
  const advice = gameState.nextConstructionAdvice();
  const next = document.getElementById('debriefNext');
  const buildBtn = document.getElementById('debriefBuildBtn');
  next.classList.toggle('hidden', !advice);
  buildBtn.classList.toggle('hidden', !advice || !advice.affordable);
  if (advice) {
    const name = BUILDING_LABELS[advice.building.type];
    document.getElementById('debriefNextText').textContent = `${advice.upgrade ? `Upgrade the ${name}` : name} · ${priceText(advice.price)} — ${BUILDING_EFFECTS[advice.key]}`
      + (advice.affordable ? ` You have $${Math.floor(gameState.cash)}.` : ` Still need ${advice.shortfall}.`);
    buildBtn.textContent = `${advice.upgrade ? 'Upgrade' : 'Build'} ${name}`;
    buildBtn.dataset.key = advice.key;
  }
  debriefPanel.classList.remove('hidden');
}

function closeDebrief() {
  if (openDebriefId && gameState.markReportSeen(openDebriefId)) gameState.save(); // seen once, even after reload
  openDebriefId = null;
  debriefPanel.classList.add('hidden');
}

document.getElementById('debriefContinueBtn').addEventListener('click', closeDebrief);
document.getElementById('debriefBuildBtn').addEventListener('click', event => {
  const key = event.currentTarget.dataset.key;
  closeDebrief();
  onBuildButton(key);
});

// Unread reports open by themselves, one at a time, unless something else
// modal is open — they wait rather than stack.
function surfaceDebriefs() {
  if (openDebriefId || buildMode || !recruitPopup.classList.contains('hidden') || !missionsPanel.classList.contains('hidden')) return;
  const [next] = gameState.unseenReports();
  if (next) showDebrief(next);
}

// ---------- Individual moments (toast feed) ----------

const eventFeedEl = document.getElementById('eventFeed');
const EVENT_SHOW_MS = 6000;
let lastEventShown = null;

function renderEventFeed(nowMs) {
  const shown = gameState.events.filter(e => nowMs - e.at < EVENT_SHOW_MS).slice(-3);
  const key = shown.map(e => e.id).join('|');
  if (key === lastEventShown) return;
  lastEventShown = key;
  eventFeedEl.replaceChildren(...shown.map(event => {
    const toast = document.createElement('button');
    toast.type = 'button';
    toast.className = 'event-toast';
    toast.textContent = event.text;
    toast.addEventListener('click', () => {
      const unit = gameState.units.find(u => u.id === event.unitId);
      if (unit) { openProfile(unit); locateUnit(unit); }
    });
    return toast;
  }));
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
  if (gameState.constructAt(buildMode.key, zoneId)) { endBuildMode(zoneId); gameState.save(); }
  else refreshBuildBar();
});
buildCancelBtn.addEventListener('click', () => endBuildMode());

function onBuildButton(key) {
  const building = gameState[key];
  if (!building.isBuilt) startBuildMode(key);
  else if (key === 'barracks' ? gameState.upgradeBarracks() : gameState.upgradeBuilding(key)) gameState.save();
}

// What each facility (or its next level) does for people — shown on the
// build buttons, the debrief and the objective card.
const BUILDING_EFFECTS = {
  barracks: 'Beds for night rest and room for 5 more soldiers.',
  shootingRange: 'Trains accuracy — 2 soldiers at a time per level.',
  weightRoom: 'Trains strength — 2 soldiers at a time per level.',
  obstacleCourse: 'Trains endurance — 2 soldiers at a time per level.',
  drillYard: 'Trains strength and endurance together, more slowly.',
  messHall: 'Meals with your food stock, so soldiers stop collapsing from hunger.',
  showers: 'Keeps hygiene up, so energy drains more slowly.',
  recRoom: 'Keeps morale up, so training isn\'t halved.',
};

function buildingEffectText(key) {
  const building = gameState[key];
  if (key === 'barracks' && building.isBuilt) return `Room for 5 more soldiers (now ${gameState.unitCap}).`;
  if (building.capacity !== undefined && building.isBuilt) return `2 more training places (now ${building.capacity}).`;
  return BUILDING_EFFECTS[key];
}

const constructionEl = document.getElementById('construction');
document.getElementById('showAllBuildingsBtn').addEventListener('click', () => constructionEl.classList.add('show-all'));

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

  // Effects, and during onboarding only the suggested facility (the rest
  // stay one tap away behind "All buildings").
  const advice = gameState.nextConstructionAdvice();
  for (const block of constructionEl.querySelectorAll('.construction-grid .hud-block')) {
    const effect = block.querySelector('.build-effect');
    if (effect) effect.textContent = buildingEffectText(block.dataset.key);
    block.classList.toggle('recommended', !!advice && advice.key === block.dataset.key);
  }
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

// ---------- First soldier chapter: the objective card ----------
//
// One instruction, its progress and one action, derived every refresh from
// GameState.chapterStage() — nothing here is saved, so clicking elsewhere,
// reloading or coming back later always shows the current step. `guideFocus`
// is what the map and page highlight.

const objectiveCardEl = document.getElementById('objectiveCard');
const objectiveActionBtn = document.getElementById('objectiveActionBtn');
const hudMoreEl = document.getElementById('hudMore');
let objectiveAction = null;
let guideFocus = null; // { unitId, zoneId, elementId }
let lastObjectiveTime = 0;

const firstName = unit => unit.name.split(' ')[0];

const drillHour = h => `${String(h).padStart(2, '0')}:00`;
// The first-soldier range drill, named as the special case it is (mission.js).
const DRILL_TEXT = unit => `Range drill: as the base's first soldier, ${firstName(unit)} trains ${FIRST_SOLDIER_DRILL.multiplier}× faster at any waking hour (${drillHour(FIRST_SOLDIER_DRILL.from)}–${drillHour(FIRST_SOLDIER_DRILL.to)}) until patrol-ready.`;

// { step, title, detail, progress: {pct, text}|null, action: {label, run, disabled}|null, focus }
function describeObjective(stage) {
  const unit = stage.unit;
  const range = gameState.shootingRange;
  switch (stage.id) {
    case 'meet': {
      const pending = pendingRecruitId && gameState.units.find(u => u.id === pendingRecruitId);
      if (pending) return { step: 2, title: `Admit ${pending.name}`, detail: `$${RECRUIT_COST} to join. They'll walk to the barracks and change into uniform.`,
        action: { label: `Admit ${firstName(pending)} · $${RECRUIT_COST}`, run: () => recruitConfirmBtn.click(), disabled: recruitConfirmBtn.disabled }, focus: { unitId: pending.id } };
      const visitor = stage.visitor;
      if (!visitor) return { step: 1, title: 'Meet your first visitor', detail: 'Someone is on the road to the gate. Visitors check in at the barrier, then wait in the Entrance Hall.', action: { label: 'Waiting at the gate…', disabled: true }, focus: {} };
      return { step: 1, title: 'Meet your first visitor', detail: `${visitor.name} ${visitor.routePhase === 'using' ? 'is waiting in the Entrance Hall' : visitor.enteredGate ? 'is walking in from the gate' : 'is checking in at the gate'}. Tap them to meet them.`,
        action: { label: `Meet ${firstName(visitor)}`, run: () => { locateUnit(visitor); openRecruitPopup(visitor); } }, focus: { unitId: visitor.id } };
    }
    case 'admit':
      return { step: 2, title: `Admit ${unit.name}`, detail: `${firstName(unit)} is walking to the barracks to change into uniform.`,
        action: { label: `Follow ${firstName(unit)}`, run: () => { locateUnit(unit); openProfile(unit); } }, focus: { unitId: unit.id } };
    case 'build_range':
      // Build mode itself explains any shortfall, so the action stays enabled.
      return { step: 3, title: `Train ${unit.name} at the range`, detail: `First, build the Shooting Range: ${BUILDING_EFFECTS.shootingRange}`,
        progress: null, action: { label: `Build Shooting Range · ${priceText(gameState.constructionPrice(range))}`, run: () => onBuildButton('shootingRange') },
        focus: { zoneId: range.zoneId, elementId: 'buildRangeBtn' } };
    case 'train': {
      const target = gameState.chapter.targetAccuracy;
      const progress = { pct: clamp((unit.accuracy - (target - INTRO_READINESS_GAIN)) / INTRO_READINESS_GAIN, 0, 1), text: `Accuracy ${Math.floor(unit.accuracy)} / ${target}` };
      const title = `Train ${unit.name} at the range`;
      if (unit.status === UNIT_STATUS.HOSPITAL) return { step: 3, title, detail: `${firstName(unit)} ${activityText(unit).charAt(0).toLowerCase() + activityText(unit).slice(1)}.`, progress, action: null, focus: { unitId: unit.id } };
      if (unit.assignedBuildingId !== range.id) {
        return { step: 3, title, detail: `Accuracy decides whether ${firstName(unit)} is ready for the first patrol. ${DRILL_TEXT(unit)} About ${Math.ceil(gameState.trainingSecondsToTarget(unit))} s at the range.`,
          progress, action: { label: `Assign ${firstName(unit)} to the range`, run: () => { gameState.assignToBuilding(unit.id, range.id); openProfile(unit); } }, focus: { unitId: unit.id, zoneId: range.zoneId } };
      }
      const training = unit.status === UNIT_STATUS.TRAINING && unit.routePhase === 'using';
      const detail = training ? `Range drill (${FIRST_SOLDIER_DRILL.multiplier}× training): ${firstName(unit)} is firing at the range — about ${Math.ceil(gameState.trainingSecondsToTarget(unit))} s to go.`
        : unit.status === UNIT_STATUS.SLEEPING ? `${firstName(unit)} is asleep; the range drill resumes at ${drillHour(FIRST_SOLDIER_DRILL.from)}.`
        : `${activityText(unit)}. ${DRILL_TEXT(unit)}`;
      return { step: 3, title, detail, progress, action: { label: `Watch ${firstName(unit)}`, run: () => { locateUnit(unit); openProfile(unit); } }, focus: { unitId: unit.id, zoneId: range.zoneId } };
    }
    case 'patrol': {
      const check = gameState.deploymentCheck(unit, missionTierById('local_patrol'));
      const detail = !check.ok ? `${firstName(unit)} can't go yet: ${check.reason.toLowerCase()}.`
        : `Accuracy ${Math.floor(unit.accuracy)} — ready. A short introductory patrol (${Math.round(INTRO_PATROL.durationMs / 1000)} s): ${firstName(unit)} is guaranteed to come back, with $${INTRO_PATROL.cashReward[0]} and ${INTRO_PATROL.xpReward} XP.`
          + (check.recall ? ` ${firstName(unit)} will stop what they're doing to go.` : '');
      return { step: 4, title: `Send ${unit.name} on Local Patrol`, detail,
        action: { label: 'Open Local Patrol', run: () => openMissionsPanel('local_patrol', check.ok ? [unit.id] : []), disabled: !check.ok },
        focus: { unitId: unit.id, elementId: 'openMissionsBtn' } };
    }
    case 'away': {
      const left = unit.missionReturnAt - Date.now();
      return { step: 5, title: `Welcome ${unit.name} back`, detail: `${firstName(unit)} is out on patrol and will walk back in through the gate.`,
        progress: { pct: clamp(1 - left / INTRO_PATROL.durationMs, 0, 1), text: `Back in ${formatClock(left)}` },
        action: { label: 'Watch the gate', run: () => camera.home() }, focus: {} };
    }
    case 'debrief':
      return { step: 5, title: `Welcome ${unit.name} back`, detail: `${firstName(unit)} is home. Read the patrol report.`,
        action: { label: `Read ${firstName(unit)}'s report`, run: () => showDebrief(stage.report) }, focus: { unitId: unit.id } };
    case 'improve': {
      const advice = stage.advice;
      if (!advice) return { step: 6, title: 'Use patrol earnings to improve the base', detail: 'Build anything to finish the chapter.', action: null, focus: {} };
      const name = BUILDING_LABELS[advice.building.type];
      return { step: 6, title: 'Use patrol earnings to improve the base', detail: `${advice.upgrade ? `Upgrade the ${name}` : name}: ${buildingEffectText(advice.key)}`
          + (advice.affordable ? '' : ` Still need ${advice.shortfall}.`),
        action: { label: `${advice.upgrade ? 'Upgrade' : 'Build'} ${name} · ${priceText(advice.price)}`, run: () => onBuildButton(advice.key), disabled: !advice.affordable && advice.upgrade },
        focus: { zoneId: advice.building.zoneId, elementId: advice.key === 'barracks' ? 'buildBarracksBtn' : null } };
    }
    default: return null;
  }
}

function refreshObjective() {
  const active = gameState.guidanceActive;
  const onboarding = gameState.onboarding;
  document.body.classList.toggle('onboarding', onboarding);
  if (!onboarding && !hudMoreEl.open) hudMoreEl.open = true; // resources stay visible once the chapter opens up
  document.getElementById('resumeGuideBtn').classList.toggle('hidden', active || gameState.chapter.done);
  const objective = active ? describeObjective(gameState.chapterStage()) : null;
  objectiveCardEl.classList.toggle('hidden', !objective);
  guideFocus = objective ? objective.focus : null;
  document.querySelectorAll('.guide-target').forEach(el => { if (!el.classList.contains('mission-tier')) el.classList.remove('guide-target'); });
  if (!objective) { objectiveAction = null; return; }
  if (guideFocus.elementId) document.getElementById(guideFocus.elementId)?.classList.add('guide-target');
  document.getElementById('objectiveStep').textContent = `STEP ${objective.step} OF 6`;
  document.getElementById('objectiveTitle').textContent = objective.title;
  document.getElementById('objectiveDetail').textContent = objective.detail;
  const progressEl = document.getElementById('objectiveProgress');
  progressEl.classList.toggle('hidden', !objective.progress);
  if (objective.progress) {
    document.getElementById('objectiveProgressFill').style.width = `${Math.round(objective.progress.pct * 100)}%`;
    document.getElementById('objectiveProgressText').textContent = objective.progress.text;
  }
  objectiveAction = objective.action;
  objectiveActionBtn.classList.toggle('hidden', !objective.action);
  if (objective.action) {
    objectiveActionBtn.textContent = objective.action.label;
    objectiveActionBtn.disabled = !!objective.action.disabled;
  }
}

objectiveActionBtn.addEventListener('click', () => {
  if (objectiveAction && objectiveAction.run && !objectiveActionBtn.disabled) objectiveAction.run();
  refreshObjective();
});
document.getElementById('skipGuideBtn').addEventListener('click', () => { gameState.dismissGuidance(); gameState.save(); refreshObjective(); });
document.getElementById('resumeGuideBtn').addEventListener('click', () => { gameState.resumeGuidance(); gameState.save(); refreshObjective(); });

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
  if (nowMs - lastObjectiveTime > 250) {
    refreshObjective();
    surfaceDebriefs();
    lastObjectiveTime = nowMs;
  }
  renderEventFeed(nowMs);
  renderFrame(ctx, gameState, selectedUnitId, { camera, dpr: devicePixelScale, now: performance.now(),
    buildMode, debug: debugScene, revealedBuildingId, guide: guideFocus });

  if (Date.now() - lastSaveTime > SAVE_INTERVAL_MS) {
    document.getElementById('saveNotice').classList.toggle('hidden', gameState.save());
    lastSaveTime = Date.now();
  }

  requestAnimationFrame(frame);
}

window.addEventListener('beforeunload', () => gameState.save());

requestAnimationFrame(frame);
