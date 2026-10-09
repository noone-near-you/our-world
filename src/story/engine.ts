import { get, set, type Opt } from '../state/store';
import { nodes, exchanges, lampPool, type Act } from './script';
import { sfx, setSfxMuted, startMoanLoop, stopMoanLoop } from '../audio/audio';
import { playSoftMusic, onWorldChange, onSongUserPicked, getSongName } from '../audio/music';
import { setAmbientWorld, startAmbientIfNeeded, setShowerWater, setIntimateAudio, stopAllAmbient } from '../audio/ambient';
import { pauseMusic, resumeMusic } from '../audio/music';
import { BODY, FX } from '../worlds/anchors';
export { startAmbientIfNeeded };
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
let runAct: (a: Act) => Promise<void> = async () => {};
export const registerActRunner = (f: (a: Act) => Promise<void>) => { runAct = f; };   // the 3D scene registers itself here

let release: (() => void) | null = null;
let sideRel: (() => void) | null = null;              // the little side-exchange (after a side button) takes taps first
export const tap = () => (sideRel ?? release)?.();                         // called when she taps his bubble (after it finished typing)
const waitTap = async (ms = 0) => {
  while (get().paused) await sleep(150);
  await new Promise<void>(r => {
    const t = ms ? window.setTimeout(() => { if (!get().paused) finish(); }, ms) : 0;
    function finish() { clearTimeout(t); release = null; r(); }
    release = finish;
  });
  while (get().paused) await sleep(150);
};
let token = 0;
const READY = ['bedroom', 'kitchen', 'garden', 'beach', 'pool', 'shower'];

/** Map local clock hour → time-of-day for sky + dialogue */
export function hourToTod(h: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}
export function syncRealTime() {
  const tod = hourToTod(new Date().getHours());
  if (get().tod !== tod) set({ tod });
  return tod;
}


/** Default clothes + pose when switching world (picker or travel). Fresh random clothSeed every entry. */
function worldDefaults(id: string) {
  const clothSeed = Math.floor(Math.random() * 1e9);
  if (id === 'beach') return { outfit: 'beach' as const, pose: 'stand' as const, steam: false, showerOn: false, naked: false, clothSeed };
  if (id === 'pool') return { outfit: 'swim' as const, pose: 'stand' as const, steam: false, showerOn: false, naked: false, clothSeed };
  if (id === 'shower') return { outfit: 'swim' as const, pose: 'stand' as const, steam: false, showerOn: false, naked: false, clothSeed };
  return {
    outfit: 'casual' as const,
    pose: 'sit' as const,
    steam: false,
    showerOn: false,
    naked: false,
    clothSeed,
  };
}

async function forceWorld(id: string) {
  if (!READY.includes(id) || get().world === id) return;
  set({ line: '', options: [], fade: 1 });
  await sleep(500);
  set({ world: id, lamp: true, ...worldDefaults(id) });
  setAmbientWorld(id);
  setShowerWater(id === 'shower' && !!get().showerOn);
  onWorldChange(id);
  await sleep(450);
  set({ fade: 0 });
  await sleep(400);
}

