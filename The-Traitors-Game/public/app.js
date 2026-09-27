// The Traitors - Mobile-Optimized Player Client Script with Atmospheric Sound & Flames
let myPlayerId = null;
let currentGameState = null;
let selectedSuspectId = null;
let selectedMurderTargetId = null;

const ICONS = {
  skull: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="9" cy="12" r="1.5"></circle>
    <circle cx="15" cy="12" r="1.5"></circle>
    <path d="M8 20v2h8v-2"></path>
    <path d="m12.5 17-.5-1-.5 1h1z"></path>
    <path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"></path>
  </svg>`,
  shield: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    <path d="m9 12 2 2 4-4"></path>
  </svg>`
};

try {
  myPlayerId = localStorage.getItem('traitor_player_id');
  if (!myPlayerId) {
    myPlayerId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'p_' + Math.random().toString(36).substring(2) + Date.now();
    localStorage.setItem('traitor_player_id', myPlayerId);
  }
} catch(e) {
  myPlayerId = 'p_' + Date.now();
}

// DOM Elements
const soundToggleBtn = document.getElementById('soundToggleBtn');
const soundIconOn = document.getElementById('soundIconOn');
const soundIconOff = document.getElementById('soundIconOff');
const timerContainer = document.getElementById('timerContainer');
const timerBanner = document.getElementById('timerBanner');
const timerLabel = document.getElementById('timerLabel');
const timerRemaining = document.getElementById('timerRemaining');

// Screens
const screenRegistration = document.getElementById('screenRegistration');
const screenLobby = document.getElementById('screenLobby');
const screenTrial = document.getElementById('screenTrial');
const screenRound = document.getElementById('screenRound');
const screenVoting = document.getElementById('screenVoting');
const screenNight = document.getElementById('screenNight');
const screenDilemma = document.getElementById('screenDilemma');
const screenEliminated = document.getElementById('screenEliminated');
const screenVictory = document.getElementById('screenVictory');

const allScreens = [
  screenRegistration, screenLobby, screenTrial, screenRound,
  screenVoting, screenNight, screenDilemma, screenEliminated, screenVictory
];

let lastScreen = null;
function showScreen(targetScreen) {
  if (lastScreen !== targetScreen && window.soundEngine) {
    window.soundEngine.playFlameWhoosh();
  }
  lastScreen = targetScreen;

  allScreens.forEach(s => {
    if (s) s.style.display = (s === targetScreen) ? 'block' : 'none';
  });
}

// Spawn Rising Fire Embers
function initFireEmbers() {
  const container = document.getElementById('emberContainer');
  if (!container) return;

  const count = window.innerWidth < 600 ? 15 : 30;
  for (let i = 0; i < count; i++) {
    const ember = document.createElement('div');
    ember.className = 'ember';
    ember.style.left = `${Math.random() * 100}vw`;
    ember.style.animationDuration = `${Math.random() * 4 + 3}s`;
    ember.style.animationDelay = `-${Math.random() * 5}s`;
    ember.style.setProperty('--ember-drift', `${(Math.random() - 0.5) * 80}px`);
    container.appendChild(ember);
  }
}
initFireEmbers();

// Sound Toggle
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

// Add generic tap click audio to all buttons
document.addEventListener('click', (e) => {
  if (e.target.closest('button') || e.target.closest('.suspect-card') || e.target.closest('.dilemma-card')) {
    if (window.soundEngine) window.soundEngine.playClick();
  }
});

// Registration
const regForm = document.getElementById('regForm');
if (regForm) {
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const number = document.getElementById('regNumber').value.replace(/\D/g, '').trim();
    if (!number) return;

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: myPlayerId, number })
      });
      const data = await res.json();
      if (data.success && window.soundEngine) {
        window.soundEngine.playFlameWhoosh();
        window.soundEngine.playGong();
      }
    } catch(err) {
      alert('Connection error: ' + err.message);
    }
  });
}

