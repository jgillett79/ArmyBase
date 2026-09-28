// save.js — versioned save schema, v1 -> v2 migration, validation, and
// localStorage access with a recovery copy. state.js builds/applies the
// data; this file owns its shape and its history.
//
// Schema history
//   v1 ('armybase_save_v1'): flat per-building level fields
//      (barracksLevel, ...), unit x/y in the retired 960 x 576 grid layout.
//   v2 ('armybase_save_v2'): { schema: 2, worldId, buildings: { id: { level,
//      zoneId } }, units, ... }. Unit x/y are world coordinates (world.js).
//   v2 + brief 08 (same key and schema number — every addition is optional,
//      so an older build still loads these saves and ignores the extras):
//      `chapter` (the first soldier chapter, see state.js freshChapter()),
//      per-unit `trained`, `serviceTag`, `serviceRecord`, `hospitalReason`,
//      and mission-log entries with id/unitId/cash/resource/levelFrom/
//      levelTo/seen (the soldier's debrief). A save without `chapter` gets
//      one from chapterForSave(): an established base starts with the
//      chapter done and guidance dismissed, a brand-new one starts fresh.
//      Per-unit `callsign` and `accent` (customization) are filled in by
//      migrateCustomization().
//
// Safety rules
//   - The v1 key is never modified or removed. Migration writes a new v2 key;
//     if that write fails the v1 data is still there next time.
//   - Every successful load copies the raw text it loaded to
//     RECOVERY_SAVE_KEY. If the main save later fails to parse/validate, the
//     loader falls back to that copy before trying the legacy key.
//   - If nothing loads, the unreadable text is parked in UNREADABLE_SAVE_KEY
//     before the fresh game's first autosave can overwrite it.

const SAVE_SCHEMA_VERSION = 2;
const SAVE_KEY = 'armybase_save_v2';
const LEGACY_SAVE_KEY_V1 = 'armybase_save_v1';
const RECOVERY_SAVE_KEY = 'armybase_save_recovery';
const UNREADABLE_SAVE_KEY = 'armybase_save_unreadable';
const MAX_BACKUP_BYTES = 1024 * 1024;
const MAX_SAVED_NAME_LENGTH = 40; // UI renames cap at 18, but generated names can be longer

const SAVED_BUILDING_IDS = ['entrance_hall', 'barracks', 'shooting_range', 'mess_hall', 'weight_room',
  'obstacle_course', 'drill_yard', 'showers', 'rec_room'];
const TRAINING_BUILDING_IDS = ['shooting_range', 'weight_room', 'obstacle_course', 'drill_yard'];
const SAVED_BUILDING_MAX_LEVEL = { entrance_hall: 1, mess_hall: 1, showers: 1, rec_room: 1 }; // others: 3

// v1 stored one flat level field per singleton building.
const V1_LEVEL_FIELDS = {
  barracks: 'barracksLevel', shooting_range: 'shootingRangeLevel', mess_hall: 'messHallLevel',
  weight_room: 'weightRoomLevel', obstacle_course: 'obstacleCourseLevel', drill_yard: 'drillYardLevel',
  showers: 'showersLevel', rec_room: 'recRoomLevel',
};

// Door positions in the retired 960 x 576 layout (gridX/gridY * 48, the old
// buildingDoor()). Only used to tell which building a v1 unit stood at.
const V1_DOORS = {
  barracks: { x: 168, y: 192 }, shooting_range: { x: 504, y: 144 }, mess_hall: { x: 792, y: 192 },
  weight_room: { x: 216, y: 336 }, obstacle_course: { x: 456, y: 336 }, drill_yard: { x: 792, y: 336 },
  entrance_hall: { x: 168, y: 384 }, rec_room: { x: 504, y: 384 }, showers: { x: 744, y: 384 },
};
const V1_DOOR_RADIUS = 45;

class SaveFormatError extends Error {}

function saveVersionOf(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (data.schema === undefined) return ('cash' in data || 'units' in data) ? 1 : null;
  return Number.isInteger(data.schema) ? data.schema : null;
}

// Safe world position for a unit saved under the old layout. Only the
// position changes; route targets were never saved, so nothing else is stale.
function relocateV1Unit(unit) {
  const node = id => worldNodePosition(id);
  if (unit.status === 'hospital') return node(WORLD.safeNodes.hospital);
  if (unit.status === 'on_mission' || unit.status === 'recruiting') return node(WORLD.safeNodes.gate);
  if (Number.isFinite(unit.x) && Number.isFinite(unit.y)) {
    for (const [buildingId, door] of Object.entries(V1_DOORS)) {
      if (Math.hypot(unit.x - door.x, unit.y - door.y) <= V1_DOOR_RADIUS) {
        return { ...zoneById(WORLD.defaultPlacements[buildingId]).entrance };
      }
    }
    // Scale the old canvas onto the world, then snap to the path graph.
    return node(nearestTrunkNode(unit.x * WORLD.width / 960, unit.y * WORLD.height / 576));
  }
  return node(WORLD.safeNodes.gate);
}

