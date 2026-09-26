// mission.js — mission tier data + the pure functions that read it.
// Missions are async/black-box by design (see CLAUDE.md): press a button,
// squad leaves, returns or doesn't, resolved by a stat-weighted percentage.
// No mini-game, no visualized travel. state.js owns dispatch/resolution
// (the stateful half); everything here is pure data + pure functions so the
// rules live in exactly one place.

// One difficulty ladder, tier gates rewards — not distinct mission "types."
// Every number below is an unbalanced placeholder, same caveat as the rest
// of this codebase's economy (recruit cost, cash trickle, etc.) — these
// exist to make the loop testable, not tuned.
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
  },
];

function missionTierById(id) {
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
  const squadAvg = squad.reduce((sum, u) => sum + unitStatAvg(u), 0) / squad.length;
  const bonus = (squadAvg - tier.minStatAvg) * 0.005; // +0.5% per stat point above the minimum
  return clamp(tier.baseSuccessChance + bonus, 0.05, 0.95);
}

function rollInRange([min, max]) {
  return Math.round(randRange(min, max));
}
