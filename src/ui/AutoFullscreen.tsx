import { useEffect, useState } from 'react';

let done = false; // run the auto-fullscreen only once per page load (also guards StrictMode double-mount)

const isFs = () => !!document.fullscreenElement;

function tryFullscreen(): Promise<boolean> {
  const el = document.documentElement as any;
  const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
  if (!req) return Promise.resolve(false);
  return Promise.resolve()
    .then(() => req())
    .then(() => { (screen.orientation as any)?.lock?.('landscape')?.catch?.(() => {}); return true; })
    .catch(() => false);
}

/** Browsers only allow fullscreen after a user gesture. If the automatic attempt is refused,
 *  go fullscreen on the very next tap / click / key press instead. */
function fullscreenOnNextGesture() {
  const go = () => {
    if (isFs()) return cleanup();
    tryFullscreen().then(ok => { if (ok) cleanup(); });
  };
  const cleanup = () => {
    window.removeEventListener('pointerdown', go, true);
    window.removeEventListener('keydown', go, true);
  };
  window.addEventListener('pointerdown', go, true);
  window.addEventListener('keydown', go, true);
}

/** Phone: fullscreen as soon as the phone is tilted to landscape (the "turn your phone sideways" step).
 *  PC: 3-2-1 countdown, then fullscreen. */
export function AutoFullscreen() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (done) return;
    const touch = matchMedia('(pointer: coarse)').matches;

    if (touch) {
      const land = matchMedia('(orientation: landscape)');
      const fire = () => {
        if (done) return;
        done = true;
        land.removeEventListener('change', onChange);
        if (isFs()) return;
        tryFullscreen().then(ok => { if (!ok) fullscreenOnNextGesture(); });
      };
      const onChange = () => { if (land.matches) fire(); };
      if (land.matches) fire();            // already sideways
      else land.addEventListener('change', onChange);  // wait for the tilt
      return () => land.removeEventListener('change', onChange);
    }

    // PC
    done = true;
    if (isFs()) return;
    setCount(3);
  }, []);

  useEffect(() => {
    if (count === null) return;
    if (count <= 0) {
      setCount(null);
      if (!isFs()) tryFullscreen().then(ok => { if (!ok) fullscreenOnNextGesture(); });
      return;
    }
    const t = setTimeout(() => setCount(c => (c == null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [count]);

  if (count === null || count <= 0) return null;
  return (
    <div className="fs-count" aria-live="polite">
      <p className="fs-count-label">Entering fullscreen</p>
      <p className="fs-count-num" key={count}>{count}</p>
    </div>
  );
}
