import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { get, useGame } from '../state/store';
import { BODY, HEADW, tk } from './anchors';
import { beatTime, BEAT_BPM, startDiscoBeat, stopDiscoBeat } from '../audio/audio';
import { pauseMusic, resumeMusic } from '../audio/music';
import { setRainSound } from '../audio/ambient';

/* ================= POOL: disco lights =================
 * Mirror ball + rotating colour beams + coloured lights orbiting the pool.
 * The room dimming itself is done in Bedroom.tsx Scene via `dsc.v`. */
const BEAMS = 6, ORBS = 6;
const hue = (T: number, n: number, l = 0.55) => new THREE.Color().setHSL((T * 0.25 + n / BEAMS) % 1, 1, l);

export function DiscoLights({ position = [0, 3.3, -1.6] as [number, number, number] }) {
  const on = useGame(g => g.disco);
  const k = useRef(0);
  const root = useRef<THREE.Group>(null!), ball = useRef<THREE.Mesh>(null!), spin = useRef<THREE.Group>(null!), ballMat = useRef<THREE.MeshStandardMaterial>(null!);
  const beamMats = useRef<THREE.MeshBasicMaterial[]>([]), orbs = useRef<THREE.PointLight[]>([]);
  const beamGeo = useMemo(() => new THREE.ConeGeometry(0.55, 4.2, 20, 1, true), []);
  // the disco beat: starts with the lights, stops when they go off or the pool is left (normal music pauses meanwhile)
  const was = useRef(false);
  useEffect(() => { if (on) { was.current = true; pauseMusic(); startDiscoBeat(); } else if (was.current) { was.current = false; stopDiscoBeat(); resumeMusic(); } }, [on]);
  useEffect(() => () => { if (was.current) { was.current = false; stopDiscoBeat(); resumeMusic(); } }, []);
  useFrame(({ clock }, dt) => {
    const T = clock.elapsedTime;
    k.current = THREE.MathUtils.damp(k.current, on ? 1 : 0, 4, dt);
    const kk = k.current;
    if (!root.current) return;
    root.current.visible = kk > 0.01;
    if (kk <= 0.01) return;
    ball.current.rotation.y = T * 1.2;
    spin.current.rotation.y = T * 0.9;
    const bt = beatTime(), spb = 60 / BEAT_BPM, ph = bt >= 0 ? (bt / spb) % 1 : -1;
    const pulse = ph >= 0 ? Math.exp(-ph * 5) : 0.5 + 0.5 * Math.sin(T * 8), pulse2 = ph >= 0 ? Math.exp(-((ph + 0.5) % 1) * 5) : 0.5 + 0.5 * Math.sin(T * 8 + 3);
    ballMat.current.emissive.copy(hue(T, 0)).multiplyScalar((0.2 + 0.5 * pulse) * kk);
    beamMats.current.forEach((m, n) => { if (!m) return; m.color.copy(hue(T * 1.3, n)); m.opacity = kk * (0.09 + 0.09 * Math.sin(T * 4 + n * 1.7) + 0.1 * (n % 2 ? pulse2 : pulse)); });
    orbs.current.forEach((l, n) => {
      if (!l) return;
      const a = T * 0.8 + (n / ORBS) * Math.PI * 2, r = 3.2 + Math.sin(T * 1.3 + n) * 0.8;
      l.position.set(Math.cos(a) * r, 0.9 + Math.sin(T * 2 + n) * 0.5, Math.sin(a) * r - 1.8);
      l.color.copy(hue(T * 1.5, n + 2));
      l.intensity = kk * (3 + 10 * (n % 2 ? pulse2 : pulse));
    });
  });
  return (
    <group ref={root} visible={false}>
      <group position={position}>
        <mesh ref={ball}><icosahedronGeometry args={[0.28, 1]} /><meshStandardMaterial ref={ballMat} color="#d8e0ff" metalness={1} roughness={0.15} flatShading /></mesh>
        <pointLight intensity={3} distance={10} color="#ffffff" />
        <group ref={spin}>
          {Array.from({ length: BEAMS }, (_, n) => (
            <group key={n} rotation={[0.85, (n / BEAMS) * Math.PI * 2, 0]}>
              <mesh geometry={beamGeo} position={[0, -2.1, 0]}>
                <meshBasicMaterial ref={m => { if (m) beamMats.current[n] = m; }} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
      {Array.from({ length: ORBS }, (_, n) => <pointLight key={n} distance={9} decay={2} intensity={0} ref={l => { if (l) orbs.current[n] = l; }} />)}
    </group>
  );
}

/* ================= GARDEN: small flowers sprinkling from the sky on both of them =================
 * Press the button -> store.petals = Date.now() -> flowers fall for ~7 s above the couple; some land and rest on their hair. */
const N = 320, DURATION = 7;
const FLOWER_COLS = ['#ff8fb0', '#ffd25a', '#ffffff', '#c58bff', '#ff6f8f', '#ffb27a', '#8fd0ff', '#ffc0d8'];
export function PetalRain() {
  const trig = useGame(g => g.petals);
  const seen = useRef(trig), pending = useRef(false), until = useRef(-1), acc = useRef(0), next = useRef(0);
  const petals = useRef<THREE.InstancedMesh>(null!), centers = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []), tmp = useMemo(() => new THREE.Color(), []);
  const P = useMemo(() => Array.from({ length: N }, () => ({ on: false, x: 0, y: 0, z: 0, vy: 0, ph: 0, rx: 0, ry: 0, rz: 0, sx: 0, sy: 0, sz: 0, s: 0, rest: 0, fade: 1, stuck: 0 })), []);
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 5; k++) { const g = new THREE.CircleGeometry(0.5, 8); g.translate(0.55, 0, 0); g.rotateZ((k / 5) * Math.PI * 2); parts.push(g); }
    return mergeGeometries(parts)!;
  }, []);
  const cGeo = useMemo(() => { const g = new THREE.CircleGeometry(0.3, 10); g.translate(0, 0, 0.01); return g; }, []);
  useEffect(() => { if (trig !== seen.current) { seen.current = trig; pending.current = true; } }, [trig]);
  useFrame(({ clock }, dt) => {
    if (!petals.current || !centers.current) return;
    const T = clock.elapsedTime;
    if (pending.current) { pending.current = false; until.current = T + DURATION; }
    const cx = (BODY[0].x + BODY[1].x) / 2, cz = (BODY[0].z + BODY[1].z) / 2;
    if (T < until.current) {
      acc.current += 42 * Math.min(1, (until.current - T) / 1.5) * dt;
      while (acc.current >= 1) {
        acc.current -= 1;
        const slot = next.current++ % N, q = P[slot];
        q.on = true; q.x = cx + (Math.random() - 0.5) * 2.6; q.z = cz + (Math.random() - 0.5) * 1.3; q.y = 4.2 + Math.random() * 1.6;
        q.vy = 0.55 + Math.random() * 0.55; q.ph = Math.random() * 6.3; q.s = 0.06 + Math.random() * 0.045;
        q.rx = Math.random() * 6; q.ry = Math.random() * 6; q.rz = Math.random() * 6; q.sx = 1 + Math.random() * 2; q.sy = 1 + Math.random() * 2; q.sz = (Math.random() - 0.5) * 2;
        q.rest = 0; q.fade = 1; q.stuck = 0;
        tmp.set(FLOWER_COLS[Math.floor(Math.random() * FLOWER_COLS.length)]);
        petals.current.setColorAt(slot, tmp);
        if (petals.current.instanceColor) petals.current.instanceColor.needsUpdate = true;
      }
    }
    for (let k = 0; k < N; k++) {
      const q = P[k];
      if (q.on) {
        if (q.stuck > 0) { q.stuck -= dt; if (q.stuck <= 0) q.fade = 0; }
        else {
          q.y -= q.vy * dt; q.x += Math.sin(T * 1.4 + q.ph) * 0.22 * dt; q.z += Math.cos(T * 1.1 + q.ph) * 0.1 * dt;
          q.rx += q.sx * dt; q.ry += q.sy * dt; q.rz += q.sz * dt;
          // land on hair: close to a head and just above it
          for (let h = 0; h < 2; h++) {
            const H = HEADW[h];
            if (H.y > 0.25 && Math.hypot(q.x - H.x, q.z - H.z) < 0.17 && q.y <= H.y + 0.56 && q.y > H.y + 0.3) { q.stuck = 1.8 + Math.random() * 1.2; q.y = H.y + 0.54; q.rx = -1.2; q.ry = 0; q.rz = Math.random() * 6; break; }
          }
          if (q.y < 0.03) q.fade = 0;
        }
        if (q.fade <= 0) q.on = false;
      }
      dummy.position.set(q.x, q.y, q.z);
      dummy.rotation.set(q.rx, q.ry, q.rz);
      dummy.scale.setScalar(q.on ? q.s : 0.0001);
      dummy.updateMatrix();
      petals.current.setMatrixAt(k, dummy.matrix); centers.current.setMatrixAt(k, dummy.matrix);
    }
    petals.current.instanceMatrix.needsUpdate = true; centers.current.instanceMatrix.needsUpdate = true;
  });
  return (<>
    <instancedMesh ref={petals} args={[geo, undefined, N]} frustumCulled={false}><meshBasicMaterial side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={centers} args={[cGeo, undefined, N]} frustumCulled={false}><meshBasicMaterial color="#ffe27a" side={THREE.DoubleSide} /></instancedMesh>
  </>);
}