export async function play(id: string): Promise<void> {
  syncRealTime();
  const my = ++token, n = nodes[id]; release?.(); if (!n) return;
  // if this is an arrive_* node, make sure the 3D world matches first
  const arr = /^arrive_(.+)$/.exec(id);
  if (arr && READY.includes(arr[1]) && get().world !== arr[1]) {
    await forceWorld(arr[1]);
    if (my !== token) return;
  }
  const via = n.route?.(get()); if (via && nodes[via]) return play(via);
  set({ options: [] });
  for (const s of n.steps) {
    if (my !== token) return;
    if (typeof s === 'string') { set({ line: s, kind: 'say', lineKey: get().lineKey + 1 }); await waitTap(); }
    else if ('thought' in s) { set({ line: s.thought, kind: 'thought', lineKey: get().lineKey + 1 }); await waitTap(1200 + s.thought.length * 55); }
    else if ('act' in s) {
      set({ busy: true, line: '' }); await runAct(s.act);  // sfx timed to contact in ACTS.ev
      if (s.act === 'flower') set({ flowerInHair: true });
      set({ busy: false });
    }
    else if ('sfx' in s) { if (s.sfx === 'song') playSoftMusic(); else sfx(s.sfx); }
    else if ('tod' in s) set({ tod: s.tod });
    else if ('gf' in s) { set({ gfHere: true }); const t0 = Date.now(); while (!get().gfSeated && Date.now() - t0 < 9000) await sleep(100); await sleep(400); }
    else if ('wait' in s) await sleep(s.wait);
    else if ('lamp' in s) { set({ line: '', lamp: s.lamp }); sfx('click'); await sleep(1000); }
    else if ('pose' in s && !('dress' in s)) {
      const w = get().world;
      // beach / pool / shower walks are longer (around obstacles, into water)
      const longWalk = ['wade', 'swim', 'rest'].includes(s.pose)
        || (s.pose === 'sit' && (w === 'beach' || w === 'pool'))
        || (s.pose === 'stand' && (w === 'beach' || w === 'shower' || w === 'pool'));
      set({ line: '', pose: s.pose });
      await sleep(s.pose === 'bed' ? 2800 : longWalk ? 4200 : 2400);
    }
    else if ('set' in s) {
      // outfit/caption change: soft fade + new random palette so colors never feel stuck
      if (s.set.caption || ('outfit' in s.set && s.set.outfit !== get().outfit)) {
        set({ line: '', fade: 1 });
        await sleep(500);
        const patch = { ...s.set } as Partial<import('../state/store').Game>;
        if ('outfit' in s.set) patch.clothSeed = Math.floor(Math.random() * 1e9);
        set(patch);
        await sleep(s.set.caption ? 2200 : 700);
        set({ caption: '', fade: 0 });
        await sleep(400);
      } else {
        set(s.set);
      }
      if ('showerOn' in s.set) setShowerWater(!!s.set.showerOn);
      if (s.set.splash) {
        // burst of water drops near both of them + splash sound aligned to the animation
        for (const b of BODY) {
          FX.q.push([b.x, 0.35, b.z, 2.2]);
          FX.q.push([b.x + 0.2, 0.45, b.z - 0.15, 1.6]);
        }
        try { sfx('splash'); } catch { /* */ }
        set({ splash: false });
      }
    }
    else if ('sleepy' in s) set({ sleepy: s.sleepy });
    else if ('scene' in s) set({ scene: s.scene });
    else if ('tone' in s) set({ tone: s.tone });
    else if ('dress' in s) {
      // clothes only change in the bedroom — come home first if needed
      set({ line: '', fade: 1 });
      await sleep(700);
      if (get().world !== 'bedroom') {
        set({ world: 'bedroom', lamp: true, ...worldDefaults('bedroom'), pose: 'stand' as const, naked: false, steam: false, showerOn: false });
        setAmbientWorld('bedroom');
        setShowerWater(false);
        onWorldChange('bedroom');
        await sleep(450);
      }
      set({
        outfit: s.dress,
        clothSeed: Math.floor(Math.random() * 1e9),
        caption: s.caption ?? (get().world === 'bedroom' ? 'a few minutes later…' : ''),
        pose: s.pose ?? 'stand',
        naked: false,
        steam: false,
        showerOn: false,
      });
      await sleep(s.caption || get().world === 'bedroom' ? 2400 : 900);
      set({ caption: '' });
      await sleep(250);
      set({ fade: 0 });
      await sleep(900);
    }
    else if ('go' in s) {
      const fadeSafety = window.setTimeout(() => set({ fade: 0 }), 2500);
      try {
        set({ line: '', fade: 1, busy: false }); await sleep(500);
        const defs = worldDefaults(s.go);
        set({ ...defs, world: s.go, lamp: true, line: '', options: [], naked: false, steam: false, showerOn: false });
        if (get().world !== s.go) set({ world: s.go });
        setAmbientWorld(s.go); setShowerWater(false); onWorldChange(s.go);
        await sleep(400);
        set({ fade: 0 }); await sleep(500);
      } finally {
        clearTimeout(fadeSafety);
        set({ fade: 0 });
      }
    }   // travel without playing the arrive_ node
    else if ('skip' in s) {
      const text = typeof s.skip === 'string' ? s.skip : (s as any).skip;
      const ms = (s as any).ms ?? (text && String(text).includes('sweet time') ? 30000 : 2800);
      const intimate = !!(s as any).intimate || ms >= 15000;
      set({ line: '', fade: 1 }); await sleep(800);
      if (intimate) {
        pauseMusic();
        stopAllAmbient();
        setIntimateAudio(true);
        setSfxMuted(true);
        startMoanLoop();          // ← start repeating
      }
      set({ caption: text });
      await sleep(ms);
      if (intimate) {
        stopMoanLoop();           // ← stop when black screen ends
        setIntimateAudio(false);
        setSfxMuted(false);
        setAmbientWorld(get().world);
        resumeMusic();
      }
      set({ fade: 0 });
      await sleep(900);
      set({ caption: '' });
      await sleep(400);
    }
      }
  if (my !== token) return;
  if (n.then) return play(n.then);
  set({ options: n.options ?? [] });
}
export async function goWorld(id: string, _opts?: { silent?: boolean }) {
  if (!READY.includes(id)) return;
  token++; release?.();
  const fadeSafety = window.setTimeout(() => set({ fade: 0 }), 2500);
  try {
    set({ options: [], line: '', fade: 1, busy: false });
    await sleep(500);
    const defs = worldDefaults(id);
    set({
      ...defs,
      world: id,
      lamp: true,
      line: '',
      options: [],
      naked: false,
      steam: false,
      showerOn: false,
      busy: false,
      fade: 1,
    });
    if (get().world !== id) set({ world: id });
    setAmbientWorld(id);
    setShowerWater(false);
    onWorldChange(id);
    await sleep(400);
    set({ fade: 0 });
    await sleep(250);
    set({ fade: 0 });

    // she hasn't met him yet — lonely thoughts, or random surprise appearance
    if (!get().gfHere) {
      if (id === 'bedroom') {
        play('solo_back_bedroom');
        return;
      }
      // ~38% chance she walks into this world first (random)
      const sheAppears = Math.random() < 0.38;
      if (sheAppears) {
        play(`solo_found_${id}`);
      } else {
        play(`solo_alone_${id}`);
      }
      return;
    }
    play(`arrive_${id}`);
  } finally {
    clearTimeout(fadeSafety);
    set({ fade: 0 });
  }
}
// ---- side exchanges: he reacts, she answers, he replies, then the story resumes exactly where it was ----
let sideOn = false, keep: { options: Opt[]; line: string; kind: 'say' | 'thought' } = { options: [], line: '', kind: 'say' };
const counts: Record<Act, number> = { hug: 0, kiss: 0, tease: 0, slap: 0, flower: 0 };
const sideTap = () => new Promise<void>(r => { sideRel = () => { sideRel = null; r(); }; });
function resume() { sideOn = false; sideRel = null; set({ busy: false, options: keep.options, line: keep.line, kind: keep.kind, lineKey: get().lineKey + 1 }); }
async function side(id: string) {
  if (id === '@resume' || !nodes[id]) return resume();
  const n = nodes[id]; set({ options: [] });
  for (const s of n.steps) {
    if (!sideOn) return;
    if (typeof s === 'string') { set({ line: s, kind: 'say', lineKey: get().lineKey + 1 }); await sideTap(); if (!sideOn) return; }
    else if ('sfx' in s) sfx(s.sfx);
  }
  if (id === 'music_no') set({ openSongPanel: true });
  if (n.then) return side(n.then);
  set({ options: n.options ?? [] });
}

