// Brief 09 station visual contract export.
//
//   node tools/station-contract.cjs [out.json] [--markdown out.md]
//
// Measures every station, queue line, perimeter anchor and parade-ground
// spot from the live data (routine.js geometry placed on world.js zones by
// daily.js) on the fresh-base layout, at every facility level. Prints
// tables in the contract's units:
//   world  — world px (1 world px = 1 screen px at zoom 1)
//   offset — world px from the facility's art anchor (footprint centre x,
//            footprint bottom − 6), the point the art's ground pivot sits on
//   px     — export pixels at 3 art px per world px, from that pivot
// Nothing here is typed by hand: re-run it after any geometry change.
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('../tests/lib/sandbox.cjs');

const args = process.argv.slice(2);
const mdIndex = args.indexOf('--markdown');
const mdOut = mdIndex >= 0 ? args[mdIndex + 1] : null;
const jsonOut = args.find((a, i) => !a.startsWith('--') && i !== mdIndex + 1);

const g = loadGame();
const data = g.run(`(() => {
  const s = new GameState();
  const r = v => Math.round(v * 10) / 10;
  const facilities = {};
  const levelsOf = { barracks: 3, showers: 3, mess_hall: 2, shooting_range: 3, weight_room: 3, obstacle_course: 3, drill_yard: 3, rec_room: 1 };
  for (const building of s.allBuildings) {
    if (!levelsOf[building.type]) continue;
    const zone = buildingZone(building);
    const anchor = s.zoneAnchor(zone);
    const original = building.level;
    building.level = levelsOf[building.type];
    s.stationCache = new Map(); s.queueSpotCache = new Map();
    const stations = s.stationsOf(building);
    const counts = {};
    for (let level = 1; level <= levelsOf[building.type]; level++) {
      building.level = level; s.stationCache = new Map();
      counts[level] = {};
      for (const st of s.stationsOf(building)) counts[level][st.type] = (counts[level][st.type] || 0) + 1;
    }
    building.level = levelsOf[building.type];
    s.stationCache = new Map();
    const pt = p => p ? { world: [r(p.x), r(p.y)], offset: [r(p.x - anchor.x), r(p.y - anchor.y)], px: [Math.round((p.x - anchor.x) * 3), Math.round((p.y - anchor.y) * 3)] } : null;
    const groups = [...new Set(stations.map(st => st.group))].filter(gr => Object.values(QUEUE_GROUP_OF).includes(gr));
    facilities[building.type] = {
      label: BUILDING_LABELS[building.type], zoneId: zone.id, kind: ASSET_MANIFEST.facilities[building.type].kind,
      fitScale: s.stationFitScale(building.type, zone), anchor: [r(anchor.x), r(anchor.y)],
      footprint: zone.footprint.map(([x, y]) => [r(x - anchor.x), r(y - anchor.y)]),
      footprintBounds: polygonBounds(zone.footprint), entrance: pt(zone.entrance),
      inside: STATION_GEOMETRY[building.type] ? pt(stations[0] && stations[0].inside) : null,
      aisle: pt(stations.find(st => st.aisle) && stations.find(st => st.aisle).aisle),
      counts,
      stations: stations.map(st => ({ id: st.id, type: st.type, activity: st.activity, facing: st.facing, index: st.index,
        firstLevel: Object.entries(counts).find(([, c]) => (c[st.type] || 0) > st.index)?.[0] * 1,
        use: pt(st), approach: pt(st.approach), contact: pt(st.contact), head: pt(st.head), feet: pt(st.feet), stall: pt(st.stall), cook: pt(st.cook),
        minutes: STATION_RULES[st.type].minutes || null, perHour: STATION_RULES[st.type].perHour || null, effect: STATION_RULES[st.type].effect || null,
        privacy: !!STATION_RULES[st.type].privacy })),
      queues: Object.fromEntries(groups.map(gr => [gr, s.queueSpots(building, gr).map(q => [r(q.x), r(q.y)])])),
    };
    building.level = original;
  }
  return {
    generated: '2026-10-01', worldId: WORLD.id, unitWorldHeight: ASSET_MANIFEST.unitWorldHeight, exportDensity: 3,
    dayLengthRealMinutes: DAY_LENGTH_REAL_MS / 60000, timetable: ROUTINE_TIMETABLE, graceMinutes: BOUNDARY_GRACE_MINUTES,
    stationRules: STATION_RULES, needs: ROUTINE_NEEDS, geometrySizes: { bed: STATION_GEOMETRY.barracks.bedSize, stall: STATION_GEOMETRY.showers.stallSize, tables: STATION_GEOMETRY.mess_hall.tables },
    perimeter: WORLD.perimeter, checkpoint: { kiosk: WORLD.checkpoint.kiosk, kioskPivot: WORLD.checkpoint.kioskPivot, boomHinge: WORLD.checkpoint.boomHinge },
    muster: WORLD.muster, outsideRoad: { x0: WORLD_X0, roadY: WORLD.perimeter.roadY, node: WORLD.nodes.road_west },
    facilities,
  };
})()`);

if (jsonOut) { fs.writeFileSync(jsonOut, JSON.stringify(data, null, 2)); console.log(`wrote ${jsonOut}`); }

// Markdown tables for the contract document.
const f = p => p ? `${p.world.join(', ')} · (${p.offset.join(', ')}) · [${p.px.join(', ')}]` : '—';
const lines = [];
for (const [type, fac] of Object.entries(data.facilities)) {
  lines.push(`### ${fac.label} (\`${type}\`, ${fac.kind}) on \`${fac.zoneId}\``, '');
  lines.push(`Anchor (art ground pivot) **(${fac.anchor.join(', ')})**, station fit scale ${fac.fitScale}. Entrance ${f(fac.entrance)}${fac.inside ? `; inside-door waypoint ${f(fac.inside)}` : ''}${fac.aisle ? `; aisle ${f(fac.aisle)}` : ''}.`);
  lines.push(`Stations per level: ${Object.entries(fac.counts).map(([l, c]) => `L${l} ${Object.entries(c).map(([t, n]) => `${n} ${t}`).join(' + ')}`).join('; ')}.`, '');
  lines.push('| Station | From level | Facing | Use (feet) | Approach | Contact | Extra | Use time / effect |', '|---|---|---|---|---|---|---|---|');
  for (const st of fac.stations) {
    const extra = [st.head && `head ${st.head.world.join(',')}`, st.feet && `feet ${st.feet.world.join(',')}`, st.stall && `stall centre ${st.stall.world.join(',')}`, st.cook && `cook ${st.cook.world.join(',')}`].filter(Boolean).join('; ') || '—';
    const timing = [st.minutes ? `${st.minutes} min` : 'whole window', st.effect && Object.entries(st.effect).map(([k, v]) => `+${v} ${k}`).join(' '), st.perHour && Object.entries(st.perHour).map(([k, v]) => `+${v} ${k}/h in use`).join(' '), st.privacy && 'privacy door'].filter(Boolean).join(', ');
    lines.push(`| \`${st.id.split(':')[1]}\` ${st.type} | ${st.firstLevel || 1} | ${st.facing} | ${f(st.use)} | ${f(st.approach)} | ${f(st.contact)} | ${extra} | ${timing} |`);
  }
  lines.push('', `Queue lines (world px, nearest first): ${Object.entries(fac.queues).map(([gname, spots]) => `**${gname}** ${spots.map(s => `(${s.join(', ')})`).join(' ')}`).join('; ')}.`, '');
}
const md = lines.join('\n');
if (mdOut) { fs.writeFileSync(mdOut, md); console.log(`wrote ${mdOut}`); } else console.log(md);
