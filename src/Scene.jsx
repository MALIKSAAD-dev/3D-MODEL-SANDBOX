import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Box, Sphere, Cylinder, Sparkles, Line, Cone, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Timer } from 'three/src/core/Timer.js';
import { useGameStore } from './store';
import { COLS, ROWS, initialWalls, pillarSet, treeSet, gardenSet, roadSet, isValidCell } from './engine';

const timer = new Timer();

const CS = 1;

const TEAM_COLORS = {
  hunter: ['#8b3a2a','#8b5a2a','#7a2a3a','#6b3a4a'],
  prey: ['#2a5a7b','#2a7b5a','#3a4a7b','#2a6b6b'],
  fighter: ['#8b3a2a','#2a5a7b','#7a5a2a','#3a7a5a','#6b2a5a','#2a6b4a'],
};
const GLOW_COLORS = {
  hunter: ['#ff6b4a','#ffaa4a','#ff4a6b','#ff4aaa'],
  prey: ['#4ac8ff','#4affc8','#6b4aff','#4affff'],
  fighter: ['#ff6b4a','#4ac8ff','#ffaa4a','#4affc8','#ff4aff','#4aff6b'],
};

// ─── Walking Soldier ───
function AgentSoldier({ agent, index }) {
  const meshRef = useRef();
  const walkRef = useRef({ step: 0, time: 0 });
  const walkingPaths = useGameStore(s => s.walkingPaths);
  const isWalking = useGameStore(s => s.isWalking);
  const gameSpeed = useGameStore(s => s.gameSpeed) || 1;
  const tc = TEAM_COLORS[agent.team] || TEAM_COLORS.fighter;
  const gc = GLOW_COLORS[agent.team] || GLOW_COLORS.fighter;
  const bodyColor = tc[index % tc.length];
  const glowColor = gc[index % gc.length];

  useFrame((state, delta) => {
    if (!meshRef.current || !agent.alive) return;
    const path = walkingPaths[agent.id];

    if (isWalking && path && path.length > 1) {
      // Animate along walking path (4.2 steps per second syncs with the 250ms/step logic duration + buffer)
      walkRef.current.time += delta * 4.2 * gameSpeed;
      const stepIdx = Math.min(Math.floor(walkRef.current.time), path.length - 1);
      const nextIdx = Math.min(stepIdx + 1, path.length - 1);
      const t = walkRef.current.time - stepIdx;
      const cx = path[stepIdx].x + (path[nextIdx].x - path[stepIdx].x) * Math.min(t, 1);
      const cz = path[stepIdx].y + (path[nextIdx].y - path[stepIdx].y) * Math.min(t, 1);
      meshRef.current.position.x = cx * CS;
      meshRef.current.position.z = cz * CS;
      // Walking bounce
      meshRef.current.position.y = Math.abs(Math.sin(walkRef.current.time * Math.PI)) * 0.06;
    } else {
      walkRef.current.time = 0;
      const tx = agent.x * CS, tz = agent.y * CS;
      meshRef.current.position.x += (tx - meshRef.current.position.x) * 5 * delta;
      meshRef.current.position.z += (tz - meshRef.current.position.z) * 5 * delta;
      meshRef.current.position.y = Math.sin(timer.getElapsed() * 1.5 + index) * 0.01;
    }
  });

  if (!agent.alive) return null;
  const S = 1.5;
  return (
    <group ref={meshRef} position={[agent.x * CS, 0, agent.y * CS]}>
      <group scale={[S, S, S]}>
        <Box position={[-0.1,0.08,0]} args={[0.14,0.16,0.2]} castShadow><meshStandardMaterial color="#1a1a1a" roughness={0.8}/></Box>
        <Box position={[0.1,0.08,0]} args={[0.14,0.16,0.2]} castShadow><meshStandardMaterial color="#1a1a1a" roughness={0.8}/></Box>
        <Cylinder position={[-0.1,0.32,0]} args={[0.06,0.07,0.3]} castShadow><meshStandardMaterial color={bodyColor} roughness={0.6}/></Cylinder>
        <Cylinder position={[0.1,0.32,0]} args={[0.06,0.07,0.3]} castShadow><meshStandardMaterial color={bodyColor} roughness={0.6}/></Cylinder>
        <Box position={[0,0.6,0]} args={[0.34,0.36,0.22]} castShadow><meshStandardMaterial color={bodyColor} roughness={0.5} metalness={0.1}/></Box>
        <Box position={[0,0.42,0]} args={[0.36,0.05,0.24]}><meshStandardMaterial color="#2a2a22" roughness={0.4} metalness={0.3}/></Box>
        <Cylinder position={[-0.24,0.58,0]} args={[0.05,0.06,0.3]} castShadow><meshStandardMaterial color={bodyColor} roughness={0.6}/></Cylinder>
        <Cylinder position={[0.24,0.58,0]} args={[0.05,0.06,0.3]} castShadow><meshStandardMaterial color={bodyColor} roughness={0.6}/></Cylinder>
        <Cylinder position={[0,0.8,0]} args={[0.06,0.07,0.06]}><meshStandardMaterial color={bodyColor} roughness={0.5}/></Cylinder>
        <Sphere position={[0,0.92,0]} args={[0.12,16,16]} castShadow><meshStandardMaterial color="#c4a882" roughness={0.4}/></Sphere>
        <Sphere position={[0,0.97,0]} args={[0.14,16,12,0,Math.PI*2,0,Math.PI/2]}><meshStandardMaterial color="#2a2a2a" roughness={0.3} metalness={0.4}/></Sphere>
        <Box position={[0,0.9,0.12]} args={[0.2,0.04,0.02]}><meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={2} toneMapped={false}/></Box>
      </group>
      <pointLight color={glowColor} intensity={3} distance={5} position={[0,0.3,0]}/>
      <Cylinder position={[0,2.5,0]} args={[0.02,0.02,3,6]}><meshBasicMaterial color={glowColor} transparent opacity={0.2}/></Cylinder>
      <pointLight color={glowColor} intensity={1} distance={6} position={[0,4,0]}/>
      <Html position={[0, 4.2, 0]} center distanceFactor={18} zIndexRange={[10, 0]}>
        <div style={{
          color: agent.team === 'hunter' ? '#ff6b4a' : agent.team === 'prey' ? '#4ac8ff' : '#facc15',
          fontSize: '13px',
          fontWeight: 700,
          fontFamily: 'Inter, system-ui, sans-serif',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          textShadow: '0 0 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.6)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
          background: 'rgba(0,0,0,0.45)',
          padding: '2px 8px',
          borderRadius: '4px',
          border: `1px solid ${agent.team === 'hunter' ? 'rgba(255,107,74,0.3)' : agent.team === 'prey' ? 'rgba(74,200,255,0.3)' : 'rgba(250,204,21,0.3)'}`,
        }}>
          {agent.label}
        </div>
      </Html>
    </group>
  );
}

