// routine.js — brief 09: the shared daily timetable, the service rules of
// each station type, and the measured station geometry of each facility.
// Pure data and pure functions; GameState (state.js) runs the simulation.
//
// Rules (durations, effects, capacity per level) and geometry (where people
// stand) are kept apart on purpose: STATION_RULES and FACILITY_STATIONS say
// what a station does and how many exist; STATION_GEOMETRY says where they
// are, in world px from the facility's art anchor (the same anchor the
// Gate 0 contract uses: footprint centre x, footprint bottom − 6). The
// renderer reads both but never grants food or stats.
//
// All durations are GAME minutes; all rates are per GAME hour. Every
// number is a provisional placeholder to be tuned against measured travel
// (tests/routine.cjs prints it), like the rest of the economy.

const DAY_MINUTES = 24 * 60;

// Half-open [start, end) windows in game minutes covering all 24 hours; a
// window whose end is before its start wraps midnight. `status` is the
// coarse UNIT_STATUS shown in older UI and saved for compatibility.
const ROUTINE_TIMETABLE = [
  { id: 'sleep', start: 22 * 60, end: 6 * 60, task: 'sleep', label: 'Sleep', status: 'sleeping' },
  { id: 'bathroom', start: 6 * 60, end: 7 * 60, task: 'bathroom', label: 'Bathroom', status: 'hygiene' },
  { id: 'breakfast', start: 7 * 60, end: 8 * 60, task: 'meal', label: 'Breakfast', status: 'eating' },
  { id: 'morning_training', start: 8 * 60, end: 12 * 60, task: 'training', label: 'Morning training', status: 'training' },
  { id: 'lunch', start: 12 * 60, end: 13 * 60, task: 'meal', label: 'Lunch', status: 'eating' },
  { id: 'afternoon_training', start: 13 * 60, end: 17 * 60, task: 'training', label: 'Afternoon training', status: 'training' },
  { id: 'recreation', start: 17 * 60, end: 19 * 60, task: 'recreation', label: 'Recreation', status: 'recreation' },
  { id: 'dinner', start: 19 * 60, end: 20 * 60, task: 'meal', label: 'Dinner', status: 'eating' },
  { id: 'shower', start: 20 * 60, end: 21 * 60, task: 'shower', label: 'Shower', status: 'hygiene' },
  { id: 'free', start: 21 * 60, end: 22 * 60, task: 'free', label: 'Free time / bed prep', status: 'idle' },
];

// A started short service may run this far past its window's end, then it
// stops (partial benefit) and the soldier moves on. Brief target: ≤ 5.
const BOUNDARY_GRACE_MINUTES = 5;

function blockContains(block, minute) {
  return block.start < block.end ? minute >= block.start && minute < block.end
    : minute >= block.start || minute < block.end;
}

