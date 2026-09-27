const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || '1337';
const STATE_FILE = path.join(__dirname, 'gamestate_store.json');

// Initial default clues for groups (Clean, no emojis)
const DEFAULT_CLUES = {
  1: "Where shadows gather near the highest wall, search beneath the cold stone to unearth your relic piece.",
  2: "Follow the silent corridor toward the mirrored hall. Look where stillness meets forgotten wood.",
  3: "In the chamber of silent tomes, seek beneath the lowermost shelf to recover your squad's crest.",
  4: "Near the threshold where dusk breaks, examine the base of the sentinel pillar.",
  5: "Where two secret pathways converge, the relic shard rests hidden in plain sight.",
  6: "Look where the royal tapestry hangs. The secret passage conceals the hidden token."
};

// Initial Game State
function getInitialState() {
  return {
    currentRound: "0", // "0" (Lobby), "trial", "1", "2", "3", "4"
    phase: "idle",     // "idle", "voting", "voting_revealed", "night", "dilemma", "dilemma_revealed", "ended"
    winnerId: null,
    winnerTeam: null,  // "Traitor" | "Faithful"
    players: [],
    clues: { ...DEFAULT_CLUES },
    relicsFound: {},   // { "1": true, "2": true }
    timer: {
      active: false,
      duration: 0,
      startedAt: null,
      remaining: 0,
      label: ""
    },
    voting: {
      active: false,
      revealed: false,
      votes: {},       // { [voterId]: suspectId }
      tally: {},       // { [suspectId]: count }
      banishedId: null
    },
    night: {
      active: false,
      murderVotes: {}, // { [traitorId]: targetId }
      murderTarget: null,
      chat: []
    },
    dilemma: {
      active: false,
      revealed: false,
      choices: {},     // { [playerId]: "trust" | "betray" }
      pairs: []
    },
    soundTrigger: null
  };
}

let gameState = getInitialState();

// Persisted state loader
try {
  if (fs.existsSync(STATE_FILE)) {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    gameState = Object.assign(getInitialState(), JSON.parse(raw));
  }
} catch (e) {
  console.warn("Could not load previous state:", e.message);
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(gameState, null, 2));
  } catch (e) {
    console.error("Failed to persist state:", e.message);
  }
}

let sseClients = new Set();

