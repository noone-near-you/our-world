import { get } from '../state/store';

let ctx: AudioContext | null = null;
export function getAudioCtx() {
  if (!ctx) {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export function unlockAudio() { getAudioCtx(); }

export function blip(freq = 520, dur = 0.12, vol = 0.05) {
  if (!ctx || !get().soundOn) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = 'sine'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur);
}

export type Sfx =
  | 'step' | 'hug' | 'kiss' | 'tease' | 'poke' | 'slap' | 'wave'
  | 'laugh' | 'sigh' | 'chuckle' | 'smile' | 'chime' | 'giggle' | 'song' | 'moan' | 'splash' | 'wave'
  | 'click' | 'power'
  /* kitchen */
  | 'cooking' | 'chop' | 'yummy'
  /* dialogue-game voicelets */
  | 'hmm' | 'uhh' | 'hm' | 'hehe' | 'heh' | 'aww' | 'oh' | 'mm' | 'shy' | 'softlaugh' | 'boylaugh' | 'girllaugh' | 'agree' | 'breath' | 'female_mm'
  | 'foh' | 'fuhh'  // female oh / uhh — separate from male so they never collide
  | 'heavy' | 'heavy_stop';  // her heavy breathing start / stop

let noise: AudioBuffer | null = null;
function ensureNoise() {
  if (!ctx) return null;
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

function tone(f0: number, f1: number, dur: number, vol: number, type: OscillatorType = 'sine', delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(Math.max(20, f0), t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + Math.max(0.01, dur));
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}
function burst(dur: number, vol: number, freq: number, delay = 0) {
  if (!ctx) return;
  const buf = ensureNoise(); if (!buf) return;
  const t = ctx.currentTime + delay, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(ctx.destination); src.start(t); src.stop(t + dur + 0.02);
}

/** Formant-ish short vocalization. base ≈ pitch (him ~150–190, her ~280–420). */
function vocal(base: number, shape: 'hum' | 'uh' | 'heh' | 'ha' | 'aw' | 'oh' | 'mm', dur: number, vol: number, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; o2.type = 'triangle';
  const formant = shape === 'hum' || shape === 'mm' ? base * 1.6
    : shape === 'uh' ? base * 2.2
    : shape === 'heh' || shape === 'ha' ? base * 3.4
    : shape === 'aw' ? base * 2.0
    : base * 2.8;
  o.frequency.setValueAtTime(base, t);
  o.frequency.exponentialRampToValueAtTime(base * (shape === 'ha' || shape === 'heh' ? 1.12 : 0.92), t + dur);
  o2.frequency.setValueAtTime(base * 1.01, t);
  f.type = 'bandpass'; f.frequency.setValueAtTime(formant, t); f.Q.value = shape === 'heh' || shape === 'ha' ? 2.2 : 1.4;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(vol * 0.7, t + dur * 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f); o2.connect(f); f.connect(g); g.connect(ctx.destination);
  o.start(t); o2.start(t); o.stop(t + dur + 0.03); o2.stop(t + dur + 0.03);
}

function voiceLaugh(base: number, count: number, gap: number, delay: number, vol: number) {
  if (!ctx) return;
  for (let i = 0; i < count; i++) {
    const t = ctx.currentTime + delay + i * gap;
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(base * (1 - i * 0.02), t);
    o.frequency.exponentialRampToValueAtTime(base * (0.88 - i * 0.02), t + gap * 0.75);
    f.type = 'bandpass'; f.frequency.value = base * 3.1; f.Q.value = 1.8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + gap * 0.8);
    o.connect(f).connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + gap);
  }
}


/**
 * Your voice files in public/sfx/
 * Change VOLUME here (0..1) per sound.
 * Change FILE name if you rename a file.
 */
