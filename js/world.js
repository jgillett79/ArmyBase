// world.js — the authored first-base map and the geometry/routing API that
// simulation (state.js), rendering (render.js) and tests share.
//
// This replaces the old 20 x 12 grid, shared 3 x 2 building footprint and the
// roadYAt() "comb". The DESIGN.md target is a terrain-shaped base: build
// zones follow rock, water and cliff edges, and people walk an authored path
// graph. Everything below is hand-placed data from a reviewed layout (see
// tools/world-diagnostic.html) — nothing is randomly generated.
//
// Coordinate system: world pixels, origin top-left, independent of the
// 960 x 576 canvas. render.js maps world -> screen; nothing here knows about
// the camera.
//
// Scope note: construction is constrained to these authored zones. Arbitrary
// free placement would need general pathfinding around arbitrary obstacles,
// rotated art and a different save shape — deliberately out of scope.

const WORLD_ID = 'first_base_v1';
const WORLD_W = 1600;
const WORLD_H = 960;

// Minimum gaps the validator enforces (world px). Placeholder values chosen
// so footprints read as separate clearings; tune with the art pass.
const ZONE_CLEARANCE = 16;     // between two zone footprints
const TERRAIN_CLEARANCE = 16;  // between a footprint and water/cliff/rock
const PATH_CLEARANCE = 8;      // between a path centreline and terrain or a footprint

// Enclosed buildings need their door on the camera-facing (south) edge —
// the three-quarter art cannot show a north door, and a single bitmap must
// never be rotated to fake one. Open-air stations can be entered from the
// north, so only they may use zones south of the main trail.
const ENCLOSED_TYPES = ['entrance_hall', 'barracks', 'mess_hall', 'showers', 'rec_room', 'weight_room'];
const OUTDOOR_TYPES = ['shooting_range', 'obstacle_course', 'drill_yard'];