/* ================= KITCHEN: soap-bubble burst =================
 * Press the button -> store.bubbles = Date.now() -> shimmering bubbles drift up around the couple for ~8 s, then pop. */
const NB = 110, BDUR = 8, BUB_COLS = ['#ffd0e8', '#c8e6ff', '#d8ffe0', '#fff2c0', '#e6d0ff', '#ffffff'];
export function BubbleBurst() {
  const trig = useGame(g => g.bubbles);
  const seen = useRef(trig), pending = useRef(false), until = useRef(-1), acc = useRef(0), next = useRef(0);
  const body = useRef<THREE.InstancedMesh>(null!), shine = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []), tmp = useMemo(() => new THREE.Color(), []);
  const P = useMemo(() => Array.from({ length: NB }, () => ({ on: false, x: 0, y: 0, z: 0, vy: 0, ph: 0, s: 0, age: 0, life: 0, pop: 0 })), []);
  useEffect(() => { if (trig !== seen.current) { seen.current = trig; pending.current = true; } }, [trig]);
  useFrame(({ clock }, dt) => {
    if (!body.current || !shine.current) return;
    const T = clock.elapsedTime;
    if (pending.current) { pending.current = false; until.current = T + BDUR; }
    const cx = (BODY[0].x + BODY[1].x) / 2, cz = (BODY[0].z + BODY[1].z) / 2;
    if (T < until.current) {
      acc.current += 12 * Math.min(1, (until.current - T) / 1.2) * dt;
      while (acc.current >= 1) {
        acc.current -= 1;
        const slot = next.current++ % NB, q = P[slot];
        q.on = true; q.x = cx + (Math.random() - 0.5) * 4; q.z = cz + (Math.random() - 0.5) * 2; q.y = 0.2 + Math.random() * 0.9;
        q.vy = 0.3 + Math.random() * 0.35; q.ph = Math.random() * 6.3; q.s = 0.05 + Math.random() * 0.09; q.age = 0; q.life = 3.2 + Math.random() * 3; q.pop = 0;
        tmp.set(BUB_COLS[Math.floor(Math.random() * BUB_COLS.length)]); body.current.setColorAt(slot, tmp);
        if (body.current.instanceColor) body.current.instanceColor.needsUpdate = true;
      }
    }
    for (let k = 0; k < NB; k++) {
      const q = P[k]; let sc = 0.0001;
      if (q.on) {
        q.age += dt;
        if (q.pop > 0) { q.pop += dt; sc = q.s * (1 + q.pop * 5); if (q.pop > 0.12) q.on = false; }
        else {
          q.y += q.vy * dt; q.x += Math.sin(T * 1.3 + q.ph) * 0.12 * dt; q.z += Math.cos(T * 1.1 + q.ph) * 0.06 * dt;
          // keep clear of the two of them: drift away from anyone close
          for (const b of BODY) { const dx = q.x - b.x, dz = q.z - b.z, d = Math.hypot(dx, dz); if (d < 0.5 && q.y < 2.2) { q.x += (dx / (d + 0.01)) * 1.3 * dt; q.z += (dz / (d + 0.01)) * 1.3 * dt; } }
          if (q.age > q.life || q.y > 3.3) q.pop = 0.001;
          sc = q.s * (1 + 0.06 * Math.sin(T * 5 + q.ph));
        }
      }
      dummy.rotation.set(0, 0, 0); dummy.position.set(q.x, q.y, q.z); dummy.scale.setScalar(sc); dummy.updateMatrix(); body.current.setMatrixAt(k, dummy.matrix);
      dummy.position.set(q.x - 0.3 * sc, q.y + 0.35 * sc, q.z + 0.55 * sc); dummy.scale.setScalar(sc * 0.2); dummy.updateMatrix(); shine.current.setMatrixAt(k, dummy.matrix);
    }
    body.current.instanceMatrix.needsUpdate = true; shine.current.instanceMatrix.needsUpdate = true;
  });
  return (<>
    <instancedMesh ref={body} args={[undefined, undefined, NB]} frustumCulled={false}><sphereGeometry args={[1, 14, 10]} /><meshBasicMaterial transparent opacity={0.42} depthWrite={false} /></instancedMesh>
    <instancedMesh ref={shine} args={[undefined, undefined, NB]} frustumCulled={false}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} /></instancedMesh>
  </>);
}

