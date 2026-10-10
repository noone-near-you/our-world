import { useEffect, useRef, useState } from 'react';
import { get, set, useGame, inFullscreen } from '../state/store';
import { play, pick, rail, tap, toggleLamp, goWorld, syncRealTime } from '../story/engine';
import type { Act } from '../story/script';
import { unlockAudio, blip, sfx } from '../audio/audio';
import { setMusicMuted, chooseSong, isMusicMuted, playSoftMusic, getSongsFor, getSongName, stopMusic } from '../audio/music';
import { startAmbientIfNeeded, setAmbientWorld, setShowerWater } from '../audio/ambient';
import { anch } from '../worlds/anchors';

function useStream(text: string, key: number): [number, () => void] {
  const [n, setN] = useState(0);
  const skipped = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    skipped.current = false;
    setN(0);
    if (!text) return;
    let i = 0;
    timer.current = setInterval(() => {
      if (skipped.current) return;
      i++;
      setN(i);
      if (text[i - 1] !== ' ' && i % 2 === 0) blip(230 + (i % 5) * 18, 0.03, 0.070);
      if (i >= text.length && timer.current) clearInterval(timer.current);
    }, 30);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [text, key]);
  const skip = () => {
    skipped.current = true;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setN(text.length);
  };
  return [n, skip];
}
const raf = (f: () => void) => { let id = 0; const loop = () => { f(); id = requestAnimationFrame(loop); }; loop(); return () => cancelAnimationFrame(id); };

