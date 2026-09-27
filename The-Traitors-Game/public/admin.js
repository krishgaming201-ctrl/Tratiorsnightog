// The Traitors - Host Control Center Logic with Mystery Soundboard
let currentGameState = null;
let searchQuery = '';

const adminAuthWall = document.getElementById('adminAuthWall');
const adminDashboard = document.getElementById('adminDashboard');
const adminPinForm = document.getElementById('adminPinForm');
const adminPinInput = document.getElementById('adminPinInput');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const soundIconOn = document.getElementById('soundIconOn');
const soundIconOff = document.getElementById('soundIconOff');

if (sessionStorage.getItem('traitors_admin_auth') === 'true') {
  showDashboard();
}

// Sound toggle
if (soundToggleBtn) {
  soundToggleBtn.addEventListener('click', () => {
    if (window.soundEngine) {
      const isMuted = window.soundEngine.toggleMute();
      soundIconOn.style.display = isMuted ? 'none' : 'block';
      soundIconOff.style.display = isMuted ? 'block' : 'none';
    }
  });

  if (window.soundEngine && window.soundEngine.muted) {
    soundIconOn.style.display = 'none';
    soundIconOff.style.display = 'block';
  }
}

if (adminPinForm) {
  adminPinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = adminPinInput.value.trim();

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem('traitors_admin_auth', 'true');
        showDashboard();
        if (window.soundEngine) {
          window.soundEngine.playGong();
        }
      } else {
        alert('Invalid Host PIN. Access Denied.');
      }
    } catch(err) {
      alert('Authentication error: ' + err.message);
    }
  });
}

function showDashboard() {
  if (adminAuthWall) adminAuthWall.style.display = 'none';
  if (adminDashboard) adminDashboard.style.display = 'block';

  const joinUrl = `${window.location.protocol}//${window.location.host}/`;
  const joinUrlEl = document.getElementById('playerJoinUrl');
  if (joinUrlEl) joinUrlEl.textContent = joinUrl;

  initSSE();
}

const copyBtn = document.getElementById('copyJoinLinkBtn');
if (copyBtn) {
  copyBtn.addEventListener('click', () => {
    const joinUrl = `${window.location.protocol}//${window.location.host}/`;
    navigator.clipboard.writeText(joinUrl);
    copyBtn.textContent = 'Copied';
    setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 2000);
  });
}

let evtSource = null;
function initSSE() {
  if (evtSource) evtSource.close();
  evtSource = new EventSource('/api/events');

  evtSource.onmessage = (event) => {
    try {
      const state = JSON.parse(event.data);
      renderAdmin(state);
    } catch(err) {
      console.error('Error parsing SSE in admin:', err);
    }
  };
}

