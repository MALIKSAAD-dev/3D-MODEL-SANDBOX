// ─── Advanced Arena Engine v3 ───
// 40x30 compound with pathfinding, vision, trees, gardens, roads

export const COLS = 40;
export const ROWS = 30;

function buildArena() {
  const walls = new Set();
  const pillars = new Set();
  const trees = new Set();
  const gardens = new Set();
  const roads = new Set();
  const roomMeta = [];

  const addWall = (x, y) => { if (x >= 0 && x < COLS && y >= 0 && y < ROWS) walls.add(`${x},${y}`); };
  const rectBorder = (x1, y1, x2, y2) => {
    for (let x = x1; x <= x2; x++) { addWall(x, y1); addWall(x, y2); }
    for (let y = y1; y <= y2; y++) { addWall(x1, y); addWall(x2, y); }
  };
  const clearDoor = (x, y) => walls.delete(`${x},${y}`);
  const addPillar = (x, y) => { if (x >= 0 && x < COLS && y >= 0 && y < ROWS) { pillars.add(`${x},${y}`); walls.add(`${x},${y}`); } };
  const addTree = (x, y) => { if (x >= 0 && x < COLS && y >= 0 && y < ROWS) { trees.add(`${x},${y}`); walls.add(`${x},${y}`); } };
  const addGarden = (x, y) => { if (x >= 0 && x < COLS && y >= 0 && y < ROWS) gardens.add(`${x},${y}`); };
  const addRoad = (x, y) => { if (x >= 0 && x < COLS && y >= 0 && y < ROWS) roads.add(`${x},${y}`); };

  // ═══ OUTER BOUNDARY ═══
  for (let x = 0; x < COLS; x++) { addWall(x, 0); addWall(x, ROWS - 1); }
  for (let y = 0; y < ROWS; y++) { addWall(0, y); addWall(COLS - 1, y); }

  // ═══ ROOM 1: Barracks (top-left) ═══
  rectBorder(2, 2, 11, 8);
  clearDoor(7, 8); clearDoor(8, 8);
  clearDoor(11, 5); clearDoor(11, 6);
  addPillar(5, 5); addPillar(8, 5);
  roomMeta.push({ name: 'Barracks', type: 'rectangle', area: '(2,2)-(11,8)', doors: 'south(7-8,8) east(11,5-6)' });

  // ═══ ROOM 2: Armory (top-right) ═══
  rectBorder(28, 2, 37, 9);
  clearDoor(32, 9); clearDoor(33, 9);
  clearDoor(28, 5); clearDoor(28, 6);
  addPillar(31, 5); addPillar(34, 5); addPillar(31, 7); addPillar(34, 7);
  roomMeta.push({ name: 'Armory', type: 'square', area: '(28,2)-(37,9)', doors: 'south(32-33,9) west(28,5-6)' });

  // ═══ ROOM 3: Command Alpha (center-left, circular) ═══
  const c1x = 12, c1y = 16, c1r = 4;
  for (let y = c1y - c1r - 1; y <= c1y + c1r + 1; y++) {
    for (let x = c1x - c1r - 1; x <= c1x + c1r + 1; x++) {
      const dist = Math.sqrt((x - c1x) ** 2 + (y - c1y) ** 2);
      if (dist >= c1r - 0.3 && dist <= c1r + 0.7) addWall(x, y);
    }
  }
  clearDoor(c1x, c1y - c1r); clearDoor(c1x + 1, c1y - c1r);
  clearDoor(c1x, c1y + c1r); clearDoor(c1x + 1, c1y + c1r);
  clearDoor(c1x - c1r, c1y); clearDoor(c1x - c1r, c1y + 1);
  clearDoor(c1x + c1r, c1y); clearDoor(c1x + c1r, c1y + 1);
  addPillar(c1x - 1, c1y - 1); addPillar(c1x + 1, c1y + 1);
  roomMeta.push({ name: 'Command Alpha', type: 'circle', center: `(${c1x},${c1y})`, radius: c1r, doors: 'N,S,E,W' });

  // ═══ ROOM 4: Command Bravo (center-right, circular) ═══
  const c2x = 28, c2y = 17, c2r = 4;
  for (let y = c2y - c2r - 1; y <= c2y + c2r + 1; y++) {
    for (let x = c2x - c2r - 1; x <= c2x + c2r + 1; x++) {
      const dist = Math.sqrt((x - c2x) ** 2 + (y - c2y) ** 2);
      if (dist >= c2r - 0.3 && dist <= c2r + 0.7) addWall(x, y);
    }
  }
  clearDoor(c2x, c2y - c2r); clearDoor(c2x - 1, c2y - c2r);
  clearDoor(c2x, c2y + c2r); clearDoor(c2x - 1, c2y + c2r);
  clearDoor(c2x - c2r, c2y); clearDoor(c2x - c2r, c2y - 1);
  clearDoor(c2x + c2r, c2y); clearDoor(c2x + c2r, c2y - 1);
  addPillar(c2x + 1, c2y - 1); addPillar(c2x - 1, c2y + 1);
  roomMeta.push({ name: 'Command Bravo', type: 'circle', center: `(${c2x},${c2y})`, radius: c2r, doors: 'N,S,E,W' });

  // ═══ ROOM 5: Watchtower (top-center, triangle) ═══
  const tx = 20, ty = 2;
  for (let row = 0; row <= 6; row++) {
    const yy = ty + row;
    if (yy >= ROWS) break;
    const lx = tx - row, rx = tx + row;
    if (row === 0) addWall(tx, ty);
    else if (row === 6) { for (let x = Math.max(1, lx); x <= Math.min(COLS - 2, rx); x++) addWall(x, yy); }
    else { if (lx >= 1) addWall(lx, yy); if (rx < COLS - 1) addWall(rx, yy); }
  }
  clearDoor(tx, ty);
  clearDoor(tx, ty + 6); clearDoor(tx + 1, ty + 6); clearDoor(tx - 1, ty + 6);
  addPillar(tx, ty + 3);
  roomMeta.push({ name: 'Watchtower', type: 'triangle', apex: `(${tx},${ty})`, base_y: ty + 6, doors: 'apex, base' });

  // ═══ ROOM 6: Operations (bottom-right, L-shape) ═══
  rectBorder(30, 22, 37, 27);
  rectBorder(34, 17, 37, 22);
  clearDoor(34, 22); clearDoor(35, 22);
  clearDoor(30, 24); clearDoor(30, 25);
  clearDoor(35, 17); clearDoor(36, 17);
  addPillar(33, 24); addPillar(36, 20);
  roomMeta.push({ name: 'Operations', type: 'L-shape', area: '(30,22)-(37,27)+(34,17)-(37,22)', doors: 'west(30,24-25) north(35-36,17)' });

  // ═══ ROOM 7: Bunker (bottom-left) ═══
  rectBorder(2, 21, 10, 27);
  clearDoor(6, 21); clearDoor(7, 21);
  clearDoor(10, 24); clearDoor(10, 25);
  addPillar(5, 24); addPillar(8, 24);
  roomMeta.push({ name: 'Bunker', type: 'rectangle', area: '(2,21)-(10,27)', doors: 'north(6-7,21) east(10,24-25)' });

  // ═══ ROOM 8: Comms Tower (bottom-center, circular) ═══
  const c3x = 20, c3y = 24, c3r = 3;
  for (let y = c3y - c3r - 1; y <= c3y + c3r + 1; y++) {
    for (let x = c3x - c3r - 1; x <= c3x + c3r + 1; x++) {
      const dist = Math.sqrt((x - c3x) ** 2 + (y - c3y) ** 2);
      if (dist >= c3r - 0.3 && dist <= c3r + 0.7) addWall(x, y);
    }
  }
  clearDoor(c3x, c3y - c3r); clearDoor(c3x + 1, c3y - c3r);
  clearDoor(c3x - c3r, c3y);
  clearDoor(c3x + c3r, c3y);
  addPillar(c3x, c3y);
  roomMeta.push({ name: 'Comms Tower', type: 'circle', center: `(${c3x},${c3y})`, radius: c3r, doors: 'N,W,E' });

  // ═══ CORRIDORS ═══
  for (let x = 12; x <= 14; x++) { addWall(x, 4); addWall(x, 7); }
  clearDoor(12, 4); clearDoor(12, 7);
  for (let x = 25; x <= 27; x++) { addWall(x, 4); addWall(x, 7); }
  clearDoor(27, 4); clearDoor(27, 7);
  for (let y = 9; y <= 11; y++) { addWall(4, y); addWall(7, y); }
  clearDoor(4, 9); clearDoor(7, 9);
  for (let y = 20; y <= 21; y++) { addWall(5, y); addWall(8, y); }
  for (let y = 10; y <= 12; y++) { addWall(33, y); addWall(36, y); }
  clearDoor(33, 10); clearDoor(36, 10);
  for (let x = 17; x <= 23; x++) { addWall(x, 15); addWall(x, 18); }
  clearDoor(17, 15); clearDoor(17, 18); clearDoor(23, 15); clearDoor(23, 18);

  // Scattered cover walls
  [[15,10],[16,10],[22,10],[23,10],[18,22],[19,22],[22,22],[23,22],
   [10,14],[10,15],[11,14],[14,25],[15,25],[25,25],[26,25]].forEach(([x,y]) => addWall(x,y));

  // ═══ PILLARS (open field) ═══
  [[15,13],[25,13],[20,14],[20,19],[10,17],[30,15],[12,10],[28,10],
   [17,26],[23,26],[6,14],[34,14],[20,10],[15,20],[25,20]].forEach(([x,y]) => addPillar(x,y));

  // ═══ TREES ═══
  [[1,1],[1,10],[1,15],[1,20],[1,28],[38,1],[38,10],[38,15],[38,20],[38,28],
   [13,1],[27,1],[13,28],[27,28],[3,13],[9,13],[3,19],[9,19],
   [19,11],[21,11],[17,20],[23,20],[30,12],[37,12],[30,28],[37,28],
   [14,3],[26,3],[14,27],[26,27]].forEach(([x,y]) => addTree(x,y));

  // ═══ GARDENS (decorative, walkable) ═══
  for (let x = 5; x <= 8; x++) for (let y = 9; y <= 10; y++) addGarden(x, y);
  for (let x = 33; x <= 36; x++) for (let y = 9; y <= 10; y++) addGarden(x, y);
  for (let x = 16; x <= 18; x++) for (let y = 20; y <= 21; y++) addGarden(x, y);
  for (let x = 22; x <= 24; x++) for (let y = 20; y <= 21; y++) addGarden(x, y);

  // ═══ ROADS (walkable, visual only) ═══
  // Main horizontal road
  for (let x = 1; x <= 38; x++) { addRoad(x, 12); addRoad(x, 13); }
  // Main vertical road
  for (let y = 1; y <= 28; y++) { addRoad(20, y); addRoad(21, y); }
  // Cross roads
  for (let x = 1; x <= 38; x++) { addRoad(x, 20); }
  for (let y = 1; y <= 28; y++) { addRoad(10, y); addRoad(30, y); }

  return { walls, pillars, trees, gardens, roads, roomMeta };
}