const WORLD = {
  id: WORLD_ID,
  width: WORLD_W,
  height: WORLD_H,

  // Terrain exclusions: nothing may be built on or walk through these.
  terrain: [
    { id: 'cliff_north', kind: 'cliff', polygon: [[0, 0], [1330, 0], [1300, 48], [1190, 72], [1050, 60], [910, 84], [770, 66], [630, 92], [490, 74], [350, 106], [230, 98], [130, 150], [64, 236], [0, 262]] },
    { id: 'rock_west', kind: 'rock', polygon: [[0, 705], [58, 694], [112, 742], [96, 828], [40, 852], [0, 860]] },
    { id: 'pond_southwest', kind: 'water', polygon: [[120, 860], [210, 830], [310, 845], [340, 900], [300, 950], [190, 955], [120, 920]] },
    { id: 'rock_knoll', kind: 'rock', polygon: [[822, 432], [864, 414], [906, 436], [900, 482], [852, 494], [816, 470]] },
    { id: 'river', kind: 'water', polygon: [[1330, 0], [1460, 0], [1482, 140], [1522, 300], [1522, 500], [1472, 660], [1372, 800], [1262, 900], [1202, 960], [1062, 960], [1122, 900], [1222, 820], [1322, 700], [1392, 560], [1420, 420], [1400, 262], [1352, 120]] },
    { id: 'far_bank', kind: 'cliff', polygon: [[1460, 0], [1600, 0], [1600, 960], [1202, 960], [1262, 900], [1372, 800], [1472, 660], [1522, 500], [1522, 300], [1482, 140]] },
  ],

  // Path graph nodes. gate_outside is off-map: visitors spawn and despawn there.
  nodes: {
    gate_outside: { x: -40, y: 610 },
    gate: { x: 40, y: 610 },          // checkpoint in the gap of the west fence
    gate_inside: { x: 120, y: 612 },
    aid_station: { x: 176, y: 688 },  // hospital fallback: where recovering soldiers wait
    t1: { x: 250, y: 615 },
    t2: { x: 430, y: 600 },
    t3: { x: 590, y: 575 },
    t4: { x: 760, y: 585 },
    t5: { x: 930, y: 610 },
    t6: { x: 1090, y: 590 },
    t7: { x: 1230, y: 540 },
    w1: { x: 440, y: 455 },
    n1: { x: 600, y: 420 },
    n2: { x: 740, y: 330 },
    n3: { x: 920, y: 300 },
    n4: { x: 1090, y: 330 },
    n5: { x: 1110, y: 460 },
  },

  // Trunk trail. `via` points bend the drawn and walked line identically.
  edges: [
    { from: 'gate_outside', to: 'gate' },
    { from: 'gate', to: 'gate_inside' },
    { from: 'gate_inside', to: 't1', via: [[186, 620]] },
    { from: 't1', to: 'aid_station' },
    { from: 't1', to: 't2', via: [[340, 614]] },
    { from: 't2', to: 't3', via: [[512, 594]] },
    { from: 't3', to: 't4', via: [[676, 574]] },
    { from: 't4', to: 't5', via: [[846, 604]] },
    { from: 't5', to: 't6', via: [[1010, 606]] },
    { from: 't6', to: 't7', via: [[1166, 574]] },
    { from: 't2', to: 'w1', via: [[426, 526]] },
    { from: 'w1', to: 'n1', via: [[520, 426]] },
    { from: 't3', to: 'n1', via: [[602, 498]] },
    { from: 'n1', to: 'n2', via: [[676, 366]] },
    { from: 'n2', to: 'n3', via: [[830, 306]] },
    { from: 'n3', to: 'n4', via: [[1004, 322]] },
    { from: 'n4', to: 'n5', via: [[1094, 396]] },
    { from: 'n5', to: 't6', via: [[1104, 526]] },
  ],

  // Named safe nodes for fallbacks (migration, stuck units, departures).
  safeNodes: { gate: 'gate_inside', waiting: 'door:zone_reception', hospital: 'aid_station' },

  // Build zones. `entrance` is just outside the footprint on its door side;
  // a spur edge from `accessNode` to the entrance joins the trail once the
  // zone has a building. `slots` are generic interaction anchors inside the
  // footprint — the building type decides what activity each one hosts
  // (brief 02). `surveyed` zones show a subtle marker from a fresh start.
  zones: [
    {
      id: 'zone_reception', label: 'Gate clearing', types: ['entrance_hall'], doorSide: 'south',
      orientations: ['three_quarter_south'], surveyed: true, accessNode: 't1',
      footprint: [[170, 420], [250, 402], [335, 414], [352, 478], [326, 534], [252, 548], [182, 536], [160, 478]],
      entrance: { x: 256, y: 562 },
      slots: [
        { id: 'wait_1', x: 206, y: 512, facing: 'down' },
        { id: 'wait_2', x: 236, y: 518, facing: 'down' },
        { id: 'wait_3', x: 276, y: 518, facing: 'down' },
        { id: 'wait_4', x: 306, y: 512, facing: 'down' },
      ],
    },
    {
      id: 'zone_west_rise', label: 'West rise', types: ENCLOSED_TYPES.filter(t => t !== 'entrance_hall').concat(OUTDOOR_TYPES),
      doorSide: 'south', orientations: ['three_quarter_south'], surveyed: true, accessNode: 'w1',
      footprint: [[290, 238], [382, 220], [472, 236], [498, 300], [474, 362], [384, 378], [302, 362], [276, 300]],
      entrance: { x: 392, y: 392 },
      slots: [
        { id: 's1', x: 340, y: 340, facing: 'down' }, { id: 's2', x: 380, y: 346, facing: 'down' },
        { id: 's3', x: 420, y: 346, facing: 'down' }, { id: 's4', x: 456, y: 336, facing: 'down' },
      ],
    },
    {
      id: 'zone_north_terrace', label: 'North terrace', types: ENCLOSED_TYPES.filter(t => t !== 'entrance_hall').concat(OUTDOOR_TYPES),
      doorSide: 'south', orientations: ['three_quarter_south'], surveyed: false, accessNode: 'n2',
      footprint: [[600, 150], [700, 128], [820, 132], [882, 166], [872, 236], [782, 258], [662, 252], [602, 214]],
      entrance: { x: 742, y: 272 },
      slots: [
        { id: 's1', x: 680, y: 224, facing: 'up' }, { id: 's2', x: 720, y: 228, facing: 'up' },
        { id: 's3', x: 764, y: 228, facing: 'up' }, { id: 's4', x: 806, y: 222, facing: 'up' },
      ],
    },
    {
      id: 'zone_centre_knoll', label: 'Centre knoll', types: ENCLOSED_TYPES.filter(t => t !== 'entrance_hall').concat(OUTDOOR_TYPES),
      doorSide: 'south', orientations: ['three_quarter_south'], surveyed: true, accessNode: 't4',
      footprint: [[640, 425], [700, 400], [770, 408], [790, 455], [768, 505], [700, 520], [642, 508], [622, 465]],
      entrance: { x: 705, y: 534 },
      slots: [
        { id: 's1', x: 668, y: 486, facing: 'down' }, { id: 's2', x: 696, y: 492, facing: 'down' },
        { id: 's3', x: 724, y: 492, facing: 'down' }, { id: 's4', x: 752, y: 484, facing: 'down' },
      ],
    },
    {
      id: 'zone_river_bend', label: 'River bend', types: ENCLOSED_TYPES.filter(t => t !== 'entrance_hall').concat(OUTDOOR_TYPES),
      doorSide: 'south', orientations: ['three_quarter_south'], surveyed: false, accessNode: 'n4',
      footprint: [[1000, 140], [1110, 112], [1232, 122], [1300, 172], [1290, 252], [1200, 286], [1070, 282], [1000, 232]],
      entrance: { x: 1110, y: 298 },
      slots: [
        { id: 's1', x: 1060, y: 250, facing: 'down' }, { id: 's2', x: 1110, y: 256, facing: 'down' },
        { id: 's3', x: 1160, y: 256, facing: 'down' }, { id: 's4', x: 1210, y: 250, facing: 'down' },
      ],
    },
    {
      id: 'zone_east_meadow', label: 'East meadow', types: ENCLOSED_TYPES.filter(t => t !== 'entrance_hall').concat(OUTDOOR_TYPES),
      doorSide: 'south', orientations: ['three_quarter_south'], surveyed: false, accessNode: 't7',
      footprint: [[1140, 360], [1240, 348], [1336, 372], [1362, 420], [1336, 468], [1246, 484], [1156, 474], [1126, 418]],
      entrance: { x: 1240, y: 498 },
      slots: [
        { id: 's1', x: 1190, y: 448, facing: 'down' }, { id: 's2', x: 1226, y: 454, facing: 'down' },
        { id: 's3', x: 1262, y: 454, facing: 'down' }, { id: 's4', x: 1298, y: 446, facing: 'down' },
      ],
    },
    {
      id: 'zone_south_green', label: 'South green', types: OUTDOOR_TYPES, doorSide: 'north',
      orientations: ['three_quarter_south'], surveyed: true, accessNode: 't3',
      footprint: [[560, 640], [670, 624], [780, 636], [806, 700], [780, 770], [672, 786], [566, 774], [540, 706]],
      entrance: { x: 672, y: 610 },
      slots: [
        { id: 's1', x: 610, y: 672, facing: 'up' }, { id: 's2', x: 650, y: 666, facing: 'up' },
        { id: 's3', x: 694, y: 666, facing: 'up' }, { id: 's4', x: 736, y: 672, facing: 'up' },
      ],
    },
    {
      id: 'zone_southwest_flats', label: 'Southwest flats', types: OUTDOOR_TYPES, doorSide: 'north',
      orientations: ['three_quarter_south'], surveyed: false, accessNode: 't2',
      footprint: [[300, 672], [400, 656], [500, 668], [520, 724], [498, 784], [400, 800], [312, 788], [284, 730]],
      entrance: { x: 410, y: 640 },
      slots: [
        { id: 's1', x: 340, y: 700, facing: 'up' }, { id: 's2', x: 380, y: 694, facing: 'up' },
        { id: 's3', x: 424, y: 694, facing: 'up' }, { id: 's4', x: 464, y: 700, facing: 'up' },
      ],
    },
    {
      id: 'zone_riverside', label: 'Riverside', types: OUTDOOR_TYPES, doorSide: 'north',
      orientations: ['three_quarter_south'], surveyed: false, accessNode: 't5',
      footprint: [[850, 662], [960, 646], [1070, 660], [1096, 716], [1070, 780], [962, 796], [856, 784], [826, 722]],
      entrance: { x: 962, y: 632 },
      slots: [
        { id: 's1', x: 900, y: 690, facing: 'up' }, { id: 's2', x: 940, y: 684, facing: 'up' },
        { id: 's3', x: 984, y: 684, facing: 'up' }, { id: 's4', x: 1026, y: 690, facing: 'up' },
      ],
    },
    {
      // Spare site: no default occupant. Lets a later build menu offer a
      // real choice of location for an open-air station.
      id: 'zone_ford', label: 'Ford', types: OUTDOOR_TYPES, doorSide: 'north',
      orientations: ['three_quarter_south'], surveyed: false, accessNode: 't7',
      footprint: [[1130, 650], [1200, 640], [1262, 660], [1270, 700], [1240, 745], [1180, 752], [1134, 738], [1116, 694]],
      entrance: { x: 1196, y: 624 },
      slots: [
        { id: 's1', x: 1160, y: 680, facing: 'up' }, { id: 's2', x: 1196, y: 676, facing: 'up' },
        { id: 's3', x: 1232, y: 680, facing: 'up' },
      ],
    },
  ],

  // Where each existing singleton building lives on a fresh base and after
  // migrating a v1 save. Building type/level stay on the building; only its
  // zoneId points here. Entrance Hall stays in the gate-side clearing (see
  // CLAUDE.md: newcomers should not walk across the whole base).
  defaultPlacements: {
    entrance_hall: 'zone_reception',
    barracks: 'zone_west_rise',
    shooting_range: 'zone_south_green',
    mess_hall: 'zone_centre_knoll',
    weight_room: 'zone_north_terrace',
    obstacle_course: 'zone_southwest_flats',
    drill_yard: 'zone_riverside',
    showers: 'zone_river_bend',
    rec_room: 'zone_east_meadow',
  },

  // Decorative fence lines along the open boundary; the single gap is the gate.
  fences: [
    [[4, 262], [8, 420], [6, 580]],
    [[6, 640], [8, 700]],
    [[330, 902], [520, 930], [760, 924], [980, 934], [1098, 914]],
  ],
};

