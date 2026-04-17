import { create } from 'zustand';
import { getAllValidCells, isValidCell, calculateDistance, findPath, getReachableBFS } from './engine';
import { askAgent } from './api';

const ALL_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen-3-32b',
];

function getSpawnPositions(count) {
  const allValid = getAllValidCells();
  const spawns = [];
  const zones = [
    { x: 6, y: 5 }, { x: 34, y: 24 }, { x: 6, y: 24 }, { x: 34, y: 5 },
    { x: 14, y: 16 }, { x: 30, y: 17 }, { x: 20, y: 5 }, { x: 20, y: 22 },
  ];
  for (let i = 0; i < count; i++) {
    const zone = zones[i % zones.length];
    const sorted = [...allValid].sort((a, b) =>
      (Math.abs(a.x - zone.x) + Math.abs(a.y - zone.y)) - (Math.abs(b.x - zone.x) + Math.abs(b.y - zone.y))
    );
    const pick = sorted.find(c => !spawns.some(s => s.x === c.x && s.y === c.y));
    if (pick) spawns.push({ x: pick.x, y: pick.y });
  }
  return spawns;
}

export const MODES = {
  classic: { label: 'Classic Hunt', desc: 'Hunter vs Prey' },
  swarm: { label: 'Swarm War', desc: 'Multiple Hunters vs Prey' },
  factions: { label: 'Factions', desc: 'Team vs Team' },
};