export const SFX_FILES: Record<string, { file: string; vol: number }> = {
  // actions
  kiss:        { file: 'kiss.mp3',           vol: 0.85 },
  hug:         { file: 'man_hug.mp3',         vol: 0.8 },
  hug_girl:    { file: 'girl_hugging.wav',   vol: 0.85 },
  slap:        { file: 'slap.wav',           vol: 0.75 },
  step:        { file: 'step.mp3',           vol: 0.5 },   // optional; procedural if missing

  // male (boyfriend) — use freely so talk feels real
  hmm:         { file: 'male_mm_hmm.mp3',    vol: 0.75 },   // soft agreement / warmth
  hm:          { file: 'male_mm_hmm.mp3',    vol: 0.65 },  // quieter nod
  mm:          { file: 'male_mm_hmm.mp3',    vol: 0.75 },  // after kiss / soft
  agree:       { file: 'male_mm_hmm.mp3',    vol: 0.7 },
  heh:         { file: 'man_laugh.mp3',      vol: 0.6 },   // light tease laugh
  chuckle:     { file: 'man_laugh.mp3',      vol: 0.7 },   // amused
  boylaugh:    { file: 'man_laugh.mp3',      vol: 0.75 },
  laugh:       { file: 'man_laugh.mp3',      vol: 0.7 },
  uhh:         { file: 'male_uhh.mp3',       vol: 0.30 },   // surprised / confused "huh?"
  oh:          { file: 'male_uhh.mp3',       vol: 0.20 },

  // female (girlfriend) — varied reactions; giggle sparingly so she doesn't spam laugh
  hehe:        { file: 'girl-giggle.mp3',    vol: 0.75 },
  giggle:      { file: 'girl-giggle.mp3',    vol: 0.75 },
  smile:       { file: 'girl-giggle.mp3',    vol: 0.65 },
  softlaugh:   { file: 'girl-giggle.mp3',    vol: 0.65 },
  girllaugh:   { file: 'girl-giggle.mp3',    vol: 0.75 },
  shy:         { file: 'girl_scared.mp3',    vol: 0.75 },  // nervous / startled
  sigh:        { file: 'girl_sigh.mp3',      vol: 0.75 },  // content / soft sigh
  breath:      { file: 'girl_sigh.mp3',      vol: 0.55 },  // soft breath
  female_mm:   { file: 'female_mm.mp3',      vol: 0.60 },  // short soft laugh — rare
  foh:         { file: 'female_oh.mp3',      vol: 0.75 },   // soft "oh" — surprised / touched
  fuhh:        { file: 'female_uhh.mp3',     vol: 0.75 },   // soft "uhh" — hesitant / thinking

  // kitchen
  cooking:     { file: 'cooking_sound.mp3',       vol: 0.7 },  // pan / stove (not chopping)
  chop:        { file: 'cutting_vegetables.mp3',  vol: 0.75 }, // chopping veggies
  yummy:       { file: 'yummy.mp3',               vol: 0.85 }, // she likes the food

  // intimate breathing (her)
  heavy:       { file: 'heavy_breathing.wav',     vol: 0.9 },  // while touching / fingers

  // special
  sleeping:    { file: 'sleeping.mp3',       vol: 0.8 },
  moan:        { file: 'moan.mp3',           vol: 0.90 },
  splash:      { file: 'water_splash.mp3',   vol: 0.85 },
  wave:        { file: 'ocean_waves.mp3',    vol: 0.55 },
};

/** Adjust moan loudness here (0..1). Used in shower intimate moment. */
export const MOAN_VOLUME = 0.90;
/** Moan during intimate blackout: full clip, then restart from 0 when it ends. */
let moanEl: HTMLAudioElement | null = null;
let moanActive = false;

export function startMoanLoop() {
  stopMoanLoop();
  if (!get().soundOn) return;
  moanActive = true;
  try {
    const meta = SFX_FILES.moan;
    const el = new Audio(`/sfx/${meta?.file ?? 'moan.mp3'}`);
    el.loop = false;
    el.preload = 'auto';
    el.volume = Math.min(1, meta?.vol ?? MOAN_VOLUME);
    el.onended = () => {
      if (!moanActive || !moanEl) return;
      try {
        moanEl.currentTime = 0;
        moanEl.play().catch(() => {});
      } catch { /* */ }
    };
    moanEl = el;
    unlockAudio();
    el.play().catch(() => {});
  } catch { /* */ }
}