// ---------------------------------------------------------------------------
// Geometry helpers (plain [x, y] arrays or {x, y} points).
// ---------------------------------------------------------------------------

function pt(p) { return Array.isArray(p) ? { x: p[0], y: p[1] } : p; }

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function segmentsIntersect(a, b, c, d) {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0)) && d1 !== 0 && d2 !== 0 && d3 !== 0 && d4 !== 0;
}

function segmentSegmentDistance(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    pointSegmentDistance(a[0], a[1], c[0], c[1], d[0], d[1]),
    pointSegmentDistance(b[0], b[1], c[0], c[1], d[0], d[1]),
    pointSegmentDistance(c[0], c[1], a[0], a[1], b[0], b[1]),
    pointSegmentDistance(d[0], d[1], a[0], a[1], b[0], b[1]));
}

function polygonEdges(polygon) {
  return polygon.map((p, i) => [p, polygon[(i + 1) % polygon.length]]);
}

// 0 when the polygons overlap or one contains the other.
function polygonDistance(a, b) {
  if (pointInPolygon(a[0][0], a[0][1], b) || pointInPolygon(b[0][0], b[0][1], a)) return 0;
  let best = Infinity;
  for (const [p, q] of polygonEdges(a)) {
    for (const [r, s] of polygonEdges(b)) best = Math.min(best, segmentSegmentDistance(p, q, r, s));
  }
  return best;
}

