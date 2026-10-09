import { useSyncExternalStore } from 'react';
export interface Opt { label: string; next?: string; world?: string }
export interface Game {
  started: boolean; soundOn: boolean; title: string;
  line: string; kind: 'say' | 'thought'; lineKey: number;   // what he is saying (lineKey restarts the typing)
  options: Opt[];                                            // what SHE can answer
  busy: boolean; tod: 'morning' | 'afternoon' | 'evening' | 'night'; gfHere: boolean; gfSeated: boolean; world: string; fade: number;
  lamp: boolean;                 // the bedroom table lamp (true = lit)
  pose: 'sit' | 'bed' | 'stand' | 'wade' | 'swim' | 'rest';   // sitting (bed edge / lounger), lying under the blanket, standing in front, feet in the water, swimming, lying back on the loungers
  sleepy: number;                // 0 awake, 0.5 drowsy, 1 asleep (eyes closed)
  scene: boolean;                // a scripted scene (sleep) is running: side buttons + lamp button are locked
  outfit: 'casual' | 'beach' | 'swim';    // what they are wearing (swim = swimwear)
  beachDone: boolean;            // the beach conversation has been played once
  tone: 'soft' | 'tease';        // how he talks right now (decided by her last answer)
  caption: string;               // time-skip text ("a few hours later…")
  steam: boolean;                // kitchen pot steam rising while cooking
  flowerInHair: boolean;         // garden: flower / gajra tucked in her hair
  showerOn: boolean;             // shower water running
  naked: boolean;               // clothes off in shower (steam covers body)
  splash: boolean;              // trigger beach splash particles once
  musicMuted: boolean;
  musicWanted: boolean;          // she asked for soft music at least once
  musicSlot: number;             // 0..4 current slot
  musicWorld: string;
  musicSlotByWorld: Record<string, number>;
  musicPlaying: boolean;         // a song is actively playing (for UI pulse)
  intro: 'gate' | 'welcome' | 'story' | 'done';
  paused: boolean;
  openSongPanel: boolean;  // opening sequence phase
}
let s: Game = { started: false, soundOn: false, title: '', line: '', kind: 'say', lineKey: 0, options: [], busy: false, tod: 'afternoon', gfHere: false, gfSeated: false, world: 'bedroom', fade: 0, lamp: true, pose: 'sit', sleepy: 0, scene: false, caption: '', outfit: 'casual', tone: 'soft', beachDone: false, steam: false, flowerInHair: false, showerOn: false, naked: false, splash: false, musicMuted: false, musicWanted: false, musicSlot: 0, musicWorld: 'bedroom', musicSlotByWorld: {}, musicPlaying: false, intro: 'gate', paused: false, openSongPanel: false };
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