function renderAdmin(state) {
  currentGameState = state;

  const total = state.players.length;
  const alive = state.players.filter(p => p.status === 'Alive');
  const eliminated = state.players.filter(p => p.status === 'Eliminated');
  const traitors = alive.filter(p => p.role === 'Traitor');
  const faithful = alive.filter(p => p.role !== 'Traitor');

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statAlive').textContent = alive.length;
  document.getElementById('statEliminated').textContent = eliminated.length;
  document.getElementById('statTraitors').textContent = traitors.length;
  document.getElementById('statInnocents').textContent = faithful.length;

  document.getElementById('aliveCountText').textContent = alive.length;
  document.getElementById('eliminatedCountText').textContent = eliminated.length;

  const roundNames = {
    '0': 'Lobby / Waiting Room',
    'trial': 'The Relic Trial (Prelude)',
    '1': 'Round 1 (Role Reveal)',
    '2': 'Round 2 (Groups of 15)',
    '3': 'Round 3 (Trust / Betray Dilemma)',
    '4': 'Round 4 (Final Showdown / Imposter)'
  };
  document.getElementById('currentRoundLabel').textContent = roundNames[state.currentRound] || `Round ${state.currentRound}`;
  document.getElementById('currentPhaseLabel').textContent = state.phase.toUpperCase();

  const timerDisplay = document.getElementById('adminTimerDisplay');
  if (state.timer && state.timer.active && state.timer.remaining > 0) {
    const m = Math.floor(state.timer.remaining / 60);
    const s = state.timer.remaining % 60;
    timerDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} (${state.timer.label || 'Timer'})`;
  } else {
    timerDisplay.textContent = 'Inactive';
  }

  renderVotingControls(state, alive);
  renderNightControls(state, alive);
  renderCluesAndSquads(state, alive);
  renderPlayerLists(state);
}

function renderVotingControls(state, alive) {
  const openBtn = document.getElementById('openVotingBtn');
  const revealBtn = document.getElementById('revealVotesBtn');
  const executeBtn = document.getElementById('executeBanishmentBtn');
  const closeBtn = document.getElementById('closeVotingBtn');
  const statusEl = document.getElementById('votingLiveStatus');

  const votes = state.voting.votes || {};
  const voteCount = Object.keys(votes).length;

  if (state.phase === 'voting') {
    openBtn.style.display = 'none';
    revealBtn.style.display = 'block';
    executeBtn.style.display = 'none';
    closeBtn.style.display = 'block';
    statusEl.textContent = `Voting Active: ${voteCount} of ${alive.length} players have voted.`;
  } else if (state.phase === 'voting_revealed') {
    openBtn.style.display = 'none';
    revealBtn.style.display = 'none';
    executeBtn.style.display = 'block';
    closeBtn.style.display = 'block';

    const banished = state.players.find(p => p.id === state.voting.banishedId);
    if (banished) {
      statusEl.innerHTML = `<strong>${banished.name}</strong> received the most votes (${state.voting.tally[banished.id] || 0} votes). Confirm banishment to eliminate.`;
      executeBtn.textContent = `Confirm Banishment of ${banished.name}`;
    } else {
      statusEl.textContent = `No votes were cast or a tie occurred.`;
    }
  } else {
    openBtn.style.display = 'block';
    revealBtn.style.display = 'none';
    executeBtn.style.display = 'none';
    closeBtn.style.display = 'none';
    statusEl.textContent = 'Voting currently inactive.';
  }
}

function renderNightControls(state, alive) {
  const startBtn = document.getElementById('startNightBtn');
  const executeBtn = document.getElementById('executeNightBtn');
  const cancelBtn = document.getElementById('cancelNightBtn');
  const statusEl = document.getElementById('nightLiveStatus');

  if (state.phase === 'night') {
    startBtn.style.display = 'none';
    executeBtn.style.display = 'block';
    cancelBtn.style.display = 'block';

    const target = state.players.find(p => p.id === state.night.murderTarget);
    if (target) {
      statusEl.innerHTML = `Target Chosen: <strong>${target.name}</strong> ${target.hasShield ? '(SHIELDED)' : ''}`;
      executeBtn.textContent = `Execute Murder of ${target.name}`;
    } else {
      statusEl.textContent = `Traitors are conferring in the secret turret...`;
      executeBtn.textContent = `Execute Night Murder`;
    }
  } else {
    startBtn.style.display = 'block';
    executeBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    statusEl.textContent = 'Night phase currently inactive.';
  }
}

function renderCluesAndSquads(state, alive) {
  const container = document.getElementById('cluesListContainer');
  container.innerHTML = '';

  const r = state.currentRound;
  const getGrp = p => r === "2" ? p.round2_group : r === "3" ? p.round3_group : r === "4" ? p.round4_group : p.round1_group;

  const groupsMap = {};
  alive.forEach(p => {
    const g = getGrp(p) || 'Unassigned';
    if (!groupsMap[g]) groupsMap[g] = [];
    groupsMap[g].push(p);
  });

  const allGroups = ['1', '2', '3', '4', '5', '6', ...Object.keys(groupsMap).filter(k => !['1','2','3','4','5','6','Unassigned'].includes(k))];

  allGroups.forEach(grpNum => {
    const members = groupsMap[grpNum] || [];
    const clueText = (state.clues && state.clues[grpNum]) || 'No clue configured.';
    const isRelicFound = Boolean(state.relicsFound && state.relicsFound[grpNum]);

    const card = document.createElement('div');
    card.className = 'mystery-scroll';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <strong style="color: var(--accent-gold); font-family: 'Cinzel', serif;">Squad ${grpNum} (${members.length} players)</strong>
        ${isRelicFound ? '<span style="color: var(--accent-green); font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Relic Recovered</span>' : ''}
      </div>
      <p style="font-size: 0.85rem; color: #ddd; font-style: italic; margin-bottom: 8px; line-height: 1.35;">
        "${clueText}"
      </p>
      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
        <button class="btn btn-outline edit-clue-btn toolbar-btn" data-grp="${grpNum}" style="width: auto; padding: 4px 8px; font-size: 0.75rem; min-height: 32px;">
          Edit Clue
        </button>
      </div>
      <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px;">
        ${members.map(m => `<span style="font-size: 0.75rem; padding: 2px 6px; background: rgba(255,255,255,0.06); border-radius: 4px; color: ${m.role === 'Traitor' ? '#ff6666' : 'var(--fg)'};">${m.name}</span>`).join('')}
      </div>
    `;
    container.appendChild(card);
  });

  document.querySelectorAll('.edit-clue-btn').forEach(btn => {
    btn.onclick = async () => {
      const g = btn.dataset.grp;
      const current = (state.clues && state.clues[g]) || '';
      const newClue = prompt(`Enter secret clue for Squad ${g}:`, current);
      if (newClue !== null && newClue.trim()) {
        await fetch('/api/admin/set-clue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group: g, clue: newClue.trim() })
        });
      }
    };
  });
}

