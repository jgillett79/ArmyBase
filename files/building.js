// building.js — Phase 0 only implements Barracks. Deliberately not
// generalised into a big "building types" registry yet — we don't know
// enough about how Mess Hall / Shooting Range / etc. actually function
// mechanically (see README "Open questions for Phase 1"), and guessing
// that structure now risks building the wrong abstraction.

const BARRACKS_MAX_LEVEL = 3;
const BARRACKS_CAP_PER_LEVEL = 5;
const BASE_UNIT_CAP = 5; // cap with zero barracks built

// Building IDs are fixed strings, not makeId()-random, on purpose: each of
// these is a singleton (there's only ever one Barracks/Range/Mess Hall), and
// GameState.load() reconstructs fresh building instances before restoring
// their saved levels. A random ID would change on every reload, silently
// orphaning any unit.assignedBuildingId reference saved from a prior session
// (found via smoke testing — occupancy counts went stale after reload).
class Barracks {
  constructor(gridX, gridY) {
    this.id = 'barracks';
    this.type = 'barracks';
    this.gridX = gridX;
    this.gridY = gridY;
    this.level = 0; // 0 = not built yet
  }

  get isBuilt() {
    return this.level > 0;
  }

  get isMaxLevel() {
    return this.level >= BARRACKS_MAX_LEVEL;
  }

  nextUpgradeCost() {
    // Simple escalating cost curve. Tune later against actual economy pacing.
    return 100 * Math.pow(2, this.level);
  }

  capContribution() {
    return this.level * BARRACKS_CAP_PER_LEVEL;
  }

  upgrade() {
    this.level += 1;
  }
}

// Footprint shared by every building for Phase 1 — 3x2 grid cells. Fine while
// there are three buildings; revisit if/when building variety grows (see README).
const BUILDING_FOOTPRINT_CELLS = { w: 3, h: 2 };

const SHOOTING_RANGE_MAX_LEVEL = 3;
const SHOOTING_RANGE_SLOTS_PER_LEVEL = 2;

class ShootingRange {
  constructor(gridX, gridY) {
    this.id = 'shooting_range'; // fixed ID — see Barracks comment above
    this.type = 'shooting_range';
    this.gridX = gridX;
    this.gridY = gridY;
    this.level = 0;
  }

  get isBuilt() { return this.level > 0; }
  get isMaxLevel() { return this.level >= SHOOTING_RANGE_MAX_LEVEL; }

  nextUpgradeCost() {
    return 80 * Math.pow(2, this.level);
  }

  get capacity() {
    return this.level * SHOOTING_RANGE_SLOTS_PER_LEVEL;
  }

  upgrade() { this.level += 1; }
}

// Mess Hall: deliberately NOT leveled in Phase 1 — built once, unlimited
// capacity. The needs loop (food purchase, energy) is complex enough on its
// own; adding a mess-hall-capacity constraint on top wasn't validated as
// necessary and can be added later if food logistics needs more friction.
class MessHall {
  constructor(gridX, gridY) {
    this.id = 'mess_hall'; // fixed ID — see Barracks comment above
    this.type = 'mess_hall';
    this.gridX = gridX;
    this.gridY = gridY;
    this.level = 0;
  }

  get isBuilt() { return this.level > 0; }

  buildCost() {
    return 120;
  }

  build() { this.level = 1; }
}