// ─── Tree ───
function Tree({ x, y }) {
  const h = useMemo(() => 0.8 + Math.random() * 0.4, []);
  return (
    <group position={[x * CS, 0, y * CS]}>
      <Cylinder position={[0, h/2, 0]} args={[0.06, 0.1, h, 6]} castShadow>
        <meshStandardMaterial color="#5a3a20" roughness={0.8}/>
      </Cylinder>
      <Sphere position={[0, h+0.25, 0]} args={[0.35, 8, 8]} castShadow>
        <meshStandardMaterial color="#2d5a1e" roughness={0.7}/>
      </Sphere>
      <Sphere position={[0.15, h+0.1, 0.1]} args={[0.22, 8, 8]}>
        <meshStandardMaterial color="#3a6b28" roughness={0.7}/>
      </Sphere>
      <Sphere position={[-0.1, h+0.15, -0.1]} args={[0.25, 8, 8]}>
        <meshStandardMaterial color="#264d18" roughness={0.7}/>
      </Sphere>
    </group>
  );
}

// ─── Wall (building-like) ───
function Wall({ x, y }) {
  return (
    <group position={[x * CS, 0, y * CS]}>
      <Box position={[0, 0.55, 0]} args={[CS*0.94, 1.1, CS*0.94]} castShadow receiveShadow>
        <meshStandardMaterial color="#7a7568" roughness={0.5} metalness={0.1}/>
      </Box>
      {/* Window detail */}
      <Box position={[0, 0.7, CS*0.48]} args={[0.2, 0.15, 0.02]}>
        <meshStandardMaterial color="#3a4555" roughness={0.3} metalness={0.5}/>
      </Box>
      {/* Top trim */}
      <Box position={[0, 1.1, 0]} args={[CS*0.97, 0.04, CS*0.97]}>
        <meshStandardMaterial color="#8a8478" roughness={0.4} metalness={0.2}/>
      </Box>
    </group>
  );
}