function renderPlayerLists(state) {
  const aliveList = document.getElementById('alivePlayerList');
  const elimList = document.getElementById('eliminatedPlayerList');
  aliveList.innerHTML = '';
  elimList.innerHTML = '';

  const r = state.currentRound;
  const getGrp = p => r === "2" ? p.round2_group : r === "3" ? p.round3_group : r === "4" ? p.round4_group : p.round1_group;

  const filtered = state.players.filter(p => {
    if (!searchQuery) return true;
    return p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.number && p.number.includes(searchQuery));
  });

  filtered.forEach(p => {
    const isAlive = p.status === 'Alive';
    const row = document.createElement('div');
    row.className = 'player-item';

    row.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
        <span class="status-dot ${isAlive ? 'alive' : 'eliminated'}"></span>
        <span style="font-weight: 700; ${isAlive ? '' : 'text-decoration: line-through; opacity: 0.6;'}">
          ${p.name}
        </span>
        <span class="role-badge ${p.role.toLowerCase()}" style="cursor: pointer;" title="Toggle role" onclick="toggleRole('${p.id}', '${p.role}')">
          ${p.role} ⇄
        </span>
        ${p.hasShield ? '<span class="shield-badge">SHIELD</span>' : ''}
        ${isAlive ? `<span style="font-size: 0.8rem; color: var(--accent-gold);">Group ${getGrp(p) || 'Unassigned'}</span>` : ''}
      </div>

      <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
        ${isAlive ? `
          <button class="btn btn-outline toolbar-btn" style="width: auto; padding: 4px 8px; font-size: 0.75rem; min-height: 32px;" onclick="toggleShield('${p.id}')">
            ${p.hasShield ? 'Drop Shield' : 'Shield'}
          </button>
          <button class="btn btn-outline toolbar-btn" style="width: auto; padding: 4px 8px; font-size: 0.75rem; min-height: 32px;" onclick="changeGroupPrompt('${p.id}', '${getGrp(p) || ''}')">
            Group
          </button>
          <button class="btn btn-danger toolbar-btn" style="width: auto; padding: 4px 8px; font-size: 0.75rem; min-height: 32px;" onclick="eliminatePlayer('${p.id}', '${p.name}')">
            Eliminate
          </button>
          ${r === '4' ? `
            <button class="btn btn-gold toolbar-btn" style="width: auto; padding: 4px 8px; font-size: 0.75rem; min-height: 32px;" onclick="declareWinner('${p.id}', '${p.name}')">
              Winner
            </button>
          ` : ''}
        ` : `
          <button class="btn btn-outline toolbar-btn" style="width: auto; padding: 4px 8px; font-size: 0.75rem; color: var(--accent-green); border-color: var(--accent-green); min-height: 32px;" onclick="revivePlayer('${p.id}', '${p.name}')">
            Revive
          </button>
        `}
        <button class="btn btn-outline toolbar-btn" style="width: auto; padding: 4px 6px; font-size: 0.7rem; color: var(--text-muted); min-height: 32px;" title="Remove player" onclick="removePlayer('${p.id}', '${p.name}')">
          Remove
        </button>
      </div>
    `;

    if (isAlive) {
      aliveList.appendChild(row);
    } else {
      elimList.appendChild(row);
    }
  });

  if (aliveList.children.length === 0) {
    aliveList.innerHTML = '<div style="padding: 14px; color: var(--text-muted); text-align: center;">No alive players found.</div>';
  }
  if (elimList.children.length === 0) {
    elimList.innerHTML = '<div style="padding: 14px; color: var(--text-muted); text-align: center;">No eliminated players.</div>';
  }
}

window.toggleRole = async (id, currentRole) => {
  const next = currentRole === 'Traitor' ? 'Faithful' : 'Traitor';
  if (confirm(`Change this player's role to ${next.toUpperCase()}?`)) {
    await fetch('/api/admin/set-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role: next })
    });
  }
};

