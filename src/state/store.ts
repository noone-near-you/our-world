import { useSyncExternalStore } from 'react';
export interface Opt { label: string; next?: string; world?: string }
export interface Game {
  started: boolean; soundOn: boolean; title: string;
  line: string; kind: 'say' | 'thought'; lineKey: number;   // what he is saying (lineKey restarts the typing)
  options: Opt[];                                            // what SHE can answer
  busy: boolean; tod: 'morning' | 'afternoon' | 'evening' | 'night'; gfHere: boolean; gfSeated: boolean; world: string; fade: number;
  lamp: boolean;                 // the bedroom table lamp (true = lit)
  pose: 'sit' | 'bed' | 'stand' | 'wade' | 'swim' | 'rest' | 'kneel';   // sitting (bed edge / lounger), lying under the blanket, standing in front, feet in the water, swimming, lying back on the loungers
  sleepy: number;                // 0 awake, 0.5 drowsy, 1 asleep (eyes closed)
  scene: boolean;                // a scripted scene (sleep) is running: side buttons + lamp button are locked
  outfit: 'casual' | 'beach' | 'swim' | 'wedding';    // what they are wearing (swim = swimwear)
  beachDone: boolean;            // the beach conversation has been played once
  tone: 'soft' | 'tease';        // how he talks right now (decided by her last answer)
  caption: string;               // time-skip text ("a few hours later…")
  steam: boolean;                // kitchen pot steam rising while cooking
  flowerInHair: boolean;         // garden: flower / gajra tucked in her hair
  showerOn: boolean;             // shower water running
  naked: boolean;               // clothes off in shower (steam covers body)
  splash: boolean;              // trigger beach splash particles once
  disco: boolean;               // pool: disco lights on
  ringBox: '' | 'closed' | 'open';   // secret proposal: the ring-box overlay (closed = waiting for her tap)
  ringOpen: boolean;            // secret proposal: the ring box in his hand is open
  fireworks: boolean;           // secret proposal: fireworks in the night sky
  confetti: number;             // Date.now() of the last flower-confetti shower on the screen
  cheer: number;                // Date.now() of the last crowd cheer (the crowd jumps)
  rain: boolean;                // garden/beach: raining
  look: 'real' | 'anime';       // character look: softer realistic shading or the original toon look
  tint: string;                 // bedroom: mood-light colour ('' = normal warm lamp)
  bubbles: number;              // kitchen: Date.now() of the last bubble burst
  ball: number;                 // beach: Date.now() of the last beach-ball throw
  petals: number;               // garden: Date.now() of the last 'sprinkle flowers' press (0 = never)
  /** random outfit palette seed — changes each world entry / outfit swap so colors never repeat the same way */
  clothSeed: number;
  musicMuted: boolean;
  musicWanted: boolean;          // she asked for soft music at least once
  musicSlot: number;             // 0..4 current slot
  musicWorld: string;
  musicSlotByWorld: Record<string, number>;
  musicPlaying: boolean;         // a song is actively playing (for UI pulse)
  intro: 'start' | 'earphone' | 'brightness' | 'gate' | 'welcome' | 'story' | 'done';
  paused: boolean;
  openSongPanel: boolean;  // opening sequence phase
}
/** true if the page is already fullscreen (API fullscreen, or F11 on PC) */
/** true if the page is already fullscreen (API fullscreen, installed app, or F11 on a real desktop) */
export const inFullscreen = () => {
  if (typeof document === 'undefined') return false;
  if (document.fullscreenElement || (document as any).webkitFullscreenElement) return true;
  if (matchMedia('(display-mode: fullscreen)').matches) return true;
  // F11 detection only for real desktop browsers — never on touch / phone view
  const touch = matchMedia('(pointer: coarse)').matches;
  return !touch && innerWidth === screen.width && innerHeight === screen.height;
};
let s: Game = { started: false, soundOn: false, title: '', line: '', kind: 'say', lineKey: 0, options: [], busy: false, tod: 'afternoon', gfHere: false, gfSeated: false, world: 'bedroom', fade: 0, lamp: true, pose: 'sit', sleepy: 0, scene: false, caption: '', outfit: 'casual', tone: 'soft', beachDone: false, steam: false, flowerInHair: false, showerOn: false, naked: false, splash: false, disco: false, ringBox: '', ringOpen: false, fireworks: false, confetti: 0, cheer: 0, rain: false, look: 'real', tint: '', bubbles: 0, ball: 0, petals: 0, clothSeed: Math.floor(Math.random() * 1e9), musicMuted: false, musicWanted: false, musicSlot: 0, musicWorld: 'bedroom', musicSlotByWorld: {}, musicPlaying: false, intro: inFullscreen() ? 'earphone' : 'start', paused: false, openSongPanel: false };
const subs = new Set<() => void>();
export const get = () => s;
export const set = (p: Partial<Game>) => { s = { ...s, ...p }; subs.forEach(f => f()); };
export const subscribe = (f: () => void) => (subs.add(f), () => { subs.delete(f); });
export const useGame = <T,>(sel: (g: Game) => T): T => {
  // cache last selected value so React's Object.is check works and subscribers re-render on change
  return useSyncExternalStore(
    f => (subs.add(f), () => { subs.delete(f); }),
    () => sel(s),
    () => sel(s),
  );
};
