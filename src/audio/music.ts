import { get, set } from '../state/store';
import { setMusicPlaying, setAmbientWorld } from './ambient';
import { unlockAudio } from './audio';
import { mediaUrl } from './media';

/**
 * Songs per world.
 * - `name` = what she sees in the song picker
 * - `file` = path under public/ (drop the mp3 there)
 *
 * Tip: you can name the file the same as the song, e.g.
 *   public/music/bedroom/Perfect.mp3
 * and set file: '/music/bedroom/Perfect.mp3'
 * Empty file string = slot unused (hidden in the picker).
 */
export type Song = { name: string; file: string };

export const WORLD_SONGS: Record<string, Song[]> = {
  bedroom: [
    { name: 'Adore You', file: '/music/bedroom/Adore You.mp3' },
    { name: 'Best Part', file: '/music/bedroom/Best Part.mp3' },
    { name: "Can't Help Falling in Love", file: "/music/bedroom/Can't Help Falling in Love.mp3" },
    { name: 'Kiss Me', file: '/music/bedroom/Kiss Me.mp3' },
    { name: 'Until I found You', file: '/music/bedroom/Until I found You.mp3' },
  ],
  kitchen: [
    { name: 'Banana Pancakes', file: '/music/kitchen/Banana Pancakes.mp3' },
    { name: 'Better Together', file: '/music/kitchen/Better Together.mp3' },
    { name: 'L-O-V-E', file: '/music/kitchen/L-O-V-E.mp3' },
    { name: 'Put your Records On', file: '/music/kitchen/Put your Records On.mp3' },
    { name: 'Sunday Morning', file: '/music/kitchen/Sunday Morning.mp3' },
  ],
  beach: [
    { name: 'Golden', file: '/music/beach/Golden.mp3' },
    { name: 'Island in the Sun', file: '/music/beach/Island in the Sun.mp3' },
    { name: 'Riptide', file: '/music/beach/Riptide.mp3' },
    { name: 'Walking on a Dream', file: '/music/beach/Walking on a Dream.mp3' },
  ],
  pool: [
    { name: 'Cake by the Ocean', file: '/music/pool/Cake by the Ocean.mp3' },
    { name: 'Electric Love', file: '/music/pool/Electric Love.mp3' },
    { name: 'I Like Me Better', file: '/music/pool/I Like Me Better.mp3' },
    { name: 'Levitating', file: '/music/pool/Levitating.mp3' },
    { name: 'Watermelon Sugar', file: '/music/pool/Watermelon Sugar.mp3' },
  ],
  garden: [
    { name: 'Bloom', file: '/music/garden/Bloom.mp3' },
    { name: 'Dream a Little Dream of Me', file: '/music/garden/Dream a Little Dream of Me.mp3' },
    { name: 'La Vie En Rose', file: '/music/garden/La Vie En Rose.mp3' },
    { name: 'Lover', file: '/music/garden/Lover.mp3' },
    { name: 'Sweet Creature', file: '/music/garden/Sweet Creature.mp3' },
  ],
  shower: [
    { name: 'Adore', file: '/music/shower/Adore.mp3' },
    { name: 'Earned It', file: '/music/shower/Earned It.mp3' },
    { name: 'Slow Dancing in the Dark', file: '/music/shower/Slow Dancing in the Dark.mp3' },
    { name: 'Wicked Games', file: '/music/shower/Wicked Games.mp3' },
  ],
};

let audio: HTMLAudioElement | null = null;
let currentWorld = '';
let currentSlot = 0;
let muted = false;
let started = false;

/** Preloaded Audio elements keyed by resolved URL — cuts CDN start delay */
const preloadCache = new Map<string, HTMLAudioElement>();

function ensure() {
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.volume = 0.10;
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous'; // needed when loading from CDN
  }
  return audio;
}

/** Warm the cache for every song in a world so the next pick starts instantly */
export function preloadWorldSongs(world: string) {
  const list = getSongsFor(world);
  for (const song of list) {
    if (!song?.file) continue;
    const src = mediaUrl(song.file);
    if (preloadCache.has(src)) continue;
    try {
      const el = new Audio();
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      el.src = src;
      // kick off network fetch without playing
      el.load();
      preloadCache.set(src, el);
    } catch { /* */ }
  }
}

/** Wait until enough data is buffered (or timeout) before play */
function waitReady(el: HTMLAudioElement, ms = 2500): Promise<void> {
  if (el.readyState >= 3) return Promise.resolve(); // HAVE_FUTURE_DATA+
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(t); el.removeEventListener('canplaythrough', finish); el.removeEventListener('canplay', finish); resolve(); };
    const t = window.setTimeout(finish, ms);
    el.addEventListener('canplaythrough', finish);
    el.addEventListener('canplay', finish);
  });
}

