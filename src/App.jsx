import React, { useEffect, useRef, useState } from 'react';
import { useGameStore, MODES, ALL_MODELS } from './store';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', background: '#222', padding: '10px', borderRadius: '5px', zIndex: 9999 }}>
          <h3>Analytics Crashed:</h3>
          <p style={{ fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'pre-wrap' }}>
            {this.state.error?.toString()}
          </p>
          <pre style={{ fontSize: '10px' }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children; 
  }
}

import { Scene } from './Scene';
import './index.css';

function DistanceGraph() {
  const canvasRef = useRef(null);
  const dh = useGameStore(s => s.distanceHistory);

  useEffect(() => {
    try {
      const c = canvasRef.current;
      const history = Array.isArray(dh) ? dh : [];
      if (!c || history.length < 2) return;
      const cwd = c.offsetWidth, chd = c.offsetHeight;
      if (cwd <= 0 || chd <= 0) return;

      c.width = cwd * 2; c.height = chd * 2;
      const ctx = c.getContext('2d');
      if (!ctx) return;

      ctx.scale(2, 2);
      ctx.clearRect(0, 0, cwd, chd);

      const validVals = history.filter(v => typeof v === 'number' && !isNaN(v));
      if (validVals.length < 2) return;

      let maxD = Math.max(...validVals);
      if (maxD <= 0 || !isFinite(maxD)) maxD = 1;
      const pad = 4;

      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.5;
      for (let i = 0; i < 5; i++) { 
        const y = pad + (i / 4) * (chd - pad * 2); 
        ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(cwd - pad, y); ctx.stroke(); 
      }

      const grad = ctx.createLinearGradient(0, 0, cwd, 0);
      grad.addColorStop(0, '#22d3ee'); grad.addColorStop(1, '#ef4444');
      ctx.strokeStyle = grad; ctx.lineWidth = 1.5; ctx.beginPath();

      history.forEach((d, i) => {
        const val = typeof d === 'number' ? d : 0;
        const x = pad + (i / Math.max(history.length - 1, 1)) * (cwd - pad * 2);
        const y = pad + (1 - val / maxD) * (chd - pad * 2);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }); 
      ctx.stroke();
    } catch (err) {
      console.error("DistanceGraph render error", err);
    }
  }, [dh]);
  
  return <div className="graph-container"><div className="graph-label">Distance Over Time</div><canvas ref={canvasRef} className="distance-canvas" /></div>;
}

function Scoreboard() {
  const sb = useGameStore(s => s.scoreboard);
  if (!sb) return null;
  const rounds = Array.isArray(sb.rounds) ? sb.rounds : [];
  if (rounds.length === 0 && !sb.hunterWins && !sb.preyWins && !sb.draws) return null;

  return (
    <div className="scoreboard-inner">
      <div className="score-row">
        <div className="score hunter-score"><span className="score-label">Hunters</span><span className="score-num">{sb.hunterWins || 0}</span></div>
        <div className="score-divider">vs</div>
        <div className="score prey-score"><span className="score-label">Prey</span><span className="score-num">{sb.preyWins || 0}</span></div>
        {(sb.draws > 0) ? <><div className="score-divider">|</div><div className="score"><span className="score-label">Draws</span><span className="score-num" style={{color:'#facc15'}}>{sb.draws}</span></div></> : null}
      </div>
    </div>
  );
}

function CollapseAlert() {
  const c = useGameStore(s => s.activeCollapse);
  if (!c) return null;
  return <div className="alert-overlay collapse-alert">💀 SPATIAL COLLAPSE — Turn {c.turn} — {c.label} tried {c.badCoord}</div>;
}