const arena = buildArena();
export const initialWalls = arena.walls;
export const pillarSet = arena.pillars;
export const treeSet = arena.trees;
export const gardenSet = arena.gardens;
export const roadSet = arena.roads;
export const rooms = arena.roomMeta;

export function isValidCell(x, y) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS && !initialWalls.has(`${x},${y}`);
}

export function getAllValidCells() {
  const cells = [];
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if (isValidCell(x, y)) cells.push({ x, y });
  return cells;
}

// ─── BFS Pathfinding ───
export function findPath(from, to, maxSteps = 8) {
  if (!isValidCell(to.x, to.y)) return null;
  const key = (x, y) => `${x},${y}`;
  const queue = [{ x: from.x, y: from.y, path: [{ x: from.x, y: from.y }] }];
  const visited = new Set([key(from.x, from.y)]);
  const dirs = [[0,1],[0,-1],[1,0],[-1,0]];

  while (queue.length > 0) {
    const curr = queue.shift();
    if (curr.x === to.x && curr.y === to.y) return curr.path;
    if (curr.path.length > maxSteps + 1) continue; // limit search depth

    for (const [dx, dy] of dirs) {
      const nx = curr.x + dx, ny = curr.y + dy;
      const k = key(nx, ny);
      if (!visited.has(k) && isValidCell(nx, ny)) {
        visited.add(k);
        queue.push({ x: nx, y: ny, path: [...curr.path, { x: nx, y: ny }] });
      }
    }
  }
  return null; // no path found
}