export function isMusicMuted() { return muted; }
export function getMusicSlot() { return currentSlot; }
export function getMusicWorld() { return currentWorld; }

export function getSongsFor(world: string): Song[] {
  return WORLD_SONGS[world] ?? WORLD_SONGS.bedroom;
}

export function getSongName(world: string, slot: number): string {
  const list = getSongsFor(world);
  return list[slot]?.name ?? `Song ${slot + 1}`;
}

export function setMusicMuted(m: boolean) {
  muted = m;
  set({ musicMuted: m });
  if (!audio) { setMusicPlaying(false); return; }
  if (m) { audio.pause(); setMusicPlaying(false); }
  else if (started && currentWorld) playSlot(currentWorld, currentSlot, false);
}

export function playSlot(world: string, slot: number, force = true) {
  const list = getSongsFor(world);
  const idx = Math.max(0, Math.min(slot, list.length - 1));
  const song = list[idx];
  if (!song?.file) return;
  currentWorld = world;
  currentSlot = idx;
  set({ musicSlot: idx, musicWorld: world });
  if (muted) { setMusicPlaying(false); return; }
  unlockAudio();
  const a = ensure();
  started = true;
  const src = mediaUrl(song.file);
  const same = a.src === src || a.src.endsWith(encodeURI(song.file)) || a.src.includes(encodeURIComponent(song.file.split('/').pop() || ''));
  if (same && !a.paused && !force) return;
  // warm the rest of this world's tracks in the background
  preloadWorldSongs(world);
  try {
    a.onplaying = () => setMusicPlaying(true);
    a.onpause = () => setMusicPlaying(false);
    a.onended = () => setMusicPlaying(false);
    a.onerror = () => setMusicPlaying(false);
    a.pause();
    // reuse preloaded element data if available (same URL already buffering)
    const cached = preloadCache.get(src);
    if (cached && cached.readyState >= 2 && a.src !== src) {
      a.src = src;
    } else {
      a.src = src;
    }
    a.currentTime = 0;
    a.volume = 0.10;
    // wait briefly for CDN buffer so play doesn't start silent / delayed
    waitReady(a, 1800).then(() => {
      if (currentSlot !== idx || currentWorld !== world) return; // user already switched
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => { setMusicPlaying(false); });
    });
  } catch { setMusicPlaying(false); }
}

export function onWorldChange(world: string) {
  // ambient always follows the world
  setAmbientWorld(world);
  // preload this world's songs so the first pick isn't laggy on CDN
  preloadWorldSongs(world);
  // keep the current song playing across world changes —
  // only change when the player picks a song or conversation starts one
  if (started && audio && !audio.paused && !muted) return;
}

export function pauseMusic() {
  if (!audio) return;
  try { audio.pause(); } catch { /* */ }
  setMusicPlaying(false);
}

export function resumeMusic() {
  if (muted || !audio || !started) return;
  const p = audio.play();
  if (p && typeof p.catch === 'function') p.catch(() => {});
  setMusicPlaying(true);
}

export function playSoftMusic() {
  set({ musicWanted: true });
  const w = get().world || 'bedroom';
  playSlot(w, get().musicSlotByWorld?.[w] ?? currentSlot ?? 0, true);
}

let songPickHook: (() => void) | null = null;
export function onSongUserPicked(fn: () => void) { songPickHook = fn; }
function notifySongPicked() {
  try { songPickHook?.(); } catch { /* */ }
}

export function chooseSong(slot: number) {
  const w = get().world || 'bedroom';
  const by = { ...(get().musicSlotByWorld ?? {}), [w]: slot };
  set({ musicSlotByWorld: by, musicWanted: true });
  playSlot(w, slot, true);
  // slightly longer delay so CDN-buffered track has started before the song comment
  setTimeout(() => notifySongPicked(), 900);
}

/** Stop the song and let ambient fill the room again. */
export function stopMusic() {
  if (audio) {
    try { audio.pause(); audio.src = ''; } catch { /* */ }
  }
  started = false;
  setMusicPlaying(false);
  // ambient comes back at full presence
  setAmbientWorld(get().world || 'bedroom');
}

/** True while a song is actively playing (for UI animation). */
export function isMusicActivelyPlaying(): boolean {
  return !!(started && audio && !audio.paused && !muted);
}