export const useGameStore = create((set, get) => ({
  gameState: 'idle',
  turn: 0,
  apiKey: '',
  setApiKey: (key) => set({ apiKey: key }),
  gameSpeed: 1,
  setGameSpeed: (s) => set({ gameSpeed: s }),
  maxTurns: 100,
  setMaxTurns: (n) => set({ maxTurns: Math.max(10, Math.min(500, n)) }),
  maxMoves: 8,
  setMaxMoves: (n) => set({ maxMoves: Math.max(1, Math.min(30, n)) }),
  fullscreen: false,
  toggleFullscreen: () => set(s => ({ fullscreen: !s.fullscreen })),
  mode: 'classic',
  setMode: (m) => set({ mode: m }),
  hunterCount: 1,
  preyCount: 1,
  setHunterCount: (n) => set({ hunterCount: Math.max(1, Math.min(4, n)) }),
  setPreyCount: (n) => set({ preyCount: Math.max(1, Math.min(4, n)) }),
  hunterModels: ['llama-3.3-70b-versatile'],
  preyModels: ['llama-3.3-70b-versatile'],
  setHunterModel: (idx, model) => set(s => { const m = [...s.hunterModels]; m[idx] = model; return { hunterModels: m }; }),
  setPreyModel: (idx, model) => set(s => { const m = [...s.preyModels]; m[idx] = model; return { preyModels: m }; }),

  agents: [],
  trails: {},
  walkingPaths: {}, // { agentId: [waypoints] } for walking animation
  walkingStep: 0, // current step in walking animation
  isWalking: false,
  collapseEvents: [],
  activeCollapse: null,
  scoreboard: { hunterWins: 0, preyWins: 0, draws: 0, rounds: [] },
  metrics: {},
  logs: [],
  addLog: (role, msg, thought = '') => set(s => ({
    logs: [...s.logs, { id: Date.now() + Math.random(), turn: s.turn, role, msg, thought }]
  })),

  startGame: () => {
    const s = get();
    const mode = s.mode;
    const hCount = mode === 'classic' ? 1 : s.hunterCount;
    const pCount = mode === 'classic' ? 1 : s.preyCount;
    const spawns = getSpawnPositions(hCount + pCount);
    const agents = [];
    const trails = {};
    const metrics = {};

    for (let i = 0; i < hCount; i++) {
      const id = `hunter_${i}`;
      const model = s.hunterModels[i] || s.hunterModels[0] || ALL_MODELS[0];
      const sp = spawns[i];
      agents.push({
        id, team: 'hunter', role: 'hunter',
        label: `Hunter ${i + 1}`,
        model, x: sp.x, y: sp.y, alive: true
      });
      trails[id] = [{ x: sp.x, y: sp.y }];
      metrics[id] = { validMoves: 0, invalidMoves: 0 };
    }
    for (let i = 0; i < pCount; i++) {
      const id = `prey_${i}`;
      const model = s.preyModels[i] || s.preyModels[0] || ALL_MODELS[0];
      const sp = spawns[hCount + i];
      agents.push({
        id, team: 'prey', role: 'prey',
        label: `Prey ${i + 1}`,
        model, x: sp.x, y: sp.y, alive: true
      });
      trails[id] = [{ x: sp.x, y: sp.y }];
      metrics[id] = { validMoves: 0, invalidMoves: 0 };
    }

    set({
      gameState: 'running', turn: 0,
      agents, trails, metrics, walkingPaths: {}, walkingStep: 0, isWalking: false,
      collapseEvents: [], activeCollapse: null, logs: []
    });
    get().runTurn();
  },

  stopGame: () => set({ gameState: 'idle' }),

  runTurn: async () => {
    const state = get();
    if (state.gameState !== 'running') return;
    const turnNum = state.turn + 1;
    set({ turn: turnNum, activeCollapse: null });

    const key = state.apiKey;
    const mode = state.mode;
    const allValid = getAllValidCells();
    const aliveAgents = state.agents.filter(a => a.alive);
    if (aliveAgents.length < 2) { set({ gameState: 'idle' }); return; }

    // Get actually reachable cells via BFS (guaranteed walkable paths)
    const getReachable = (pos) => getReachableBFS(pos, state.maxMoves);

    try {
      const promises = aliveAgents.map(agent => {
        const teammates = aliveAgents.filter(a => a.id !== agent.id && a.team === agent.team);
        const enemies = aliveAgents.filter(a => a.team !== agent.team);

        const reachable = getReachable({ x: agent.x, y: agent.y });

        return askAgent(key, agent.model, {
          mode, agentId: agent.id, label: agent.label, role: agent.role, team: agent.team,
          pos: { x: agent.x, y: agent.y },
          teammates: teammates.map(t => ({ id: t.id, label: t.label, x: t.x, y: t.y })),
          enemies: enemies.map(e => ({ id: e.id, label: e.label, x: e.x, y: e.y, team: e.team })),
          teamSize: teammates.length + 1, turn: turnNum,
          maxTurns: state.maxTurns,
          maxMoves: state.maxMoves,
          reachableSample: reachable.slice(0, 20),
        }, allValid, state.logs).catch(e => ({
          thought: 'API error: ' + String(e?.message || e),
          target_x: agent.x, target_y: agent.y, _error: true
        }));
      });

      const results = await Promise.all(promises);
      const newAgents = [...state.agents];
      const newTrails = { ...state.trails };
      const newMetrics = { ...state.metrics };
      const newPaths = {};
      let collapse = null;

      // Helper: move agent along a path
      const moveAgent = (agentIdx, agentId, path) => {
        const dest = path[path.length - 1];
        newAgents[agentIdx] = { ...newAgents[agentIdx], x: dest.x, y: dest.y };
        newTrails[agentId] = [...(newTrails[agentId] || []), ...path.slice(1)];
        newPaths[agentId] = path;
        return dest;
      };

      results.forEach((res, i) => {
        const agent = aliveAgents[i];
        const agentIdx = newAgents.findIndex(a => a.id === agent.id);
        if (agentIdx === -1) return;

        const tx = parseInt(res.target_x), ty = parseInt(res.target_y);
        const thought = res.thought || '';
        const reachable = getReachable({ x: agent.x, y: agent.y });

        // Check if agent is trying to stay in place
        const stayingInPlace = (tx === agent.x && ty === agent.y);

        if (!isNaN(tx) && !isNaN(ty) && isValidCell(tx, ty) && !stayingInPlace) {
          // Try direct path first
          const path = findPath({ x: agent.x, y: agent.y }, { x: tx, y: ty }, state.maxMoves);
          if (path && path.length > 1 && path.length <= state.maxMoves + 1) {
            const dest = moveAgent(agentIdx, agent.id, path);
            newMetrics[agent.id] = { ...(newMetrics[agent.id] || {}), validMoves: (newMetrics[agent.id]?.validMoves || 0) + 1 };
            get().addLog(agent.id, `${agent.label} walks to (${dest.x},${dest.y}) [${path.length - 1} steps]`, thought);
          } else {
            // Target too far or path blocked — try multiple nearby cells toward target
            const sorted = [...reachable].sort((a, b) =>
              calculateDistance(a, { x: tx, y: ty }) - calculateDistance(b, { x: tx, y: ty })
            );
            let moved = false;
            for (const candidate of sorted.slice(0, 8)) {
              const fallbackPath = findPath({ x: agent.x, y: agent.y }, candidate, state.maxMoves);
              if (fallbackPath && fallbackPath.length > 1 && fallbackPath.length <= state.maxMoves + 1) {
                const dest = moveAgent(agentIdx, agent.id, fallbackPath);
                newMetrics[agent.id] = { ...(newMetrics[agent.id] || {}), validMoves: (newMetrics[agent.id]?.validMoves || 0) + 1 };
                get().addLog(agent.id, `${agent.label} walks toward (${tx},${ty}) → reached (${dest.x},${dest.y})`, thought);
                moved = true;
                break;
              }
            }
            if (!moved) {
              // Last resort: pick any reachable cell
              const randomCell = reachable[Math.floor(Math.random() * Math.min(reachable.length, 10))];
              if (randomCell) {
                const rPath = findPath({ x: agent.x, y: agent.y }, randomCell, state.maxMoves);
                if (rPath && rPath.length > 1) {
                  const dest = moveAgent(agentIdx, agent.id, rPath);
                  get().addLog(agent.id, `${agent.label} moves to (${dest.x},${dest.y}) [fallback]`, thought);
                }
              }
              newMetrics[agent.id] = { ...(newMetrics[agent.id] || {}), validMoves: (newMetrics[agent.id]?.validMoves || 0) + 1 };
            }
          }
        } else if (stayingInPlace || (isNaN(tx) || isNaN(ty) || !isValidCell(tx, ty))) {
          // Agent tried to stay in place OR gave invalid coords — force movement
          if (reachable.length > 0) {
            // Pick a random reachable cell (prefer farther ones for variety)
            const options = reachable.filter(c => c.dist >= 3);
            const pick = options.length > 0
              ? options[Math.floor(Math.random() * options.length)]
              : reachable[Math.floor(Math.random() * reachable.length)];
            const forcedPath = findPath({ x: agent.x, y: agent.y }, pick, state.maxMoves);
            if (forcedPath && forcedPath.length > 1) {
              const dest = moveAgent(agentIdx, agent.id, forcedPath);
              get().addLog(agent.id, `${agent.label} forced move to (${dest.x},${dest.y})`, thought);
            }
          }
          if (!stayingInPlace) {
            newMetrics[agent.id] = { ...(newMetrics[agent.id] || {}), invalidMoves: (newMetrics[agent.id]?.invalidMoves || 0) + 1 };
            collapse = { role: agent.id, turn: turnNum, badCoord: `(${res.target_x},${res.target_y})`, label: agent.label };
            get().addLog(agent.id, `${agent.label} SPATIAL COLLAPSE → (${res.target_x},${res.target_y})`, thought);
          }
        }
      });

      // Check collisions
      const alive = newAgents.filter(a => a.alive);
      for (let i = 0; i < alive.length; i++) {
        for (let j = i + 1; j < alive.length; j++) {
          if (alive[i].x === alive[j].x && alive[i].y === alive[j].y && alive[i].team !== alive[j].team) {
            const hunter = alive[i].team === 'hunter' ? alive[i] : alive[j];
            const prey = alive[i].team === 'prey' ? alive[i] : alive[j];
            const preyIdx = newAgents.findIndex(a => a.id === prey.id);
            newAgents[preyIdx] = { ...newAgents[preyIdx], alive: false };
            get().addLog('system', `💀 ${hunter.label} CAUGHT ${prey.label}!`);
          }
        }
      }

      // Walking animation — set paths and animate
      set({
        agents: newAgents, trails: newTrails, metrics: newMetrics,
        walkingPaths: newPaths, walkingStep: 0, isWalking: true,
        activeCollapse: collapse,
        collapseEvents: collapse ? [...state.collapseEvents, collapse] : state.collapseEvents,
      });

      // Animate walking steps
      const speed = get().gameSpeed || 1;
      const maxSteps = Math.max(...Object.values(newPaths).map(p => p.length), 1);
      const walkDuration = (maxSteps * 250) / speed; // 250ms per step

      // Win check after walking
      setTimeout(() => {
        set({ isWalking: false });
        const s2 = get();
        const stillAlive = s2.agents.filter(a => a.alive);
        const alivePrey = stillAlive.filter(a => a.team === 'prey');

        if (alivePrey.length === 0) {
          get().addLog('system', '🔴 HUNTERS WIN!');
          set(st => ({ gameState: 'hunter_wins', scoreboard: { ...st.scoreboard, hunterWins: st.scoreboard.hunterWins + 1 } }));
          return;
        }
        if (turnNum >= s2.maxTurns) {
          get().addLog('system', '🔵 PREY ESCAPES!');
          set(st => ({ gameState: 'prey_escapes', scoreboard: { ...st.scoreboard, preyWins: st.scoreboard.preyWins + 1 } }));
          return;
        }

        setTimeout(() => get().runTurn(), 800 / speed);
      }, walkDuration);

    } catch (err) {
      get().addLog('system', `Error: ${err?.message || JSON.stringify(err)}`);
      set({ gameState: 'error' });
    }
  },
}));

export { ALL_MODELS };