// SSE Connection
let evtSource = null;
function initSSE() {
  if (evtSource) evtSource.close();
  evtSource = new EventSource('/api/events');

  evtSource.onmessage = (event) => {
    try {
      const state = JSON.parse(event.data);
      renderGameState(state);
    } catch(err) {
      console.error('Error parsing SSE:', err);
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      fetch('/api/state')
        .then(r => r.json())
        .then(st => renderGameState(st))
        .catch(() => {});
    }
  });
}

initSSE();

// Main State Machine
function renderGameState(state) {
  currentGameState = state;
  const me = state.players.find(p => p.id === myPlayerId);

  // Audio triggers
  if (state.soundTrigger && window.soundEngine) {
    const s = state.soundTrigger.sound;
    if (s === 'bell') window.soundEngine.playBell();
    else if (s === 'gong') window.soundEngine.playGong();
    else if (s === 'elimination') window.soundEngine.playElimination();
    else if (s === 'fanfare') window.soundEngine.playFanfare();
    else if (s === 'dagger') window.soundEngine.playDagger();
    else if (s === 'thunder') window.soundEngine.playThunder();
    else if (s === 'flame') window.soundEngine.playFlameWhoosh();
    else if (s === 'heartbeat') window.soundEngine.playHeartbeat();
  }

  // Timer
  if (state.timer && state.timer.active && state.timer.remaining > 0) {
    timerContainer.style.display = 'block';
    timerLabel.textContent = state.timer.label || 'Castle Timer';
    const m = Math.floor(state.timer.remaining / 60);
    const s = state.timer.remaining % 60;
    timerRemaining.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    if (state.timer.remaining <= 30) {
      timerBanner.classList.add('urgent');
      if (window.soundEngine && state.timer.remaining <= 10) {
        window.soundEngine.playHeartbeat();
      }
    } else {
      timerBanner.classList.remove('urgent');
    }
  } else {
    timerContainer.style.display = 'none';
  }

  // 1. Not Registered
  if (!me) {
    showScreen(screenRegistration);
    return;
  }

  // 2. Victory / Game Over
  if (state.phase === 'ended' || state.winnerId) {
    showScreen(screenVictory);
    const winnerPlayer = state.players.find(p => p.id === state.winnerId);
    const isMeWinner = state.winnerId === myPlayerId;
    const header = document.getElementById('victoryHeader');
    const winnerNameEl = document.getElementById('winnerName');
    const winnerSub = document.getElementById('winnerSubtext');

    if (isMeWinner) {
      header.textContent = 'CONGRATULATIONS';
      winnerNameEl.textContent = 'YOU WIN';
      winnerSub.textContent = 'You have outwitted, outplayed, and outlasted all others in the castle.';
    } else if (winnerPlayer) {
      header.textContent = 'The Crown Belongs To';
      winnerNameEl.textContent = winnerPlayer.name;
      winnerSub.textContent = `A cunning ${winnerPlayer.role} has claimed victory!`;
    } else if (state.winnerTeam) {
      header.textContent = 'Victory Decided';
      winnerNameEl.textContent = `${state.winnerTeam.toUpperCase()}S WIN`;
      winnerSub.textContent = `The ${state.winnerTeam}s have outlasted all opposition!`;
    }

    const sparkles = document.getElementById('victorySparkles');
    if (sparkles && sparkles.children.length === 0) {
      for (let i = 0; i < 20; i++) {
        const sp = document.createElement('div');
        sp.className = 'sparkle';
        sp.style.left = `${Math.random() * 100}%`;
        sp.style.animationDuration = `${Math.random() * 3 + 2}s`;
        sp.style.animationDelay = `-${Math.random() * 3}s`;
        sparkles.appendChild(sp);
      }
    }
    return;
  }

  // 3. Eliminated
  if (me.status === 'Eliminated') {
    showScreen(screenEliminated);
    return;
  }

  // 4. Voting Phase (Round Table)
  if (state.phase === 'voting' || state.phase === 'voting_revealed') {
    showScreen(screenVoting);
    renderVotingChamber(state, me);
    return;
  }

  // 5. Night Murder Phase
  if (state.phase === 'night') {
    showScreen(screenNight);
    renderNightPhase(state, me);
    return;
  }

  // 6. Round 3 Dilemma (Trust or Betray)
  if (state.currentRound === '3' && state.dilemma && state.dilemma.active) {
    showScreen(screenDilemma);
    renderDilemmaPhase(state, me);
    return;
  }

  // 7. Lobby
  if (state.currentRound === '0') {
    showScreen(screenLobby);
    document.getElementById('lobbyPlayerName').textContent = me.name;
    return;
  }

  // 8. The Relic Trial
  if (state.currentRound === 'trial') {
    showScreen(screenTrial);
    renderTrialScreen(state, me);
    return;
  }

  // 9. Standard Rounds (Round 1, 2, 4)
  showScreen(screenRound);
  renderRoundScreen(state, me);
}

