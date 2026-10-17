import { get } from '../state/store';
import { getAudioCtx } from './audio';
import { setRainSound } from './ambient';

/* ================= SECRET PROPOSAL WORLD: audio =================
 * Everything is synthesized (no files): a slow romantic piano + strings loop, a soft crowd murmur, cheers/claps and firework booms. */
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
let noiseBuf: AudioBuffer | null = null;
function noise(c: AudioContext) {
  if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  return noiseBuf;
}
function nburst(c: AudioContext, out: AudioNode, t: number, dur: number, vol: number, freq: number, type: BiquadFilterType = 'bandpass', q = 0.8, attack = 0.002) {
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noise(c); s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}

/* ---------- music ---------- */
const BPM = 64, BEAT = 60 / BPM;
// 8 bars (D  A  Bm  F#m  G  D  G  A): bass, arpeggio notes (low→high), pad chord, melody [beat, midi, beats]
const BARS: { bass: number; arp: number[]; pad: number[]; mel: [number, number, number][] }[] = [
  { bass: 38, arp: [50, 57, 62, 66], pad: [62, 66, 69], mel: [[0, 78, 1.5], [1.5, 81, 0.5], [2, 83, 1], [3, 81, 1]] },
  { bass: 37, arp: [49, 57, 61, 64], pad: [61, 64, 69], mel: [[0, 85, 1.5], [1.5, 83, 0.5], [2, 81, 1], [3, 85, 1]] },
  { bass: 35, arp: [47, 54, 59, 62], pad: [59, 62, 66], mel: [[0, 83, 1.5], [1.5, 86, 0.5], [2, 85, 1], [3, 83, 1]] },
  { bass: 30, arp: [42, 49, 54, 57], pad: [57, 61, 66], mel: [[0, 85, 1.5], [1.5, 81, 0.5], [2, 78, 1], [3, 81, 1]] },
  { bass: 43, arp: [43, 50, 55, 59], pad: [59, 62, 67], mel: [[0, 79, 1.5], [1.5, 83, 0.5], [2, 86, 1], [3, 83, 1]] },
  { bass: 38, arp: [50, 57, 62, 66], pad: [62, 66, 69], mel: [[0, 81, 1.5], [1.5, 78, 0.5], [2, 74, 1], [3, 78, 1]] },
  { bass: 43, arp: [43, 50, 55, 59], pad: [59, 62, 67], mel: [[0, 79, 1.5], [1.5, 83, 0.5], [2, 86, 1], [3, 88, 1]] },
  { bass: 45, arp: [45, 52, 57, 61], pad: [61, 64, 69], mel: [[0, 85, 2], [2, 83, 1], [3, 81, 1]] },
];
const ARP_PAT = [0, 1, 2, 3, 2, 1, 2, 1];
let mTimer: number | null = null, mGain: GainNode | null = null, mBar = 0, mNext = 0, mHall: ConvolverNode | null = null, mDry: GainNode | null = null;

