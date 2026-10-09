import { get, set } from '../state/store';
import { getAudioCtx, unlockAudio } from './audio';
import { mediaUrl } from './media';

/**
 * Soft ambient per world — ONLY your files:
 *   public/ambient/<world>/ambient.mp3
 *
 * Old procedural pads/ocean/beeps are removed.
 * If the file is missing, ambient stays silent.
 * Ducks when a real song plays.
 * Shower water hiss is separate (only when showerOn is true).
 */

let audio: HTMLAudioElement | null = null;
let currentWorld = '';
let musicDucked = false;
let wantedWorld = 'bedroom';
let enabled = true;
let showerWaterOn = false; // off until they turn shower on

const VOL = 0.25; // mild

/** Preloaded ambient Audio elements keyed by resolved URL — cuts CDN start delay */
const ambientCache = new Map<string, HTMLAudioElement>();
const AMBIENT_WORLDS = ['bedroom', 'kitchen', 'garden', 'beach', 'pool', 'shower'];

function waitReady(el: HTMLAudioElement, ms = 2000): Promise<void> {
  if (el.readyState >= 3) return Promise.resolve();
  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(t);
      el.removeEventListener('canplaythrough', finish);
      el.removeEventListener('canplay', finish);
      resolve();
    };
    const t = window.setTimeout(finish, ms);
    el.addEventListener('canplaythrough', finish);
    el.addEventListener('canplay', finish);
  });
}

/** Warm CDN cache for one world's ambient (and beach wave sfx). */
export function preloadAmbient(world: string) {
  const path = mediaUrl(`/ambient/${world}/ambient.mp3`);
  if (!ambientCache.has(path)) {
    try {
      const el = new Audio();
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      el.loop = true;
      el.src = path;
      el.load();
      ambientCache.set(path, el);
    } catch { /* */ }
  }
  // beach ocean waves live in public/sfx (shipped with the game), NOT on the music CDN
  if (world === 'beach') {
    const waveSrc = '/sfx/ocean_waves.mp3';
    if (!ambientCache.has(waveSrc)) {
      try {
        const el = new Audio();
        el.preload = 'auto';
        el.loop = true;
        el.src = waveSrc;
        el.load();
        ambientCache.set(waveSrc, el);
      } catch { /* */ }
    }
  }
}

/** Preload every world's ambient so the first world hop isn't laggy on CDN. */
export function preloadAllAmbients() {
  for (const w of AMBIENT_WORLDS) preloadAmbient(w);
}

function targetVol() {
  if (!get().soundOn || !enabled) return 0;
  return musicDucked ? 0.015 : VOL;
}

function applyVol() {
  if (!audio) return;
  try { audio.volume = targetVol(); } catch { /* */ }
}

function stopFile() {
  if (!audio) return;
  try { audio.pause(); audio.src = ''; } catch { /* */ }
  audio = null;
  currentWorld = '';
  stopWaveLoop();
}

function playFile(world: string) {
  if (!get().soundOn || !enabled) return;
  unlockAudio();
  // same world already playing → just fix volume
  if (audio && currentWorld === world && !audio.paused) {
    applyVol();
    return;
  }
  stopFile();
  // warm this world + keep others buffering in background
  preloadAmbient(world);
  const path = mediaUrl(`/ambient/${world}/ambient.mp3`);
  const a = new Audio();
  a.loop = true;
  a.preload = 'auto';
  a.volume = 0.001;
  a.crossOrigin = 'anonymous'; // needed when loading from CDN
  a.src = path;
  a.onerror = () => {
    // no file → silence (no procedural fallback)
    try { a.pause(); a.src = ''; } catch { /* */ }
    if (audio === a) { audio = null; currentWorld = ''; }
  };
  a.onplaying = () => applyVol();
  audio = a;
  currentWorld = world;
  // wait briefly for CDN buffer so ambient starts cleanly
  waitReady(a, 1800).then(() => {
    if (audio !== a || currentWorld !== world) return;
    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay / missing */ });
    setTimeout(applyVol, 80);
  });
  startWaveLoop(world);
}

/** Ocean waves loop — fades in gradually as they get closer to the water. */
let oceanEl: HTMLAudioElement | null = null;
let oceanTarget = 0; // 0..1 desired loudness
let oceanVol = 0;
let oceanRaf: number | null = null;

function stopWaveLoop() {
  if (oceanRaf != null) { cancelAnimationFrame(oceanRaf); oceanRaf = null; }
  if (oceanEl) {
    try { oceanEl.pause(); oceanEl.src = ''; } catch { /* */ }
    oceanEl = null;
  }
  oceanVol = 0;
  oceanTarget = 0;
}

function oceanTick() {
  oceanRaf = null;
  if (!oceanEl) return;
  // smooth approach — gradual, never instant
  const speed = 0.008; // ~2–3s to full from 0
  if (Math.abs(oceanVol - oceanTarget) > 0.002) {
    oceanVol += (oceanTarget - oceanVol) * speed * 16; // approx frame-independent-ish
    if (Math.abs(oceanVol - oceanTarget) < 0.003) oceanVol = oceanTarget;
  }
  const ducked = musicDucked ? 0.25 : 1;
  try { oceanEl.volume = Math.min(0.7, Math.max(0, oceanVol * 0.55 * ducked)); } catch { /* */ }
  if (oceanEl && (oceanVol > 0.001 || oceanTarget > 0.001)) {
    oceanRaf = requestAnimationFrame(oceanTick);
  }
}

