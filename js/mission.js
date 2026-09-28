// mission.js — mission tier data + the pure functions that read it.
// Missions are async/black-box by design (see CLAUDE.md): press a button,
// squad leaves, returns or doesn't, resolved by a stat-weighted percentage.
// No mini-game, no visualized travel. state.js owns dispatch/resolution
// (the stateful half); everything here is pure data + pure functions so the
// rules live in exactly one place.

// One difficulty ladder; each rung also has a purpose (brief 08): what its
// reward is for and which upgrade that unlocks, so a player picks a mission
// for a reason rather than for a bigger number. `recoveryMs` is how long a
// soldier who fails it spends at the aid station (real time, like the
// mission timer) — short early on so an unlucky patrol can't stop a first
// session for a day. Every number below is an unbalanced placeholder, same
// caveat as the rest of this codebase's economy (recruit cost, cash
// trickle, etc.) — these exist to make the loop testable, not tuned.
const MISSION_TIERS = [
  {
    id: 'local_patrol',
    name: 'Local Patrol',
    tier: 1,
    minLevel: 1,
    minStatAvg: 0,
    maxSquadSize: 4,
    durationMs: 3 * 60 * 1000, // quick first return; always real time, not compressed game time
    baseSuccessChance: 0.85,
    xpReward: 60,
    cashReward: [40, 80],
    resourceReward: null,
    recoveryMs: 5 * 60 * 1000,
    purpose: 'Cash for your next facility',
    unlocks: 'Pays for the Mess Hall and Barracks',
  },
  {
    id: 'supply_run',
    name: 'Supply Run',
    tier: 2,
    minLevel: 3,
    minStatAvg: 40,
    maxSquadSize: 4,
    durationMs: 30 * 60 * 1000,
    baseSuccessChance: 0.7,
    xpReward: 110,
    cashReward: [80, 150],
    resourceReward: { type: 'lumber', amount: [10, 20] },
    recoveryMs: 30 * 60 * 1000,
    purpose: 'Lumber for level 2',
    unlocks: 'Every level 2 upgrade needs 10 lumber',
  },
  {
    id: 'fortified_outpost',
    name: 'Fortified Outpost',
    tier: 3,
    minLevel: 6,
    minStatAvg: 60,
    maxSquadSize: 4,
    durationMs: 2 * 60 * 60 * 1000,
    baseSuccessChance: 0.55,
    xpReward: 190,
    cashReward: [150, 300],
    resourceReward: { type: 'steel', amount: [5, 12] },
    recoveryMs: 2 * 60 * 60 * 1000,
    purpose: 'Steel for level 3',
    unlocks: 'Every level 3 upgrade needs 6 steel',
  },
  {
    id: 'high_value_target',
    name: 'High-Value Target',
    tier: 4,
    minLevel: 10,
    minStatAvg: 80,
    // Squad cap for later/bigger missions could go above 4 — start small,
    // raise it per-tier if a tier's design ever calls for a bigger squad.
    maxSquadSize: 4,
    durationMs: 4 * 60 * 60 * 1000,
    baseSuccessChance: 0.4,
    xpReward: 300,
    cashReward: [300, 600],
    resourceReward: { type: 'gems', amount: [1, 3] },
    recoveryMs: 4 * 60 * 60 * 1000,
    purpose: 'Rare gems',
    unlocks: 'Gems are saved for Promotion (not built yet)',
  },
];

// The first soldier's one-time introductory assignment (brief 08). It is
// Local Patrol for that soldier, once: shorter, solo, and a guaranteed
// return that the UI says is guaranteed (no displayed percentage is
// manipulated). It uses the ordinary dispatch/return/reward pipeline; the
// readiness target is the first soldier's accuracy at admission plus
// INTRO_READINESS_GAIN (GameState.chapter.targetAccuracy). Not listed in
// MISSION_TIERS, so the ladder and its formulas are unchanged.
// Accuracy points: 25 s of range time at 0.5/game-hour. Deliberately small:
// the range trains only 09:00-12:00 and 13:00-17:00 of a 5-minute day and
// walking eats game hours, so a new player gains ~1.5 points on day 1
// (measured headlessly, see CLAUDE_IMPLEMENTATION/08_FIRST_SOLDIER_MANIFEST.md).
// At +3 the first patrol slipped to ~12 minutes and the soldier collapsed
// overnight first. Placeholder pending a training-rate/schedule decision.
const INTRO_READINESS_GAIN = 1;
const INTRO_PATROL = {
  id: 'intro_patrol',
  name: 'Local Patrol',
  tier: 1,
  intro: true,
  guaranteed: true,
  minLevel: 1,
  minStatAvg: 0,
  maxSquadSize: 1,
  durationMs: 75 * 1000,
  baseSuccessChance: 1,
  xpReward: 60,
  cashReward: [70, 70],
  resourceReward: null,
  recoveryMs: 5 * 60 * 1000,
  purpose: 'Introductory patrol',
  unlocks: 'Pays toward the Mess Hall',
};

// Energy collapse (neglect) recovery. CLAUDE.md locks "neglect is never
// harsher than mission failure", so once failure recovery became per tier
// (5 min for Local Patrol) the old 23 h neglect stay had to come down too.
// Placeholder — matches the shortest mission recovery; needs playtesting.
const NEGLECT_RECOVERY_MS = 5 * 60 * 1000;

function missionTierById(id) {
  if (id === INTRO_PATROL.id) return INTRO_PATROL;
  return MISSION_TIERS.find(t => t.id === id) || null;
}

// Single blended number instead of separate per-stat thresholds — keeps
// the requirement easy to read/tune/explain, while still meaning a unit
// can't qualify on level alone: strength/accuracy/endurance only move via
// the training buildings (or slow level-up trickle), so this is what
// actually ties "went on a good mission" back to "trained first."
function unitStatAvg(unit) {
  return (unit.strength + unit.accuracy + unit.endurance) / 3;
}

function unitMeetsMissionRequirements(unit, tier) {
  return unit.level >= tier.minLevel && unitStatAvg(unit) >= tier.minStatAvg;
}

// Base tier chance, nudged by how far the squad's average stat exceeds the
// tier's minimum — training past the bare requirement actually helps.
function missionSuccessChance(tier, squad) {
  if (squad.length === 0) return 0;
  if (tier.guaranteed) return 1; // the introductory patrol, labelled as guaranteed in the UI
  const squadAvg = squad.reduce((sum, u) => sum + unitStatAvg(u), 0) / squad.length;
  const bonus = (squadAvg - tier.minStatAvg) * 0.005; // +0.5% per stat point above the minimum
  return clamp(tier.baseSuccessChance + bonus, 0.05, 0.95);
}

function rollInRange([min, max]) {
  return Math.round(randRange(min, max));
}