function hallIR(c: AudioContext) {
  const len = c.sampleRate * 2.8, ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  return ir;
}
function piano(c: AudioContext, out: AudioNode, t: number, midi: number, dur: number, vol: number) {
  const f = mtof(midi), g = c.createGain(), lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = Math.min(6000, f * 7);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const [mul, a, type] of [[1, 1, 'triangle'], [2, 0.32, 'sine'], [3, 0.12, 'sine'], [4, 0.05, 'sine']] as [number, number, OscillatorType][]) {
    const o = c.createOscillator(), og = c.createGain(); o.type = type; o.frequency.value = f * mul; og.gain.value = a; o.connect(og).connect(lp); o.start(t); o.stop(t + dur + 0.05);
  }
  lp.connect(g).connect(out);
}
function strings(c: AudioContext, out: AudioNode, t: number, midi: number, dur: number, vol: number) {
  const g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.9); g.gain.setValueAtTime(vol, t + dur - 0.9); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
  for (const det of [-7, 7]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(midi); o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 0.5); }
  lp.connect(g).connect(out);
}
function violin(c: AudioContext, out: AudioNode, t: number, midi: number, dur: number, vol: number) {
  const g = c.createGain(), lp = c.createBiquadFilter(), lfo = c.createOscillator(), lg = c.createGain(); lp.type = 'lowpass'; lp.frequency.value = 2600;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.12); g.gain.setValueAtTime(vol, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
  lfo.frequency.value = 5.2; lg.gain.value = 9;
  for (const [mul, a, type] of [[1, 1, 'sawtooth'], [2, 0.12, 'sine']] as [number, number, OscillatorType][]) {
    const o = c.createOscillator(), og = c.createGain(); o.type = type; o.frequency.value = mtof(midi) * mul; og.gain.value = a; lfo.connect(lg).connect(o.detune); o.connect(og).connect(lp); o.start(t); o.stop(t + dur + 0.3);
  }
  lfo.start(t); lfo.stop(t + dur + 0.3); lp.connect(g).connect(out);
}
function scheduleBar(c: AudioContext, bar: number, t: number) {
  const b = BARS[bar % 8], out = mGain!;
  piano(c, out, t, b.bass, BEAT * 3.6, 0.2);
  b.arp.forEach(() => 0);
  ARP_PAT.forEach((idx, k) => piano(c, out, t + k * BEAT / 2, b.arp[idx] + 12, BEAT * 1.6, 0.075 + (k % 4 === 0 ? 0.025 : 0)));
  b.pad.forEach(n => strings(c, out, t, n - 12, BEAT * 4, 0.018));
  if (bar >= 4) b.mel.forEach(([bt, n, d]) => violin(c, out, t + bt * BEAT, n - 12, d * BEAT, 0.045));
}
export function startProposalMusic() {
  if (mTimer !== null) return;
  const c = getAudioCtx(), master = c.createGain();
  master.gain.value = 0.0001; master.gain.linearRampToValueAtTime(get().soundOn ? 0.9 : 0.0001, c.currentTime + 3); master.connect(c.destination);
  mHall = c.createConvolver(); mHall.buffer = hallIR(c); const wet = c.createGain(); wet.gain.value = 0.55; mHall.connect(wet).connect(master);
  const dry = c.createGain(); dry.gain.value = 0.75; dry.connect(master); mDry = dry;
  const bus = c.createGain(); bus.connect(dry); bus.connect(mHall); mGain = bus;
  (mGain as any)._master = master;
  mBar = 0; mNext = c.currentTime + 0.4;
  const tick = () => { while (mNext < c.currentTime + 0.5) { if (get().soundOn) scheduleBar(c, mBar, mNext); mBar++; mNext += BEAT * 4; } };
  tick(); mTimer = window.setInterval(tick, 120);
}
export function stopProposalMusic() {
  if (mTimer === null) return;
  clearInterval(mTimer); mTimer = null;
  const m: GainNode | undefined = (mGain as any)?._master, c = getAudioCtx();
  if (m) { try { m.gain.setValueAtTime(m.gain.value, c.currentTime); m.gain.linearRampToValueAtTime(0.0001, c.currentTime + 1.6); } catch { /* */ } setTimeout(() => { try { m.disconnect(); } catch { /* */ } }, 2200); }
  mGain = null; mHall = null; mDry = null;
}