// 0 when the segment crosses into the polygon.
function segmentPolygonDistance(a, b, polygon) {
  if (pointInPolygon(a[0], a[1], polygon) || pointInPolygon(b[0], b[1], polygon)) return 0;
  let best = Infinity;
  for (const [p, q] of polygonEdges(polygon)) best = Math.min(best, segmentSegmentDistance(a, b, p, q));
  return best;
}

function pointPolygonDistance(x, y, polygon) {
  if (pointInPolygon(x, y, polygon)) return 0;
  let best = Infinity;
  for (const [p, q] of polygonEdges(polygon)) best = Math.min(best, pointSegmentDistance(x, y, p[0], p[1], q[0], q[1]));
  return best;
}

function polygonBounds(polygon) {
  const xs = polygon.map(p => p[0]), ys = polygon.map(p => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

function polygonCentroid(polygon) {
  const sum = polygon.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
  return { x: sum[0] / polygon.length, y: sum[1] / polygon.length };
}

// ---------------------------------------------------------------------------
// Zone lookups
// ---------------------------------------------------------------------------

function zoneById(zoneId, world = WORLD) {
  return world.zones.find(z => z.id === zoneId) || null;
}

function doorNodeId(zoneId) { return `door:${zoneId}`; }

function zoneAllowsType(zone, type) { return !!zone && zone.types.includes(type); }

// Position of any node, including the implicit door:<zoneId> nodes.
function worldNodePosition(nodeId, world = WORLD) {
  if (nodeId.startsWith('door:')) {
    const zone = zoneById(nodeId.slice(5), world);
    return zone ? { x: zone.entrance.x, y: zone.entrance.y } : null;
  }
  const node = world.nodes[nodeId];
  return node ? { x: node.x, y: node.y } : null;
}

// ---------------------------------------------------------------------------
// Path graph. Trunk edges are always walkable; each zone contributes a spur
// from its access node to its entrance. `zoneIds` limits which spurs are
// included (null = every zone, used by validation).
// ---------------------------------------------------------------------------

function worldEdgeList(zoneIds = null, world = WORLD) {
  const edges = world.edges.map(edge => ({ ...edge, kind: 'trail', zoneId: null }));
  for (const zone of world.zones) {
    if (zoneIds && !zoneIds.has(zone.id)) continue;
    edges.push({ from: zone.accessNode, to: doorNodeId(zone.id), via: zone.spurVia || [], kind: 'spur', zoneId: zone.id });
  }
  return edges.map(edge => {
    const points = [worldNodePosition(edge.from, world), ...(edge.via || []).map(pt), worldNodePosition(edge.to, world)];
    let length = 0;
    for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    return { ...edge, points, length };
  });
}

function buildAdjacency(edges) {
  const adjacency = new Map();
  const add = (a, b, edge, reversed) => {
    if (!adjacency.has(a)) adjacency.set(a, []);
    adjacency.get(a).push({ to: b, edge, reversed });
  };
  for (const edge of edges) {
    add(edge.from, edge.to, edge, false);
    add(edge.to, edge.from, edge, true);
  }
  return adjacency;
}

// Dijkstra from one or more weighted start nodes. Graph is ~30 nodes, so a
// linear scan for the next node is simpler than a heap and plenty fast.
function shortestNodePath(starts, goal, adjacency) {
  const dist = new Map(), prev = new Map(), done = new Set();
  for (const { node, cost } of starts) {
    if (!dist.has(node) || cost < dist.get(node)) { dist.set(node, cost); prev.set(node, null); }
  }
  for (;;) {
    let current = null, best = Infinity;
    for (const [node, d] of dist) if (!done.has(node) && d < best) { best = d; current = node; }
    if (current === null) return null;
    if (current === goal) break;
    done.add(current);
    for (const step of adjacency.get(current) || []) {
      const nd = best + step.edge.length;
      if (!dist.has(step.to) || nd < dist.get(step.to)) {
        dist.set(step.to, nd);
        prev.set(step.to, { node: current, step });
      }
    }
  }
  const steps = [];
  for (let node = goal; prev.get(node); node = prev.get(node).node) steps.unshift(prev.get(node).step);
  return { cost: dist.get(goal), steps };
}

// Closest point on any edge's polyline, with the along-edge distance to each
// endpoint so routing can start from wherever a unit currently stands.
function locateOnGraph(x, y, edges) {
  let best = null;
  for (const edge of edges) {
    let along = 0;
    for (let i = 1; i < edge.points.length; i++) {
      const a = edge.points[i - 1], b = edge.points[i];
      const segLength = Math.hypot(b.x - a.x, b.y - a.y);
      const t = segLength === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / (segLength * segLength)));
      const px = a.x + (b.x - a.x) * t, py = a.y + (b.y - a.y) * t;
      const d = Math.hypot(x - px, y - py);
      if (!best || d < best.distance) {
        best = { edge, distance: d, point: { x: px, y: py }, segmentIndex: i, alongFrom: along + segLength * t };
      }
      along += segLength;
    }
  }
  return best;
}

