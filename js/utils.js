// utils.js — id generation, random helpers, name generator.
// Loaded first (see index.html script order) since every other file
// depends on these being global.

let _idCounter = 0;
function makeId(prefix) {
  _idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${_idCounter}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Float in [min, max).
function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// Integer in [min, max] inclusive.
function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Placeholder name pool — not final, just enough variety that recruited
// units don't all look identical in the roster.
const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Linda', 'Michael', 'Barbara',
  'David', 'Elizabeth', 'Carlos', 'Maria', 'Wei', 'Fatima', 'Ivan', 'Aisha',
  'Kenji', 'Sofia', 'Omar', 'Grace',
];
const LAST_NAMES = [
  'Smith', 'Johnson', 'Garcia', 'Chen', 'Kim', 'Patel', 'Novak', 'Diallo',
  'Rossi', 'Nguyen', 'Andersson', 'Silva', 'Muller', 'Okafor', 'Petrov',
];

function randomFullName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}