function migrateV1ToV2(v1) {
  const buildings = {};
  for (const id of SAVED_BUILDING_IDS) {
    const level = id === 'entrance_hall' ? 1 : v1[V1_LEVEL_FIELDS[id]] ?? 0;
    buildings[id] = { level, zoneId: WORLD.defaultPlacements[id] };
  }
  return {
    schema: SAVE_SCHEMA_VERSION,
    worldId: WORLD_ID,
    migratedFrom: LEGACY_SAVE_KEY_V1,
    cash: v1.cash, food: v1.food, lumber: v1.lumber ?? 0, steel: v1.steel ?? 0, gems: v1.gems ?? 0,
    gameClockMs: v1.gameClockMs, lastTick: v1.lastTick,
    missionLog: Array.isArray(v1.missionLog) ? v1.missionLog : [],
    buildings,
    units: (Array.isArray(v1.units) ? v1.units : []).map(unit => {
      if (!unit || typeof unit !== 'object') return unit; // validation reports it
      const { x, y } = relocateV1Unit(unit);
      return { ...unit, x, y };
    }),
  };
}

// The chapter for a save made before brief 08. Anyone who already has a
// soldier, a mission behind them or a building of their own is not a new
// player: they are never pushed back into onboarding and get no intro patrol.
function chapterForSave(data) {
  const established = (Array.isArray(data.units) && data.units.length > 0)
    || (Array.isArray(data.missionLog) && data.missionLog.length > 0)
    || Object.entries(data.buildings || {}).some(([id, b]) => id !== 'entrance_hall' && b && b.level > 0);
  return established
    ? { firstSoldierId: null, targetAccuracy: null, introDispatched: true, introReportId: null, done: true, dismissed: true, legacy: true }
    : { firstSoldierId: null, targetAccuracy: null, introDispatched: false, introReportId: null, done: false, dismissed: false };
}

function validateChapter(chapter, errors) {
  if (typeof chapter !== 'object' || chapter === null || Array.isArray(chapter)) { errors.push('The first-soldier chapter is not a valid record.'); return; }
  for (const key of ['introDispatched', 'done', 'dismissed']) {
    if (chapter[key] !== undefined && typeof chapter[key] !== 'boolean') errors.push(`Chapter ${key} is not true/false.`);
  }
  if (chapter.firstSoldierId != null && typeof chapter.firstSoldierId !== 'string') errors.push('Chapter soldier id is invalid.');
  if (chapter.targetAccuracy != null && !Number.isFinite(chapter.targetAccuracy)) errors.push('Chapter target is not a number.');
}

// A chapter following a soldier who isn't on the roster (only possible in
// an edited backup) would strand the guide; close it rather than refuse
// the whole save.
function repairChapter(data) {
  const { chapter } = data;
  if (!chapter.firstSoldierId || chapter.done || data.units.some(u => u.id === chapter.firstSoldierId)) return data;
  return { ...data, chapter: { ...chapter, done: true, dismissed: true } };
}

// Callsign/accent (brief 08 customization): older soldiers get no callsign
// and their stable default accent; hand-edited values are cleaned rather
// than refusing the save (an overlong callsign is cut, an unknown accent
// falls back to the default).
function migrateCustomization(data) {
  return { ...data, units: data.units.map(unit => ({ ...unit,
    callsign: sanitizeCallsign(unit.callsign),
    accent: accentById(unit.accent) ? unit.accent : defaultAccentFor(unit.colorSeed) })) };
}

