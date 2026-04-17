import { COLS, ROWS, getMapContext, countAdjacentWalls, getRoom } from './engine';

export async function askAgent(apiKey, model, ctx, allValidCells, logs) {
  const { mode, agentId, label, role, team, pos, teammates, enemies, teamSize, turn, maxTurns, maxMoves, reachableSample } = ctx;

  const cover = countAdjacentWalls(pos);
  const room = getRoom(pos);
  const reachStr = (reachableSample || []).slice(0, 15).map(c => `(${c.x},${c.y})`).join(', ');

  let memory = '';
  const myLogs = logs.filter(l => l.role === agentId).slice(-4);
  if (myLogs.length > 0) memory += `\nRecent: ${myLogs.map(l => `T${l.turn}: ${l.msg}`).join(' → ')}`;

  let roleDesc;
  if (role === 'hunter') {
    roleDesc = `You are ${label} (HUNTER, team of ${teamSize}). Walk to prey's cell to catch them. Prey wins if they survive ${turn > 0 ? maxTurns - turn : maxTurns} more turns.`;
  } else {
    roleDesc = `You are ${label} (PREY, team of ${teamSize}). Survive ${maxTurns} turns. Avoid hunters.`;
  }

  let teamInfo = '';
  if (teammates.length > 0)
    teamInfo = `\nTEAMMATES:\n${teammates.map(t => `  • ${t.label} at (${t.x},${t.y}) in ${getRoom(t)}`).join('\n')}`;

  let enemyInfo = '';
  if (enemies.length > 0)
    enemyInfo = `\nENEMIES:\n${enemies.map(e => `  • ${e.label} at (${e.x},${e.y}) — dist ${Math.abs(pos.x - e.x) + Math.abs(pos.y - e.y)}`).join('\n')}`;
  else
    enemyInfo = `\nNo enemies remaining.`;

  const systemPrompt = `You are a tactical AI in a ${COLS}×${ROWS} military compound.

${getMapContext(maxMoves)}

${roleDesc}

MOVEMENT: Walk up to ${maxMoves} cells per turn along walkable paths (no diagonal, no through walls).
TARGET: Pick a cell from the reachable cells list. You MUST move every turn — staying at your current position is NOT allowed.
IMPORTANT: Always pick a different cell than your current position. Move strategically.

Respond JSON only: { "thought": "reasoning", "target_x": <int>, "target_y": <int> }`;

  const userPrompt = `=== TURN ${turn}/${maxTurns} ===
You: ${label} at (${pos.x},${pos.y}) in ${room} — cover: ${cover}
${teamInfo}${enemyInfo}${memory}

Reachable cells (within ${maxMoves} steps): ${reachStr}

Choose target. JSON only.`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      temperature: 0.85,
      ...(model.includes('llama-3') ? { response_format: { type: "json_object" } } : {})
    })
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message || data.error.type || JSON.stringify(data.error));
  if (!data.choices?.[0]) throw new Error('No response');

  const content = data.choices[0].message.content;
  try { return JSON.parse(content); } catch (e) {
    const m = content.match(/\{[\s\S]*"target_x"[\s\S]*\}/);
    if (m) try { return JSON.parse(m[0]); } catch (e2) {}
    const rand = allValidCells[Math.floor(Math.random() * allValidCells.length)];
    return { thought: "Parse error", target_x: rand.x, target_y: rand.y };
  }
}
