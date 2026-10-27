/** Procedural dice rattle via Web Audio — no external assets. */

/** Host + phone share the same roll duration so reveal aligns. */
export const DICE_ROLL_MS = 2200;

/** One context for the tab — unlock on any gesture, then useEffect can play. */
let sharedCtx = null;
let keepAliveOsc = null;
let keepAliveGain = null;

function ensureAudioContext(ref) {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new AC();
    keepAliveOsc = null;
    keepAliveGain = null;
  }
  if (ref) ref.current = sharedCtx;
  return sharedCtx;
}

function ensureKeepAlive(ctx) {
  if (!ctx || keepAliveOsc) return;
  try {
    keepAliveOsc = ctx.createOscillator();
    keepAliveGain = ctx.createGain();
    keepAliveGain.gain.value = 0.00001;
    keepAliveOsc.connect(keepAliveGain);
    keepAliveGain.connect(ctx.destination);
    keepAliveOsc.start();
  } catch {
    keepAliveOsc = null;
    keepAliveGain = null;
  }
}

/** Call from a click/tap so later synced rolls are allowed to make sound. */
export function unlockDiceAudio(audioRef) {
  const ctx = ensureAudioContext(audioRef);
  if (!ctx) return Promise.resolve();
  const arm = () => {
    ensureKeepAlive(ctx);
    try {
      const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      /* ignore */
    }
  };
  if (ctx.state === 'suspended') {
    return ctx.resume().then(arm).catch(() => {});
  }
  arm();
  return Promise.resolve();
}

function safeRamp(gainParam, value, time) {
  try {
    gainParam.exponentialRampToValueAtTime(Math.max(0.0001, value), time);
  } catch {
    try {
      gainParam.linearRampToValueAtTime(Math.max(0.0001, value), time);
    } catch {
      /* ignore */
    }
  }
}

function noiseBurst(ctx, start, dur, gainPeak = 0.18) {
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
  filter.frequency.value = 900 + Math.random() * 1100;
  filter.Q.value = 0.65;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  safeRamp(gain.gain, gainPeak, start + 0.008);
  safeRamp(gain.gain, 0.0001, start + dur);
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
  try {
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, start + 0.06);
  } catch {
    osc.frequency.linearRampToValueAtTime(freq * 0.55, start + 0.06);
  }
  gain.gain.setValueAtTime(0.0001, start);
  safeRamp(gain.gain, 0.16, start + 0.01);
  safeRamp(gain.gain, 0.0001, start + 0.08);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + 0.1);
}

function withRunningContext(audioRef, run) {
  const ctx = ensureAudioContext(audioRef);
  if (!ctx) return;
  const kick = () => {
    try {
      run(ctx);
    } catch {
      /* ignore audio graph errors */
    }
  };
  if (ctx.state === 'suspended') {
    ctx.resume().then(kick).catch(() => {});
  } else {
    kick();
  }
}

/**
 * Dense dice rattle for the full roll window.
 * @param {{ current?: AudioContext|null }|null} audioRef
 * @param {number} [durationSec]
 */
export function playDiceRollSound(audioRef, durationSec = DICE_ROLL_MS / 1000) {
  const dur = Math.max(0.6, Number(durationSec) || DICE_ROLL_MS / 1000);
  withRunningContext(audioRef, (ctx) => {
    const now = ctx.currentTime;
    const end = now + dur;
    let t = now;
    let i = 0;
    while (t < end - 0.04) {
      const progress = (t - now) / dur;
      const gap = 0.028 + progress * 0.085 + Math.random() * 0.012;
      const peak = (0.2 - progress * 0.08) + Math.random() * 0.05;
      noiseBurst(ctx, t, 0.035 + Math.random() * 0.04, Math.max(0.06, peak));
      if (i % 2 === 0) clickTone(ctx, t + 0.008, 150 + Math.random() * 160);
      t += gap;
      i += 1;
    }
    clickTone(ctx, end - 0.08, 140);
    noiseBurst(ctx, end - 0.05, 0.06, 0.09);
  });
}

/** Soft confirm when hits are revealed. */
export function playDiceRevealSound(audioRef, hits = 0) {
  withRunningContext(audioRef, (ctx) => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = hits > 0 ? 520 : 280;
    gain.gain.setValueAtTime(0.0001, now);
    safeRamp(gain.gain, hits > 0 ? 0.2 : 0.12, now + 0.02);
    safeRamp(gain.gain, 0.0001, now + (hits > 0 ? 0.22 : 0.14));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  });
}

/** Phone buzz while shaking / on reveal. */
export function vibrateDice(kind = 'roll') {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    if (kind === 'reveal') {
      navigator.vibrate([30, 40, 70]);
      return;
    }
    navigator.vibrate([
      35, 45, 28, 40, 32, 50, 25, 35, 40, 45,
      30, 55, 28, 40, 35, 50, 40, 60, 50, 80,
    ]);
  } catch {
    /* ignore */
  }
}