/* ---------- crowd ---------- */
let crowdNodes: { g: GainNode; src: AudioBufferSourceNode; lfo: OscillatorNode } | null = null;
export function startCrowd() {
  if (crowdNodes || !get().soundOn) return;
  const c = getAudioCtx(), src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  src.buffer = noise(c); src.loop = true; f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 0.7;
  g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(0.05, c.currentTime + 2.5);
  lfo.frequency.value = 0.23; lg.gain.value = 0.015; lfo.connect(lg).connect(g.gain);
  src.connect(f).connect(g).connect(c.destination); src.start(); lfo.start(); crowdNodes = { g, src, lfo };
}
export function stopCrowd() {
  if (!crowdNodes) return;
  const n = crowdNodes, c = getAudioCtx(); crowdNodes = null;
  try { n.g.gain.cancelScheduledValues(c.currentTime); n.g.gain.setValueAtTime(n.g.gain.value, c.currentTime); n.g.gain.linearRampToValueAtTime(0.0001, c.currentTime + 1.2); } catch { /* */ }
  setTimeout(() => { try { n.src.stop(); n.lfo.stop(); n.g.disconnect(); } catch { /* */ } }, 1500);
}
/** a big happy cheer: a swell of voices plus a patter of claps */
export function crowdCheer() {
  if (!get().soundOn) return;
  const c = getAudioCtx(), t = c.currentTime, out = c.destination;
  nburst(c, out, t, 2.6, 0.2, 900, 'bandpass', 0.6, 0.25); nburst(c, out, t, 2.2, 0.12, 1700, 'bandpass', 0.8, 0.3);
  for (let i = 0; i < 70; i++) nburst(c, out, t + 0.1 + Math.random() * 3.2, 0.05, 0.09, 1800 + Math.random() * 2500, 'bandpass', 0.7);
}
/** the little "awww / gasp" when he kneels */
export function crowdAww() {
  if (!get().soundOn) return;
  const c = getAudioCtx(), t = c.currentTime;
  nburst(c, c.destination, t, 1.8, 0.1, 700, 'bandpass', 0.9, 0.35);
  nburst(c, c.destination, t, 1.4, 0.05, 1500, 'bandpass', 1, 0.3);
}
/** a firework: low thump + crackle (delayed a little, like sound travelling) */
export function fireworkSfx(delay = 0.2, vol = 1) {
  if (!get().soundOn) return;
  const c = getAudioCtx(), t = c.currentTime + delay, out = c.destination;
  const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.45);
  g.gain.setValueAtTime(0.5 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); o.connect(g).connect(out); o.start(t); o.stop(t + 0.65);
  nburst(c, out, t, 0.35, 0.28 * vol, 260, 'lowpass', 0.5);
  for (let i = 0; i < 16; i++) nburst(c, out, t + 0.12 + Math.random() * 0.9, 0.04, 0.07 * vol, 3500 + Math.random() * 3000, 'highpass', 0.6);
}