// ─── BFS Reachability (guaranteed walkable cells within maxSteps) ───
export function getReachableBFS(pos, maxSteps = 8) {
  const key = (x, y) => `${x},${y}`;
  const queue = [{ x: pos.x, y: pos.y, dist: 0 }];
  const visited = new Map([[key(pos.x, pos.y), 0]]);
  const result = [];
  const dirs = [[0,1],[0,-1],[1,0],[-1,0]];

  while (queue.length > 0) {
    const curr = queue.shift();
    if (curr.dist > 0) result.push({ x: curr.x, y: curr.y, dist: curr.dist });
    if (curr.dist >= maxSteps) continue;
    for (const [dx, dy] of dirs) {
      const nx = curr.x + dx, ny = curr.y + dy;
      const k = key(nx, ny);
      if (!visited.has(k) && isValidCell(nx, ny)) {
        visited.set(k, curr.dist + 1);
        queue.push({ x: nx, y: ny, dist: curr.dist + 1 });
      }
    }
  }
  return result;
}

export function getNearbyCells(pos, radius = 6) {
  const cells = [];
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = pos.x + dx, ny = pos.y + dy;
      if (isValidCell(nx, ny) && (dx !== 0 || dy !== 0))
        cells.push({ x: nx, y: ny, dist: Math.abs(dx) + Math.abs(dy) });
    }
  return cells.sort((a, b) => a.dist - b.dist);
}