/* ================= BEACH: a beach ball bounces along the sand in front of them =================
 * Stays on the near sand (z ≈ 1.9) — always well clear of both of them. */
const BALL_DUR = 6.5;
export function BeachBall() {
  const trig = useGame(g => g.ball);
  const seen = useRef(trig), pending = useRef(false), t0 = useRef(-99);
  const grp = useRef<THREE.Group>(null!), ballM = useRef<THREE.Mesh>(null!), shadow = useRef<THREE.Mesh>(null!);
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 28, 18), p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
    const PAL = ['#ff5a5a', '#ffffff', '#ffd23a', '#ffffff', '#3a9dff', '#ffffff'];
    for (let k = 0; k < p.count; k++) {
      const a = Math.atan2(p.getX(k), p.getZ(k)), i = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 6) % 6;
      c.set(Math.abs(p.getY(k)) > 0.93 ? '#ffffff' : PAL[i]); cols[k * 3] = c.r; cols[k * 3 + 1] = c.g; cols[k * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); return g;
  }, []);
  useEffect(() => { if (trig !== seen.current) { seen.current = trig; pending.current = true; } }, [trig]);
  useFrame(({ clock }) => {
    if (!grp.current) return;
    const T = clock.elapsedTime;
    if (pending.current) { pending.current = false; t0.current = T; }
    const u = (T - t0.current) / BALL_DUR;
    grp.current.visible = u >= 0 && u <= 1;
    if (!grp.current.visible) return;
    const R = 0.3, x = -5.5 + 11 * u, z = 1.9 + 0.25 * Math.sin(u * 5);
    const ph = (u * 6) % 1, h = Math.sin(ph * Math.PI) * 0.95 * (1 - 0.25 * u);   // 6 bounces
    const squash = ph < 0.08 || ph > 0.92 ? 0.86 : 1;
    grp.current.position.set(x, 0.04 + R * squash + h, z);
    ballM.current.scale.set(R / squash ** 0.5, R * squash, R / squash ** 0.5);
    ballM.current.rotation.set(0.4, 0, -x / R);
    shadow.current.position.set(0, -(0.04 + R * squash + h) + 0.05, 0);   // stays on the sand (group-relative)
    shadow.current.scale.setScalar(R * (1.1 - 0.35 * Math.min(1, h)));
  });
  return (
    <group ref={grp} visible={false}>
      <mesh ref={ballM} geometry={geo} castShadow><meshStandardMaterial vertexColors roughness={0.45} /></mesh>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1, 20]} /><meshBasicMaterial color="#6a5a3a" transparent opacity={0.28} depthWrite={false} /></mesh>
    </group>
  );
}

