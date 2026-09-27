// Procedural Web Audio API Sound & Ambience Engine for The Traitors Game
class TraitorsAudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.ambientRunning = false;
    this.ambientGain = null;
    this.fireGain = null;
    this.droneGain = null;

    try {
      this.muted = localStorage.getItem('traitors_muted') === 'true';
    } catch(e) {}
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.ambientRunning && !this.muted) {
      this.startContinuousAmbience();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem('traitors_muted', this.muted);
    } catch(e) {}

    if (this.muted) {
      if (this.ambientGain && this.ctx) {
        this.ambientGain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
    } else {
      this.unlock();
      if (this.ambientGain && this.ctx) {
        this.ambientGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      }
    }
    return this.muted;
  }

  // --- CONTINUOUS AMBIENCE: CASTLE TORCH FIRE CRACKLE + EERIE DRONE ---
  startContinuousAmbience() {
    if (!this.ctx || this.ambientRunning || this.muted) return;
    this.ambientRunning = true;

    const t = this.ctx.currentTime;
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.45, t);
    this.ambientGain.connect(this.ctx.destination);

    // 1. Eerie Castle Dungeon Sub-Drone (Oscillators)
    const droneGain = this.ctx.createGain();
    droneGain.gain.setValueAtTime(0.25, t);

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(55, t); // A1 note
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(55.6, t); // Slight detune for pulsing suspense

    const droneFilter = this.ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.setValueAtTime(110, t);

    osc1.connect(droneFilter);
    osc2.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(this.ambientGain);

    osc1.start(t);
    osc2.start(t);

    // 2. Continuous Castle Torch Fire Crackle & Flame Roar
    this.initFireSynthesis();
  }

  initFireSynthesis() {
    if (!this.ctx || !this.ambientGain) return;

    // Buffer for white noise
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Flame Roar (low-frequency warm wind rumble)
    const flameFilter = this.ctx.createBiquadFilter();
    flameFilter.type = 'bandpass';
    flameFilter.frequency.setValueAtTime(180, this.ctx.currentTime);
    flameFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    const flameGain = this.ctx.createGain();
    flameGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

    whiteNoise.connect(flameFilter);
    flameFilter.connect(flameGain);
    flameGain.connect(this.ambientGain);

    whiteNoise.start();

    // Procedural Wood Burning & Crackling Pops
    this.scheduleFireCrackle();
  }

  scheduleFireCrackle() {
    if (!this.ctx || this.muted) return;

    // Random pops every 60ms to 350ms
    const interval = Math.random() * 280 + 70;
    setTimeout(() => {
      if (this.ctx && !this.muted && this.ambientGain) {
        this.playSingleCrackle();
      }
      this.scheduleFireCrackle();
    }, interval);
  }

  playSingleCrackle() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    // Random high pitch snap
    const freq = Math.random() * 2000 + 1000;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.02);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.setValueAtTime(3, t);

    const popVol = Math.random() * 0.15 + 0.03;
    gain.gain.setValueAtTime(popVol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);

    osc.start(t);
    osc.stop(t + 0.03);
  }

  // --- SOUND EFFECTS ---

  // Button Click / Slate Tap
  playClick() {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.04);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  // Flame Ignite Whoosh
  playFlameWhoosh() {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.5;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, t);
    filter.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
    filter.frequency.exponentialRampToValueAtTime(80, t + 0.45);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.6, t + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(t);
    noise.stop(t + 0.5);
  }

  // Dagger / Blade Unsheathe Strike
  playDagger() {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(450, t + 0.2);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  // Thunder / Lightning Strike
  playThunder() {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    this.playFlameWhoosh();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 1.8);

    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 2.0);
  }

  // Gothic Cathedral Bell Toll
  playBell() {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const partials = [
      { freq: 110, gain: 0.55, decay: 4.5 },
      { freq: 220, gain: 0.45, decay: 3.5 },
      { freq: 275, gain: 0.38, decay: 3.0 },
      { freq: 330, gain: 0.28, decay: 2.5 },
      { freq: 440, gain: 0.22, decay: 2.0 },
      { freq: 660, gain: 0.16, decay: 1.5 }
    ];

    partials.forEach(p => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(p.gain, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + p.decay);
    });
  }

  // Council Bronze Gong
  playGong() {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const freqs = [78, 156, 235, 312, 420];
    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.45 / (i + 1), t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 3.8);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 4.0);
    });
  }

  // Tense Heartbeat
  playHeartbeat() {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    [0, 0.12].forEach(offset => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(58, t + offset);
      osc.frequency.exponentialRampToValueAtTime(32, t + offset + 0.1);

      gain.gain.setValueAtTime(0.65, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + offset);
      osc.stop(t + offset + 0.18);
    });
  }

  // Elimination Death Toll
  playElimination() {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    this.playBell();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(65, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 2.5);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, t);
    filter.frequency.linearRampToValueAtTime(35, t + 2.5);

    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.8);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 3.0);
  }

  // Victory Royal Chime
  playFanfare() {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [
      { f: 261.63, time: 0, dur: 0.35 },
      { f: 329.63, time: 0.28, dur: 0.35 },
      { f: 392.00, time: 0.56, dur: 0.45 },
      { f: 523.25, time: 0.95, dur: 1.4 }
    ];

    notes.forEach(n => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, t + n.time);

      gain.gain.setValueAtTime(0.001, t + n.time);
      gain.gain.linearRampToValueAtTime(0.45, t + n.time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.time + n.dur);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + n.time);
      osc.stop(t + n.time + n.dur);
    });
  }
}

window.soundEngine = new TraitorsAudioEngine();

// Start ambient fire and unlock on first interaction
window.addEventListener('click', () => {
  if (window.soundEngine) window.soundEngine.unlock();
}, { once: true });
window.addEventListener('touchstart', () => {
  if (window.soundEngine) window.soundEngine.unlock();
}, { once: true });