window.toggleShield = async (id) => {
  await fetch('/api/admin/toggle-shield', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
};

window.changeGroupPrompt = async (id, currentGrp) => {
  const grp = prompt(`Enter group number for this player:`, currentGrp);
  if (grp !== null) {
    await fetch('/api/admin/set-player-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, group: grp.trim() })
    });
  }
};

window.eliminatePlayer = async (id, name) => {
  if (confirm(`Confirm elimination of ${name}?`)) {
    await fetch('/api/admin/eliminate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
  }
};

window.revivePlayer = async (id, name) => {
  if (confirm(`Revive ${name}?`)) {
    await fetch('/api/admin/revive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
  }
};

window.removePlayer = async (id, name) => {
  if (confirm(`Remove ${name} completely from this game?`)) {
    await fetch('/api/admin/remove-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
  }
};

window.declareWinner = async (id, name) => {
  if (confirm(`Declare ${name} as the WINNER of The Traitors?`)) {
    await fetch('/api/admin/set-winner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
  }
};

const searchInput = document.getElementById('playerSearchInput');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    if (currentGameState) renderPlayerLists(currentGameState);
  });
}

// Mystery Soundboard Button Click Handlers
document.querySelectorAll('.soundboard-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const sound = btn.dataset.sound;
    // Play locally on Host machine
    if (window.soundEngine) {
      if (sound === 'bell') window.soundEngine.playBell();
      else if (sound === 'gong') window.soundEngine.playGong();
      else if (sound === 'thunder') window.soundEngine.playThunder();
      else if (sound === 'flame') window.soundEngine.playFlameWhoosh();
      else if (sound === 'dagger') window.soundEngine.playDagger();
      else if (sound === 'heartbeat') window.soundEngine.playHeartbeat();
      else if (sound === 'elimination') window.soundEngine.playElimination();
      else if (sound === 'fanfare') window.soundEngine.playFanfare();
    }
    // Broadcast live to all connected players
    fetch('/api/admin/sound-trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sound })
    });
  });
});