function startWaveLoop(world: string) {
  stopWaveLoop();
  if (world !== 'beach' || !get().soundOn) return;
  try {
    // local public/sfx — not on CDN (MEDIA_BASE only has music + ambient)
    const waveSrc = '/sfx/ocean_waves.mp3';
    preloadAmbient('beach'); // ensure wave is in cache
    const el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
    el.src = waveSrc;
    oceanEl = el;
    oceanVol = 0;
    oceanTarget = 0.25; // soft when just on the beach
    waitReady(el, 1500).then(() => {
      if (oceanEl !== el) return;
      el.play().catch(() => {});
      if (oceanRaf == null) oceanRaf = requestAnimationFrame(oceanTick);
    });
    oceanRaf = requestAnimationFrame(oceanTick);
  } catch { /* */ }
}

/** 0 = far from water, 1 = in / very near the ocean. Call from the beach scene. */
export function setOceanProximity(level: number) {
  if (!oceanEl || currentWorld !== 'beach') return;
  oceanTarget = Math.max(0, Math.min(1, level));
  if (oceanRaf == null) oceanRaf = requestAnimationFrame(oceanTick);
  // ensure playing
  if (oceanEl.paused && get().soundOn) oceanEl.play().catch(() => {});
}

/* ---- shower water only (not ambient theme) ---- */
let waterNodes: { master: GainNode; stops: (() => void)[] } | null = null;

function noiseBuf(ctx: AudioContext, secs = 2) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function noiseLoop(ctx: AudioContext, master: GainNode, opts: { freq: number; q: number; type?: BiquadFilterType; vol: number; lfoHz?: number; lfoDepth?: number }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf(ctx, 3);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = opts.type ?? 'lowpass';
  f.frequency.value = opts.freq;
  f.Q.value = opts.q;
  const g = ctx.createGain();
  g.gain.value = opts.vol;
  src.connect(f).connect(g).connect(master);
  src.start();
  const stops: (() => void)[] = [() => { try { src.stop(); src.disconnect(); } catch { /* */ } }];
  if (opts.lfoHz) {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = opts.lfoHz;
    lg.gain.value = opts.lfoDepth ?? opts.freq * 0.3;
    lfo.connect(lg).connect(f.frequency);
    lfo.start();
    stops.push(() => { try { lfo.stop(); lfo.disconnect(); } catch { /* */ } });
  }
  return stops;
}

function stopWater() {
  if (!waterNodes) return;
  const old = waterNodes;
  try {
    old.master.gain.linearRampToValueAtTime(0.0001, old.master.context.currentTime + 0.3);
  } catch { /* */ }
  setTimeout(() => { old.stops.forEach(fn => fn()); try { old.master.disconnect(); } catch { /* */ } }, 400);
  waterNodes = null;
}

function startWater() {
  if (!get().soundOn || waterNodes) return;
  const ctx = getAudioCtx();
  const master = ctx.createGain();
  master.gain.value = 0.0001;
  master.connect(ctx.destination);
  const stops = [
    ...noiseLoop(ctx, master, { freq: 2400, q: 0.45, type: 'bandpass', vol: 0.45, lfoHz: 0.25, lfoDepth: 500 }),
    ...noiseLoop(ctx, master, { freq: 900, q: 0.35, type: 'lowpass', vol: 0.22, lfoHz: 0.12, lfoDepth: 120 }),
  ];
  master.gain.linearRampToValueAtTime(musicDucked ? 0.02 : 0.09, ctx.currentTime + 0.45);
  waterNodes = { master, stops };
}

export function setShowerWater(on: boolean) {
  showerWaterOn = on;
  if (on && get().world === 'shower' && get().soundOn) startWater();
  else stopWater();
}

export function setAmbientWorld(world: string) {
  wantedWorld = world;
  // always warm cache (even before sound is on) so first play is instant on CDN
  preloadAmbient(world);
  if (!get().soundOn || !enabled) return;
  playFile(world);
  // water only when shower is on in shower world
  if (world === 'shower' && showerWaterOn) startWater();
  else stopWater();
}

export function setMusicPlaying(playing: boolean) {
  musicDucked = playing;
  applyVol();
  try { set({ musicPlaying: playing }); } catch { /* */ }
  if (waterNodes) {
    const t = waterNodes.master.context.currentTime;
    waterNodes.master.gain.cancelScheduledValues(t);
    waterNodes.master.gain.linearRampToValueAtTime(playing ? 0.015 : 0.09, t + 0.3);
  }
}

export function stopAmbient() {
  stopFile();
  stopWater();
}

export function setAmbientEnabled(on: boolean) {
  enabled = on;
  if (!on) stopAmbient();
  else if (get().soundOn) playFile(wantedWorld);
}

export function startAmbientIfNeeded() {
  // kick off CDN preload for every world as soon as sound is enabled
  preloadAllAmbients();
  if (get().soundOn && enabled) playFile(wantedWorld || get().world || 'bedroom');
}


/** During intimate moment: quiet the shower water (slow/soft). */
export function setIntimateAudio(on: boolean) {
  if (!waterNodes) return;
  const t = waterNodes.master.context.currentTime;
  waterNodes.master.gain.cancelScheduledValues(t);
  // normal ~0.09, intimate much softer/slower feel
  waterNodes.master.gain.linearRampToValueAtTime(on ? 0.025 : (musicDucked ? 0.015 : 0.09), t + 0.6);
}

/** Hard-stop ambient file + wave loop + duck shower (for intimate moment). */
export function stopAllAmbient() {
  stopFile();
  stopWaveLoop();
  if (waterNodes) {
    const t = waterNodes.master.context.currentTime;
    waterNodes.master.gain.cancelScheduledValues(t);
    waterNodes.master.gain.linearRampToValueAtTime(0.02, t + 0.4);
  }
}