/* ================= BEACH + GARDEN: small birds flying across the sky (daytime only) ================= */
export function Birds({ kind }: { kind: 'gull' | 'garden' }) {
  const N = kind === 'gull' ? 5 : 6;
  const cfg = useMemo(() => Array.from({ length: N }, (_, k) => ({
    x0: (k / N) * 26 + Math.random() * 3, y: 3.5 + Math.random() * 1.7, z: -7 - Math.random() * 2.5, sp: 0.9 + Math.random() * 0.8, dir: k % 3 === 0 ? -1 : 1,
    ph: Math.random() * 6.3, s: 1.2 + Math.random() * 0.5,
    body: kind === 'gull' ? '#f6f6f2' : ['#4a86d8', '#e8b030', '#d85a4a', '#5aa85a', '#9a6ad0', '#e87aa0'][k % 6],
    wing: kind === 'gull' ? '#9aa4ae' : ['#2e62b0', '#c48a18', '#a83c32', '#3a823a', '#7a4ab0', '#c85a80'][k % 6],
  })), [N, kind]);
  const root = useRef<THREE.Group>(null!), birds = useRef<THREE.Group[]>([]), wl = useRef<THREE.Group[]>([]), wr = useRef<THREE.Group[]>([]);
  useFrame(({ clock }) => {
    const T = clock.elapsedTime, vis = 1 - THREE.MathUtils.clamp(tk.v * 3, 0, 1);
    if (!root.current) return;
    root.current.visible = vis > 0.02;
    if (vis <= 0.02) return;
    cfg.forEach((c, k) => {
      const b = birds.current[k]; if (!b) return;
      const x = c.dir * (((c.x0 + T * c.sp) % 26) - 13);
      b.position.set(x, c.y + Math.sin(T * 0.7 + c.ph) * 0.35, c.z + Math.sin(T * 0.3 + c.ph) * 0.6);
      b.rotation.set(0, c.dir > 0 ? 0 : Math.PI, Math.cos(T * 0.7 + c.ph) * 0.08);
      b.scale.setScalar(c.s * vis);
      const f = Math.sin(T * (kind === 'gull' ? 6 : 11) + c.ph) * 0.75 * (kind === 'gull' ? 0.5 + 0.5 * Math.sin(T * 0.5 + c.ph) : 1);
      wl.current[k].rotation.x = -f; wr.current[k].rotation.x = f;
    });
  });
  const mat = (col: string) => <meshStandardMaterial color={col} flatShading roughness={0.8} />;
  return (
    <group ref={root}>
      {cfg.map((c, k) => (
        <group key={k} ref={g => { if (g) birds.current[k] = g; }}>
          <mesh scale={[0.18, 0.085, 0.1]}><sphereGeometry args={[1, 10, 8]} />{mat(c.body)}</mesh>
          <mesh position={[0.17, 0.04, 0]} scale={[0.07, 0.065, 0.065]}><sphereGeometry args={[1, 10, 8]} />{mat(c.body)}</mesh>
          <mesh position={[0.25, 0.035, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[0.025, 0.06, 0.025]}><coneGeometry args={[1, 1, 6]} /><meshStandardMaterial color="#ffb13a" flatShading /></mesh>
          <mesh position={[-0.2, 0.01, 0]} scale={[0.1, 0.012, 0.06]}>{<sphereGeometry args={[1, 8, 6]} />}{mat(c.wing)}</mesh>
          <group ref={g => { if (g) wl.current[k] = g; }} position={[0, 0.04, 0.07]}><mesh position={[-0.02, 0, 0.16]} scale={[0.11, 0.012, 0.2]}><sphereGeometry args={[1, 10, 6]} />{mat(c.wing)}</mesh></group>
          <group ref={g => { if (g) wr.current[k] = g; }} position={[0, 0.04, -0.07]}><mesh position={[-0.02, 0, -0.16]} scale={[0.11, 0.012, 0.2]}><sphereGeometry args={[1, 10, 6]} />{mat(c.wing)}</mesh></group>
        </group>
      ))}
    </group>
  );
}

/* ================= BEACH: little scorpions wandering on the near sand =================
 * They stay in the front strip of sand and always steer away from both characters (never touch them). */
const SC_BODY = '#8a5a2b', SC_TAIL = '#b07838', SC_DARK = '#2a1a10';
const SC_R = 1.7;   // personal-space radius around each character
function Scorpion({ x0, z0, seed }: { x0: number; z0: number; seed: number }) {
  const g = useRef<THREE.Group>(null!), tail = useRef<THREE.Group>(null!), legs = useRef<THREE.Group[]>([]);
  const S = useRef({ x: x0, z: z0, ang: seed * 2.1, t: 0, turn: 0, pause: 0, ph: seed * 3 });
  const M = (c: string) => <meshStandardMaterial color={c} flatShading roughness={0.7} />;
  useFrame(({ clock }, dt) => {
    if (!g.current) return;
    dt = Math.min(dt, 0.05);
    const s = S.current, T = clock.elapsedTime;
    s.t -= dt;
    if (s.t <= 0) { s.t = 1.5 + Math.random() * 3; s.turn = (Math.random() - 0.5) * 2.4; s.pause = Math.random() < 0.25 ? 0.7 + Math.random() * 1.3 : 0; }
    if (s.pause > 0) s.pause -= dt; else s.ang += s.turn * dt * 0.5;
    // steer away from both characters
    let rx = 0, rz = 0, mag = 0, fleeing = false;
    for (const b of BODY) {
      const dx = s.x - b.x, dz = s.z - b.z, d = Math.hypot(dx, dz) || 0.01;
      if (d < SC_R + 0.8) { const k = (SC_R + 0.8 - d) / (SC_R + 0.8); rx += (dx / d) * k; rz += (dz / d) * k; mag = Math.max(mag, k); if (d < SC_R + 0.3) fleeing = true; }
    }
    // stay inside the front strip of sand
    if (s.x > 6.2) rx -= 1, mag = Math.max(mag, 0.6); if (s.x < -6.2) rx += 1, mag = Math.max(mag, 0.6);
    if (s.z > 4.0) rz -= 1, mag = Math.max(mag, 0.6); if (s.z < 1.9) rz += 1, mag = Math.max(mag, 0.6);
    if (mag > 0) {
      const away = Math.atan2(rx, rz), da = Math.atan2(Math.sin(away - s.ang), Math.cos(away - s.ang));
      s.ang += da * Math.min(1, 5 * dt * (0.3 + mag));
    }
    const spd = fleeing ? 0.9 : s.pause > 0 && mag === 0 ? 0 : 0.32;
    s.x += Math.sin(s.ang) * spd * dt; s.z += Math.cos(s.ang) * spd * dt;
    // hard guarantee: never closer than SC_R to anyone, never leave the sand strip
    for (const b of BODY) { const dx = s.x - b.x, dz = s.z - b.z, d = Math.hypot(dx, dz) || 0.01; if (d < SC_R) { s.x = b.x + (dx / d) * SC_R; s.z = b.z + (dz / d) * SC_R; } }
    s.x = THREE.MathUtils.clamp(s.x, -6.6, 6.6); s.z = THREE.MathUtils.clamp(s.z, 1.7, 4.3);
    g.current.position.set(s.x, 0.04, s.z); g.current.rotation.y = s.ang;
    s.ph += spd * dt * 22;
    legs.current.forEach((l, k) => { if (l) l.rotation.y = (k < 4 ? 1 : -1) * Math.sin(s.ph + k * 1.3) * (spd > 0 ? 0.35 : 0.03); });
    if (tail.current) tail.current.rotation.x = Math.sin(T * 1.6 + seed) * 0.08 + (spd === 0 ? Math.sin(T * 5) * 0.06 : 0);
  });
  const tailPts: [number, number][] = [[-0.32, 0.07], [-0.4, 0.12], [-0.43, 0.2], [-0.38, 0.28], [-0.29, 0.33], [-0.2, 0.33]];
  return (
    <group ref={g} scale={1.5}>
      <mesh position={[0, 0.06, 0.13]} scale={[0.07, 0.04, 0.09]}><sphereGeometry args={[1, 10, 8]} />{M(SC_BODY)}</mesh>
      {[0, 1, 2, 3].map(k => <mesh key={k} position={[0, 0.055, -0.02 - k * 0.07]} scale={[0.062 - k * 0.007, 0.035, 0.05]}><sphereGeometry args={[1, 10, 8]} />{M(k % 2 ? SC_BODY : SC_TAIL)}</mesh>)}
      <group ref={tail}>
        {tailPts.map(([z, y], k) => <mesh key={k} position={[0, y, z]} scale={0.034 - k * 0.002}><sphereGeometry args={[1, 8, 6]} />{M(SC_TAIL)}</mesh>)}
        <mesh position={[0, 0.3, -0.14]} rotation={[Math.PI * 0.85, 0, 0]} scale={[0.02, 0.06, 0.02]}><coneGeometry args={[1, 1, 6]} />{M(SC_DARK)}</mesh>
      </group>
      {[-1, 1].map(sd => <group key={sd}>
        <mesh position={[sd * 0.07, 0.055, 0.25]} rotation={[0.9, 0, sd * 0.3]} scale={[0.014, 0.075, 0.014]}><capsuleGeometry args={[1, 1, 4, 6]} />{M(SC_BODY)}</mesh>
        <mesh position={[sd * 0.1, 0.05, 0.34]} scale={[0.045, 0.02, 0.065]}><sphereGeometry args={[1, 10, 8]} />{M(SC_TAIL)}</mesh>
        <mesh position={[sd * 0.065, 0.05, 0.37]} scale={[0.02, 0.014, 0.04]}><sphereGeometry args={[1, 8, 6]} />{M(SC_BODY)}</mesh>
        {[0, 1, 2, 3].map(k => <group key={k} ref={l => { if (l) legs.current[(sd > 0 ? 0 : 4) + k] = l; }} position={[sd * 0.05, 0.05, 0.16 - k * 0.06]}>
          <mesh position={[sd * 0.06, -0.015, 0]} rotation={[0, 0, -sd * 1.1]} scale={[0.01, 0.07, 0.01]}><capsuleGeometry args={[1, 1, 4, 6]} />{M(SC_BODY)}</mesh>
          <mesh position={[sd * 0.115, -0.03, 0]} scale={[0.008, 0.045, 0.008]}><capsuleGeometry args={[1, 1, 4, 6]} />{M(SC_DARK)}</mesh>
        </group>)}
      </group>)}
      {[-1, 1].map(sd => <mesh key={sd} position={[sd * 0.025, 0.1, 0.19]} scale={0.012}><sphereGeometry args={[1, 6, 6]} />{M('#111')}</mesh>)}
    </group>
  );
}
export function Scorpions() {
  return (<><Scorpion x0={-3.2} z0={3.0} seed={1} /><Scorpion x0={2.8} z0={2.6} seed={2} /><Scorpion x0={-0.4} z0={3.7} seed={3} /></>);
}


/* ================= GARDEN + BEACH: fireflies at night / evening ================= */
export function Fireflies({ area }: { area: 'garden' | 'beach' }) {
  const N = 38;
  const core = useRef<THREE.InstancedMesh>(null!), halo = useRef<THREE.InstancedMesh>(null!), dummy = useMemo(() => new THREE.Object3D(), []);
  const F = useMemo(() => Array.from({ length: N }, () => area === 'garden'
    ? { cx: -6 + Math.random() * 12, cy: 0.4 + Math.random() * 1.9, cz: -4.2 + Math.random() * 5.5, rx: 0.5 + Math.random() * 1.2, ry: 0.2 + Math.random() * 0.4, rz: 0.4 + Math.random() * 1, a: 0.2 + Math.random() * 0.4, b: 0.3 + Math.random() * 0.5, c: 0.2 + Math.random() * 0.4, ph: Math.random() * 6.3, bl: 0.6 + Math.random() * 0.9 }
    : { cx: -6 + Math.random() * 11, cy: 0.4 + Math.random() * 1.5, cz: -2 + Math.random() * 5, rx: 0.5 + Math.random() * 1.2, ry: 0.2 + Math.random() * 0.4, rz: 0.4 + Math.random() * 1, a: 0.2 + Math.random() * 0.4, b: 0.3 + Math.random() * 0.5, c: 0.2 + Math.random() * 0.4, ph: Math.random() * 6.3, bl: 0.6 + Math.random() * 0.9 }), [area]);
  useFrame(({ clock }) => {
    if (!core.current || !halo.current) return;
    const T = clock.elapsedTime, vis = THREE.MathUtils.clamp((tk.v - 0.3) * 2.5, 0, 1) * (get().rain ? 0 : 1);
    core.current.visible = halo.current.visible = vis > 0.01;
    if (vis <= 0.01) return;
    for (let k = 0; k < N; k++) {
      const f = F[k], glow = Math.pow(Math.max(0, Math.sin(T * f.bl * 2.2 + f.ph)), 2) * vis;
      dummy.position.set(f.cx + Math.sin(T * f.a + f.ph) * f.rx, f.cy + Math.sin(T * f.b + f.ph * 2) * f.ry, f.cz + Math.cos(T * f.c + f.ph) * f.rz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(0.0001 + 0.022 * (0.35 + glow) * vis); dummy.updateMatrix(); core.current.setMatrixAt(k, dummy.matrix);
      dummy.scale.setScalar(0.0001 + 0.12 * glow); dummy.updateMatrix(); halo.current.setMatrixAt(k, dummy.matrix);
    }
    core.current.instanceMatrix.needsUpdate = true; halo.current.instanceMatrix.needsUpdate = true;
  });
  return (<>
    <instancedMesh ref={core} args={[undefined, undefined, N]} frustumCulled={false}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="#f4ff9a" /></instancedMesh>
    <instancedMesh ref={halo} args={[undefined, undefined, N]} frustumCulled={false}><sphereGeometry args={[1, 10, 8]} /><meshBasicMaterial color="#d4ff4a" transparent opacity={0.28} depthWrite={false} blending={THREE.AdditiveBlending} /></instancedMesh>
  </>);
}

/* ================= GARDEN + BEACH: rain (store.rain) ================= */
const NR = 650;
export function Rain() {
  const on = useGame(g => g.rain);
  const mesh = useRef<THREE.InstancedMesh>(null!), mat = useRef<THREE.MeshBasicMaterial>(null!), k = useRef(0), dummy = useMemo(() => new THREE.Object3D(), []);
  const P = useMemo(() => Array.from({ length: NR }, () => ({ x: -9 + Math.random() * 18, y: Math.random() * 7, z: -9 + Math.random() * 13, v: 8 + Math.random() * 4 })), []);
  useEffect(() => { setRainSound(on); return () => setRainSound(false); }, [on]);
  useFrame((_, dt) => {
    if (!mesh.current) return;
    k.current = THREE.MathUtils.damp(k.current, on ? 1 : 0, 1.6, dt);
    mesh.current.visible = k.current > 0.01;
    if (!mesh.current.visible) return;
    mat.current.opacity = 0.42 * k.current;
    dt = Math.min(dt, 0.05);
    dummy.rotation.set(0, 0, 0.13);
    for (let i = 0; i < NR; i++) {
      const q = P[i];
      q.y -= q.v * dt; q.x -= 1.1 * dt;
      if (q.y < 0) { q.y = 6.5 + Math.random() * 1.5; q.x = -9 + Math.random() * 18; q.z = -9 + Math.random() * 13; }
      dummy.position.set(q.x, q.y, q.z); dummy.updateMatrix(); mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, NR]} frustumCulled={false} visible={false}>
      <boxGeometry args={[0.012, 0.5, 0.012]} /><meshBasicMaterial ref={mat} color="#cfe6ff" transparent opacity={0} depthWrite={false} />
    </instancedMesh>
  );
}
