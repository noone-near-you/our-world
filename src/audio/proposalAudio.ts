import { get } from '../state/store';
import { getAudioCtx } from './audio';

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
export function endProposalAudio() { stopProposalMusic(); stopCrowd(); }