// ─── Pillar ───
function Pillar({ x, y }) {
  return (
    <group position={[x * CS, 0, y * CS]}>
      <Cylinder position={[0,0.05,0]} args={[0.3,0.35,0.1,8]}><meshStandardMaterial color="#8a8578" roughness={0.5} metalness={0.2}/></Cylinder>
      <Cylinder position={[0,0.8,0]} args={[0.18,0.2,1.5,8]} castShadow><meshStandardMaterial color="#9a9488" roughness={0.4} metalness={0.15}/></Cylinder>
      <Cylinder position={[0,1.6,0]} args={[0.3,0.18,0.12,8]}><meshStandardMaterial color="#8a8578" roughness={0.5} metalness={0.2}/></Cylinder>
    </group>
  );
}

// ─── Floor ───
function FloorTile({ x, y }) {
  const isRoad = roadSet.has(`${x},${y}`);
  const isGarden = gardenSet.has(`${x},${y}`);

  let color;
  if (isRoad) {
    color = (x + y) % 2 === 0 ? '#6b6860' : '#605d55';
  } else if (isGarden) {
    color = (x + y) % 2 === 0 ? '#4a6b3a' : '#3d5e30';
  } else if (x >= 3 && x <= 10 && y >= 3 && y <= 7) {
    color = (x+y)%2===0 ? '#c4b8a0' : '#b8ac94';
  } else if (x >= 29 && x <= 36 && y >= 3 && y <= 8) {
    color = (x+y)%2===0 ? '#a0b4c4' : '#94a8b8';
  } else if (Math.sqrt((x-12)**2+(y-16)**2)<3.5) {
    color = (x+y)%2===0 ? '#c4c0b0' : '#b8b4a4';
  } else if (Math.sqrt((x-28)**2+(y-17)**2)<3.5) {
    color = (x+y)%2===0 ? '#c0b0c4' : '#b4a4b8';
  } else if (Math.sqrt((x-20)**2+(y-24)**2)<2.5) {
    color = (x+y)%2===0 ? '#b8c4b0' : '#acb8a4';
  } else if ((x>=31&&x<=36&&y>=23&&y<=26)||(x>=35&&x<=36&&y>=18&&y<=21)) {
    color = (x+y)%2===0 ? '#b0c4a0' : '#a4b894';
  } else if (x>=3&&x<=9&&y>=22&&y<=26) {
    color = (x+y)%2===0 ? '#c4b0a0' : '#b8a494';
  } else {
    color = (x+y)%2===0 ? '#d0ccc2' : '#c4c0b6';
  }

  const hasWeed = useMemo(() => isGarden && Math.random() > 0.6, [isGarden]);
  const weedPos = useMemo(() => [(Math.random()-0.5)*0.4, 0.04, (Math.random()-0.5)*0.4], []);

  return (
    <group position={[x*CS, 0, y*CS]}>
      <Box position={[0,-0.06,0]} args={[CS*0.97,0.12,CS*0.97]} receiveShadow>
        <meshStandardMaterial color={color} roughness={isRoad?0.6:0.75} metalness={isRoad?0.05:0.02}/>
      </Box>
      {isRoad && (
        <Box position={[0,-0.005,0]} args={[0.06,0.01,CS*0.8]}>
          <meshStandardMaterial color="#8a8575" roughness={0.5}/>
        </Box>
      )}
      {hasWeed && (
        <Cylinder position={weedPos} args={[0.01,0.02,0.08,4]}>
          <meshStandardMaterial color="#4a7a30" roughness={0.8}/>
        </Cylinder>
      )}
    </group>
  );
}

function GroundAndFloor() {
  const tiles = useMemo(() => {
    const arr = [];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (!initialWalls.has(`${x},${y}`)) arr.push({ x, y });
    return arr;
  }, []);
  return (
    <group>
      <mesh position={[COLS/2-0.5,-0.2,ROWS/2-0.5]} rotation={[-Math.PI/2,0,0]} receiveShadow>
        <planeGeometry args={[COLS+6,ROWS+6]}/>
        <meshStandardMaterial color="#2a2822" roughness={0.95}/>
      </mesh>
      {tiles.map((t,i) => <FloorTile key={i} x={t.x} y={t.y}/>)}
    </group>
  );
}

function CollapseFlash() {
  const collapse = useGameStore(s => s.activeCollapse);
  const ref = useRef();
  useFrame(() => { if (ref.current && collapse) ref.current.material.opacity = Math.sin(timer.getElapsed()*12)*0.15+0.15; });
  if (!collapse) return null;
  return <mesh ref={ref} position={[COLS/2,1,ROWS/2]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[COLS+4,ROWS+4]}/><meshBasicMaterial color="#ff0000" transparent opacity={0.15} side={THREE.DoubleSide}/></mesh>;
}