// Full walkable polyline from (x, y) to nodeId: join the nearest edge,
// follow the shortest graph route, finish at the node. Returns an array of
// {x, y} points (not including the start position) or null if unreachable.
function findWorldRoute(x, y, goalNodeId, zoneIds = null, world = WORLD) {
  const edges = worldEdgeList(zoneIds, world);
  const adjacency = buildAdjacency(edges);
  if (!adjacency.has(goalNodeId)) return null;
  const here = locateOnGraph(x, y, edges);
  if (!here) return null;
  const { edge } = here;
  const result = shortestNodePath([
    { node: edge.from, cost: here.alongFrom },
    { node: edge.to, cost: edge.length - here.alongFrom },
  ], goalNodeId, adjacency);
  if (!result) return null;

  const points = [];
  const push = p => {
    const last = points[points.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 0.5) points.push({ x: p.x, y: p.y });
  };
  push(here.point);
  // Walk along the joined edge's polyline to whichever endpoint the route uses.
  const firstNode = result.steps.length ? (result.steps[0].reversed ? result.steps[0].edge.to : result.steps[0].edge.from) : goalNodeId;
  if (firstNode === edge.to) {
    for (let i = here.segmentIndex; i < edge.points.length; i++) push(edge.points[i]);
  } else {
    for (let i = here.segmentIndex - 1; i >= 0; i--) push(edge.points[i]);
  }
  for (const step of result.steps) {
    const polyline = step.reversed ? step.edge.points.slice().reverse() : step.edge.points;
    polyline.forEach(push);
  }
  return points;
}