// ─── Mode Selector ───
function ModeSelector() {
  const { mode, setMode, hunterCount, preyCount, setHunterCount, setPreyCount } = useGameStore();
  const gs = useGameStore(s => s.gameState);
  const disabled = gs === 'running';
  const showCounts = mode === 'swarm' || mode === 'factions';

  return (
    <div className="mode-section">
      <div className="mode-tabs">
        {Object.entries(MODES).map(([key, m]) => (
          <button key={key} className={`mode-tab ${mode === key ? 'active' : ''}`}
            onClick={() => !disabled && setMode(key)} disabled={disabled}
            title={m.desc}>
            {m.label}
          </button>
        ))}
      </div>
      {showCounts && (
        <div className="agent-counts">
          <div className="count-control">
            <span className="count-label" style={{ color: '#f87171' }}>Hunters</span>
            <button className="count-btn" onClick={() => setHunterCount(hunterCount - 1)} disabled={disabled || hunterCount <= 1}>−</button>
            <span className="count-num">{hunterCount}</span>
            <button className="count-btn" onClick={() => setHunterCount(hunterCount + 1)} disabled={disabled || hunterCount >= 4}>+</button>
          </div>
          <div className="count-control">
            <span className="count-label" style={{ color: '#22d3ee' }}>Prey</span>
            <button className="count-btn" onClick={() => setPreyCount(preyCount - 1)} disabled={disabled || preyCount <= 1}>−</button>
            <span className="count-num">{preyCount}</span>
            <button className="count-btn" onClick={() => setPreyCount(preyCount + 1)} disabled={disabled || preyCount >= 4}>+</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Model Selector for multi-agent ───
function ModelAssignments() {
  const { mode, hunterCount, preyCount, hunterModels, preyModels, setHunterModel, setPreyModel } = useGameStore();
  const gs = useGameStore(s => s.gameState);
  const disabled = gs === 'running';
  const sn = id => id.split('/').pop().replace(/-instruct.*/, '').replace(/-versatile/, '');
  const hCount = mode === 'classic' ? 1 : hunterCount;
  const pCount = mode === 'classic' ? 1 : preyCount;
  const hLabel = 'Hunter';
  const pLabel = 'Prey';

  return (
    <div className="model-assignments">
      {Array.from({ length: hCount }).map((_, i) => (
        <div key={`h${i}`} className="model-slot">
          <span className="slot-label" style={{ color: '#f87171' }}>{hLabel}{hCount > 1 ? ` ${i + 1}` : ''}</span>
          <select className="glass-select-sm" value={hunterModels[i] || ALL_MODELS[0]}
            onChange={e => setHunterModel(i, e.target.value)} disabled={disabled}>
            {ALL_MODELS.map(m => <option key={m} value={m}>{sn(m)}</option>)}
          </select>
        </div>
      ))}
      {Array.from({ length: pCount }).map((_, i) => (
        <div key={`p${i}`} className="model-slot">
          <span className="slot-label" style={{ color: '#22d3ee' }}>{pLabel}{pCount > 1 ? ` ${i + 1}` : ''}</span>
          <select className="glass-select-sm" value={preyModels[i] || ALL_MODELS[0]}
            onChange={e => setPreyModel(i, e.target.value)} disabled={disabled}>
            {ALL_MODELS.map(m => <option key={m} value={m}>{sn(m)}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}

// ─── Agent Status Board ───
function AgentStatusBoard() {
  const agents = useGameStore(s => s.agents);
  const metrics = useGameStore(s => s.metrics);
  if (agents.length === 0) return null;
  const sn = id => id.split('/').pop().replace(/-instruct.*/, '').replace(/-versatile/, '').slice(0, 14);
  return (
    <div className="agent-status-board">
      {agents.map(a => {
        const m = metrics[a.id] || {};
        const acc = (m.validMoves || 0) + (m.invalidMoves || 0) > 0
          ? Math.round(((m.validMoves || 0) / ((m.validMoves || 0) + (m.invalidMoves || 0))) * 100) : 100;
        return (
          <div key={a.id} className={`agent-status ${a.alive ? '' : 'dead'}`}>
            <span className="agent-dot" style={{ background: a.alive ? (a.team === 'hunter' ? '#f87171' : a.team === 'prey' ? '#22d3ee' : '#facc15') : '#555' }}></span>
            <span className="agent-name">{a.label}</span>
            <span className="agent-model">{sn(a.model)}</span>
            <span className="agent-pos">({a.x},{a.y})</span>
            <span className="agent-acc" style={{ color: acc >= 90 ? '#4ade80' : '#f97316' }}>{acc}%</span>
            {!a.alive && <span className="agent-dead-tag">☠</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const { gameState, turn, apiKey, setApiKey, startGame, stopGame,
    fullscreen, toggleFullscreen, gameSpeed, setGameSpeed, maxTurns, setMaxTurns, maxMoves, setMaxMoves } = useGameStore();

  const [showLogs, setShowLogs] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showAgents, setShowAgents] = useState(false);

  const logs = useGameStore(s => s.logs);
  const logRef = useRef(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  const isRunning = gameState === 'running';
  const isFinished = gameState === 'hunter_wins' || gameState === 'prey_escapes';

  return (
    <div className={`app-container ${fullscreen ? 'fullscreen-mode' : ''}`}>
      <div className="canvas-wrapper"><Scene /></div>

      <CollapseAlert />

      <div className="ui-overlay">
        {!fullscreen && (
          <div className="glass-panel config-bar">
            <div className="logo-section">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              <h1>Agentic Sandbox</h1>
            </div>
            <div className="controls-row">
              <input type="password" placeholder="Groq API Key" value={apiKey} onChange={e => setApiKey(e.target.value)} className="glass-input" disabled={isRunning} />
              
              <div className="speed-control" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span className="count-label" style={{ color: '#aaa', minWidth: '40px' }}>Spd {gameSpeed}x</span>
                <input type="range" min="0.5" max="5.0" step="0.5" value={gameSpeed} onChange={e => setGameSpeed(parseFloat(e.target.value))} style={{ width: '55px', accentColor: '#60a5fa' }} />
              </div>

              <div style={{ display: 'flex', gap: '4px' }}>
                <input type="number" value={maxTurns} onChange={e => setMaxTurns(parseInt(e.target.value) || 100)} className="glass-input" style={{ width: '60px', textAlign: 'center' }} title="Max Turns" disabled={isRunning} />
                <span style={{ fontSize: '0.65rem', alignSelf: 'center', color: '#888' }}>Turns</span>
                <input type="number" value={maxMoves} onChange={e => setMaxMoves(parseInt(e.target.value) || 8)} className="glass-input" style={{ width: '50px', textAlign: 'center', marginLeft: '4px' }} title="Max Cells per Turn" disabled={isRunning} />
                <span style={{ fontSize: '0.65rem', alignSelf: 'center', color: '#888' }}>Dist</span>
              </div>

              {isRunning ? (
                <button className="btn stop" onClick={stopGame}>■ Stop</button>
              ) : (
                <button className="btn play" onClick={startGame} disabled={!apiKey}>▶ {isFinished ? 'Rematch' : 'Start'}</button>
              )}
            </div>
            <div className="status-section">
              <span className={`status-badge ${gameState}`}>
                {gameState === 'hunter_wins' ? '🔴 HUNTERS WIN' : gameState === 'prey_escapes' ? '🔵 PREY ESCAPES' :
                    gameState === 'running' ? `⚡ T${turn}/${maxTurns}` :
                      gameState === 'error' ? '⚠ ERROR' : '● READY'}
              </span>
            </div>
          </div>
        )}

        {!fullscreen && (
          <div className="glass-panel config-panel">
            <ModeSelector />
            <ModelAssignments />
          </div>
        )}

        <button className="fullscreen-btn glass-panel" onClick={toggleFullscreen}>
          {fullscreen ? '✕' : '⛶'}
        </button>

        {fullscreen && (
          <div className="fs-status glass-panel">
            <span className={`status-badge ${gameState}`}>
              {gameState === 'hunter_wins' ? '🔴 HUNTERS WIN' : gameState === 'prey_escapes' ? '🔵 PREY ESCAPES' :
                gameState === 'match_over' ? '🏆 MATCH OVER' : gameState === 'running' ? `⚡ TURN ${turn}/${maxTurns}` : '● READY'}
            </span>
          </div>
        )}

        {!fullscreen && (
          <div className="bottom-tabs">
            <button className={`tab-btn ${showAgents ? 'active' : ''}`} onClick={() => setShowAgents(!showAgents)}>👥 Agents {showAgents ? '▼' : '▲'}</button>
            <button className={`tab-btn ${showLogs ? 'active' : ''}`} onClick={() => setShowLogs(!showLogs)}>📋 Logs {showLogs ? '▼' : '▲'}</button>
            <button className={`tab-btn analytics-tab ${showAnalytics ? 'active' : ''}`} onClick={() => setShowAnalytics(!showAnalytics)}>📊 Analytics {showAnalytics ? '▼' : '▲'}</button>
          </div>
        )}

        {!fullscreen && (
          <div className="bottom-panels">
            {showAgents && (
              <div className="glass-panel bottom-panel agent-panel"><AgentStatusBoard /></div>
            )}
            {showLogs && (
              <div className="glass-panel bottom-panel log-panel-wide">
                <div className="log-scroll" ref={logRef}>
                  {logs.map(l => {
                    const isSystem = l.role === 'system';
                    return (
                      <div key={l.id} className={`log-entry ${isSystem ? 'system-log' : ''}`}>
                        <div className="log-turn">T{l.turn}</div>
                        <div className="log-action">{l.msg}</div>
                        {l.thought && <div className="log-thought">"{l.thought}"</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {showAnalytics && (
              <div className="glass-panel bottom-panel analytics-panel-bottom">
                <ErrorBoundary>
                  <DistanceGraph />
                </ErrorBoundary>
                <ErrorBoundary>
                  <Scoreboard />
                </ErrorBoundary>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