// Problems that make data unsafe to load, as sentences a player can act on.
function validateSaveData(data) {
  const errors = [];
  const finite = (value, label) => { if (!Number.isFinite(value)) errors.push(`${label} is missing or not a number.`); };
  if (saveVersionOf(data) !== SAVE_SCHEMA_VERSION) return ['The save format version is not recognised.'];
  if (data.worldId !== WORLD_ID) errors.push(`It was made for a different base map (${data.worldId}).`);
  finite(data.cash, 'Cash');
  finite(data.food, 'Food');
  for (const key of ['lumber', 'steel', 'gems', 'gameClockMs', 'lastTick']) {
    if (data[key] !== undefined) finite(data[key], key);
  }

  if (!data.buildings || typeof data.buildings !== 'object') errors.push('The building list is missing.');
  else {
    const usedZones = new Map();
    for (const [id, entry] of Object.entries(data.buildings)) {
      if (!SAVED_BUILDING_IDS.includes(id)) { errors.push(`Unknown building "${id}".`); continue; }
      const max = SAVED_BUILDING_MAX_LEVEL[id] ?? 3;
      if (!entry || !Number.isInteger(entry.level) || entry.level < 0 || entry.level > max) {
        errors.push(`${id} has an invalid level.`);
      }
      const zone = entry && zoneById(entry.zoneId);
      if (!zone) errors.push(`${id} is placed on an unknown site.`);
      else if (!zoneAllowsType(zone, id)) errors.push(`${id} cannot stand on ${zone.id}.`);
      else if (usedZones.has(zone.id)) errors.push(`${id} and ${usedZones.get(zone.id)} share ${zone.id}.`);
      else usedZones.set(zone.id, id);
    }
  }

  if (data.chapter !== undefined) validateChapter(data.chapter, errors);
  if (data.missionLog !== undefined && !Array.isArray(data.missionLog)) errors.push('The mission log is not a list.');

  if (!Array.isArray(data.units)) errors.push('The soldier list is missing.');
  else {
    if (data.units.length > 20) errors.push('It has more than 20 soldiers.');
    const ids = new Set();
    const statuses = Object.values(UNIT_STATUS);
    data.units.forEach((unit, index) => {
      const who = `Soldier ${index + 1}`;
      if (!unit || typeof unit !== 'object') { errors.push(`${who} is not a valid record.`); return; }
      if (typeof unit.id !== 'string' || !/^unit_[a-zA-Z0-9_-]+$/.test(unit.id)) errors.push(`${who} has an invalid id.`);
      else if (ids.has(unit.id)) errors.push(`${who} repeats id ${unit.id}.`);
      ids.add(unit.id);
      if (typeof unit.name !== 'string' || !unit.name.trim() || unit.name.length > MAX_SAVED_NAME_LENGTH) errors.push(`${who} has an invalid name.`);
      if (!statuses.includes(unit.status)) errors.push(`${who} has an unknown status.`);
      for (const key of ['x', 'y', 'level', 'xp', 'strength', 'accuracy', 'endurance', 'energy']) {
        if (!Number.isFinite(unit[key])) errors.push(`${who}: ${key} is missing or not a number.`);
      }
      if (unit.assignedBuildingId != null && !TRAINING_BUILDING_IDS.includes(unit.assignedBuildingId)) {
        errors.push(`${who} is assigned to an unknown facility.`);
      }
      if (unit.status === 'on_mission' && (!Number.isFinite(unit.missionReturnAt) || typeof unit.missionTierId !== 'string')) {
        errors.push(`${who} is on a mission with no return time.`);
      }
      if (unit.status === 'hospital' && !Number.isFinite(unit.hospitalUntil)) {
        errors.push(`${who} is in hospital with no recovery time.`);
      }
    });
  }
  return errors;
}

// Any supported version -> validated current-version data. Throws
// SaveFormatError with a readable message instead of returning bad data.
function normalizeSaveData(data) {
  const version = saveVersionOf(data);
  if (version === null) throw new SaveFormatError('This is not a Command Base save or backup.');
  if (version > SAVE_SCHEMA_VERSION) throw new SaveFormatError('This backup was made by a newer version of Command Base.');
  const migrated = version === 1 ? migrateV1ToV2(data) : data;
  const current = migrated.chapter === undefined ? { ...migrated, chapter: chapterForSave(migrated) } : migrated;
  const errors = validateSaveData(current);
  if (errors.length) {
    const more = errors.length > 3 ? ` (and ${errors.length - 3} more problems)` : '';
    throw new SaveFormatError(`This backup can't be restored: ${errors.slice(0, 3).join(' ')}${more}`);
  }
  return { data: migrateCustomization(repairChapter(current)), migrated: version !== SAVE_SCHEMA_VERSION, fromVersion: version };
}

function parseSaveText(raw) {
  let data;
  try { data = JSON.parse(raw); } catch { throw new SaveFormatError('The file is not valid JSON.'); }
  return normalizeSaveData(data);
}

// Tries the current key, then the recovery copy, then the v1 key. Returns
// { data, source, migrated } or null for a fresh start.
function readStoredSave(storage = localStorage) {
  const sources = [
    { key: SAVE_KEY, source: 'current' },
    { key: RECOVERY_SAVE_KEY, source: 'recovery' },
    { key: LEGACY_SAVE_KEY_V1, source: 'legacy_v1' },
  ];
  let firstUnreadable = null;
  for (const { key, source } of sources) {
    let raw;
    try { raw = storage.getItem(key); } catch (error) { console.warn('Could not read saved game', error); return null; }
    if (!raw) continue;
    try {
      const result = parseSaveText(raw);
      try { storage.setItem(RECOVERY_SAVE_KEY, raw); } catch (error) { console.warn('Could not keep a recovery copy', error); }
      return { ...result, source };
    } catch (error) {
      console.warn(`Saved game in ${key} could not be loaded`, error);
      firstUnreadable ??= raw;
    }
  }
  if (firstUnreadable) {
    try { storage.setItem(UNREADABLE_SAVE_KEY, firstUnreadable); } catch { /* nothing else to try */ }
  }
  return null;
}

// Replace the current save with restored data, keeping what was there as the
// recovery copy. Returns false if storage refused the write.
function writeRestoredSave(data, storage = localStorage) {
  try {
    const previous = storage.getItem(SAVE_KEY);
    if (previous) storage.setItem(RECOVERY_SAVE_KEY, previous);
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.warn('Could not store restored backup', error);
    return false;
  }
}