// Render The Relic Trial Screen
function renderTrialScreen(state, me) {
  const grp = me.round1_group || '?';
  document.getElementById('trialGroupNum').textContent = grp;

  const defaultClue = "Search the estate grounds diligently, find your missing piece, and return to the council chamber.";
  const clue = (state.clues && state.clues[grp]) || defaultClue;
  document.getElementById('trialClueText').textContent = `"${clue}"`;

  const relicBtn = document.getElementById('relicFoundBtn');
  if (state.relicsFound && state.relicsFound[grp]) {
    relicBtn.textContent = 'Relic Piece Recovered (Confirmed)';
    relicBtn.disabled = true;
    relicBtn.style.opacity = '0.6';
  } else {
    relicBtn.textContent = 'Relic Piece Recovered';
    relicBtn.disabled = false;
    relicBtn.style.opacity = '1';
    relicBtn.onclick = async () => {
      if (confirm('Confirm that your squad has recovered the relic piece?')) {
        await fetch('/api/relic-found', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group: grp })
        });
        if (window.soundEngine) window.soundEngine.playGong();
      }
    };
  }

  const squad = state.players.filter(p => p.round1_group === grp && p.status === 'Alive');
  const squadListEl = document.getElementById('trialSquadList');
  squadListEl.innerHTML = '';
  squad.forEach(p => {
    const isMe = p.id === me.id;
    const badge = document.createElement('span');
    badge.style.padding = '6px 12px';
    badge.style.borderRadius = '16px';
    badge.style.fontSize = '0.9rem';
    badge.style.display = 'inline-flex';
    badge.style.alignItems = 'center';
    badge.style.gap = '4px';
    badge.style.background = isMe ? 'rgba(197, 160, 89, 0.2)' : 'rgba(255, 255, 255, 0.06)';
    badge.style.border = isMe ? '1px solid var(--accent-gold)' : '1px solid rgba(255, 255, 255, 0.1)';
    badge.style.color = isMe ? 'var(--accent-gold)' : 'var(--fg)';
    badge.textContent = isMe ? `(You) ${p.name}` : p.name;
    squadListEl.appendChild(badge);
  });
}