// Reset Game
document.getElementById('resetGameBtn').onclick = async () => {
  if (confirm('Reset the entire game state back to the lobby?')) {
    await fetch('/api/admin/reset', { method: 'POST' });
  }
};

// Round Controls
document.getElementById('startTrialBtn').onclick = async () => {
  if (confirm('Start The Relic Trial (Prelude)? This assigns squads and secret roles.')) {
    await fetch('/api/admin/start-trial', { method: 'POST' });
  }
};

document.getElementById('startRound1Btn').onclick = async () => {
  if (confirm('Start Round 1? This reveals secret roles to players.')) {
    await fetch('/api/admin/start-round1', { method: 'POST' });
  }
};

document.getElementById('startRound2Btn').onclick = async () => {
  if (confirm('Start Round 2? This organizes players into squads of 15.')) {
    await fetch('/api/admin/start-round2', { method: 'POST' });
  }
};

document.getElementById('startRound3Btn').onclick = async () => {
  if (confirm('Start Round 3? This arranges players into pairs for the Trust / Betray dilemma.')) {
    await fetch('/api/admin/start-round3', { method: 'POST' });
  }
};

document.getElementById('startRound4Btn').onclick = async () => {
  if (confirm('Start Round 4 (The Final Showdown)?')) {
    await fetch('/api/admin/start-round4', { method: 'POST' });
  }
};

// Voting Controls
document.getElementById('openVotingBtn').onclick = async () => {
  if (confirm('Open the Round Table Banishment Vote on all players phones?')) {
    await fetch('/api/admin/start-voting', { method: 'POST' });
  }
};

document.getElementById('revealVotesBtn').onclick = async () => {
  await fetch('/api/admin/reveal-votes', { method: 'POST' });
};

document.getElementById('executeBanishmentBtn').onclick = async () => {
  if (confirm('Execute banishment on the highest-voted player?')) {
    await fetch('/api/admin/execute-banishment', { method: 'POST' });
  }
};

document.getElementById('closeVotingBtn').onclick = async () => {
  await fetch('/api/admin/close-voting', { method: 'POST' });
};

// Night Controls
document.getElementById('startNightBtn').onclick = async () => {
  if (confirm('Initiate Night Phase? Faithful sleep and Traitors vote on murder.')) {
    await fetch('/api/admin/start-night', { method: 'POST' });
  }
};

document.getElementById('executeNightBtn').onclick = async () => {
  if (confirm('Confirm murder of the Traitors target?')) {
    await fetch('/api/admin/execute-night', { method: 'POST' });
  }
};

document.getElementById('cancelNightBtn').onclick = async () => {
  await fetch('/api/admin/cancel-night', { method: 'POST' });
};

document.getElementById('autoAssignGroupsBtn').onclick = async () => {
  if (confirm('Auto-assign all alive players into balanced squads?')) {
    await fetch('/api/admin/randomize-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onlyUnassigned: false })
    });
  }
};

// Timer Presets
document.querySelectorAll('.timer-preset-btn').forEach(btn => {
  btn.onclick = async () => {
    const sec = parseInt(btn.dataset.sec, 10);
    await fetch('/api/admin/start-timer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seconds: sec, label: `${sec / 60}m Timer` })
    });
  };
});

document.getElementById('customTimerBtn').onclick = async () => {
  const m = prompt('Enter timer duration in minutes:');
  if (m && !isNaN(m) && Number(m) > 0) {
    await fetch('/api/admin/start-timer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seconds: Math.floor(Number(m) * 60), label: `${m}m Timer` })
    });
  }
};

document.getElementById('stopTimerBtn').onclick = async () => {
  await fetch('/api/admin/stop-timer', { method: 'POST' });
};