/* ---------- wish fountain: music-box lullaby + water, plus a sound layer for each wish ---------- */
const FBPM = 72, FBEAT = 60 / FBPM;
const FCH = [
  { bass: 36, arp: [60, 64, 67, 72], pad: [64, 67, 72] },   // C
  { bass: 33, arp: [57, 60, 64, 69], pad: [60, 64, 69] },   // Am
  { bass: 29, arp: [53, 57, 60, 65], pad: [57, 60, 65] },   // F
  { bass: 31, arp: [55, 59, 62, 67], pad: [59, 62, 67] },   // G
];
const FMEL: [number, number, number][][] = [[[0, 84, 1], [1.5, 81, 0.5], [2, 79, 1], [3.5, 76, 0.5]], [], [[0, 81, 1], [1.5, 79, 0.5], [2, 77, 1], [3.5, 79, 0.5]], []];
let fTimer: number | null = null, fMaster: GainNode | null = null, fBus: GainNode | null = null, fBar = 0, fNext = 0, layerTimer: number | null = null, layerStops: (() => void)[] = [], waterStop: (() => void) | null = null;
function bell(c: AudioContext, out: AudioNode, t: number, midi: number, dur: number, vol: number) {
  const f = mtof(midi), g = c.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const [mul, a] of [[1, 1], [2.76, 0.18], [5.4, 0.06]] as [number, number][]) { const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.value = f * mul; og.gain.value = a; o.connect(og).connect(g); o.start(t); o.stop(t + dur + 0.05); }
  g.connect(out);
}
function scheduleFountainBar(c: AudioContext, bar: number, t: number) {
  const b = FCH[bar % 4], out = fBus!;
  piano(c, out, t, b.bass, FBEAT * 3.6, 0.13);
  [0, 1, 2, 3, 2, 1, 2, 3].forEach((idx, k) => bell(c, out, t + (k * FBEAT) / 2, b.arp[idx] + 12, FBEAT * 1.4, 0.06));
  b.pad.forEach(n => strings(c, out, t, n - 12, FBEAT * 4, 0.012));
  if (bar >= 2) FMEL[bar % 4].forEach(([bt, n, d]) => bell(c, out, t + bt * FBEAT, n + 12, d * FBEAT + 0.6, 0.05));
}
export function startFountainAudio() {
  if (fTimer !== null) return;
  const c = getAudioCtx(), master = c.createGain();
  master.gain.value = 0.0001; master.gain.linearRampToValueAtTime(get().soundOn ? 0.9 : 0.0001, c.currentTime + 2.5); master.connect(c.destination);
  const hall = c.createConvolver(); hall.buffer = hallIR(c); const wet = c.createGain(); wet.gain.value = 0.5; hall.connect(wet).connect(master);
  const dry = c.createGain(); dry.gain.value = 0.8; dry.connect(master);
  const bus = c.createGain(); bus.connect(dry); bus.connect(hall); fBus = bus; fMaster = master;
  fBar = 0; fNext = c.currentTime + 0.4;
  const tick = () => { while (fNext < c.currentTime + 0.5) { if (get().soundOn) scheduleFountainBar(c, fBar, fNext); fBar++; fNext += FBEAT * 4; } };
  tick(); fTimer = window.setInterval(tick, 120);
  // gentle running water
  if (get().soundOn) {
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    src.buffer = noise(c); src.loop = true; f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.6; g.gain.value = 0.03; lfo.frequency.value = 0.35; lg.gain.value = 0.01; lfo.connect(lg).connect(g.gain);
    src.connect(f).connect(g).connect(c.destination); src.start(); lfo.start();
    waterStop = () => { try { src.stop(); lfo.stop(); g.disconnect(); } catch { /* */ } };
  }
}
function clearLayer() {
  if (layerTimer !== null) { clearInterval(layerTimer); layerTimer = null; }
  layerStops.forEach(fn => fn()); layerStops = [];
}
/** the sound that goes with the active wish ('' = none) */
export function setFountainTheme(theme: string) {
  clearLayer();
  if (!theme || !get().soundOn || !fBus) return;
  const c = getAudioCtx(), out = c.destination;
  const loopNoise = (freq: number, q: number, vol: number, lfoHz: number) => {
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    src.buffer = noise(c); src.loop = true; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(vol, c.currentTime + 2);
    lfo.frequency.value = lfoHz; lg.gain.value = vol * 0.5; lfo.connect(lg).connect(g.gain); src.connect(f).connect(g).connect(out); src.start(); lfo.start();
    layerStops.push(() => { try { g.gain.cancelScheduledValues(c.currentTime); g.gain.setValueAtTime(g.gain.value, c.currentTime); g.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.6); setTimeout(() => { try { src.stop(); lfo.stop(); g.disconnect(); } catch { /* */ } }, 800); } catch { /* */ } });
  };
  if (theme === 'snow') loopNoise(420, 0.7, 0.06, 0.13);
  else if (theme === 'castle' || theme === 'city' || theme === 'venice') {
    // a 3/4 waltz: cheerful calliope for the kingdom, a softer accordion-ish one for the city
    const castle = theme === 'castle', tune = castle ? [72, 76, 79, 76, 77, 81, 84, 81, 79, 77, 76, 74] : [69, 72, 76, 72, 74, 77, 81, 77, 72, 71, 69, 67];
    let step = 0;
    if (castle) loopNoise(700, 0.5, 0.025, 0.2);
    if (theme === 'venice') loopNoise(750, 0.6, 0.035, 0.22);
    layerTimer = window.setInterval(() => {
      const t = c.currentTime + 0.05, b = step % 3, cb = Math.floor(step / 3);
      const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(); o.type = castle ? 'square' : 'sawtooth'; lp.type = 'lowpass'; lp.frequency.value = castle ? 2400 : 1400;
      const n = b === 0 ? tune[cb % tune.length] : tune[cb % tune.length] - 5; o.frequency.value = mtof(b === 0 ? n : n + 4);
      g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + 0.35);
      if (b === 0) { const bo = c.createOscillator(), bg = c.createGain(); bo.type = 'triangle'; bo.frequency.value = mtof(tune[cb % tune.length] - 24); bg.gain.setValueAtTime(0.08, t); bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.4); bo.connect(bg).connect(out); bo.start(t); bo.stop(t + 0.45); }
      step++;
    }, castle ? 330 : 420);
  } else if (theme === 'blossom') {
    const sc = [69, 72, 74, 76, 79, 81];
    layerTimer = window.setInterval(() => { if (Math.random() < 0.7) { const t = c.currentTime + 0.02; piano(c, out, t, sc[Math.floor(Math.random() * sc.length)] + 12, 1.4, 0.07); } }, 700);
  } else if (theme === 'rainstreet') {
    const sc = [57, 60, 62, 64, 67, 69];
    setRainSound(true); layerStops.push(() => setRainSound(false));
    layerTimer = window.setInterval(() => { if (Math.random() < 0.6) piano(c, out, c.currentTime + 0.02, sc[Math.floor(Math.random() * sc.length)] + 12, 2.2, 0.09); }, 1500);
  } else if (theme === 'rainbow') {
    loopNoise(900, 0.45, 0.07, 0.2);
    layerTimer = window.setInterval(() => { if (Math.random() < 0.45) { const t = c.currentTime + 0.02, n = 96 + Math.floor(Math.random() * 6); bell(c, out, t, n, 0.5, 0.035); bell(c, out, t + 0.14, n + 4, 0.5, 0.03); } }, 1100);
  } else if (theme === 'glowsea') {
    const sc = [76, 79, 81, 84, 88];
    loopNoise(650, 0.6, 0.055, 0.12);
    layerTimer = window.setInterval(() => { if (Math.random() < 0.6) bell(c, out, c.currentTime + 0.02, sc[Math.floor(Math.random() * sc.length)], 2, 0.05); }, 800);
  } else if (theme === 'forest') {
    const sc = [72, 76, 79, 83, 84];
    loopNoise(3600, 2.2, 0.014, 6);
    layerTimer = window.setInterval(() => { if (Math.random() < 0.55) bell(c, out, c.currentTime + 0.02, sc[Math.floor(Math.random() * sc.length)] + 12, 1.8, 0.04); }, 900);
  } else if (theme === 'balloons') {
    loopNoise(520, 0.7, 0.04, 0.1);
    const chords = [[65, 69, 72], [67, 71, 74], [64, 67, 72], [62, 65, 69]]; let ci = 0;
    const padTick = () => { chords[ci++ % 4].forEach(n => strings(c, out, c.currentTime + 0.05, n, 5.5, 0.012)); };
    padTick(); layerTimer = window.setInterval(padTick, 5000);
  } else if (theme === 'galaxy') {
    const sc = [88, 91, 93, 96, 100];
    for (const f of [55, 82.4]) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(0.05, c.currentTime + 3); o.connect(g).connect(out); o.start(); layerStops.push(() => { try { g.gain.setValueAtTime(g.gain.value, c.currentTime); g.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.8); setTimeout(() => { try { o.stop(); g.disconnect(); } catch { /* */ } }, 1000); } catch { /* */ } }); }
    layerTimer = window.setInterval(() => { if (Math.random() < 0.7) bell(c, out, c.currentTime + 0.02, sc[Math.floor(Math.random() * sc.length)], 2.4, 0.04); }, 500);
  } else if (theme === 'lanterns') {
    const sc = [84, 88, 91, 93, 96];
    loopNoise(300, 0.8, 0.03, 0.1);
    layerTimer = window.setInterval(() => { if (Math.random() < 0.65) bell(c, out, c.currentTime + 0.02, sc[Math.floor(Math.random() * sc.length)], 2.2, 0.05); }, 600);
  }
}
export function stopFountainAudio() {
  clearLayer();
  if (waterStop) { waterStop(); waterStop = null; }
  if (fTimer === null) return;
  clearInterval(fTimer); fTimer = null;
  const m = fMaster, c = getAudioCtx(); fMaster = null; fBus = null;
  if (m) { try { m.gain.setValueAtTime(m.gain.value, c.currentTime); m.gain.linearRampToValueAtTime(0.0001, c.currentTime + 1.6); } catch { /* */ } setTimeout(() => { try { m.disconnect(); } catch { /* */ } }, 2200); }
}
export function endProposalAudio() { stopProposalMusic(); stopCrowd(); stopFountainAudio(); }