// Render Standard Round Screen (Round 1, 2, 4)
function renderRoundScreen(state, me) {
  const r = state.currentRound;
  document.getElementById('roundHeaderLabel').textContent = `LIVE — Round ${r}`;
  document.getElementById('roundHeaderTitle').textContent = `Round ${r}`;

  const roleBox = document.getElementById('roleRevealBox');
  const roleSvgContainer = document.getElementById('roleSvgContainer');
  const roleTitle = document.getElementById('roleTitle');
  const roleBadge = document.getElementById('roleBadge');
  const traitorNote = document.getElementById('traitorNote');
  const shieldIndicator = document.getElementById('shieldIndicator');

  const isTraitor = me.role === 'Traitor';
  roleTitle.textContent = me.role;
  roleBadge.textContent = me.role;

  if (isTraitor) {
    roleBox.className = 'role-reveal role-traitor';
    roleSvgContainer.innerHTML = ICONS.skull;
    roleBadge.className = 'role-badge traitor';
    traitorNote.style.display = 'block';
    traitorNote.textContent = r === "1" ? "You have 2 votes this round. Murder with caution." : "You have 1 vote to banish. Choose wisely.";
  } else {
    roleBox.className = 'role-reveal role-faithful';
    roleSvgContainer.innerHTML = ICONS.shield;
    roleBadge.className = 'role-badge faithful';
    traitorNote.style.display = 'none';
  }

  shieldIndicator.style.display = me.hasShield ? 'inline-flex' : 'none';

  let myGrp = r === "2" ? me.round2_group : r === "3" ? me.round3_group : r === "4" ? me.round4_group : me.round1_group;
  document.getElementById('roundGroupNumber').textContent = myGrp || '?';

  const squadMembers = state.players.filter(p => {
    const pGrp = r === "2" ? p.round2_group : r === "3" ? p.round3_group : r === "4" ? p.round4_group : p.round1_group;
    return pGrp === myGrp && p.status === 'Alive';
  });

  document.getElementById('squadMemberCount').textContent = `${squadMembers.length} members`;
  const container = document.getElementById('roundSquadMembers');
  container.innerHTML = '';

  squadMembers.forEach(p => {
    const isMe = p.id === me.id;
    const badge = document.createElement('span');
    badge.style.padding = '6px 12px';
    badge.style.borderRadius = '16px';
    badge.style.fontSize = '0.9rem';
    badge.style.display = 'inline-flex';
    badge.style.alignItems = 'center';
    badge.style.background = isMe ? 'rgba(197, 160, 89, 0.2)' : 'rgba(255, 255, 255, 0.06)';
    badge.style.border = isMe ? '1px solid var(--accent-gold)' : '1px solid rgba(255, 255, 255, 0.1)';
    badge.style.color = isMe ? 'var(--accent-gold)' : 'var(--fg)';
    badge.textContent = isMe ? `(You) ${p.name}` : p.name;
    container.appendChild(badge);
  });
}