/** When she picks a song: he names it and asks if she likes it.
 *  Only interrupt at a natural pause (options on screen). Mid-dialogue song changes
 *  just switch the track — never freeze the conversation. */
export async function commentOnSong() {
  const g = get();
  if (g.busy || sideOn || g.paused || g.intro !== 'done' || !g.started) return;
  // mid-line / mid-steps: changing music must not steal the story
  if (!g.options.length) return;
  const name = getSongName(g.world, g.musicSlot) || 'this one';
  keep = { options: g.options, line: g.line, kind: g.kind };
  sideOn = true;
  set({ busy: true, options: [], line: '', kind: 'say' });
  set({ line: `Oh… is this “${name}”?`, lineKey: get().lineKey + 1 });
  await sideTap();
  if (!sideOn) return;
  set({ line: 'Do you like it?', lineKey: get().lineKey + 1 });
  await sideTap();
  if (!sideOn) return;
  set({
    busy: false,
    options: [
      { label: '“Yes… I like this.”', next: 'music_yes' },
      { label: '“Not really…”', next: 'music_no' },
    ],
  });
}

// register once
onSongUserPicked(() => { commentOnSong(); });

export async function pick(o: Opt) {
  if (sideOn) { set({ options: [] }); return side(o.next ?? '@resume'); }
  set({ options: [] });
  if (o.world === 'beach' && get().outfit !== 'beach' && get().outfit !== 'swim') return play('out_ask');
  if (o.world) {
    if (READY.includes(o.world)) await goWorld(o.world);
    else await play(`world_${o.world}`);
    return;
  }
  await play(o.next ?? 'hub');
}
// The permanent side buttons work any time she is seated.
export async function rail(a: Act) {
  const g = get(); if (g.busy || sideOn || g.scene || g.pose !== 'sit' || !g.gfSeated || (g.kind === 'thought' && g.line)) return;
  keep = { options: g.options, line: g.line, kind: g.kind }; sideOn = true; set({ busy: true, options: [], line: '' });
  await runAct(a);  // sfx from ACTS.ev at contact time
  const c = ++counts[a], ex = exchanges[a], id = c >= 4 && c % 2 === 0 ? ex.many : ex.pool[(c - 1) % ex.pool.length];
  side(id);
}
// The lamp button (bedroom only). Off -> he says the power is out and they talk; on -> he says the power is back. Then the story resumes where it was.
const lampCount = { on: 0, off: 0 };
export async function toggleLamp() {
  const g = get(); if (g.busy || sideOn || g.scene || g.pose !== 'sit' || !g.gfSeated || g.world !== 'bedroom' || (g.kind === 'thought' && g.line)) return;
  const on = !g.lamp, pool = on ? lampPool.on : lampPool.off;
  keep = { options: g.options, line: g.line, kind: g.kind }; sideOn = true; set({ lamp: on, busy: true, options: [], line: '' });
  sfx(on ? 'click' : 'power'); await sleep(on ? 700 : 1100);
  side(pool[lampCount[on ? 'on' : 'off']++ % pool.length]);
}