// A deterministic point along a trunk edge (fraction 0..1 of its length).
function pointAlongEdge(edge, fraction) {
  let remaining = edge.length * Math.max(0, Math.min(1, fraction));
  for (let i = 1; i < edge.points.length; i++) {
    const a = edge.points[i - 1], b = edge.points[i];
    const segLength = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= segLength || i === edge.points.length - 1) {
      const t = segLength === 0 ? 0 : Math.min(1, remaining / segLength);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= segLength;
  }
  return { ...edge.points[0] };
}

// The polyline from an edge's `from` node to the point at `fraction`,
// excluding the starting node — keeps a partial walk on the drawn path.
function edgePrefix(edge, fraction) {
  const end = pointAlongEdge(edge, fraction);
  const limit = edge.length * Math.max(0, Math.min(1, fraction));
  const points = [];
  let along = 0;
  for (let i = 1; i < edge.points.length - 1; i++) {
    along += Math.hypot(edge.points[i].x - edge.points[i - 1].x, edge.points[i].y - edge.points[i - 1].y);
    if (along >= limit) break;
    points.push({ ...edge.points[i] });
  }
  points.push(end);
  return points;
}

// Nearest trunk node to an arbitrary point (used for safe relocation).
function nearestTrunkNode(x, y, world = WORLD) {
  let best = null, bestDistance = Infinity;
  for (const [id, node] of Object.entries(world.nodes)) {
    if (id === 'gate_outside') continue;
    const d = Math.hypot(node.x - x, node.y - y);
    if (d < bestDistance) { best = id; bestDistance = d; }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Validation — shared by tests and the diagnostic page. Returns a list of
// human-readable problems; empty means the authored map is sound.
// ---------------------------------------------------------------------------

function validateWorld(world = WORLD) {
  const errors = [];
  const inWorld = (x, y) => x >= 0 && y >= 0 && x <= world.width && y <= world.height;
  const zoneIds = new Set();

  for (const zone of world.zones) {
    if (zoneIds.has(zone.id)) errors.push(`duplicate zone id ${zone.id}`);
    zoneIds.add(zone.id);
    if (zone.footprint.length < 3) errors.push(`${zone.id}: footprint needs 3+ points`);
    if (!zone.footprint.every(([x, y]) => inWorld(x, y))) errors.push(`${zone.id}: footprint leaves the world`);
    if (!world.nodes[zone.accessNode]) errors.push(`${zone.id}: unknown access node ${zone.accessNode}`);
    if (!zone.types.length) errors.push(`${zone.id}: no allowed building types`);
    if (zone.doorSide === 'north' && zone.types.some(t => !OUTDOOR_TYPES.includes(t))) {
      errors.push(`${zone.id}: a north-side entrance only suits open-air stations`);
    }
    const { entrance } = zone;
    if (pointInPolygon(entrance.x, entrance.y, zone.footprint)) errors.push(`${zone.id}: entrance inside its own footprint`);
    if (pointPolygonDistance(entrance.x, entrance.y, zone.footprint) > 24) errors.push(`${zone.id}: entrance is not at the footprint edge`);
    const slotIds = new Set();
    for (const slot of zone.slots) {
      if (slotIds.has(slot.id)) errors.push(`${zone.id}: duplicate slot ${slot.id}`);
      slotIds.add(slot.id);
      if (!pointInPolygon(slot.x, slot.y, zone.footprint)) errors.push(`${zone.id}: slot ${slot.id} outside footprint`);
    }
    for (const area of world.terrain) {
      const d = polygonDistance(zone.footprint, area.polygon);
      if (d < TERRAIN_CLEARANCE) errors.push(`${zone.id}: ${d === 0 ? 'overlaps' : 'too close to'} ${area.id} (${d.toFixed(1)}px)`);
      if (pointInPolygon(entrance.x, entrance.y, area.polygon)) errors.push(`${zone.id}: entrance inside ${area.id}`);
    }
  }

  for (let i = 0; i < world.zones.length; i++) {
    for (let j = i + 1; j < world.zones.length; j++) {
      const a = world.zones[i], b = world.zones[j];
      const d = polygonDistance(a.footprint, b.footprint);
      if (d < ZONE_CLEARANCE) errors.push(`${a.id} and ${b.id} ${d === 0 ? 'overlap' : 'are too close'} (${d.toFixed(1)}px)`);
      if (pointInPolygon(a.entrance.x, a.entrance.y, b.footprint)) errors.push(`${a.id}: entrance inside ${b.id}`);
    }
  }

  const edges = worldEdgeList(null, world);
  for (const edge of edges) {
    for (const id of [edge.from, edge.to]) if (!worldNodePosition(id, world)) errors.push(`edge references unknown node ${id}`);
    for (let k = 1; k < edge.points.length; k++) {
      const a = [edge.points[k - 1].x, edge.points[k - 1].y], b = [edge.points[k].x, edge.points[k].y];
      for (const area of world.terrain) {
        if (segmentPolygonDistance(a, b, area.polygon) < PATH_CLEARANCE) errors.push(`path ${edge.from}-${edge.to} crosses ${area.id}`);
      }
      for (const zone of world.zones) {
        if (segmentPolygonDistance(a, b, zone.footprint) < PATH_CLEARANCE) errors.push(`path ${edge.from}-${edge.to} crosses ${zone.id}`);
      }
    }
  }
  for (const [id, node] of Object.entries(world.nodes)) {
    for (const area of world.terrain) if (pointInPolygon(node.x, node.y, area.polygon)) errors.push(`node ${id} inside ${area.id}`);
  }

  // Reachability: every node and every zone entrance from the gate.
  const adjacency = buildAdjacency(edges);
  const seen = new Set(['gate_outside']);
  const queue = ['gate_outside'];
  while (queue.length) for (const step of adjacency.get(queue.shift()) || []) {
    if (!seen.has(step.to)) { seen.add(step.to); queue.push(step.to); }
  }
  for (const id of Object.keys(world.nodes)) if (!seen.has(id)) errors.push(`node ${id} unreachable from the gate`);
  for (const zone of world.zones) if (!seen.has(doorNodeId(zone.id))) errors.push(`${zone.id} unreachable from the gate`);
  for (const [role, id] of Object.entries(world.safeNodes)) if (!seen.has(id)) errors.push(`safe ${role} node ${id} unreachable`);

  // Placements: each default is legal, and no two buildings share a zone.
  const used = new Map();
  for (const [buildingType, zoneId] of Object.entries(world.defaultPlacements)) {
    const zone = zoneById(zoneId, world);
    if (!zone) errors.push(`default placement for ${buildingType} names unknown zone ${zoneId}`);
    else if (!zoneAllowsType(zone, buildingType)) errors.push(`${zoneId} does not allow ${buildingType}`);
    if (used.has(zoneId)) errors.push(`${zoneId} used by both ${used.get(zoneId)} and ${buildingType}`);
    used.set(zoneId, buildingType);
  }
  return errors;
}