function broadcastState(customSound = null) {
  if (customSound) {
    gameState.soundTrigger = { sound: customSound, nonce: Date.now() };
  } else {
    gameState.soundTrigger = null;
  }

  saveState();

  const data = `data: ${JSON.stringify(gameState)}\n\n`;
  for (const client of sseClients) {
    try {
      client.res.write(data);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

// Timer tick engine
setInterval(() => {
  if (gameState.timer.active && gameState.timer.startedAt) {
    const elapsed = Math.floor((Date.now() - gameState.timer.startedAt) / 1000);
    const remaining = Math.max(0, gameState.timer.duration - elapsed);
    gameState.timer.remaining = remaining;

    if (remaining <= 0) {
      gameState.timer.active = false;
      broadcastState("bell");
    } else {
      if (remaining <= 10 || remaining % 5 === 0) {
        broadcastState();
      }
    }
  }
}, 1000);

function parseJson(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(content);
    }
  });
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- SSE REAL-TIME STREAM ---
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const clientObj = { res, id: crypto.randomUUID() };
    sseClients.add(clientObj);

    res.write(`data: ${JSON.stringify(gameState)}\n\n`);

    req.on('close', () => {
      sseClients.delete(clientObj);
    });
    return;
  }

  // --- GET CURRENT GAME STATE ---
  if (pathname === '/api/state' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(gameState));
    return;
  }

  // --- PLAYER REGISTRATION (ONLY PLAYER NUMBER - NO NAME ASKED) ---
  if (pathname === '/api/register' && req.method === 'POST') {
    const { id, number } = await parseJson(req);
    const cleanedNumber = String(number || '').replace(/\D/g, '').trim();

    if (!id || !cleanedNumber) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Player number is required' }));
      return;
    }

    const displayName = `Player ${cleanedNumber}`;

    let existing = gameState.players.find(p => p.id === id);
    if (existing) {
      existing.name = displayName;
      existing.number = cleanedNumber;
    } else {
      // Check if this number is already used by another device
      const duplicateNum = gameState.players.find(p => p.number === cleanedNumber && p.id !== id);
      if (duplicateNum) {
        // Reuse or update
        duplicateNum.id = id;
        existing = duplicateNum;
      } else {
        const newPlayer = {
          id,
          name: displayName,
          number: cleanedNumber,
          role: 'Faithful', // "Faithful" or "Traitor"
          status: 'Alive',  // "Alive" | "Eliminated"
          hasShield: false,
          round1_group: null,
          round2_group: null,
          round3_group: null,
          round4_group: null
        };
        gameState.players.push(newPlayer);
        existing = newPlayer;
      }
    }

    broadcastState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, player: existing }));
    return;
  }

  // --- PLAYER: RELIC FOUND ---
  if (pathname === '/api/relic-found' && req.method === 'POST') {
    const { group } = await parseJson(req);
    if (group) {
      gameState.relicsFound[group] = true;
      broadcastState("gong");
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // --- PLAYER: CAST VOTE (Round Table Banishment) ---
  if (pathname === '/api/vote' && req.method === 'POST') {
    const { voterId, suspectId } = await parseJson(req);
    if (!gameState.voting.active) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Voting is not currently active' }));
      return;
    }

    const voter = gameState.players.find(p => p.id === voterId);
    if (!voter || voter.status !== 'Alive') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Only alive players can vote' }));
      return;
    }

    gameState.voting.votes[voterId] = suspectId;
    broadcastState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // --- TRAITOR: CHAT MESSAGE ---
  if (pathname === '/api/traitor/chat' && req.method === 'POST') {
    const { senderId, text } = await parseJson(req);
    const sender = gameState.players.find(p => p.id === senderId);

    if (!sender || sender.role !== 'Traitor' || sender.status !== 'Alive') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Only active Traitors can send secret messages' }));
      return;
    }

    if (text && text.trim()) {
      gameState.night.chat.push({
        senderId,
        senderName: sender.name,
        text: text.trim().slice(0, 300),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      if (gameState.night.chat.length > 50) gameState.night.chat.shift();
      broadcastState();
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // --- TRAITOR: MURDER VOTE ---
  if (pathname === '/api/traitor/murder-vote' && req.method === 'POST') {
    const { traitorId, targetId } = await parseJson(req);
    const traitor = gameState.players.find(p => p.id === traitorId);

    if (!traitor || traitor.role !== 'Traitor' || traitor.status !== 'Alive') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized traitor action' }));
      return;
    }

    gameState.night.murderVotes[traitorId] = targetId;
    gameState.night.murderTarget = targetId;
    broadcastState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // --- PLAYER: DILEMMA CHOICE (Trust or Betray) ---
  if (pathname === '/api/dilemma/choice' && req.method === 'POST') {
    const { playerId, choice } = await parseJson(req);
    if (!gameState.dilemma.active) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Dilemma phase is not active' }));
      return;
    }

    if (choice === 'trust' || choice === 'betray') {
      gameState.dilemma.choices[playerId] = choice;
      broadcastState();
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // ================= ADMIN API ROUTES =================

  if (pathname === '/api/admin/login' && req.method === 'POST') {
    const { pin } = await parseJson(req);
    if (pin === ADMIN_PIN) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, token: 'authorized' }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid Admin PIN' }));
    }
    return;
  }

  if (pathname === '/api/admin/reset' && req.method === 'POST') {
    gameState = getInitialState();
    broadcastState("bell");
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/admin/sound-trigger' && req.method === 'POST') {
    const { sound } = await parseJson(req);
    broadcastState(sound || 'bell');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/admin/start-timer' && req.method === 'POST') {
    const { seconds, label } = await parseJson(req);
    const dur = parseInt(seconds, 10) || 300;
    gameState.timer = {
      active: true,
      duration: dur,
      startedAt: Date.now(),
      remaining: dur,
      label: label || 'Timer'
    };
    broadcastState("gong");
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/admin/stop-timer' && req.method === 'POST') {
    gameState.timer.active = false;
    broadcastState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // Start Prelude: The Relic Trial
  if (pathname === '/api/admin/start-trial' && req.method === 'POST') {
    gameState.currentRound = "trial";
    gameState.phase = "idle";
    gameState.voting.active = false;
    gameState.night.active = false;

    const alive = gameState.players.filter(p => p.status === 'Alive');
    alive.sort(() => Math.random() - 0.5);

    alive.forEach((p, idx) => {
      if (!p.round1_group) {
        p.round1_group = (Math.floor(idx / 10) + 1).toString();
      }
    });

    // Secretly pick 2-4 Traitors if none assigned
    const currentTraitors = alive.filter(p => p.role === 'Traitor');
    if (currentTraitors.length === 0 && alive.length >= 4) {
      const traitorsCount = Math.max(2, Math.floor(alive.length * 0.2));
      const shuffled = [...alive].sort(() => Math.random() - 0.5);
      shuffled.slice(0, traitorsCount).forEach(p => { p.role = 'Traitor'; });
    }

    broadcastState("gong");
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/admin/start-round1' && req.method === 'POST') {
    gameState.currentRound = "1";
    gameState.phase = "idle";
    gameState.voting.active = false;
    gameState.night.active = false;
    broadcastState("bell");
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/admin/start-round2' && req.method === 'POST') {
    gameState.currentRound = "2";
    gameState.phase = "idle";
    gameState.voting.active = false;
    gameState.night.active = false;

    const alive = gameState.players.filter(p => p.status === 'Alive');
    alive.sort(() => Math.random() - 0.5);
    alive.forEach((p, idx) => {
      p.round2_group = (Math.floor(idx / 15) + 1).toString();
    });

    broadcastState("gong");
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/admin/start-round3' && req.method === 'POST') {
    gameState.currentRound = "3";
    gameState.phase = "idle";
    gameState.voting.active = false;
    gameState.night.active = false;

    const alive = gameState.players.filter(p => p.status === 'Alive');
    alive.sort(() => Math.random() - 0.5);

    gameState.dilemma = {
      active: true,
      revealed: false,
      choices: {},
      pairs: []
    };

    for (let i = 0; i < alive.length; i += 2) {
      const p1 = alive[i];
      const p2 = alive[i + 1] || null;
      const pairGroup = (Math.floor(i / 2) + 1).toString();

      p1.round3_group = pairGroup;
      if (p2) {
        p2.round3_group = pairGroup;
        gameState.dilemma.pairs.push([p1.id, p2.id]);
      } else {
        gameState.dilemma.pairs.push([p1.id]);
      }
    }

    broadcastState("bell");
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/admin/reveal-dilemma' && req.method === 'POST') {
    gameState.dilemma.revealed = true;
    broadcastState("gong");
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/admin/start-round4' && req.method === 'POST') {
    gameState.currentRound = "4";
    gameState.phase = "idle";
    gameState.voting.active = false;
    gameState.night.active = false;

    const alive = gameState.players.filter(p => p.status === 'Alive');
    alive.forEach(p => { p.round4_group = "1"; });

    broadcastState("bell");
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/admin/start-voting' && req.method === 'POST') {
    gameState.voting = {
      active: true,
      revealed: false,
      votes: {},
      tally: {},
      banishedId: null
    };
    gameState.phase = "voting";
    broadcastState("gong");
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/admin/reveal-votes' && req.method === 'POST') {
    const tally = {};
    for (const suspectId of Object.values(gameState.voting.votes)) {
      tally[suspectId] = (tally[suspectId] || 0) + 1;
    }

    gameState.voting.tally = tally;
    gameState.voting.revealed = true;
    gameState.phase = "voting_revealed";

    let highestSuspect = null;
    let maxVotes = -1;
    for (const [sId, count] of Object.entries(tally)) {
      if (count > maxVotes) {
        maxVotes = count;
        highestSuspect = sId;
      }
    }
    gameState.voting.banishedId = highestSuspect;

    broadcastState("bell");
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, banishedId: highestSuspect, tally }));
    return;
  }

  if (pathname === '/api/admin/execute-banishment' && req.method === 'POST') {
    const { id } = await parseJson(req);
    const targetId = id || gameState.voting.banishedId;

    if (targetId) {
      const victim = gameState.players.find(p => p.id === targetId);
      if (victim) {
        victim.status = 'Eliminated';
      }
    }

    gameState.voting.active = false;
    gameState.phase = "idle";
    broadcastState("elimination");
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/admin/close-voting' && req.method === 'POST') {
    gameState.voting.active = false;
    gameState.phase = "idle";
    broadcastState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/admin/start-night' && req.method === 'POST') {
    gameState.night = {
      active: true,
      murderVotes: {},
      murderTarget: null,
      chat: gameState.night.chat || []
    };
    gameState.phase = "night";
    broadcastState("bell");
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/admin/execute-night' && req.method === 'POST') {
    const { targetId } = await parseJson(req);
    const victimId = targetId || gameState.night.murderTarget;

    let shielded = false;
    if (victimId) {
      const victim = gameState.players.find(p => p.id === victimId);
      if (victim) {
        if (victim.hasShield) {
          shielded = true;
          victim.hasShield = false;
        } else {
          victim.status = 'Eliminated';
        }
      }
    }

    gameState.night.active = false;
    gameState.phase = "idle";
    broadcastState(shielded ? "gong" : "elimination");
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, shielded }));
    return;
  }

  if (pathname === '/api/admin/cancel-night' && req.method === 'POST') {
    gameState.night.active = false;
    gameState.phase = "idle";
    broadcastState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/admin/eliminate' && req.method === 'POST') {
    const { id } = await parseJson(req);
    const p = gameState.players.find(pl => pl.id === id);
    if (p) {
      p.status = 'Eliminated';
      broadcastState("elimination");
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/admin/revive' && req.method === 'POST') {
    const { id } = await parseJson(req);
    const p = gameState.players.find(pl => pl.id === id);
    if (p) {
      p.status = 'Alive';
      broadcastState("gong");
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // Remove / Kick Player (Host action)
  if (pathname === '/api/admin/remove-player' && req.method === 'POST') {
    const { id } = await parseJson(req);
    gameState.players = gameState.players.filter(pl => pl.id !== id);
    broadcastState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/admin/set-role' && req.method === 'POST') {
    const { id, role } = await parseJson(req);
    const p = gameState.players.find(pl => pl.id === id);
    if (p) {
      p.role = role === 'Traitor' ? 'Traitor' : 'Faithful';
      broadcastState();
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/admin/toggle-shield' && req.method === 'POST') {
    const { id } = await parseJson(req);
    const p = gameState.players.find(pl => pl.id === id);
    if (p) {
      p.hasShield = !p.hasShield;
      broadcastState("gong");
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, hasShield: p ? p.hasShield : false }));
    return;
  }

  if (pathname === '/api/admin/set-winner' && req.method === 'POST') {
    const { id, team } = await parseJson(req);
    gameState.winnerId = id || null;
    gameState.winnerTeam = team || (id ? (gameState.players.find(p => p.id === id)?.role || null) : null);
    gameState.phase = "ended";
    broadcastState("fanfare");
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/admin/set-player-group' && req.method === 'POST') {
    const { id, group } = await parseJson(req);
    const p = gameState.players.find(pl => pl.id === id);
    if (p) {
      const r = gameState.currentRound;
      const grpStr = group ? group.toString() : null;
      if (r === "2") p.round2_group = grpStr;
      else if (r === "3") p.round3_group = grpStr;
      else if (r === "4") p.round4_group = grpStr;
      else p.round1_group = grpStr;
      broadcastState();
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/admin/randomize-groups' && req.method === 'POST') {
    const { onlyUnassigned, groupSize } = await parseJson(req);
    const r = gameState.currentRound;
    const size = parseInt(groupSize, 10) || (r === "2" ? 15 : r === "3" ? 2 : 10);

    const getGroup = p => r === "2" ? p.round2_group : r === "3" ? p.round3_group : r === "4" ? p.round4_group : p.round1_group;
    const setGroup = (p, val) => {
      if (r === "2") p.round2_group = val;
      else if (r === "3") p.round3_group = val;
      else if (r === "4") p.round4_group = val;
      else p.round1_group = val;
    };

    let targetPlayers = gameState.players.filter(p => p.status === 'Alive');
    if (onlyUnassigned) {
      targetPlayers = targetPlayers.filter(p => !getGroup(p));
    }

    targetPlayers.sort(() => Math.random() - 0.5);

    let maxGrp = 1;
    gameState.players.forEach(p => {
      const g = parseInt(getGroup(p), 10);
      if (!isNaN(g) && g > maxGrp) maxGrp = g;
    });

    targetPlayers.forEach((p, idx) => {
      const g = onlyUnassigned ? (maxGrp + Math.floor(idx / size)).toString() : (Math.floor(idx / size) + 1).toString();
      setGroup(p, g);
    });

    broadcastState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/admin/set-clue' && req.method === 'POST') {
    const { group, clue } = await parseJson(req);
    if (group && clue) {
      gameState.clues[group] = clue;
      broadcastState();
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // --- STATIC FILES ROUTING ---
  const publicDir = path.join(__dirname, 'public');

  if (pathname === '/' || pathname === '/index.html') {
    serveStatic(res, path.join(publicDir, 'index.html'));
    return;
  }

  if (pathname === '/admin' || pathname === '/secret-admin' || pathname === '/admin.html') {
    serveStatic(res, path.join(publicDir, 'admin.html'));
    return;
  }

  const safePath = path.normalize(path.join(publicDir, pathname));
  if (safePath.startsWith(publicDir) && fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
    serveStatic(res, safePath);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`THE TRAITORS - Realtime Game Server Running on port ${PORT}`);
  console.log(`Player Portal:   http://localhost:${PORT}/`);
  console.log(`Host Dashboard:  http://localhost:${PORT}/secret-admin`);
  console.log(`Master PIN:      ${ADMIN_PIN}`);
  console.log(`====================================================`);
});
