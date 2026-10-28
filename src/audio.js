/**
 * Web Audio API synthesized sound effects for 3D Blackjack.
 * No external audio files used.
 */

let audioCtx = null;
let masterGain = null;
let isSoundEnabled = true;
let currentVolume = 0.8;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function getAudioDestination(ctx) {
  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(isSoundEnabled ? currentVolume : 0, ctx.currentTime);
    masterGain.connect(ctx.destination);
  }
  return masterGain;
}

export function setSoundEnabled(enabled) {
  isSoundEnabled = !!enabled;
  if (masterGain && audioCtx) {
    masterGain.gain.setValueAtTime(isSoundEnabled ? currentVolume : 0, audioCtx.currentTime);
  }
}

export function isSoundMuted() {
  return !isSoundEnabled;
}

export function setSoundVolume(volume) {
  currentVolume = Math.max(0, Math.min(1, volume));
  if (masterGain && audioCtx && isSoundEnabled) {
    masterGain.gain.setValueAtTime(currentVolume, audioCtx.currentTime);
  }
}

export function getSoundVolume() {
  return currentVolume;
}

/**
 * Synthesizes a card sliding friction / deal sound.
 */
export function playCardSlideSound() {
  if (!isSoundEnabled || currentVolume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const dest = getAudioDestination(ctx);

  const now = ctx.currentTime;
  const duration = 0.12;

  // White noise buffer for friction / paper scrape
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }

  const whiteNoise = ctx.createBufferSource();
  whiteNoise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2800, now);
  filter.frequency.exponentialRampToValueAtTime(800, now + duration);
  filter.Q.setValueAtTime(2.5, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.24, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  whiteNoise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  whiteNoise.start(now);
  whiteNoise.stop(now + duration);

  // Soft low felt landing tap
  const osc = ctx.createOscillator();
  const tapGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, now + duration * 0.7);
  osc.frequency.exponentialRampToValueAtTime(45, now + duration * 0.7 + 0.05);

  tapGain.gain.setValueAtTime(0.08, now + duration * 0.7);
  tapGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.7 + 0.05);

  osc.connect(tapGain);
  tapGain.connect(dest);

  osc.start(now + duration * 0.7);
  osc.stop(now + duration * 0.7 + 0.05);
}

/**
 * Synthesizes a card flip / reveal snap sound.
 */
export function playCardFlipSound() {
  if (!isSoundEnabled || currentVolume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const dest = getAudioDestination(ctx);

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.exponentialRampToValueAtTime(160, now + 0.08);

  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

  osc.connect(gain);
  gain.connect(dest);

  osc.start(now);
  osc.stop(now + 0.08);
}

/**
 * Synthesizes a crisp ceramic casino chip clink.
 */
export function playChipClinkSound() {
  if (!isSoundEnabled || currentVolume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const dest = getAudioDestination(ctx);

  const now = ctx.currentTime;
  const pitchVar = 0.95 + Math.random() * 0.1; // slight random variation

  // Resonant body clink
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(2800 * pitchVar, now);
  osc1.frequency.exponentialRampToValueAtTime(1200 * pitchVar, now + 0.04);

  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(4100 * pitchVar, now);
  osc2.frequency.exponentialRampToValueAtTime(2200 * pitchVar, now + 0.035);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.22, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(dest);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.05);
  osc2.stop(now + 0.05);

  // Micro-click transient
  const clickBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.01), ctx.sampleRate);
  const data = clickBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const clickSource = ctx.createBufferSource();
  clickSource.buffer = clickBuffer;
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.15, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
  clickSource.connect(clickGain);
  clickGain.connect(dest);
  clickSource.start(now);
}

/**
 * Synthesizes a chip collection / sweep sound.
 */
export function playChipCollectSound() {
  if (!isSoundEnabled || currentVolume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      playChipClinkSound();
    }, i * 40);
  }
}

/**
 * Synthesizes a pleasant casino win chime.
 */
export function playWinSound() {
  if (!isSoundEnabled || currentVolume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const dest = getAudioDestination(ctx);

  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startTime = now + idx * 0.08;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(0.12, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(startTime);
    osc.stop(startTime + 0.35);
  });
}

/**
 * Synthesizes a subtle low tone for bust / loss.
 */
export function playBustSound() {
  if (!isSoundEnabled || currentVolume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const dest = getAudioDestination(ctx);

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);

  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

  osc.connect(gain);
  gain.connect(dest);

  osc.start(now);
  osc.stop(now + 0.3);
}

/**
 * Synthesizes a multi-step card shuffle riffle sound.
 */
export function playShuffleSound() {
  if (!isSoundEnabled || currentVolume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const dest = getAudioDestination(ctx);

  // Riffle shuffle simulation: rapid succession of quick card friction clicks
  for (let i = 0; i < 7; i++) {
    setTimeout(() => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320 + Math.random() * 180, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.04);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(now);
      osc.stop(now + 0.04);
    }, i * 35);
  }
}

/**
 * Synthesizes an energetic celebratory level-up fanfare.
 */
export function playLevelUpSound() {
  if (!isSoundEnabled || currentVolume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const dest = getAudioDestination(ctx);

  const now = ctx.currentTime;
  // Ascending brass/bell arpeggio: C4, E4, G4, C5, E5, G5, C6 triumph chord
  const chordNotes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];

  chordNotes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startTime = now + idx * 0.055;
    const duration = 0.55;

    osc.type = idx >= 4 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(0.14, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(startTime);
    osc.stop(startTime + duration);
  });

  // Bright shimmer bell at the pinnacle
  setTimeout(() => {
    if (!audioCtx) return;
    const peakTime = audioCtx.currentTime;
    const bellOsc = audioCtx.createOscillator();
    const bellGain = audioCtx.createGain();
    bellOsc.type = 'sine';
    bellOsc.frequency.setValueAtTime(2093.00, peakTime); // C7 chime

    bellGain.gain.setValueAtTime(0.12, peakTime);
    bellGain.gain.exponentialRampToValueAtTime(0.0001, peakTime + 0.6);

    bellOsc.connect(bellGain);
    bellGain.connect(dest);

    bellOsc.start(peakTime);
    bellOsc.stop(peakTime + 0.6);
  }, 350);
}
