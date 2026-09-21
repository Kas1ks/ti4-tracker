/** Procedural dice rattle via Web Audio — no external assets. */

function ensureAudioContext(ref) {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ref.current || ref.current.state === 'closed') {
    ref.current = new AC();
  }
  return ref.current;
}

function noiseBurst(ctx, start, dur, gainPeak = 0.12) {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * dur));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1200 + Math.random() * 800;
  filter.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(start);
  src.stop(start + dur + 0.02);
}

function clickTone(ctx, start, freq = 180) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, start);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.55, start + 0.06);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.1, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.08);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + 0.1);
}

/** Short dice-shaker burst (~0.6s). */
export function playDiceRollSound(audioRef) {
  const ctx = ensureAudioContext(audioRef);
  if (!ctx) return;
  const run = () => {
    const now = ctx.currentTime;
    for (let i = 0; i < 8; i += 1) {
      const t = now + i * 0.055 + Math.random() * 0.02;
      noiseBurst(ctx, t, 0.045 + Math.random() * 0.03, 0.08 + Math.random() * 0.05);
      if (i % 2 === 0) clickTone(ctx, t + 0.01, 160 + Math.random() * 120);
    }
  };
  if (ctx.state === 'suspended') {
    ctx.resume().then(run).catch(() => {});
  } else {
    run();
  }
}

/** Soft confirm when hits are revealed. */
export function playDiceRevealSound(audioRef, hits = 0) {
  const ctx = ensureAudioContext(audioRef);
  if (!ctx) return;
  const run = () => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = hits > 0 ? 520 : 280;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(hits > 0 ? 0.14 : 0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (hits > 0 ? 0.22 : 0.14));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  };
  if (ctx.state === 'suspended') {
    ctx.resume().then(run).catch(() => {});
  } else {
    run();
  }
}

export function vibrateDice() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([25, 40, 25, 40, 50]);
    }
  } catch {
    /* ignore */
  }
}