export function stopMoanLoop() {
  moanActive = false;
  if (moanEl) {
    try {
      moanEl.onended = null;
      moanEl.pause();
      moanEl.currentTime = 0;
      moanEl.src = '';
    } catch { /* */ }
    moanEl = null;
  }
}

/**
 * Procedural footstep — no file needed.
 * Soft indoor step: light heel + sole scrape (works for her walk-in).
 */
function footstep(vol = 0.28) {
  if (!ctx) return;
  const t = ctx.currentTime;
  // light heel (slightly higher = lighter / feminine step)
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(60, t + 0.07);
  g.gain.setValueAtTime(vol * 0.65, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + 0.12);
  // sole body (filtered noise)
  const buf = ensureNoise();
  if (buf) {
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g2 = ctx.createGain();
    src.buffer = buf;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(520, t);
    f.frequency.exponentialRampToValueAtTime(200, t + 0.09);
    f.Q.value = 0.8;
    g2.gain.setValueAtTime(vol * 0.85, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    src.connect(f).connect(g2).connect(ctx.destination);
    src.start(t);
    src.stop(t + 0.12);
    // soft toe tap
    const src2 = ctx.createBufferSource();
    const f2 = ctx.createBiquadFilter();
    const g3 = ctx.createGain();
    src2.buffer = buf;
    f2.type = 'bandpass';
    f2.frequency.value = 1400;
    f2.Q.value = 1.6;
    g3.gain.setValueAtTime(0.0001, t);
    g3.gain.linearRampToValueAtTime(vol * 0.35, t + 0.02);
    g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    src2.connect(f2).connect(g3).connect(ctx.destination);
    src2.start(t + 0.015);
    src2.stop(t + 0.08);
  }
}

/** Prefer public/sfx/<name>.mp3; if missing, run fallback().
 *  Optional maxMs: stop the clip early so it matches short animations (e.g. splash). */
function playSfxOr(name: string, vol: number, fallback: () => void, maxMs?: number) {
  const meta = SFX_FILES[name];
  const file = meta?.file ?? `${name}.mp3`;
  const v = meta?.vol ?? vol;
  try {
    const el = new Audio();
    el.src = `/sfx/${file}`;
    el.volume = Math.min(1, v);
    let done = false;
    const fail = () => { if (!done) { done = true; fallback(); } };
    const ok = () => { done = true; };
    el.addEventListener('error', fail);
    el.addEventListener('playing', ok);
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(fail);
    setTimeout(() => { if (!done) fail(); }, 320);
    // cut long mp3s so they end with the visual (splash droplets last ~0.9–1.2s)
    if (maxMs && maxMs > 0) {
      setTimeout(() => {
        try { el.pause(); el.currentTime = 0; el.src = ''; } catch { /* */ }
      }, maxMs);
    }
  } catch { fallback(); }
}

/** Play a mapped file by key (no procedural fallback). */
export function playMappedSfx(key: string) {
  const meta = SFX_FILES[key];
  if (!meta) return;
  try {
    const el = new Audio(`/sfx/${meta.file}`);
    el.volume = Math.min(1, meta.vol);
    el.play().catch(() => {});
  } catch { /* */ }
}

let sfxMuted = false;
/** Mute all sfx except moan (used during intimate blackout). */
export function setSfxMuted(on: boolean) { sfxMuted = on; }

/** Her heavy breathing — plays while touching; stop when they separate. */
let heavyEl: HTMLAudioElement | null = null;
let heavyStopTimer: ReturnType<typeof setTimeout> | null = null;

export function startHeavyBreath(ms?: number) {
  if (!get().soundOn) return;
  stopHeavyBreath();
  try {
    const meta = SFX_FILES.heavy;
    const el = new Audio(`/sfx/${meta?.file ?? 'heavy_breathing.wav'}`);
    el.volume = Math.min(1, meta?.vol ?? 0.7);
    el.loop = !ms; // loop if no duration given; otherwise play once for ms
    heavyEl = el;
    el.play().catch(() => {});
    if (ms && ms > 0) {
      heavyStopTimer = setTimeout(() => stopHeavyBreath(), ms);
    }
  } catch { /* */ }
}

export function stopHeavyBreath() {
  if (heavyStopTimer) { clearTimeout(heavyStopTimer); heavyStopTimer = null; }
  if (heavyEl) {
    try { heavyEl.pause(); heavyEl.currentTime = 0; } catch { /* */ }
    heavyEl = null;
  }
}

export function sfx(name: Sfx) {
  if (!get().soundOn) return;
  if (sfxMuted && name !== 'moan') return;
  getAudioCtx();
  if (!ctx) return;
  switch (name) {
    case 'step':
      // always procedural — no step.mp3 required; clear steps for her walk-in
      getAudioCtx();
      footstep(0.28);
      break;
    case 'hug':
      // both of them react on a hug
      playSfxOr('hug', 0.8, () => {});
      setTimeout(() => playSfxOr('hug_girl', 0.85, () => { vocal(320, 'mm', 0.4, 0.14); }), 180);
      break;
    case 'kiss':
      playSfxOr('kiss', 0.8, () => {});
      break;
    case 'tease':
      playSfxOr('tease', 0.6, () => {});
      break;
    case 'poke': tone(420, 640, 0.08, 0.1, 'triangle'); break;
    case 'slap':
      playSfxOr('slap', 0.7, () => {});
      break;
    case 'wave': tone(660, 880, 0.12, 0.07); tone(880, 990, 0.14, 0.07, 'sine', 0.14); break;
    case 'laugh':
      playSfxOr('laugh', 0.65, () => { voiceLaugh(400, 5, 0.11, 0, 0.18); voiceLaugh(170, 4, 0.13, 0.1, 0.16); });
      break;
    case 'girllaugh':
      playSfxOr('girllaugh', 0.65, () => { voiceLaugh(420, 5, 0.1, 0, 0.18); });
      break;
    case 'boylaugh':
      playSfxOr('boylaugh', 0.65, () => { voiceLaugh(165, 4, 0.14, 0, 0.17); });
      break;
    case 'giggle':
      playSfxOr('giggle', 0.6, () => { voiceLaugh(520, 4, 0.08, 0, 0.16); voiceLaugh(190, 2, 0.12, 0.15, 0.1); });
      break;
    case 'softlaugh': voiceLaugh(380, 3, 0.11, 0, 0.14); break;
    case 'chuckle':
      playSfxOr('chuckle', 0.6, () => { voiceLaugh(155, 3, 0.13, 0, 0.16); });
      break;
    case 'smile':
      playSfxOr('hehe', 0.55, () => { vocal(380, 'heh', 0.14, 0.16, 0); vocal(400, 'heh', 0.14, 0.14, 0.14); });
      break;
    case 'hehe':
      playSfxOr('hehe', 0.6, () => {
        vocal(400, 'heh', 0.13, 0.18, 0);
        vocal(420, 'heh', 0.13, 0.16, 0.12);
        vocal(390, 'heh', 0.12, 0.14, 0.24);
      });
      break;
    case 'heh':
      playSfxOr('heh', 0.55, () => { vocal(165, 'heh', 0.16, 0.18); vocal(155, 'heh', 0.14, 0.14, 0.14); });
      break;
    case 'hmm':
      playSfxOr('hmm', 0.7, () => { vocal(150, 'hum', 0.55, 0.26); vocal(145, 'mm', 0.4, 0.16, 0.18); });
      break;
    case 'mm':
      playSfxOr('mm', 0.65, () => { vocal(170, 'mm', 0.4, 0.22); });
      break;
    case 'uhh':
      playSfxOr('uhh', 0.6, () => { vocal(300, 'uh', 0.35, 0.2); });
      break;
    case 'shy':
      playSfxOr('shy', 0.6, () => { vocal(340, 'uh', 0.3, 0.18); vocal(360, 'heh', 0.12, 0.12, 0.22); });
      break;
    case 'hm':
      playSfxOr('hm', 0.6, () => { vocal(165, 'hum', 0.28, 0.2); });
      break;
    case 'agree':
      playSfxOr('hm', 0.55, () => { vocal(155, 'hum', 0.25, 0.18); });
      break;
    case 'aww':
      playSfxOr('aww', 0.6, () => { vocal(200, 'aw', 0.45, 0.2); vocal(320, 'aw', 0.35, 0.14, 0.08); });
      break;
    case 'oh':
      playSfxOr('oh', 0.6, () => { vocal(175, 'oh', 0.3, 0.2); });
      break;
    case 'breath':
      playSfxOr('breath', 0.55, () => { burst(0.4, 0.1, 700); tone(200, 140, 0.35, 0.05); });
      break;
    case 'chime': tone(880, 880, 0.55, 0.06); tone(1320, 1320, 0.65, 0.045, 'sine', 0.12); break;
    case 'song': break;
    case 'splash':
      // water splash — cut at ~1.1s so it ends with the droplet animation (mp3 is much longer)
      playSfxOr('splash', 0.85, () => {
        burst(0.18, 0.42, 1800); burst(0.12, 0.3, 2400, 0.05);
        tone(400, 180, 0.2, 0.09, 'sawtooth'); burst(0.25, 0.2, 900, 0.1);
      }, 1100);
      break;
    case 'wave':
      playSfxOr('wave', 0.55, () => {
        burst(0.7, 0.07, 350); tone(90, 50, 1.2, 0.05, 'sine'); burst(0.5, 0.06, 280, 0.3);
      });
      break;
    case 'moan': {
      const meta = SFX_FILES.moan;
      try {
        const m = new Audio(`/sfx/${meta?.file ?? 'moan.mp3'}`);
        m.volume = meta?.vol ?? MOAN_VOLUME;
        m.play().catch(() => {});
      } catch { /* */ }
      break;
    }
    case 'female_mm':
      playSfxOr('female_mm', 0.75, () => { vocal(340, 'mm', 0.35, 0.18); });
      break;
    case 'sigh':
      playSfxOr('sigh', 0.55, () => { burst(0.45, 0.1, 900); vocal(150, 'hum', 0.5, 0.12, 0.05); });
      break;
    case 'cooking':
      playSfxOr('cooking', 0.7, () => { burst(0.5, 0.08, 400); tone(120, 90, 0.6, 0.06); });
      break;
    case 'chop':
      playSfxOr('chop', 0.75, () => {
        burst(0.05, 0.2, 2000); burst(0.05, 0.18, 1800, 0.12); burst(0.05, 0.16, 2200, 0.24);
      });
      break;
    case 'yummy':
      playSfxOr('yummy', 0.85, () => { vocal(360, 'mm', 0.35, 0.2); vocal(400, 'mm', 0.25, 0.14, 0.15); });
      break;
    case 'foh':
      playSfxOr('foh', 0.8, () => { vocal(360, 'oh', 0.3, 0.18); });
      break;
    case 'fuhh':
      playSfxOr('fuhh', 0.8, () => { vocal(320, 'uh', 0.35, 0.18); });
      break;
    case 'heavy':
      // start looping; stop with heavy_stop when touch ends
      startHeavyBreath();
      break;
    case 'heavy_stop':
      stopHeavyBreath();
      break;
  }
}

export function actSfx(act: 'hug' | 'kiss' | 'tease' | 'slap' | 'flower') {
  if (act === 'flower') sfx('chime');
  else sfx(act);
}