function routineBlockAt(minuteOfDay) {
  const m = ((minuteOfDay % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return ROUTINE_TIMETABLE.find(block => blockContains(block, m));
}

function routineBlockById(id) {
  return ROUTINE_TIMETABLE.find(block => block.id === id) || null;
}

// The window instance containing absolute game minute `abs` (day * 1440 +
// minute of day). A window belongs to the day it starts on, so 02:00 on
// day 3 is in day 2's sleep window. Returns { id, day, block, startAbs, endAbs }.
function routineWindowAt(abs) {
  const day = Math.floor(abs / DAY_MINUTES), minute = abs - day * DAY_MINUTES;
  const block = routineBlockAt(minute);
  const windowDay = block.start > block.end && minute < block.end ? day - 1 : day;
  const startAbs = windowDay * DAY_MINUTES + block.start;
  const length = (block.end - block.start + DAY_MINUTES) % DAY_MINUTES;
  return { id: `${windowDay}:${block.id}`, day: windowDay, block, startAbs, endAbs: startAbs + length };
}

function nextRoutineBlock(block) {
  return ROUTINE_TIMETABLE[(ROUTINE_TIMETABLE.indexOf(block) + 1) % ROUTINE_TIMETABLE.length];
}

function formatGameMinute(minuteOfDay) {
  const m = ((Math.floor(minuteOfDay) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Station rules. `minutes` is one use; `grace` lets a started use run into
// the boundary grace; `effect` is applied once on completion (partial uses
// get a share); `perHour` applies only while the soldier is in `use`.
// ---------------------------------------------------------------------------
const STATION_RULES = {
  bed: { activity: 'sleep', label: 'bunk', perHour: { energy: 6 } },
  bedroll: { activity: 'sleep', label: 'bedroll', perHour: { energy: 3 }, fallback: true }, // half effect, explicit spot
  toilet: { activity: 'toilet', label: 'toilet stall', minutes: 8, grace: true, privacy: true, effect: { hygiene: 15 } },
  basin: { activity: 'wash', label: 'wash basin', minutes: 4, grace: true, effect: { hygiene: 10 } },
  shower: { activity: 'shower', label: 'shower stall', minutes: 10, grace: true, privacy: true, effect: { hygiene: 30 } },
  counter: { activity: 'collect_meal', label: 'serving counter', minutes: 3, grace: true },
  seat: { activity: 'eat', label: 'dining seat', minutes: 15, grace: true, perHour: { energy: 100 } }, // +25 per meal
  bench: { activity: 'relax', label: 'rec bench', minutes: 20, effect: { morale: 12 } },
  // Training equipment: gains per game hour come from the facility's
  // `trains` map (building.js), applied only while in use.
  range_lane: { activity: 'fire', label: 'firing point', minutes: 30, training: true },
  barbell: { activity: 'lift', label: 'barbell', minutes: 30, training: true },
  beam: { activity: 'traverse', label: 'balance beam', minutes: 30, training: true },
  drill_post: { activity: 'drill', label: 'drill post', minutes: 30, training: true },
  waiting_chair: { activity: 'wait', label: 'chair' },
};

// Needs that drift every game hour regardless of activity (sleeping in a bed
// still costs hygiene). Energy drain depends on what the soldier is doing.
const ROUTINE_NEEDS = {
  energyDrainAwake: -2,    // walking, queuing, waiting, washing, eating
  energyDrainTraining: -6, // while using training equipment
  hygieneDrain: -2,
  moraleDrain: -1.5,
  mealFood: 1,             // food charged once, when serving starts
};

// Which station types each facility type offers and how many at each level
// (index = level). Decorative copies in art never add capacity: only these
// counts do. Training facilities and the rec room use the slots already
// registered on their zone/art (state.js facilitySlots), one station each.
const FACILITY_STATIONS = {
  barracks: { bed: [0, 6, 6, 6] },          // level 2–3 bed geometry is an open question (see contract)
  // Wash block: measured in tests/routine.cjs, one toilet could not serve
  // four soldiers in the 60-minute bathroom window (24 min barracks -> wash
  // block walk + 8 min per use + ~5 min queue hand-off each), so the
  // starter block has two toilet stalls.
  showers: { toilet: [0, 2, 3, 3], basin: [0, 1, 2, 3], shower: [0, 2, 2, 3] },
  mess_hall: { counter: [0, 1, 2], seat: [0, 6, 6] },
};
const SLOT_STATION_TYPES = {
  shooting_range: 'range_lane', weight_room: 'barbell', obstacle_course: 'beam', drill_yard: 'drill_post', rec_room: 'bench',
  entrance_hall: 'waiting_chair',
};

// Queue groups: one FIFO line per (facility, group). Seats are never queued
// for: a seat is reserved when serving starts.
const QUEUE_GROUP_OF = { toilet: 'toilet', basin: 'basin', shower: 'shower', counter: 'counter',
  range_lane: 'equipment', barbell: 'equipment', beam: 'equipment', drill_post: 'equipment', bench: 'bench' };

// ---------------------------------------------------------------------------
// Station geometry, world px from the facility's art anchor, measured on the
// default zone (CLAUDE_IMPLEMENTATION/09_STATION_VISUAL_CONTRACT.md):
//   use       the person's ground pivot while using the station
//   approach  where they stand just before entering / after leaving it
//   facing    the direction they face while using it
//   contact   a numeric action contact point (hands at counter/basin, body
//             centre on the mattress, tray on the table)
//   head/feet sleeping body line on a bed (lying placeholder)
//   inside    a waypoint just inside the door, shared by the facility
// Indices follow FACILITY_STATIONS order: level N uses the first N entries.
// ---------------------------------------------------------------------------
const STATION_GEOMETRY = {
  barracks: {
    inside: [0, -10],
    // Six single beds, 46 x 18 world px, in two columns either side of a
    // 24 px aisle, heads to the aisle. Rows 24 px apart.
    bed: [
      { use: [-35, -70], approach: [-14, -70], head: [-52 + 34, -70], feet: [-52, -70], facing: 'left' },
      { use: [35, -70], approach: [14, -70], head: [52 - 34, -70], feet: [52, -70], facing: 'right' },
      { use: [-35, -46], approach: [-14, -46], head: [-18, -46], feet: [-52, -46], facing: 'left' },
      { use: [35, -46], approach: [14, -46], head: [18, -46], feet: [52, -46], facing: 'right' },
      { use: [-35, -22], approach: [-14, -22], head: [-18, -22], feet: [-52, -22], facing: 'left' },
      { use: [35, -22], approach: [14, -22], head: [18, -22], feet: [52, -22], facing: 'right' },
    ],
    bedSize: [46, 18],
  },
  showers: {
    inside: [0, -6],
    aisle: [0, -58],
    // Back row: six 20 x 24 stalls, doors on the south side. Toilets take
    // the three west stalls, showers the three east ones, filling inwards
    // as the block is upgraded, so no stall ever moves.
    toilet: [
      { use: [-54, -82], approach: [-54, -64], facing: 'up', stall: [-54, -82] },
      { use: [-32, -82], approach: [-32, -64], facing: 'up', stall: [-32, -82] },
      { use: [-11, -82], approach: [-11, -64], facing: 'up', stall: [-11, -82] },
    ],
    shower: [
      { use: [54, -82], approach: [54, -64], facing: 'up', stall: [54, -82] },
      { use: [32, -82], approach: [32, -64], facing: 'up', stall: [32, -82] },
      { use: [11, -82], approach: [11, -64], facing: 'up', stall: [11, -82] },
    ],
    // Front row: basins against a low wall, aisle at dx 0 kept clear.
    basin: [
      { use: [-48, -30], approach: [-48, -30], facing: 'up', contact: [-48, -42] },
      { use: [-26, -30], approach: [-26, -30], facing: 'up', contact: [-26, -42] },
      { use: [26, -30], approach: [26, -30], facing: 'up', contact: [26, -42] },
    ],
    stallSize: [20, 24],
  },
  mess_hall: {
    inside: [0, -10],
    // Serving counter against the north-east wall: the soldier stands south
    // of it facing up, hands at `contact`; the cook stands behind at `cook`
    // facing down (brief 09C animates the hand-off).
    counter: [
      { use: [40, -68], approach: [40, -58], facing: 'up', contact: [40, -80], cook: [40, -92] },
      { use: [16, -68], approach: [16, -58], facing: 'up', contact: [16, -80], cook: [16, -92] },
    ],
    cookFacing: 'down',
    // Two tables, three seats each on the camera (south) side, 22 px apart,
    // facing up; `contact` is where the tray sits on the table top.
    seat: [
      { use: [-54, -44], approach: [-54, -36], facing: 'up', contact: [-54, -56] },
      { use: [-32, -44], approach: [-32, -36], facing: 'up', contact: [-32, -56] },
      { use: [-10, -44], approach: [-10, -36], facing: 'up', contact: [-10, -56] },
      { use: [-54, -14], approach: [-54, -6], facing: 'up', contact: [-54, -26] },
      { use: [-32, -14], approach: [-32, -6], facing: 'up', contact: [-32, -26] },
      { use: [-10, -14], approach: [-10, -6], facing: 'up', contact: [-10, -26] },
    ],
    tables: [[-32, -56, 70, 10], [-32, -26, 70, 10]], // centre dx, dy, width, depth (placeholder art)
  },
};

function stationRule(type) {
  return STATION_RULES[type] || null;
}