/** Phone back button / leaving: confirm before exit */
function ExitGuard() {
  const [ask, setAsk] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const push = () => { try { history.pushState({ app: 1 }, '', location.href); } catch { /* */ } };
    push();
    push();
    const onPop = () => { push(); setAsk(true); set({ paused: true }); };
    const onFs = () => { if (!document.fullscreenElement) { setAsk(true); set({ paused: true }); } };
    window.addEventListener('popstate', onPop);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, []);

  // countdown resume 3-2-1
  useEffect(() => {
    if (count === null) return;
    if (count <= 0) {
      setCount(null);
      setAsk(false);
      set({ paused: false });
      document.documentElement.requestFullscreen?.().catch(() => {});
      try { history.pushState({ app: 1 }, '', location.href); } catch { /* */ }
      return;
    }
    const t = setTimeout(() => setCount(c => (c == null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [count]);

  if (!ask && count === null) return null;

  if (count !== null) {
    return (
      <div className="exit-overlay" role="dialog" aria-modal="true">
        <div className="exit-card">
          <p className="exit-title">Resuming</p>
          <p className="exit-count">{count}</p>
          <p className="exit-sub">Get ready…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="exit-overlay" role="dialog" aria-modal="true" aria-label="Exit confirmation">
      <div className="exit-card">
        <p className="exit-title">Do you really want to exit?</p>
        <p className="exit-sub">The story is paused here.</p>
        <div className="exit-actions">
          <button className="exit-no" onClick={() => {
            setCount(3);
          }}>No, stay</button>
          <button className="exit-yes" onClick={() => {
            if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
            window.open('', '_self');
            window.close();
            setTimeout(() => { location.href = 'about:blank'; }, 150);
          }}>Yes, exit</button>
        </div>
      </div>
    </div>
  );
}


function His() {
  const { line, kind, lineKey } = useGame(g => g), ref = useRef<HTMLDivElement>(null), [n, skip] = useStream(line, lineKey);
  const smooth = useRef({ x: 0, y: 0, ready: false });
  const done = n >= line.length && !!line;
  useEffect(() => {
    if (!done || kind !== 'say') return;
    const wait = Math.min(2800, 900 + line.length * 28);
    const t = setTimeout(() => { if (!get().paused) tap(); }, wait);
    return () => clearTimeout(t);
  }, [done, lineKey, kind, line]);
  // reset smooth lock when a new line starts so it snaps to his head once
  useEffect(() => { smooth.current.ready = false; }, [lineKey]);
  useEffect(() => raf(() => {
    const el = ref.current; if (!el) return;
    const W = innerWidth, H = innerHeight;
    const pad = 12;
    const w = el.offsetWidth || 160;
    const hgt = el.offsetHeight || 48;
    // target: directly above his head (bubble uses translate(-50%, -100%))
    const tx = anch.him.x;
    const ty = anch.him.y - 10;
    // must be on-screen and not near legs (legs are lower half)
    const valid = tx > 8 && tx < W - 8 && ty > 40 && ty < H * 0.62;
    if (!valid) {
      if (!smooth.current.ready) return;
    } else if (!smooth.current.ready) {
      smooth.current = { x: tx, y: ty, ready: true };
    } else {
      smooth.current.x += (tx - smooth.current.x) * 0.22;
      smooth.current.y += (ty - smooth.current.y) * 0.22;
    }
    let cx = smooth.current.x;
    let cy = smooth.current.y;
    // clamp on screen only — do not chase other UI
    cx = Math.max(pad + w / 2, Math.min(W - pad - w / 2, cx));
    cy = Math.max(pad + hgt + 4, Math.min(H - pad - 20, cy));
    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;
    el.style.maxWidth = `${Math.min(280, W * 0.38)}px`;
    el.style.setProperty('--tx', '0px');
    el.style.visibility = smooth.current.ready ? 'visible' : 'hidden';
  }), [line, n]);
  if (!line) return null;
  return <div key={lineKey} className={`bub him ${kind}`} ref={ref} onClick={() => (done ? tap() : skip())}>
    <p className="stream"><span className="ghost">{line}</span><span className="live">{line.slice(0, n)}</span></p>{done && kind === 'say' && <small>▾</small>}</div>;
}
function herVoice(label: string) {
  const l = label.toLowerCase();
  // accurate female reactions from her option text
  if (/giggle|hehe|teehee/.test(l)) return sfx('giggle');
  if (/laugh|haha|joke|funny/.test(l)) return sfx('girllaugh');
  if (/sweet|soft|smile|adorable|cute/.test(l)) return sfx('smile'); // sweet_laugh_girl
  if (/scared|shy|embarrass|nervous|don.?t look/.test(l)) return sfx('shy');
  if (/sigh|tired|sleepy/.test(l)) return sfx('sigh');
  if (/love|kiss|hold|closer|cuddle|stay|please|yes|mm|miss you|need you|want you|come here|with you|together|feed|cook|splash/.test(l))
    return sfx('female_mm');
  if (/tease|try it|dangerous|on\b/.test(l)) return sfx('hehe');
  // default soft girl acknowledge
  return sfx('female_mm');
}
function Her() {
  const { options } = useGame(g => g);
  if (!options.length) return null;
  return <div className="bub her">{options.map(o => <button key={o.label} onClick={() => {
    herVoice(o.label);
    navigator.vibrate?.(10);
    pick(o);
  }}>{o.label.replace(/[\u201c\u201d"]/g, '').trim()}</button>)}</div>;
}
const ACTS: [Act, string][] = [['hug', 'Hug'], ['kiss', 'Kiss'], ['tease', 'Tease'], ['slap', 'Slap']];
const ICONS: Record<Act, string> = {
  hug: 'M12 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M4 20c0-5 3.4-7.5 8-7.5s8 2.5 8 7.5 M6.5 15.5l11 2.5 M17.5 15.5l-11 2.5',
  kiss: 'M3 12c3-4 6-4 9-2 3-2 6-2 9 2-3 5-6 6-9 6s-6-1-9-6Z M3 12h18',
  tease: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M9 9.5h.01 M15 9.5h.01 M8 14c1.5 2 6.5 2 8 0',
  slap: 'M7 13V8a1.4 1.4 0 0 1 2.8 0V4.5a1.4 1.4 0 0 1 2.8 0V6a1.4 1.4 0 0 1 2.8 0v4a1.4 1.4 0 0 1 2.8 0v5c0 4-2.5 6-6 6s-6-2-6-4l-2-3.5a1.4 1.4 0 0 1 2.4-1.4L7 13Z',
  flower: 'M12 13a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z M12 4.5c1.2 1.8 1.2 3.6 0 5.2-1.2-1.6-1.2-3.4 0-5.2Z M12 14.3c1.2 1.8 1.2 3.6 0 5.2-1.2-1.6-1.2-3.4 0-5.2Z M7.2 8.5c2.1.2 3.6 1.4 4.3 3.2-1.8-.7-3.5-.5-5.1.8 0-1.9.3-3.1.8-4Z M16.8 8.5c-2.1.2-3.6 1.4-4.3 3.2 1.8-.7 3.5-.5 5.1.8 0-1.9-.3-3.1-.8-4Z',
};
const Icon = ({ a }: { a: Act }) => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={ICONS[a]} />
  </svg>
);
const LampIcon = () => <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8.5 3h7l3 8h-13l3-8Z M12 11v7 M8 21h8 M9.5 18h5" /></svg>;

const WORLDS: { id: string; label: string; emoji: string; color: string }[] = [
  { id: 'bedroom', label: 'Bedroom', emoji: '🛏️', color: '#c4a07a' },
  { id: 'kitchen', label: 'Kitchen', emoji: '🍳', color: '#d4a574' },
  { id: 'beach', label: 'Beach', emoji: '🏖️', color: '#6ec4e8' },
  { id: 'pool', label: 'Pool', emoji: '🏊', color: '#5bb8d4' },
  { id: 'shower', label: 'Shower', emoji: '🚿', color: '#8aa0b4' },
  { id: 'garden', label: 'Garden', emoji: '🌸', color: '#7cbc6a' },
];

function useZzz(on: boolean) {
  useEffect(() => { if (!on) return; const t = setInterval(() => {
    const z = document.createElement('span'); z.className = 'heart zzz'; z.textContent = Math.random() < 0.5 ? 'z' : 'Z'; z.style.left = `${anch.him.x - 30 + Math.random() * 90}px`; z.style.top = `${anch.him.y + 70}px`;
    z.style.fontSize = `${16 + Math.random() * 10}px`; z.style.setProperty('--d', '2.6s'); z.style.setProperty('--dx', `${10 + Math.random() * 30}px`); document.body.appendChild(z); z.addEventListener('animationend', () => z.remove()); }, 900); return () => clearInterval(t); }, [on]);
}
/** true while the screen is landscape (the "turn your phone sideways" overlay is hidden) */
function useLandscape() {
  const [land, setLand] = useState(() => matchMedia('(orientation: landscape)').matches);
  useEffect(() => {
    const m = matchMedia('(orientation: landscape)');
    const on = () => setLand(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return land;
}
const isTouch = () => matchMedia('(pointer: coarse)').matches;

/** fullscreen (phone + PC). Must be called from a tap/click. Landscape lock only on phones. */
function enterFullscreen() {
  const el = document.documentElement as any;
  Promise.resolve()
    .then(() => (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el))
    .then(() => { if (isTouch()) return (screen.orientation as any)?.lock?.('landscape'); })
    .catch(() => {});
}

/** First screen: palm animation → double tap / double click = fullscreen, then earphone screen.
 *  Skipped automatically if the page is already fullscreen. */
function StartTap() {
  const last = useRef(0);
  const touch = isTouch();
  const next = () => set({ intro: 'earphone' });

  useEffect(() => {
    if (inFullscreen()) { next(); return; }              // already fullscreen → skip
    const onFs = () => { if (document.fullscreenElement) next(); };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  return (
    <div
      className="intro-screen start-screen dt-screen"
      onPointerDown={() => {
        const now = Date.now();
        if (now - last.current < 450) { enterFullscreen(); next(); }   // second tap within 450 ms
        last.current = now;
      }}>
      <div className="dt-stage" aria-hidden>
        <span className="dt-ring r1" />
        <span className="dt-ring r2" />
        <span className="dt-hand">{touch ? '🖐️' : '🖱️'}</span>
      </div>
      <p className="dt-title">{touch ? 'Double tap' : 'Double click'} to enter fullscreen</p>
      {touch && <p className="start-sub">My Cutie</p>}
    </div>
  );
}

function EarphoneThenBrightness() {
  const land = useLandscape();
  useEffect(() => {
    if(!land) return;
    const t = setTimeout(() => set({ intro: 'brightness' }), 8000);
    return () => clearTimeout(t);
  }, [land]);
  return (
    <div className="intro-screen pre-screen" key="earphone">
      <div className="pre-icon warn-icon" aria-hidden>⚠️</div>
      <p className="pre-title">Please plug in earphones</p>
      <p className="pre-sub">This experience uses soft audio and intimate sounds.<br />Headphones are recommended</p>
    </div>
  );
}

function BrightnessAuto() {
  const land = useLandscape();
  useEffect(() => {
    if(!land) return;
    const t = setTimeout(() => set({ intro: 'gate' }), 8000);
    return () => clearTimeout(t);
  }, [land]);
  return (
    <div className="intro-screen pre-screen" key="brightness">
      <div className="pre-icon" aria-hidden>🔆</div>
      <p className="pre-title">Increase brightness & volume</p>
      <p className="pre-sub">Turn up screen brightness and headphone volume<br />for the best experience.</p>
    </div>
  );
}
/** Opening: welcome → story typing → enter world */
function Intro() {
  const intro = useGame(g => g.intro);
  const [storyN, setStoryN] = useState(0);
  const STORY = "The day of 14 Feb 2023, a lady came in my life. She is the angel — can't describe much, but she is a goddess, the princess of this world — my Ishu.";
  const done = storyN >= STORY.length;

  const storySkip = useRef(false);
  const storyTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (intro !== 'story') return;
    storySkip.current = false;
    setStoryN(0);
    let i = 0;
    storyTimer.current = setInterval(() => {
      if (storySkip.current) return;
      i++;
      setStoryN(i);
      if (STORY[i - 1] !== ' ' && i % 2 === 0) blip(200 + (i % 6) * 22, 0.025, 0.10);
      if (i >= STORY.length && storyTimer.current) clearInterval(storyTimer.current);
    }, 28);
    return () => { if (storyTimer.current) clearInterval(storyTimer.current); };
  }, [intro]);
  const finishStory = () => {
    storySkip.current = true;
    if (storyTimer.current) clearInterval(storyTimer.current);
    storyTimer.current = null;
    setStoryN(STORY.length);
  };

  
  if (intro === 'start') return <StartTap />;
  // 2) Earphones warning (phone + PC)
  if (intro === 'earphone') {
    return <EarphoneThenBrightness />;
  }

  if (intro === 'brightness') {
    return <BrightnessAuto />;
  }

  
  if (intro === 'gate') {
    return (
      <div className="gate intro-gate">
        <p className="eyebrow">A little world, just for you</p>
        <button onClick={() => {
          unlockAudio();
          document.documentElement.requestFullscreen?.().then(() => (screen.orientation as any).lock?.('landscape')).catch(() => {});
          set({ soundOn: true, intro: 'welcome' });
          blip(440);
          setTimeout(() => { setAmbientWorld('bedroom'); startAmbientIfNeeded(); }, 100);
        }}>Tap to begin</button>
        <button className="ghost" onClick={() => {
          set({ soundOn: false, intro: 'welcome' });
        }}>Without sound</button>
      </div>
    );
  }

  if (intro === 'welcome') {
    return (
      <div className="intro-screen" onClick={() => { blip(520); set({ intro: 'story' }); }}>
        <div className="welcome-anim">
          <p className="welcome-line">Welcome to our world,</p>
          <p className="welcome-line accent">my lady!</p>
        </div>
        <p className="intro-hint">tap to continue</p>
      </div>
    );
  }

  if (intro === 'story') {
    return (
      <div className="intro-screen story-screen" onClick={() => {
        if (!done) { finishStory(); return; }
        blip(480);
        const tod = syncRealTime();
        const titleMap = { morning: 'Bedroom · Morning', afternoon: 'Bedroom · Afternoon', evening: 'Bedroom · Evening', night: 'Bedroom · Night' } as const;
        set({ intro: 'done', started: true, title: titleMap[tod] });
        setAmbientWorld('bedroom');
        startAmbientIfNeeded();
        setTimeout(() => set({ title: '' }), 2200);
        setTimeout(() => play('start'), 2400);
      }}>
        <div className="story-block">
          <p className="story-text">
            <span className="ghost">{STORY}</span>
            <span className="live">{STORY.slice(0, storyN)}</span>
          </p>
          <p className="story-quote">— Raj</p>
        </div>
        {done && <p className="intro-hint">tap to enter our world</p>}
      </div>
    );
  }

  return null;
}

function useOpenSongPanel(setOpen: (v: boolean) => void) {
  const want = useGame(g => g.openSongPanel);
  useEffect(() => {
    if (want) {
      setOpen(true);
      set({ openSongPanel: false });
    }
  }, [want, setOpen]);
}

function WorldBar() {
  const world = useGame(g => g.world);
  const busy = useGame(g => g.busy);
  const [open, setOpen] = useState(false);
  return (
    <div className={`worldbar${open ? ' open' : ''}`}>
      <button className="world-toggle" aria-label="Change world" title="Change world"
        onClick={() => { blip(400); setOpen(o => !o); }}>
        <span className="world-dot" style={{ background: WORLDS.find(w => w.id === world)?.color ?? '#c4a07a' }} />
        <span className="world-name">{WORLDS.find(w => w.id === world)?.label ?? world}</span>
        <span className="world-chev">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="world-panel" role="listbox">
          {WORLDS.map(w => (
            <button key={w.id} className={`world-chip${w.id === world ? ' active' : ''}`}
              disabled={busy || w.id === world}
              onClick={() => {
                blip(500);
                setOpen(false);
                if (w.id === world) return;
                // switch world + start that world's conversation (arrive_*)
                goWorld(w.id);
              }}>
              <span className="chip-emoji">{w.emoji}</span>
              <span>{w.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ShowerToggle() {
  const world = useGame(g => g.world);
  const on = useGame(g => g.showerOn);
  const [hint, setHint] = useState(false);
  // show arrow hint longer so the player notices the shower button
  useEffect(() => {
    if (world !== 'shower') { setHint(false); return; }
    setHint(true);
    const t = setTimeout(() => setHint(false), 8000);
    return () => clearTimeout(t);
  }, [world]);
  if (world !== 'shower') return null;
  return (
    <div className="shower-wrap">
      {hint && (
        <div className="shower-hint" aria-hidden>
          <span className="shower-hint-arrow">→</span>
          <span className="shower-hint-text">Shower on / off</span>
        </div>
      )}
      <button className={`music-btn shower-btn${on ? ' active' : ''}${hint ? ' pulse-hint' : ''}`}
        aria-label={on ? 'Turn shower off' : 'Turn shower on'}
        title={on ? 'Shower off' : 'Shower on'}
        onClick={() => {
          blip(on ? 320 : 480);
          const next = !on;
          set({ showerOn: next, steam: next });
          setShowerWater(next);
          setHint(false);
        }}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 4v2M8 6c0 4 4 4 4 8v4M16 6c0 4-4 4-4 8" />
          <path d="M9 20h6M10 16h4" />
        </svg>
      </button>
    </div>
  );
}

function MusicBar() {
  const muted = useGame(g => g.musicMuted);
  const slot = useGame(g => g.musicSlot);
  const world = useGame(g => g.world);
  const playing = useGame(g => g.musicPlaying);
  const [open, setOpen] = useState(false);
  useOpenSongPanel(setOpen);
  return (
    <div className={`musicbar${open ? ' open' : ''}`}>
      <button className="music-btn" aria-label={muted ? 'Unmute music' : 'Mute music'} title={muted ? 'Unmute' : 'Mute'}
        onClick={() => { blip(360); setMusicMuted(!isMusicMuted()); }}>
        {muted ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 5 6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 5 6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /></svg>
        )}
      </button>
      <div className="radial-wrap">
      <button
        className={`music-btn song-pick-btn${playing && !muted ? ' playing' : ''}`}
        aria-label="Choose song"
        title="Songs"
        onClick={() => { blip(400); setOpen(o => !o); }}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
      </button>

      {open && (() => {
        const songs = getSongsFor(world || 'bedroom').filter(s => s.file);
        const items = [
          { key: 'stop', label: '■', title: 'Stop music', cls: 'stop-chip', run: () => { blip(320); stopMusic(); } },
          ...songs.map((s, i) => ({
            key: 's' + i, label: String(i + 1), title: s.name,
            cls: slot === i && playing ? 'active' : '',
            run: () => { blip(480); chooseSong(i); },
          })),
          { key: 'soft', label: '♪', title: 'Play soft music', cls: 'soft', run: () => { blip(440); playSoftMusic(); } },
        ];
        const n = items.length, R = 112, start = 90, end = 180; // degrees: 90 = straight down, 180 = straight left
        return (
          <div className="radial">
            {items.map((it, i) => {
              const a = (n === 1 ? start : start + (i * (end - start)) / (n - 1)) * Math.PI / 180;
              return (
                <button key={it.key} className={`radial-item ${it.cls}`} title={it.title} aria-label={it.title}
                  style={{ '--x': `${Math.cos(a) * R}px`, '--y': `${Math.sin(a) * R}px`, '--i': i } as any}
                  onClick={() => { it.run(); setOpen(false); }}>
                  {it.label}
                </button>
              );
            })}
          </div>
        );
      })()}
    </div>
        
    </div>
  );
}

export function Hud() {
  const { started, title, busy, gfSeated, fade, world, lamp, pose, scene, caption, sleepy, intro } = useGame(g => g);
  useZzz(sleepy >= 1);
  // acts need them seated & free; lamp stays available anytime in bedroom
  const actsLocked = busy || !gfSeated || (pose !== 'sit' && pose !== 'bed') || scene;
  const lampLocked = scene; // only during blackout / transition
  const showUi = started && intro === 'done' && !title;

  return (<>
    <ExitGuard />
    {intro !== 'done' && <Intro />}
    <div className="fade" style={{ opacity: fade }} onClick={() => { if (fade > 0.5) set({ fade: 0 }); }} />
    {caption && <div className="caption" key={caption}><p>{caption}</p></div>}
    {title && <div className="title"><h1>{title}</h1></div>}
    {showUi && <>
      <His /><Her />
      <div className="topbar">
        <ShowerToggle /><MusicBar />
        <WorldBar />
      </div>
      <div className="rail" role="group" aria-label="Actions">
        {ACTS.map(([a, l]) => <button key={a} aria-label={l} title={l} disabled={actsLocked} onClick={() => { blip(560); rail(a); }}><Icon a={a} /></button>)}
        {world === 'bedroom' && <button className={`lampbtn${lamp ? ' on' : ''}`} aria-label={lamp ? 'Turn the lamp off' : 'Turn the lamp on'} title={lamp ? 'Lamp off' : 'Lamp on'} disabled={lampLocked} onClick={() => { blip(lamp ? 380 : 620); toggleLamp(); }}><LampIcon /></button>}
      </div>
    </>}
  </>);
}