export function calculateDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function checkLineOfSight(pos1, pos2) {
  let x0 = pos1.x, y0 = pos1.y, x1 = pos2.x, y1 = pos2.y;
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    if (x0 === x1 && y0 === y1) return true;
    if (initialWalls.has(`${x0},${y0}`) && !(x0 === pos1.x && y0 === pos1.y)) return false;
    let e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

export function countAdjacentWalls(pos) {
  let c = 0;
  for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]])
    if (initialWalls.has(`${pos.x + dx},${pos.y + dy}`)) c++;
  return c;
}

export function getRoom(pos) {
  if (pos.x >= 3 && pos.x <= 10 && pos.y >= 3 && pos.y <= 7) return 'Barracks';
  if (pos.x >= 29 && pos.x <= 36 && pos.y >= 3 && pos.y <= 8) return 'Armory';
  if (Math.sqrt((pos.x - 12) ** 2 + (pos.y - 16) ** 2) < 3.5) return 'Command Alpha';
  if (Math.sqrt((pos.x - 28) ** 2 + (pos.y - 17) ** 2) < 3.5) return 'Command Bravo';
  if (Math.sqrt((pos.x - 20) ** 2 + (pos.y - 24) ** 2) < 2.5) return 'Comms Tower';
  if ((pos.x >= 31 && pos.x <= 36 && pos.y >= 23 && pos.y <= 26) || (pos.x >= 35 && pos.x <= 36 && pos.y >= 18 && pos.y <= 21)) return 'Operations';
  if (pos.x >= 3 && pos.x <= 9 && pos.y >= 22 && pos.y <= 26) return 'Bunker';
  if (pos.x >= 15 && pos.x <= 25 && pos.y >= 3 && pos.y <= 7) return 'Watchtower Area';
  return 'Open Field';
}

export function getMapContext(maxMoves = 8) {
  const rd = rooms.map(r => `  • ${r.name} (${r.type}): ${r.area || `center=${r.center},r=${r.radius}`} — doors: ${r.doors}`).join('\n');
  return `BUILDING LAYOUT (${COLS}×${ROWS} grid):
Military compound with ${rooms.length} rooms, corridors, trees, gardens, and roads.

ROOMS:
${rd}

ENVIRONMENT:
- Trees block movement and line of sight (scattered around perimeter and between buildings)
- Gardens are open walkable areas with vegetation (near corridors)
- Roads connect major zones (horizontal at y=12-13, y=20; vertical at x=10, x=20-21, x=30)
- Pillars block movement but provide cover


MOVEMENT: You can walk up to ${maxMoves} cells per turn along valid paths (no diagonal, no through walls).

STRATEGIC ZONES:
- TOP: Barracks(left), Watchtower(center), Armory(right)
- MID: Command Alpha(left), Command Bravo(right) — connected by central passage
- BOTTOM: Bunker(left), Comms Tower(center), Operations(right)
Coordinates: (0,0)=top-left, (${COLS-1},${ROWS-1})=bottom-right.`;
}