function AgentTrail({ agentId, color }) {
  const trail = useGameStore(s => s.trails[agentId]);
  if (!trail || trail.length < 2) return null;
  const pts = trail.slice(-30).map(p => [p.x*CS,0.02,p.y*CS]);
  return <Line points={pts} color={color} lineWidth={1.5} opacity={0.3} transparent/>;
}

function ArenaBorder() {
  const h=0.5, t=0.25, w=COLS*CS, d=ROWS*CS;
  const cx=w/2-0.5, cz=d/2-0.5;
  const mat = <meshStandardMaterial color="#4a4842" roughness={0.5} metalness={0.2}/>;
  return (
    <group>
      <Box position={[cx,h/2,-0.5-t/2]} args={[w+t*2,h,t]}>{mat}</Box>
      <Box position={[cx,h/2,d-0.5+t/2]} args={[w+t*2,h,t]}>{mat}</Box>
      <Box position={[-0.5-t/2,h/2,cz]} args={[t,h,d+t*2]}>{mat}</Box>
      <Box position={[w-0.5+t/2,h/2,cz]} args={[t,h,d+t*2]}>{mat}</Box>
    </group>
  );
}

function TimerUpdater() {
  useFrame(() => { timer.update(); });
  return null;
}

export function Scene() {
  const agents = useGameStore(s => s.agents);
  const wallsArr = useMemo(() => Array.from(initialWalls).filter(w => !pillarSet.has(w) && !treeSet.has(w)).map(w => { const [x,y] = w.split(',').map(Number); return {x,y}; }), []);
  const pillarsArr = useMemo(() => Array.from(pillarSet).map(p => { const [x,y] = p.split(',').map(Number); return {x,y}; }), []);
  const treesArr = useMemo(() => Array.from(treeSet).map(p => { const [x,y] = p.split(',').map(Number); return {x,y}; }), []);

  return (
    <Canvas shadows={{ type: THREE.PCFShadowMap }} camera={{ position: [COLS/2, 30, ROWS+16], fov: 38 }}
      style={{ background: 'linear-gradient(180deg, #1a2030 0%, #0a0f18 100%)', width: '100%', height: '100%' }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}>
      <TimerUpdater />
      <fog attach="fog" args={['#0a0f18', 35, 65]}/>
      <directionalLight position={[COLS/2,40,ROWS/3]} intensity={1.8} color="#fff5e6"
        castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-far={90} shadow-camera-left={-25} shadow-camera-right={25}
        shadow-camera-top={25} shadow-camera-bottom={-25}/>
      <directionalLight position={[-10,18,ROWS/2]} intensity={0.3} color="#b0c4de"/>
      <ambientLight intensity={0.25} color="#e8e4dc"/>
      <pointLight position={[5,6,5]} intensity={0.4} color="#ffd6a0" distance={18}/>
      <pointLight position={[35,6,5]} intensity={0.4} color="#a0c8ff" distance={18}/>
      <pointLight position={[20,6,15]} intensity={0.5} color="#fff0d4" distance={20}/>
      <pointLight position={[35,6,24]} intensity={0.4} color="#a8e0a0" distance={18}/>
      <pointLight position={[5,6,24]} intensity={0.4} color="#d4c0a0" distance={18}/>
      <Sparkles count={80} scale={[COLS+4,10,ROWS+4]} position={[COLS/2,5,ROWS/2]}
        size={0.6} speed={0.08} opacity={0.03} color="#fff5e6"/>
      <GroundAndFloor/>
      <ArenaBorder/>
      {wallsArr.map((w,i) => <Wall key={`w${i}`} x={w.x} y={w.y}/>)}
      {pillarsArr.map((p,i) => <Pillar key={`p${i}`} x={p.x} y={p.y}/>)}
      {treesArr.map((t,i) => <Tree key={`t${i}`} x={t.x} y={t.y}/>)}
      {agents.map((a,i) => <AgentTrail key={`tr_${a.id}`} agentId={a.id} color={(GLOW_COLORS[a.team]||GLOW_COLORS.fighter)[i%4]}/>)}
      <CollapseFlash/>
      {agents.map((a,i) => <AgentSoldier key={a.id} agent={a} index={i}/>)}
      <OrbitControls target={[COLS/2-0.5,0,ROWS/2-0.5]}
        maxPolarAngle={Math.PI/2.1} minDistance={12} maxDistance={55}
        enableDamping dampingFactor={0.05}/>
    </Canvas>
  );
}
