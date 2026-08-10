// equipment.js — equipment catalog + pure helpers. Same shape as
// mission.js: pure data/functions only, no game state. state.js owns the
// armory (the stateful half — which items exist, which unit if any has
// each one equipped).
//
// Per the locked design (CLAUDE.md): equipment is a per-BASE inventory,
// not something a unit "owns" outright — a unit only ever holds a
// reference (an id) into GameState.armory, so the same items can later be
// shipped between Base 1 and Base 2 without needing to change hands
// between units first. consumable items (grenades) are used up the
// instant a mission carrying them is dispatched, regardless of whether
// that mission succeeds or fails — persistent items (rifles) stay
// equipped either way.
//
// Every number below is an unbalanced placeholder, same caveat as the
// rest of this codebase's economy — these exist to make the loop
// testable, not tuned.
const EQUIPMENT_CATALOG = {
  rifle: {
    name: 'Rifle',
    consumable: false,
    missionBonus: 0.05, // +5% mission success chance while equipped
  },
  grenade: {
    name: 'Grenade',
    consumable: true,
    missionBonus: 0.10, // +10%, but gone after the mission it's brought on
  },
};

function equipmentCatalogEntry(type) {
  return EQUIPMENT_CATALOG[type] || null;
}
