// Door-to-door walking time between every build zone, in game minutes at
// 38 world px/s (the middle of the 30-46 px/s walking range) on the brief 09
// 20-minute day. Used to choose the starter layout (09A manifest).
//   node tools/walk-matrix.cjs
const { loadGame } = require('../tests/lib/sandbox.cjs');
const g = loadGame();
const res = g.run(`(() => { const zs = WORLD.zones.map(z => z.id); const all = new Set(zs);
  const len = r => { let L = 0; for (let i = 1; i < r.length; i++) L += Math.hypot(r[i].x - r[i-1].x, r[i].y - r[i-1].y); return L; };
  return zs.map(a => { const za = zoneById(a); return [a, zs.map(b => Math.round(len(findWorldRoute(za.entrance.x, za.entrance.y, doorNodeId(b), all))))]; }); })()`);
const minutesPerPx = 1 / 38 / (60 * 1000 / g.run('GAME_MS_PER_REAL_MS') / 1000);
console.log('door-to-door game minutes at 38 px/s');
console.log(''.padEnd(22) + res.map(([z]) => z.slice(5, 10).padStart(6)).join(''));
for (const [a, row] of res) console.log(a.padEnd(22) + row.map(px => String(Math.round(px * minutesPerPx)).padStart(6)).join(''));