// Render Round Table Banishment (Voting)
function renderVotingChamber(state, me) {
  const votingOpenSection = document.getElementById('votingOpenSection');
  const votingRevealedSection = document.getElementById('votingRevealedSection');
  const castVoteBtn = document.getElementById('castVoteBtn');
  const voteConfirmedText = document.getElementById('voteConfirmedText');

  if (state.phase === 'voting_revealed') {
    votingOpenSection.style.display = 'none';
    votingRevealedSection.style.display = 'block';

    const tallyContainer = document.getElementById('votingTallyBars');
    tallyContainer.innerHTML = '';
    const tally = state.voting.tally || {};
    const totalVotes = Object.values(tally).reduce((a, b) => a + b, 0) || 1;

    Object.entries(tally).forEach(([suspectId, count]) => {
      const p = state.players.find(pl => pl.id === suspectId);
      const name = p ? p.name : 'Unknown';
      const pct = Math.round((count / totalVotes) * 100);

      const row = document.createElement('div');
      row.style.background = 'rgba(0,0,0,0.5)';
      row.style.padding = '8px 12px';
      row.style.borderRadius = '4px';
      row.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 0.95rem; margin-bottom: 4px;">
          <span><strong>${name}</strong></span>
          <span style="color: var(--accent-gold); font-weight: bold;">${count} vote${count > 1 ? 's' : ''} (${pct}%)</span>
        </div>
        <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
          <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, var(--accent-gold), #ff3333); transition: width 0.8s ease;"></div>
        </div>
      `;
      tallyContainer.appendChild(row);
    });

    const banished = state.players.find(p => p.id === state.voting.banishedId);
    if (banished) {
      document.getElementById('banishedPlayerName').textContent = banished.name;
      document.getElementById('banishedRoleReveal').textContent = `Identity Revealed: ${banished.role.toUpperCase()}`;
    }
    return;
  }

  votingOpenSection.style.display = 'block';
  votingRevealedSection.style.display = 'none';

  const hasVoted = Boolean(state.voting.votes && state.voting.votes[me.id]);
  const currentVoteId = state.voting.votes ? state.voting.votes[me.id] : null;

  if (hasVoted) {
    castVoteBtn.style.display = 'none';
    voteConfirmedText.style.display = 'block';
    const votedPlayer = state.players.find(p => p.id === currentVoteId);
    voteConfirmedText.textContent = `Your secret vote has been cast for ${votedPlayer ? votedPlayer.name : 'Suspect'}.`;
  } else {
    castVoteBtn.style.display = 'block';
    voteConfirmedText.style.display = 'none';
  }

  const suspects = state.players.filter(p => p.status === 'Alive' && p.id !== me.id);
  const grid = document.getElementById('suspectGrid');
  grid.innerHTML = '';

  suspects.forEach(p => {
    const card = document.createElement('div');
    card.className = `suspect-card ${selectedSuspectId === p.id || currentVoteId === p.id ? 'selected' : ''}`;
    card.innerHTML = `
      <div style="font-family: 'Cinzel', serif; font-size: 1.8rem; color: var(--accent-gold); font-weight: 700;">#${p.number}</div>
      <div class="name">${p.name}</div>
    `;

    if (!hasVoted) {
      card.onclick = () => {
        selectedSuspectId = p.id;
        document.querySelectorAll('.suspect-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        castVoteBtn.disabled = false;
        castVoteBtn.textContent = `Vote To Banish ${p.name}`;
        if (window.soundEngine) window.soundEngine.playDagger();
      };
    }
    grid.appendChild(card);
  });

  castVoteBtn.onclick = async () => {
    if (!selectedSuspectId) return;
    if (confirm(`Are you certain you wish to cast your vote to banish this player?`)) {
      await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId: me.id, suspectId: selectedSuspectId })
      });
      if (window.soundEngine) {
        window.soundEngine.playDagger();
        window.soundEngine.playBell();
      }
    }
  };
}

// Render Night Phase (Murder)
function renderNightPhase(state, me) {
  const faithfulView = document.getElementById('nightFaithfulView');
  const traitorView = document.getElementById('nightTraitorView');

  if (me.role !== 'Traitor') {
    faithfulView.style.display = 'block';
    traitorView.style.display = 'none';
    return;
  }

  faithfulView.style.display = 'none';
  traitorView.style.display = 'block';

  const chatBox = document.getElementById('nightChatBox');
  chatBox.innerHTML = '';
  const chatMessages = state.night.chat || [];
  chatMessages.forEach(msg => {
    const isMe = msg.senderId === me.id;
    const line = document.createElement('div');
    line.className = 'chat-message';
    line.innerHTML = `
      <span class="author">${isMe ? 'You' : msg.senderName}:</span>
      <span class="text">${msg.text}</span>
      <span class="time">${msg.time}</span>
    `;
    chatBox.appendChild(line);
  });
  chatBox.scrollTop = chatBox.scrollHeight;

  const victims = state.players.filter(p => p.status === 'Alive' && p.role !== 'Traitor');
  const victimGrid = document.getElementById('murderVictimGrid');
  victimGrid.innerHTML = '';

  const confirmMurderBtn = document.getElementById('confirmMurderBtn');
  const currentTargetId = state.night.murderTarget;

  victims.forEach(p => {
    const card = document.createElement('div');
    card.className = `suspect-card ${selectedMurderTargetId === p.id || currentTargetId === p.id ? 'selected' : ''}`;
    card.innerHTML = `
      <div style="font-family: 'Cinzel', serif; font-size: 1.6rem; color: var(--accent-gold);">#${p.number}</div>
      <div class="name">${p.name}</div>
      ${p.hasShield ? '<div style="font-size: 0.75rem; color: var(--accent-gold); margin-top: 4px;">SHIELDED</div>' : ''}
    `;

    card.onclick = () => {
      selectedMurderTargetId = p.id;
      document.querySelectorAll('#murderVictimGrid .suspect-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      confirmMurderBtn.disabled = false;
      confirmMurderBtn.textContent = `Murder ${p.name}`;
      if (window.soundEngine) window.soundEngine.playDagger();
    };
    victimGrid.appendChild(card);
  });

  confirmMurderBtn.onclick = async () => {
    if (!selectedMurderTargetId) return;
    if (confirm('Select this player as the murder target tonight?')) {
      await fetch('/api/traitor/murder-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traitorId: me.id, targetId: selectedMurderTargetId })
      });
      if (window.soundEngine) window.soundEngine.playGong();
    }
  };
}

// Night Chat Submit
const nightChatForm = document.getElementById('nightChatForm');
if (nightChatForm) {
  nightChatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('nightChatInput');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    await fetch('/api/traitor/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderId: myPlayerId, text })
    });
  });
}

// Render Round 3 Dilemma
function renderDilemmaPhase(state, me) {
  const pairs = state.dilemma.pairs || [];
  const myPair = pairs.find(pair => pair.includes(me.id));
  const partnerId = myPair ? myPair.find(id => id !== me.id) : null;
  const partner = partnerId ? state.players.find(p => p.id === partnerId) : null;

  document.getElementById('dilemmaPartnerName').textContent = partner ? partner.name : 'Unknown';

  const myChoice = state.dilemma.choices ? state.dilemma.choices[me.id] : null;
  const trustCard = document.getElementById('choiceTrust');
  const betrayCard = document.getElementById('choiceBetray');

  trustCard.classList.toggle('selected', myChoice === 'trust');
  betrayCard.classList.toggle('selected', myChoice === 'betray');

  if (!state.dilemma.revealed) {
    trustCard.onclick = async () => {
      await fetch('/api/dilemma/choice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: me.id, choice: 'trust' })
      });
      if (window.soundEngine) window.soundEngine.playFlameWhoosh();
    };
    betrayCard.onclick = async () => {
      await fetch('/api/dilemma/choice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: me.id, choice: 'betray' })
      });
      if (window.soundEngine) window.soundEngine.playDagger();
    };
  }

  const revealedBox = document.getElementById('dilemmaRevealedBox');
  const outcomeText = document.getElementById('dilemmaOutcomeText');
  if (state.dilemma.revealed) {
    revealedBox.style.display = 'block';
    const partnerChoice = (partner && state.dilemma.choices) ? state.dilemma.choices[partner.id] : 'No decision';

    if (myChoice === 'trust' && partnerChoice === 'trust') {
      outcomeText.innerHTML = `<strong>MUTUAL TRUST</strong>: Both of you chose Trust. You both survive!`;
    } else if (myChoice === 'betray' && partnerChoice === 'trust') {
      outcomeText.innerHTML = `<strong>BETRAYAL SUCCESS</strong>: You chose Betray while ${partner.name} trusted you. You win!`;
    } else if (myChoice === 'trust' && partnerChoice === 'betray') {
      outcomeText.innerHTML = `<strong>BETRAYED</strong>: You trusted, but ${partner.name} betrayed you!`;
    } else if (myChoice === 'betray' && partnerChoice === 'betray') {
      outcomeText.innerHTML = `<strong>MUTUAL BETRAYAL</strong>: Both chose Betray. Both face council trial!`;
    } else {
      outcomeText.textContent = `Your choice: ${myChoice || 'None'} | Partner choice: ${partnerChoice || 'None'}`;
    }
  } else {
    revealedBox.style.display = 'none';
  }
}
