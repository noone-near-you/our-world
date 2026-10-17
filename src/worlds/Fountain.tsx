import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { get, useGame } from '../state/store';
import { Sky, Mountains, Fireworks, skyK } from './Proposal';

/* ================= SECRET WORLD: the wish fountain =================
 * A moonlit plaza with a fountain. She throws a coin and makes a wish; the whole area then transforms into the wish:
 * castle (fairytale kingdom with ferris wheel, carousel, fireworks), snow, blossom, city (city of lights), lanterns.
 * Characters stand at z ≈ 0.6, the fountain is at z = -3, ground is y = 0. */
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pickOf = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const FZ = -3;

/** shared look values the Scene reads each frame (background, fog, hemisphere light) */
export const fx = { bg: new THREE.Color('#0a1230'), hemi: new THREE.Color('#9fb0e8'), light: 1, near: 40, far: 150 };
const K: Record<string, number> = { castle: 0, snow: 0, blossom: 0, city: 0, lanterns: 0, glowsea: 0, forest: 0, balloons: 0, galaxy: 0, rainstreet: 0, venice: 0, rainbow: 0 };   // how strongly each wish is currently shown (0..1)

const LOOK: Record<string, { bg: string; hemi: string; light: number; near: number; far: number; stars?: number }> = {
  '': { bg: '#0a1230', hemi: '#9fb0e8', light: 1, near: 40, far: 150 },
  castle: { bg: '#1c1658', hemi: '#cdbcff', light: 1.3, near: 70, far: 220 },
  snow: { bg: '#0c1a3a', hemi: '#bcd6ff', light: 1.4, near: 40, far: 150 },
  blossom: { bg: '#36203f', hemi: '#ffd6ea', light: 1.35, near: 45, far: 160 },
  city: { bg: '#101a3e', hemi: '#ffe2b4', light: 1.25, near: 55, far: 190 },
  lanterns: { bg: '#0b0828', hemi: '#ffc894', light: 1.15, near: 50, far: 170 },
  glowsea: { bg: '#04122a', hemi: '#8adcff', light: 1.35, near: 50, far: 190 },
  forest: { bg: '#04121a', hemi: '#8affd4', light: 1.35, near: 30, far: 120 },
  balloons: { bg: '#f0a278', hemi: '#ffe0bc', light: 1.9, near: 60, far: 230, stars: 0 },
  galaxy: { bg: '#02030e', hemi: '#9aa8ff', light: 1.25, near: 80, far: 300 },
  rainstreet: { bg: '#080d1c', hemi: '#90a4d4', light: 1.2, near: 30, far: 120 },
  venice: { bg: '#16102e', hemi: '#ffd2a0', light: 1.35, near: 50, far: 190 },
  rainbow: { bg: '#8fd0ff', hemi: '#fff4e0', light: 2.0, near: 80, far: 260, stars: 0 },
};
const LIGHTS: Record<string, [string, [number, number, number], number][]> = {
  '': [['#7fb0ff', [0, 5, -2], 6], ['#ffffff', [0, 3, 3], 0]],
  castle: [['#ffb4e4', [0, 9, -14], 120], ['#ffe2a8', [0, 4, 2], 12]],
  snow: [['#a8d0ff', [0, 6, -4], 45], ['#ffffff', [0, 3, 3], 9]],
  blossom: [['#ff9ccd', [0, 5, -6], 55], ['#ffd0a0', [0, 3, 2], 9]],
  city: [['#ffd28a', [0, 8, -8], 75], ['#ffb060', [0, 3, 3], 9]],
  lanterns: [['#ff9a40', [0, 6, -6], 50], ['#ffb870', [0, 2, 2], 11]],
  glowsea: [['#40e0ff', [0, 1.5, -6], 60], ['#8aa0ff', [0, 3, 3], 9]],
  forest: [['#7affc0', [0, 4, -5], 60], ['#b08aff', [0, 3, 3], 10]],
  balloons: [['#ffcf9a', [0, 8, -20], 100], ['#ffe8c8', [0, 3, 3], 14]],
  galaxy: [['#a58aff', [0, 6, -8], 65], ['#6ad0ff', [0, 3, 3], 11]],
  rainstreet: [['#ff7ad0', [-5, 4, -5], 60], ['#6adcff', [5, 4, -8], 50]],
  venice: [['#ffb070', [0, 6, -10], 90], ['#ff9a60', [0, 3, 3], 12]],
  rainbow: [['#fff0d0', [0, 10, -10], 110], ['#ffffff', [0, 3, 3], 14]],
};

/** a themed group: rises out of the ground when its wish is active and sinks when another wish replaces it */
function Theme({ name, children }: { name: string; children: ReactNode }) {
  const g = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    const on = get().wish === name;
    K[name] = THREE.MathUtils.damp(K[name], on ? 1 : 0, on ? 1.1 : 2.4, dt);
    const k = K[name], e = k * k * (3 - 2 * k);
    if (!g.current) return;
    g.current.visible = k > 0.01; g.current.position.y = -(1 - e) * 6;
  });
  return <group ref={g} visible={false}>{children}</group>;
}

/* ---------------- base plaza ---------------- */
function Plaza() {
  const spray = useRef<THREE.InstancedMesh>(null!), ripple = useRef<THREE.Mesh>(null!), coin = useRef<THREE.Mesh>(null!), burst = useRef<THREE.InstancedMesh>(null!), glow = useRef<THREE.PointLight>(null!);
  const lA = useRef<THREE.PointLight>(null!), lB = useRef<THREE.PointLight>(null!);
  const coinAt = useGame(g => g.coinAt), wishFx = useGame(g => g.wishFx);
  const seenCoin = useRef(coinAt), seenFx = useRef(wishFx), coinT0 = useRef(-99), fxT0 = useRef(-99), splashT = useRef(-99);
  const NS = 120, NB = 180, dummy = useMemo(() => new THREE.Object3D(), []), tmpC = useMemo(() => new THREE.Color(), []);
  const D = useMemo(() => Array.from({ length: NS }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, l: Math.random() * 2 })), []);
  const B = useMemo(() => Array.from({ length: NB }, () => ({ vx: 0, vy: 0, vz: 0, l: 0 })), []);
  const trees = useMemo(() => Array.from({ length: 22 }, (_, k) => { const a = (k / 22) * Math.PI * 2 + rnd(-0.1, 0.1), r = rnd(13, 22); return { x: Math.cos(a) * r, z: Math.sin(a) * r - 6, h: rnd(3.5, 6.5) }; }), []);
  const posts = useMemo(() => Array.from({ length: 6 }, (_, k) => { const a = Math.PI * (0.18 + k * 0.128) + Math.PI; return { x: Math.cos(a) * 7.5, z: Math.sin(a) * 6.5 - 2 }; }), []);
  useEffect(() => { if (coinAt !== seenCoin.current) { seenCoin.current = coinAt; coinT0.current = -1; splashT.current = -99; } }, [coinAt]);
  useEffect(() => { if (wishFx !== seenFx.current) { seenFx.current = wishFx; fxT0.current = -1; } }, [wishFx]);
  useFrame(({ clock }, dt) => {
    dt = Math.min(dt, 0.05); const T = clock.elapsedTime, w = get().wish;
    // look (sky colour, fog, hemisphere light) follows the active wish
    const L = LOOK[w] || LOOK[''], k = 1 - Math.exp(-1.6 * dt);
    skyK.v += ((L.stars ?? 1) - skyK.v) * k;
    fx.bg.lerp(tmpC.set(L.bg), k); fx.hemi.lerp(tmpC.set(L.hemi), k); fx.light += (L.light - fx.light) * k; fx.near += (L.near - fx.near) * k; fx.far += (L.far - fx.far) * k;
    const lt = LIGHTS[w] || LIGHTS[''];
    for (const [ref, i] of [[lA, 0], [lB, 1]] as [MutableRefObject<THREE.PointLight>, number][]) {
      const l = ref.current, [c, p, inten] = lt[i]; if (!l) continue;
      l.color.lerp(tmpC.set(c), k); l.position.x += (p[0] - l.position.x) * k; l.position.y += (p[1] - l.position.y) * k; l.position.z += (p[2] - l.position.z) * k; l.intensity += (inten - l.intensity) * k;
    }
    if (glow.current) glow.current.intensity = 5 + Math.sin(T * 2) * 0.8;
    // coin flight: from her hand to the water
    if (coinT0.current === -1) coinT0.current = T;
    if (coin.current) {
      const u = (T - coinT0.current) / 1.0;
      coin.current.visible = coinT0.current > -90 && u >= 0 && u <= 1;
      if (coin.current.visible) {
        coin.current.position.set(0.55 * (1 - u), 1.25 + (0.62 - 1.25) * u + 1.5 * Math.sin(Math.PI * u), 0.7 + (FZ - 0.7) * u); coin.current.rotation.set(T * 14, 0, T * 9);
      } else if (u > 1 && u < 4 && splashT.current < 0 && coinT0.current > -90) splashT.current = T;
    }
    // splash when the coin lands: ripples + a spray of droplets
    if (splashT.current > 0 && T - splashT.current < 0.05 && B[0].l <= 0) { for (const q of B) { const a = Math.random() * 6.3, v = rnd(0.6, 2.4); q.vx = Math.cos(a) * v; q.vz = Math.sin(a) * v; q.vy = rnd(2.5, 5.5); q.l = rnd(0.8, 1.3); } }
    if (ripple.current) { const u = (T - splashT.current) / 1.6, on = splashT.current > 0 && u >= 0 && u <= 1; ripple.current.visible = on; if (on) { ripple.current.scale.setScalar(0.2 + u * 1.5); (ripple.current.material as THREE.MeshBasicMaterial).opacity = (1 - u) * 0.7; } }
    // continuous fountain jets
    if (spray.current) {
      for (let i = 0; i < NS; i++) {
        const q = D[i]; q.l -= dt;
        if (q.l <= 0) { const a = Math.random() * 6.3, v = rnd(0.2, 0.9); q.x = 0; q.y = 2.15; q.z = FZ; q.vx = Math.cos(a) * v; q.vz = Math.sin(a) * v; q.vy = rnd(0.2, 1.6); q.l = rnd(0.9, 1.5); }
        q.vy -= 4.2 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
        dummy.position.set(q.x, Math.max(q.y, 0.45), q.z); dummy.scale.setScalar(q.y > 0.45 ? 0.035 : 0.0001); dummy.updateMatrix(); spray.current.setMatrixAt(i, dummy.matrix);
      }
      spray.current.instanceMatrix.needsUpdate = true;
    }
    if (burst.current) {
      for (let i = 0; i < NB; i++) {
        const q = B[i];
        if (q.l > 0) { q.l -= dt; q.vy -= 7 * dt; const p = (burst.current as any)._p || ((burst.current as any)._p = Array.from({ length: NB }, () => [0, 0.5, FZ])); p[i][0] += q.vx * dt; p[i][1] += q.vy * dt; p[i][2] += q.vz * dt; if (p[i][1] < 0.45) q.l = 0; dummy.position.set(p[i][0], p[i][1], p[i][2]); dummy.scale.setScalar(0.045); }
        else { const p = (burst.current as any)._p; if (p) { p[i][0] = 0; p[i][1] = 0.5; p[i][2] = FZ; } dummy.position.set(0, -9, 0); dummy.scale.setScalar(0.0001); }
        dummy.updateMatrix(); burst.current.setMatrixAt(i, dummy.matrix);
      }
      burst.current.instanceMatrix.needsUpdate = true;
    }
  });
  return (<>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -14]} receiveShadow><planeGeometry args={[220, 140]} /><meshStandardMaterial color="#15241a" roughness={1} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -2]} receiveShadow><circleGeometry args={[9.5, 56]} /><meshStandardMaterial color="#8a8478" roughness={0.95} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, -2]}><ringGeometry args={[6.2, 6.5, 56]} /><meshStandardMaterial color="#b8b0a0" roughness={0.9} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, FZ]}><ringGeometry args={[2.2, 2.45, 48]} /><meshStandardMaterial color="#b8b0a0" roughness={0.9} /></mesh>
    {/* fountain */}
    <mesh position={[0, 0.25, FZ]} castShadow receiveShadow><cylinderGeometry args={[1.7, 1.8, 0.5, 40]} /><meshStandardMaterial color="#a39c8e" roughness={0.85} /></mesh>
    <mesh position={[0, 0.46, FZ]}><cylinderGeometry args={[1.55, 1.55, 0.04, 40]} /><meshStandardMaterial color="#4fc3f7" emissive="#2a8ac0" emissiveIntensity={0.4} roughness={0.1} transparent opacity={0.92} /></mesh>
    <mesh position={[0, 0.95, FZ]}><cylinderGeometry args={[0.2, 0.3, 1.0, 14]} /><meshStandardMaterial color="#c4bdae" roughness={0.8} /></mesh>
    <mesh position={[0, 1.45, FZ]}><cylinderGeometry args={[0.85, 0.35, 0.28, 24]} /><meshStandardMaterial color="#b5ae9f" roughness={0.8} /></mesh>
    <mesh position={[0, 1.95, FZ]}><sphereGeometry args={[0.2, 14, 10]} /><meshStandardMaterial color="#d0c9ba" roughness={0.7} /></mesh>
    <mesh ref={ripple} position={[0, 0.5, FZ]} rotation={[-Math.PI / 2, 0, 0]} visible={false}><ringGeometry args={[0.9, 1, 40]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.6} depthWrite={false} /></mesh>
    <mesh ref={coin} visible={false}><cylinderGeometry args={[0.07, 0.07, 0.015, 16]} /><meshStandardMaterial color="#f2c230" emissive="#c8901a" emissiveIntensity={0.9} roughness={0.3} /></mesh>
    <instancedMesh ref={spray} args={[undefined, undefined, NS]} frustumCulled={false}><sphereGeometry args={[1, 6, 5]} /><meshBasicMaterial color="#cfeaff" transparent opacity={0.85} /></instancedMesh>
    <instancedMesh ref={burst} args={[undefined, undefined, NB]} frustumCulled={false}><sphereGeometry args={[1, 6, 5]} /><meshBasicMaterial color="#ffffff" /></instancedMesh>
    <pointLight ref={glow} position={[0, 0.9, FZ]} color="#7fd0ff" intensity={5} distance={9} decay={2} />
    <pointLight ref={lA} position={[0, 5, -2]} intensity={6} distance={60} decay={2} color="#7fb0ff" />
    <pointLight ref={lB} position={[0, 3, 3]} intensity={0} distance={30} decay={2} color="#ffffff" />
    {/* lamp posts and a ring of dark trees */}
    {posts.map((p, k) => <group key={k} position={[p.x, 0, p.z]}><mesh position={[0, 1.4, 0]}><cylinderGeometry args={[0.05, 0.06, 2.8, 8]} /><meshStandardMaterial color="#2a2018" /></mesh><mesh position={[0, 2.85, 0]}><sphereGeometry args={[0.13, 10, 8]} /><meshBasicMaterial color="#ffe0a0" /></mesh></group>)}
    {trees.map((t, k) => <group key={k} position={[t.x, 0, t.z]}><mesh position={[0, t.h * 0.2, 0]}><cylinderGeometry args={[0.15, 0.2, t.h * 0.4, 6]} /><meshStandardMaterial color="#2a1c12" /></mesh>{[0, 1, 2].map(j => <mesh key={j} position={[0, t.h * (0.38 + j * 0.24), 0]}><coneGeometry args={[1.5 - j * 0.38, t.h * 0.42, 7]} /><meshStandardMaterial color="#10301f" flatShading roughness={1} /></mesh>)}</group>)}
  </>);
}

/* ---------------- WISH: fairytale kingdom ---------------- */
function Castle() {
  const wheel = useRef<THREE.Group>(null!), gond = useRef<THREE.Group[]>([]), car = useRef<THREE.Group>(null!), horses = useRef<THREE.Group[]>([]), flags = useRef<THREE.Mesh[]>([]), bal = useRef<THREE.InstancedMesh>(null!), win = useRef<THREE.InstancedMesh>(null!), bulbs = useRef<THREE.InstancedMesh>(null!);
  const fw = useRef(false), dummy = useMemo(() => new THREE.Object3D(), []), tmp = useMemo(() => new THREE.Color(), []);
  const towers = useMemo(() => ([[0, -26, 2.3, 10, '#f4ecff', '#5a6fe0'], [-4.8, -25, 1.5, 7.5, '#f7e6f0', '#e0609e'], [4.8, -25, 1.5, 7.5, '#f7e6f0', '#e0609e'], [-8.8, -24, 1.2, 5.5, '#e8f0ff', '#4ab8d8'], [8.8, -24, 1.2, 5.5, '#e8f0ff', '#4ab8d8']] as [number, number, number, number, string, string][]), []);
  const balloons = useMemo(() => Array.from({ length: 30 }, () => ({ x: rnd(-9, 9), z: rnd(-10, 2), y: rnd(0, 12), v: rnd(0.35, 0.8), ph: rnd(0, 6.3), c: pickOf(['#ff6b9a', '#ffd23a', '#5ab8ff', '#a77bff', '#ff8a4a', '#6fe0b0']) })), []);
  const FW = 8, RW = 3.4;
  useEffect(() => {
    const d = new THREE.Object3D();
    // lit windows on the keep + towers
    let n = 0; for (const [tx, tz, r, h] of towers) for (let k = 0; k < 4; k++) { const a = -0.8 + k * 0.5, y = h * (0.35 + (k % 2) * 0.25); d.position.set(tx + Math.sin(a) * r * 1.02, y, tz + Math.cos(a) * r * 1.02); d.scale.set(0.18, 0.36, 0.1); d.rotation.set(0, a, 0); d.updateMatrix(); if (n < 40) win.current.setMatrixAt(n++, d.matrix); }
    for (; n < 40; n++) { d.position.set(0, -50, 0); d.updateMatrix(); win.current.setMatrixAt(n, d.matrix); }
    win.current.instanceMatrix.needsUpdate = true;
  }, [towers]);
  useFrame(({ clock }, dt) => {
    const T = clock.elapsedTime, k = K.castle; fw.current = k > 0.7;
    if (!wheel.current) return;
    wheel.current.rotation.z = T * 0.22; gond.current.forEach(g => { if (g) g.rotation.z = -T * 0.22; });
    car.current.rotation.y = T * 0.9; horses.current.forEach((h, i) => { if (h) h.position.y = 0.7 + Math.sin(T * 2.4 + i * 1.05) * 0.22; });
    flags.current.forEach((f, i) => { if (f) { f.rotation.y = Math.sin(T * 3 + i) * 0.35; } });
    balloons.forEach((b, i) => { b.y += b.v * dt; if (b.y > 14) b.y = 0; dummy.position.set(b.x + Math.sin(T * 0.7 + b.ph) * 0.4, b.y, b.z); dummy.scale.set(0.22, 0.27, 0.22); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); bal.current.setMatrixAt(i, dummy.matrix); bal.current.setColorAt(i, tmp.set(b.c)); });
    bal.current.instanceMatrix.needsUpdate = true; if (bal.current.instanceColor) bal.current.instanceColor.needsUpdate = true;
    const tw = (Math.sin(T * 5) + 1) / 2; if (bulbs.current) (bulbs.current.material as THREE.MeshBasicMaterial).color.setHSL((T * 0.08) % 1, 0.9, 0.7 + tw * 0.15);
  });
  const bulbPts = useMemo(() => { const out: [number, number, number][] = []; for (let k = 0; k < 30; k++) { const a = (k / 30) * Math.PI * 2; out.push([-7 + Math.cos(a) * RW, 4.2 + Math.sin(a) * RW, -8 + 0.1]); } for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; out.push([6.5 + Math.cos(a) * 1.95, 2.7, -6.5 + Math.sin(a) * 1.95]); } return out; }, []);
  useEffect(() => { const d = new THREE.Object3D(); bulbPts.forEach((p, k) => { d.position.set(...p); d.scale.setScalar(0.06); d.updateMatrix(); bulbs.current.setMatrixAt(k, d.matrix); }); bulbs.current.instanceMatrix.needsUpdate = true; }, [bulbPts]);
  return (<>
    {/* the castle */}
    <mesh position={[0, 2, -23.2]} castShadow><boxGeometry args={[19, 4, 1.4]} /><meshStandardMaterial color="#efe6f8" roughness={0.8} emissive="#3a2a60" emissiveIntensity={0.25} /></mesh>
    <mesh position={[0, 1.5, -22.45]}><boxGeometry args={[2.2, 3, 0.2]} /><meshStandardMaterial color="#2a1a40" emissive="#ffd890" emissiveIntensity={0.9} /></mesh>
    {towers.map(([x, z, r, h, c, roof], k) => <group key={k} position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]} castShadow><cylinderGeometry args={[r * 0.92, r * 1.05, h, 14]} /><meshStandardMaterial color={c} roughness={0.8} emissive="#3a2a60" emissiveIntensity={0.22} /></mesh>
      <mesh position={[0, h + r * 1.1, 0]} castShadow><coneGeometry args={[r * 1.3, r * 2.4, 14]} /><meshStandardMaterial color={roof} roughness={0.6} emissive={roof} emissiveIntensity={0.18} /></mesh>
      <mesh position={[0, h + r * 2.4 + 0.5, 0]}><cylinderGeometry args={[0.025, 0.025, 1, 6]} /><meshStandardMaterial color="#d8d8e8" /></mesh>
      <mesh ref={m => { if (m) flags.current[k] = m; }} position={[0.25, h + r * 2.4 + 0.75, 0]}><planeGeometry args={[0.5, 0.3]} /><meshBasicMaterial color="#ff5a8a" side={THREE.DoubleSide} /></mesh>
    </group>)}
    <instancedMesh ref={win} args={[undefined, undefined, 40]} frustumCulled={false}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#ffe9a0" /></instancedMesh>
    {/* ferris wheel */}
    <group position={[-7, 0, -8]}>
      {[-1, 1].map(s => <mesh key={s} position={[s * 1.3, 2.1, 0]} rotation={[0, 0, -s * 0.28]}><boxGeometry args={[0.14, 4.6, 0.14]} /><meshStandardMaterial color="#e8e4f4" /></mesh>)}
      <group ref={wheel} position={[0, 4.2, 0]}>
        <mesh><torusGeometry args={[RW, 0.07, 8, 48]} /><meshStandardMaterial color="#f4f0ff" emissive="#8a7aff" emissiveIntensity={0.4} /></mesh>
        <mesh><torusGeometry args={[1.2, 0.05, 8, 32]} /><meshStandardMaterial color="#f4f0ff" /></mesh>
        {Array.from({ length: 8 }, (_, k) => <mesh key={k} rotation={[0, 0, (k * Math.PI) / 8]}><boxGeometry args={[0.05, RW * 2, 0.05]} /><meshStandardMaterial color="#f4f0ff" /></mesh>)}
        {Array.from({ length: FW + 2 }, (_, k) => { const a = (k / (FW + 2)) * Math.PI * 2, c = ['#ff6b9a', '#ffd23a', '#5ab8ff', '#a77bff', '#6fe0b0'][k % 5];
          return <group key={k} position={[Math.cos(a) * RW, Math.sin(a) * RW, 0]}><group ref={g => { if (g) gond.current[k] = g; }}><mesh position={[0, -0.32, 0]}><boxGeometry args={[0.5, 0.36, 0.4]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.3} /></mesh><mesh position={[0, -0.08, 0]}><boxGeometry args={[0.04, 0.2, 0.04]} /><meshStandardMaterial color="#e8e4f4" /></mesh></group></group>; })}
      </group>
    </group>
    {/* carousel */}
    <group position={[6.5, 0, -6.5]}>
      <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[1.8, 1.9, 0.25, 24]} /><meshStandardMaterial color="#f2d8ea" /></mesh>
      <mesh position={[0, 1.7, 0]}><cylinderGeometry args={[0.08, 0.08, 3.2, 8]} /><meshStandardMaterial color="#ffd870" /></mesh>
      <mesh position={[0, 3.1, 0]}><coneGeometry args={[2.1, 1.0, 24]} /><meshStandardMaterial color="#ff7ab0" emissive="#ff7ab0" emissiveIntensity={0.25} /></mesh>
      <mesh position={[0, 2.62, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.95, 0.06, 8, 36]} /><meshStandardMaterial color="#ffe9a0" emissive="#ffe9a0" emissiveIntensity={0.5} /></mesh>
      <group ref={car}>
        {Array.from({ length: 6 }, (_, k) => { const a = (k / 6) * Math.PI * 2, c = ['#ffffff', '#ffd1e6', '#cfe6ff', '#fff0b8', '#e2d0ff', '#d0ffe6'][k];
          return <group key={k} position={[Math.cos(a) * 1.3, 0, Math.sin(a) * 1.3]} rotation={[0, -a + Math.PI / 2, 0]}><mesh position={[0, 1.4, 0]}><cylinderGeometry args={[0.03, 0.03, 2.4, 6]} /><meshStandardMaterial color="#ffd870" /></mesh>
            <group ref={h => { if (h) horses.current[k] = h; }}><mesh scale={[0.4, 0.2, 0.16]}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color={c} /></mesh><mesh position={[0.34, 0.16, 0]} scale={[0.12, 0.18, 0.1]}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color={c} /></mesh></group></group>; })}
      </group>
    </group>
    <instancedMesh ref={bulbs} args={[undefined, undefined, 46]} frustumCulled={false}><sphereGeometry args={[1, 6, 5]} /><meshBasicMaterial color="#ffe9a0" /></instancedMesh>
    <instancedMesh ref={bal} args={[undefined, undefined, 30]} frustumCulled={false}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial roughness={0.3} emissive="#ffffff" emissiveIntensity={0.12} /></instancedMesh>
    <Fireworks activeRef={fw} spread={20} zr={[-46, -38]} hr={[11, 17]} />
  </>);
}

/* ---------------- WISH: snowy winter night ---------------- */
function Snow() {
  const N = 520, flakes = useRef<THREE.InstancedMesh>(null!), ground = useRef<THREE.MeshStandardMaterial>(null!), ground2 = useRef<THREE.MeshStandardMaterial>(null!), aur = useRef<THREE.MeshBasicMaterial[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const F = useMemo(() => Array.from({ length: N }, () => ({ x: rnd(-14, 14), y: rnd(0, 9), z: rnd(-16, 5), v: rnd(0.5, 1.1), ph: rnd(0, 6.3) })), []);
  const pines = useMemo(() => Array.from({ length: 16 }, (_, k) => { const a = (k / 16) * Math.PI * 2 + rnd(-0.1, 0.1), r = rnd(10.5, 17); return { x: Math.cos(a) * r, z: Math.sin(a) * r - 5, h: rnd(4, 7) }; }), []);
  const tex = useMemo(() => { const cv = document.createElement('canvas'); cv.width = 8; cv.height = 128; const x = cv.getContext('2d')!, g = x.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, 'rgba(60,255,160,0)'); g.addColorStop(0.25, 'rgba(60,255,170,.85)'); g.addColorStop(0.65, 'rgba(70,200,255,.5)'); g.addColorStop(1, 'rgba(170,90,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 8, 128); return new THREE.CanvasTexture(cv); }, []);
  useFrame(({ clock }, dt) => {
    dt = Math.min(dt, 0.05); const T = clock.elapsedTime, k = K.snow;
    if (ground.current) ground.current.opacity = k; if (ground2.current) ground2.current.opacity = k;
    if (flakes.current) { F.forEach((f, i) => { f.y -= f.v * dt; if (f.y < 0) { f.y = 9; f.x = rnd(-14, 14); f.z = rnd(-16, 5); } dummy.position.set(f.x + Math.sin(T * 0.8 + f.ph) * 0.35, f.y, f.z); dummy.scale.setScalar(0.03 + (i % 3) * 0.008); dummy.updateMatrix(); flakes.current.setMatrixAt(i, dummy.matrix); }); flakes.current.instanceMatrix.needsUpdate = true; }
    aur.current.forEach((m, i) => { if (m) m.opacity = k * (0.35 + 0.2 * Math.sin(T * 0.7 + i * 2)); });
  });
  return (<>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -10]}><planeGeometry args={[80, 60]} /><meshStandardMaterial ref={ground} color="#eef3ff" roughness={1} transparent opacity={0} depthWrite={false} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.032, -2]}><circleGeometry args={[9.5, 48]} /><meshStandardMaterial ref={ground2} color="#f6f9ff" roughness={1} transparent opacity={0} depthWrite={false} /></mesh>
    <instancedMesh ref={flakes} args={[undefined, undefined, N]} frustumCulled={false}><sphereGeometry args={[1, 5, 4]} /><meshBasicMaterial color="#ffffff" /></instancedMesh>
    {pines.map((p, k) => <group key={k} position={[p.x, 0, p.z]}>
      <mesh position={[0, p.h * 0.15, 0]}><cylinderGeometry args={[0.15, 0.2, p.h * 0.3, 6]} /><meshStandardMaterial color="#4a3020" /></mesh>
      {[0, 1, 2, 3].map(j => <group key={j} position={[0, p.h * (0.3 + j * 0.2), 0]}><mesh><coneGeometry args={[1.5 - j * 0.3, p.h * 0.34, 8]} /><meshStandardMaterial color="#1e5a44" flatShading roughness={1} /></mesh><mesh position={[0, 0.12, 0]}><coneGeometry args={[1.32 - j * 0.3, p.h * 0.3, 8]} /><meshStandardMaterial color="#f4f8ff" flatShading roughness={1} /></mesh></group>)}
      <mesh position={[0, p.h * 1.02, 0]}><sphereGeometry args={[0.1, 8, 6]} /><meshBasicMaterial color="#ffe9a0" /></mesh>
    </group>)}
    {([[-4.6, -1.6], [4.9, -2]] as [number, number][]).map(([x, z], k) => <group key={k} position={[x, 0, z]}>
      <mesh position={[0, 0.42, 0]}><sphereGeometry args={[0.46, 14, 10]} /><meshStandardMaterial color="#ffffff" roughness={0.9} /></mesh><mesh position={[0, 1.0, 0]}><sphereGeometry args={[0.34, 14, 10]} /><meshStandardMaterial color="#ffffff" roughness={0.9} /></mesh><mesh position={[0, 1.42, 0]}><sphereGeometry args={[0.25, 14, 10]} /><meshStandardMaterial color="#ffffff" roughness={0.9} /></mesh>
      <mesh position={[0, 1.42, 0.25]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.045, 0.22, 8]} /><meshStandardMaterial color="#ff8a2a" /></mesh>
      {[-0.08, 0.08].map(e => <mesh key={e} position={[e, 1.48, 0.21]}><sphereGeometry args={[0.025, 6, 6]} /><meshBasicMaterial color="#111" /></mesh>)}
      <mesh position={[0, 1.66, 0]}><cylinderGeometry args={[0.15, 0.17, 0.2, 12]} /><meshStandardMaterial color={k ? '#c8304a' : '#2a3a8a'} /></mesh>
    </group>)}
    {[-24, 0, 24].map((x, i) => <mesh key={i} position={[x, 17, -52 + Math.abs(x) * 0.25]} rotation={[0, -x * 0.012, 0]}><planeGeometry args={[34, 18]} /><meshBasicMaterial ref={m => { if (m) aur.current[i] = m; }} map={tex} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} fog={false} /></mesh>)}
  </>);
}

/* ---------------- WISH: cherry blossoms ---------------- */
function Blossom() {
  const N = 420, pet = useRef<THREE.InstancedMesh>(null!), glow = useRef<THREE.MeshBasicMaterial>(null!), lan = useRef<THREE.InstancedMesh>(null!), ring = useRef<THREE.MeshStandardMaterial>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []), tmp = useMemo(() => new THREE.Color(), []);
  const P = useMemo(() => Array.from({ length: N }, () => ({ x: rnd(-13, 13), y: rnd(0, 9), z: rnd(-16, 5), v: rnd(0.3, 0.7), ph: rnd(0, 6.3), r: rnd(0, 6) })), []);
  const trees = useMemo(() => Array.from({ length: 13 }, (_, k) => { const a = (k / 13) * Math.PI * 2 + rnd(-0.1, 0.1), r = k < 2 ? 6 : rnd(8, 15); const ang = k === 0 ? Math.PI * 0.85 : k === 1 ? Math.PI * 0.15 : a; return { x: Math.cos(ang) * r, z: Math.sin(ang) * r - 5, h: rnd(3.2, 4.6), lean: rnd(-0.2, 0.2) }; }), []);
  const strings = useMemo(() => { const out: { p: [number, number, number]; c: string }[] = []; for (const z of [-3, -8, -13]) for (let k = 0; k <= 14; k++) { const u = k / 14; out.push({ p: [-9 + u * 18, 3.6 - Math.sin(u * Math.PI) * 0.6, z], c: k % 2 ? '#ff7a8a' : '#ffd28a' }); } return out; }, []);
  useEffect(() => { strings.forEach((s, i) => { dummy.position.set(...s.p); dummy.scale.set(0.12, 0.17, 0.12); dummy.updateMatrix(); lan.current.setMatrixAt(i, dummy.matrix); lan.current.setColorAt(i, tmp.set(s.c)); }); lan.current.instanceMatrix.needsUpdate = true; if (lan.current.instanceColor) lan.current.instanceColor.needsUpdate = true; }, [strings, dummy, tmp]);
  useFrame(({ clock }, dt) => {
    dt = Math.min(dt, 0.05); const T = clock.elapsedTime, k = K.blossom;
    if (ring.current) ring.current.opacity = k * 0.8;
    if (pet.current) { P.forEach((p, i) => { p.y -= p.v * dt; p.r += dt * 1.6; if (p.y < 0) { p.y = 9; p.x = rnd(-13, 13); p.z = rnd(-16, 5); } dummy.position.set(p.x + Math.sin(T * 0.6 + p.ph) * 0.8, p.y, p.z + Math.cos(T * 0.5 + p.ph) * 0.4); dummy.rotation.set(p.r, p.r * 0.7, 0); dummy.scale.setScalar(0.05); dummy.updateMatrix(); pet.current.setMatrixAt(i, dummy.matrix); pet.current.setColorAt(i, tmp.set(i % 3 ? '#ffb0cf' : '#fff0f6')); }); pet.current.instanceMatrix.needsUpdate = true; if (pet.current.instanceColor) pet.current.instanceColor.needsUpdate = true; }
    if (glow.current) glow.current.opacity = 0.35 + 0.1 * Math.sin(T * 1.4);
  });
  return (<>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -2]}><ringGeometry args={[2.2, 9.4, 48]} /><meshStandardMaterial ref={ring} color="#f6c6dc" roughness={1} transparent opacity={0} depthWrite={false} /></mesh>
    {trees.map((t, k) => <group key={k} position={[t.x, 0, t.z]} rotation={[0, 0, t.lean]}>
      <mesh position={[0, t.h / 2, 0]} castShadow><cylinderGeometry args={[0.12, 0.22, t.h, 7]} /><meshStandardMaterial color="#4a3024" roughness={1} /></mesh>
      {[[0, 0, 0, 1.3], [0.9, -0.3, 0.2, 0.95], [-0.9, -0.2, -0.1, 1.0], [0.3, 0.5, 0.7, 0.9], [-0.4, 0.4, -0.8, 0.9], [0.1, 0.7, 0, 0.85]].map(([bx, by, bz, br], j) => <mesh key={j} position={[bx, t.h + by, bz]} scale={br}><icosahedronGeometry args={[0.9, 1]} /><meshStandardMaterial color={j % 2 ? '#ffb3d1' : '#ff9ac2'} emissive="#ff7aa8" emissiveIntensity={0.18} flatShading roughness={0.9} /></mesh>)}
    </group>)}
    {/* red gate */}
    <group position={[0, 0, -17]}>{[-2.6, 2.6].map(x => <mesh key={x} position={[x, 2.8, 0]}><cylinderGeometry args={[0.22, 0.26, 5.6, 10]} /><meshStandardMaterial color="#c8302a" roughness={0.6} emissive="#c8302a" emissiveIntensity={0.15} /></mesh>)}
      <mesh position={[0, 5.3, 0]}><boxGeometry args={[7.4, 0.35, 0.5]} /><meshStandardMaterial color="#c8302a" emissive="#c8302a" emissiveIntensity={0.15} /></mesh><mesh position={[0, 4.55, 0]}><boxGeometry args={[6, 0.22, 0.34]} /><meshStandardMaterial color="#c8302a" /></mesh></group>
    <instancedMesh ref={lan} args={[undefined, undefined, strings.length]} frustumCulled={false}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial ref={glow} transparent opacity={0.4} /></instancedMesh>
    <instancedMesh ref={pet} args={[undefined, undefined, N]} frustumCulled={false}><circleGeometry args={[1, 6]} /><meshBasicMaterial side={THREE.DoubleSide} /></instancedMesh>
  </>);
}

/* ---------------- WISH: a city of lights ---------------- */
function City() {
  const spark = useRef<THREE.InstancedMesh>(null!), beams = useRef<THREE.Group>(null!), win = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const NS = 150;
  const sp = useMemo(() => Array.from({ length: NS }, () => { const y = rnd(0.5, 30), r = Math.max(0.15, (y < 9 ? 7 - (y / 9) * 3.8 : y < 17 ? 3.2 - ((y - 9) / 8) * 1.6 : y < 26 ? 1.6 - ((y - 17) / 9) * 1.1 : 0.5 - ((y - 26) / 6) * 0.45)), a = rnd(0, 6.3); return { x: Math.cos(a) * r, y, z: -34 + Math.sin(a) * r, ph: rnd(0, 6.3), sp: rnd(2, 6) }; }), []);
  const bld = useMemo(() => { const out: { x: number; z: number; h: number; w: number; c: string }[] = []; for (const sd of [-1, 1]) for (let k = 0; k < 8; k++) out.push({ x: sd * (9.5 + rnd(0, 2.5)), z: -6 - k * 4.2, h: rnd(8, 13), w: rnd(5.5, 6.5), c: pickOf(['#d8c8a8', '#cdbd9c', '#e0d2b4', '#c4b496']) }); return out; }, []);
  const wins = useMemo(() => { const out: [number, number, number, number][] = []; bld.forEach(b => { const faceX = b.x > 0 ? b.x - b.w / 2 - 0.02 : b.x + b.w / 2 + 0.02; for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (Math.random() < 0.8) out.push([faceX, 1.4 + r * (b.h / 5.4), b.z - 1.6 + c * 1.6, b.x > 0 ? -1 : 1]); }); return out; }, [bld]);
  useEffect(() => { wins.slice(0, 260).forEach((w, i) => { dummy.position.set(w[0], w[1], w[2]); dummy.scale.set(0.05, 0.7, 0.5); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); win.current.setMatrixAt(i, dummy.matrix); }); for (let i = wins.length; i < 260; i++) { dummy.position.set(0, -50, 0); dummy.updateMatrix(); win.current.setMatrixAt(i, dummy.matrix); } win.current.instanceMatrix.needsUpdate = true; }, [wins, dummy]);
  useFrame(({ clock }) => {
    const T = clock.elapsedTime;
    sp.forEach((s, i) => { const on = Math.sin(T * s.sp + s.ph) > 0.55; dummy.position.set(s.x, s.y, s.z); dummy.scale.setScalar(on ? 0.16 : 0.0001); dummy.updateMatrix(); spark.current.setMatrixAt(i, dummy.matrix); });
    spark.current.instanceMatrix.needsUpdate = true;
    if (beams.current) beams.current.rotation.y = T * 0.5;
  });
  return (<>
    {/* the iron tower */}
    <group position={[0, 0, -34]}>
      {([[4.5, 7, 3.2, 9], [13, 3.2, 1.6, 8], [21.5, 1.6, 0.5, 9], [29.5, 0.5, 0.05, 6]] as [number, number, number, number][]).map(([y, rb, rt, h], k) => <group key={k} position={[0, y, 0]}>
        <mesh><cylinderGeometry args={[rt, rb, h, 8, 3, true]} /><meshBasicMaterial color="#f2c264" wireframe /></mesh>
        <mesh><cylinderGeometry args={[rt * 0.9, rb * 0.9, h, 8]} /><meshStandardMaterial color="#3a2a18" emissive="#8a5a18" emissiveIntensity={0.45} /></mesh></group>)}
      {[9, 17.5].map(y => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[y < 10 ? 3.3 : 1.7, 0.18, 6, 24]} /><meshBasicMaterial color="#ffe3a0" /></mesh>)}
      <group ref={beams} position={[0, 32, 0]}>{[0, Math.PI].map(a => <mesh key={a} rotation={[0, a, 1.2]} position={[Math.cos(a) * 3, 0, 0]}><coneGeometry args={[1.2, 14, 12, 1, true]} /><meshBasicMaterial color="#fff2c8" transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} /></mesh>)}</group>
    </group>
    <instancedMesh ref={spark} args={[undefined, undefined, NS]} frustumCulled={false}><sphereGeometry args={[1, 6, 5]} /><meshBasicMaterial color="#fff6c8" /></instancedMesh>
    {bld.map((b, k) => <mesh key={k} position={[b.x, b.h / 2, b.z]} castShadow><boxGeometry args={[b.w, b.h, 5]} /><meshStandardMaterial color={b.c} roughness={0.9} emissive="#3a2a10" emissiveIntensity={0.15} /></mesh>)}
    <instancedMesh ref={win} args={[undefined, undefined, 260]} frustumCulled={false}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#ffd890" /></instancedMesh>
    {/* avenue lamps + cafe tables with candles */}
    {Array.from({ length: 12 }, (_, k) => { const sd = k % 2 ? 1 : -1, z = -4 - Math.floor(k / 2) * 3.4; return <group key={k} position={[sd * 4.2, 0, z]}><mesh position={[0, 1.6, 0]}><cylinderGeometry args={[0.05, 0.07, 3.2, 8]} /><meshStandardMaterial color="#1a1a22" /></mesh><mesh position={[0, 3.3, 0]}><sphereGeometry args={[0.17, 10, 8]} /><meshBasicMaterial color="#ffe0a0" /></mesh></group>; })}
    {([[-5.6, 0.2], [5.6, -0.4], [-6.2, -2.6]] as [number, number][]).map(([x, z], k) => <group key={k} position={[x, 0, z]}>
      <mesh position={[0, 0.7, 0]}><cylinderGeometry args={[0.45, 0.45, 0.05, 16]} /><meshStandardMaterial color="#e8e0d0" /></mesh><mesh position={[0, 0.35, 0]}><cylinderGeometry args={[0.05, 0.05, 0.7, 8]} /><meshStandardMaterial color="#2a2a30" /></mesh>
      <mesh position={[0, 0.78, 0]}><sphereGeometry args={[0.04, 8, 6]} /><meshBasicMaterial color="#ffb040" /></mesh>
      {[-0.7, 0.7].map(c => <mesh key={c} position={[c, 0.42, 0]}><cylinderGeometry args={[0.2, 0.2, 0.05, 12]} /><meshStandardMaterial color="#6a3a2a" /></mesh>)}
    </group>)}
  </>);
}

/* ---------------- WISH: a sky full of lanterns ---------------- */
function Lanterns() {
  const N = 150, lan = useRef<THREE.InstancedMesh>(null!), halo = useRef<THREE.InstancedMesh>(null!), refl = useRef<THREE.InstancedMesh>(null!), water = useRef<THREE.MeshStandardMaterial>(null!), star = useRef<THREE.Mesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []), tmp = useMemo(() => new THREE.Color(), []), ss = useRef({ t: 0, x: 0, y: 0, z: 0 });
  const L = useMemo(() => Array.from({ length: N }, () => ({ x: rnd(-18, 18), y: rnd(0, 20), z: rnd(-20, 5), v: rnd(0.45, 0.9), ph: rnd(0, 6.3), c: pickOf(['#ffb040', '#ff9a30', '#ffd070', '#ff8a50']) })), []);
  useEffect(() => { L.forEach((l, i) => { lan.current.setColorAt(i, tmp.set(l.c)); halo.current.setColorAt(i, tmp.set(l.c)); }); [lan, halo].forEach(r => { if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true; }); }, [L, tmp]);
  useFrame(({ clock }, dt) => {
    dt = Math.min(dt, 0.05); const T = clock.elapsedTime, k = K.lanterns;
    if (water.current) water.current.opacity = k;
    L.forEach((l, i) => {
      l.y += l.v * dt; if (l.y > 21) { l.y = 0; l.x = rnd(-18, 18); l.z = rnd(-20, 5); }
      const x = l.x + Math.sin(T * 0.5 + l.ph) * 0.6, fade = Math.min(1, (21 - l.y) / 4), glowS = 0.75 + 0.25 * Math.sin(T * 3 + l.ph);
      dummy.position.set(x, l.y, l.z); dummy.rotation.set(0, T * 0.3 + l.ph, 0); dummy.scale.set(0.2, 0.28, 0.2); dummy.updateMatrix(); lan.current.setMatrixAt(i, dummy.matrix);
      dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(0.6 * glowS * fade); dummy.updateMatrix(); halo.current.setMatrixAt(i, dummy.matrix);
      const outside = Math.hypot(x, l.z + 2) > 9.8; dummy.position.set(x, -0.012, l.z); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.setScalar(outside ? 0.5 * (1 - l.y / 24) : 0.0001); dummy.updateMatrix(); refl.current.setMatrixAt(i, dummy.matrix);
    });
    [lan, halo, refl].forEach(r => { r.current.instanceMatrix.needsUpdate = true; });
    // an occasional shooting star
    const s = ss.current; if (s.t <= 0 && Math.random() < 0.006) { s.t = 1; s.x = rnd(-20, 10); s.y = rnd(14, 24); s.z = -40; } if (s.t > 0) { s.t -= dt * 1.1; s.x += 28 * dt; s.y -= 9 * dt; }
    if (star.current) { star.current.visible = s.t > 0; star.current.position.set(s.x, s.y, s.z); star.current.rotation.z = -0.3; (star.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, s.t); }
  });
  return (<>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, -14]}><planeGeometry args={[220, 120]} /><meshStandardMaterial ref={water} color="#0a1236" roughness={0.12} metalness={0.2} emissive="#101c50" emissiveIntensity={0.4} transparent opacity={0} /></mesh>
    <instancedMesh ref={lan} args={[undefined, undefined, N]} frustumCulled={false}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial /></instancedMesh>
    <instancedMesh ref={halo} args={[undefined, undefined, N]} frustumCulled={false}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} /></instancedMesh>
    <instancedMesh ref={refl} args={[undefined, undefined, N]} frustumCulled={false}><circleGeometry args={[1, 10]} /><meshBasicMaterial color="#ffb060" transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} /></instancedMesh>
    <mesh ref={star} visible={false}><boxGeometry args={[3.5, 0.05, 0.05]} /><meshBasicMaterial color="#ffffff" transparent opacity={1} fog={false} /></mesh>
  </>);
}

const radialTex = (inner: string, outer = 'rgba(0,0,0,0)') => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d')!, g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv); };

/* ---------------- WISH: a glowing sea (bioluminescent beach) ---------------- */
function GlowSea() {
  const NP = 700, pl = useRef<THREE.InstancedMesh>(null!), sand = useRef<THREE.MeshStandardMaterial>(null!), sea = useRef<THREE.MeshStandardMaterial>(null!), foam = useRef<THREE.Mesh[]>([]), jelly = useRef<THREE.Group[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []), tmp = useMemo(() => new THREE.Color(), []);
  const P = useMemo(() => Array.from({ length: NP }, () => ({ x: rnd(-34, 34), z: rnd(-72, -10.6), s: rnd(0.05, 0.11), ph: rnd(0, 6.3) })), []);
  const J = useMemo(() => Array.from({ length: 9 }, (_, k) => ({ x: k < 2 ? (k ? 6.5 : -6.5) : rnd(-14, 14), z: k < 2 ? -4 : rnd(-30, -12), y: rnd(1.5, 4), s: rnd(0.7, 1.3), ph: rnd(0, 6.3), c: pickOf(['#7ff0ff', '#ff8ae8', '#9a9aff']) })), []);
  useFrame(({ clock }) => {
    const T = clock.elapsedTime, k = K.glowsea;
    if (sand.current) sand.current.opacity = k; if (sea.current) sea.current.opacity = k;
    if (pl.current) {
      P.forEach((p, i) => { const w = Math.sin(T * 1.1 - p.z * 0.35 + p.x * 0.12), on = Math.max(0, (w - 0.5) / 0.5); dummy.position.set(p.x, 0.045, p.z); dummy.scale.setScalar(0.0001 + p.s * (0.3 + on * 1.7)); dummy.updateMatrix(); pl.current.setMatrixAt(i, dummy.matrix); pl.current.setColorAt(i, tmp.setHSL(0.5 + 0.05 * Math.sin(p.ph), 1, 0.3 + 0.4 * on)); });
      pl.current.instanceMatrix.needsUpdate = true; if (pl.current.instanceColor) pl.current.instanceColor.needsUpdate = true;
    }
    foam.current.forEach((f, i) => { if (!f) return; const u = (T * 0.16 + i * 0.25) % 1; f.position.z = -17 + u * 6.5; (f.material as THREE.MeshBasicMaterial).opacity = Math.sin(u * Math.PI) * 0.55 * k; });
    jelly.current.forEach((g, i) => { if (!g) return; const j = J[i]; g.position.y = j.y + Math.sin(T * 0.7 + j.ph) * 0.4; g.scale.setScalar(j.s * (1 + 0.1 * Math.sin(T * 2 + j.ph))); });
  });
  return (<>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -50]}><planeGeometry args={[240, 80]} /><meshStandardMaterial ref={sea} color="#052a3a" emissive="#0a5a7a" emissiveIntensity={0.6} roughness={0.15} metalness={0.3} transparent opacity={0} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -2]}><circleGeometry args={[9.5, 48]} /><meshStandardMaterial ref={sand} color="#d8c9a0" roughness={1} transparent opacity={0} depthWrite={false} /></mesh>
    {[0, 1, 2, 3].map(i => <mesh key={i} ref={m => { if (m) foam.current[i] = m; }} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, -14]}><planeGeometry args={[90, 0.7]} /><meshBasicMaterial color="#8ff6ff" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>)}
    <instancedMesh ref={pl} args={[undefined, undefined, NP]} frustumCulled={false}><sphereGeometry args={[1, 6, 5]} /><meshBasicMaterial blending={THREE.AdditiveBlending} transparent depthWrite={false} /></instancedMesh>
    {J.map((j, i) => <group key={i} ref={g => { if (g) jelly.current[i] = g; }} position={[j.x, j.y, j.z]}>
      <mesh scale={[1, 0.7, 1]}><sphereGeometry args={[0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshBasicMaterial color={j.c} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} /></mesh>
      {[0, 1, 2, 3, 4, 5].map(t => <mesh key={t} position={[Math.cos(t * 1.05) * 0.28, -0.45, Math.sin(t * 1.05) * 0.28]}><cylinderGeometry args={[0.012, 0.006, 0.9, 5]} /><meshBasicMaterial color={j.c} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>)}
    </group>)}
  </>);
}

/* ---------------- WISH: an enchanted, glowing forest ---------------- */
function Forest() {
  const NM = 56, NW = 170, stems = useRef<THREE.InstancedMesh>(null!), caps = useRef<THREE.InstancedMesh>(null!), halos = useRef<THREE.InstancedMesh>(null!), wisp = useRef<THREE.InstancedMesh>(null!), wh = useRef<THREE.InstancedMesh>(null!), floor = useRef<THREE.MeshStandardMaterial>(null!), hm = useRef<THREE.MeshBasicMaterial>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []), tmp = useMemo(() => new THREE.Color(), []);
  const trees = useMemo(() => Array.from({ length: 13 }, (_, k) => { const a = (k / 13) * Math.PI * 2 + rnd(-0.15, 0.15), r = rnd(9, 18); return { x: Math.cos(a) * r, z: Math.sin(a) * r - 4, h: rnd(9, 15), tr: rnd(0.5, 0.95) }; }), []);
  const mush = useMemo(() => Array.from({ length: NM }, () => { const a = rnd(0, 6.3), r = rnd(3.6, 17); return { x: Math.cos(a) * r, z: Math.sin(a) * r - 3, s: rnd(0.16, 0.5), c: pickOf(['#4af0ff', '#ff5ad8', '#8aff6a', '#b88aff', '#ffd25a']) }; }), []);
  const W = useMemo(() => Array.from({ length: NW }, () => ({ x: rnd(-14, 14), y: rnd(0, 8), z: rnd(-18, 5), v: rnd(0.15, 0.5), ph: rnd(0, 6.3), c: pickOf(['#8affd0', '#ffe48a', '#ffa0e0', '#9ad0ff']) })), []);
  useEffect(() => {
    mush.forEach((m, i) => { dummy.rotation.set(0, 0, 0); dummy.position.set(m.x, m.s * 0.5, m.z); dummy.scale.set(m.s * 0.18, m.s, m.s * 0.18); dummy.updateMatrix(); stems.current.setMatrixAt(i, dummy.matrix);
      dummy.position.set(m.x, m.s, m.z); dummy.scale.set(m.s * 0.7, m.s * 0.55, m.s * 0.7); dummy.updateMatrix(); caps.current.setMatrixAt(i, dummy.matrix); caps.current.setColorAt(i, tmp.set(m.c));
      dummy.position.set(m.x, m.s * 1.05, m.z); dummy.scale.setScalar(m.s * 2); dummy.updateMatrix(); halos.current.setMatrixAt(i, dummy.matrix); halos.current.setColorAt(i, tmp.set(m.c)); });
    [stems, caps, halos].forEach(r => { r.current.instanceMatrix.needsUpdate = true; if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true; });
    W.forEach((w, i) => { wisp.current.setColorAt(i, tmp.set(w.c)); wh.current.setColorAt(i, tmp.set(w.c)); }); [wisp, wh].forEach(r => { if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true; });
  }, [mush, W, dummy, tmp]);
  useFrame(({ clock }, dt) => {
    dt = Math.min(dt, 0.05); const T = clock.elapsedTime, k = K.forest;
    if (floor.current) floor.current.opacity = k * 0.9; if (hm.current) hm.current.opacity = (0.25 + 0.12 * Math.sin(T * 1.8)) * k;
    W.forEach((w, i) => { w.y += w.v * dt; if (w.y > 9) { w.y = 0; w.x = rnd(-14, 14); w.z = rnd(-18, 5); } const tw = 0.6 + 0.4 * Math.sin(T * 3 + w.ph);
      dummy.position.set(w.x + Math.sin(T * 0.7 + w.ph) * 0.5, w.y, w.z + Math.cos(T * 0.6 + w.ph) * 0.3); dummy.scale.setScalar(0.04 * tw); dummy.updateMatrix(); wisp.current.setMatrixAt(i, dummy.matrix); dummy.scale.setScalar(0.22 * tw); dummy.updateMatrix(); wh.current.setMatrixAt(i, dummy.matrix); });
    wisp.current.instanceMatrix.needsUpdate = true; wh.current.instanceMatrix.needsUpdate = true;
  });
  return (<>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -10]}><planeGeometry args={[90, 60]} /><meshStandardMaterial ref={floor} color="#0e2a24" roughness={1} transparent opacity={0} depthWrite={false} /></mesh>
    {trees.map((t, k) => <group key={k} position={[t.x, 0, t.z]}>
      <mesh position={[0, t.h / 2, 0]} castShadow><cylinderGeometry args={[t.tr * 0.75, t.tr * 1.3, t.h, 9]} /><meshStandardMaterial color="#2a1e3a" roughness={1} emissive="#3a2a6a" emissiveIntensity={0.25} /></mesh>
      {[[0, 0, 0, 3.1], [2.2, -0.6, 0.6, 2.3], [-2.1, -0.4, -0.5, 2.4], [0.6, 1.2, 1.6, 2], [-0.8, 1.0, -1.6, 2.1]].map(([bx, by, bz, br], j) => <mesh key={j} position={[bx, t.h + by, bz]} scale={br}><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color={j % 2 ? '#2f3f9a' : '#3a2a8a'} emissive={j % 2 ? '#3a6aff' : '#7a4aff'} emissiveIntensity={0.55} flatShading roughness={0.9} /></mesh>)}
      {[0, 1, 2, 3, 4].map(j => <mesh key={`b${j}`} position={[Math.cos(j * 1.3) * t.tr * 1.2, 0.4, Math.sin(j * 1.3) * t.tr * 1.2]}><sphereGeometry args={[0.07, 6, 5]} /><meshBasicMaterial color="#8affd0" /></mesh>)}
    </group>)}
    <instancedMesh ref={stems} args={[undefined, undefined, NM]} frustumCulled={false}><cylinderGeometry args={[1, 1, 1, 7]} /><meshStandardMaterial color="#e8e0f0" roughness={0.8} emissive="#b0a0d0" emissiveIntensity={0.25} /></instancedMesh>
    <instancedMesh ref={caps} args={[undefined, undefined, NM]} frustumCulled={false}><sphereGeometry args={[1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshBasicMaterial /></instancedMesh>
    <instancedMesh ref={halos} args={[undefined, undefined, NM]} frustumCulled={false}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial ref={hm} transparent opacity={0.25} depthWrite={false} blending={THREE.AdditiveBlending} /></instancedMesh>
    <instancedMesh ref={wisp} args={[undefined, undefined, NW]} frustumCulled={false}><sphereGeometry args={[1, 6, 5]} /><meshBasicMaterial /></instancedMesh>
    <instancedMesh ref={wh} args={[undefined, undefined, NW]} frustumCulled={false}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} /></instancedMesh>
  </>);
}

/* ---------------- WISH: hot-air balloons at sunrise ---------------- */
function Balloons() {
  const N = 14, grp = useRef<THREE.Group[]>([]), meadow = useRef<THREE.MeshStandardMaterial>(null!), sunM = useRef<THREE.MeshBasicMaterial>(null!), mist = useRef<THREE.MeshBasicMaterial[]>([]);
  const PAL: [string, string][] = [['#ff5a6a', '#ffe08a'], ['#4aa8ff', '#ffffff'], ['#a77bff', '#ffd1e6'], ['#ff9a3a', '#fff0c8'], ['#3ad0a0', '#ffffff'], ['#ff6ab0', '#ffe8f4']];
  const geos = useMemo(() => PAL.map(([a, b]) => { const g = new THREE.SphereGeometry(1, 24, 16), p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color(); for (let k = 0; k < p.count; k++) { const an = Math.atan2(p.getX(k), p.getZ(k)), i = Math.floor(((an + Math.PI) / (Math.PI * 2)) * 10) % 2; c.set(i ? a : b); cols[k * 3] = c.r; cols[k * 3 + 1] = c.g; cols[k * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); return g; }), []);
  const B = useMemo(() => Array.from({ length: N }, (_, k) => ({ x: rnd(-24, 24), z: rnd(-46, -9), y: rnd(4, 16), v: rnd(0.15, 0.34), s: rnd(1.4, 2.4), ph: rnd(0, 6.3), pal: k % PAL.length })), []);
  const halo = useMemo(() => radialTex('rgba(255,240,190,.9)'), []);
  useFrame(({ clock }, dt) => {
    dt = Math.min(dt, 0.05); const T = clock.elapsedTime, k = K.balloons;
    if (meadow.current) meadow.current.opacity = k; if (sunM.current) sunM.current.opacity = k * 0.9;
    mist.current.forEach((m, i) => { if (m) m.opacity = k * (0.16 + 0.05 * Math.sin(T * 0.4 + i)); });
    grp.current.forEach((g, i) => { if (!g) return; const b = B[i]; b.y += b.v * dt; if (b.y > 28) { b.y = 1; b.x = rnd(-24, 24); b.z = rnd(-46, -9); } g.position.set(b.x + Math.sin(T * 0.2 + b.ph) * 1.5, b.y, b.z); g.rotation.y = T * 0.1 + b.ph; });
  });
  return (<>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, -12]}><planeGeometry args={[120, 70]} /><meshStandardMaterial ref={meadow} color="#6aa850" roughness={1} transparent opacity={0} depthWrite={false} /></mesh>
    <mesh position={[0, 7, -100]}><sphereGeometry args={[6, 24, 18]} /><meshBasicMaterial ref={sunM} color="#fff0b8" transparent opacity={0} fog={false} /></mesh>
    <mesh position={[0, 7, -99]}><planeGeometry args={[60, 60]} /><meshBasicMaterial map={halo} transparent opacity={0.8} depthWrite={false} fog={false} blending={THREE.AdditiveBlending} /></mesh>
    {[0, 1].map(i => <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.8 + i * 1.4, -22 - i * 8]}><planeGeometry args={[160, 50]} /><meshBasicMaterial ref={m => { if (m) mist.current[i] = m; }} color="#fff0e0" transparent opacity={0} depthWrite={false} /></mesh>)}
    {B.map((b, i) => <group key={i} ref={g => { if (g) grp.current[i] = g; }} scale={b.s} position={[b.x, b.y, b.z]}>
      <mesh position={[0, 1.15, 0]} scale={[1, 1.2, 1]} geometry={geos[b.pal]}><meshStandardMaterial vertexColors roughness={0.7} emissive="#ffffff" emissiveIntensity={0.18} /></mesh>
      <mesh position={[0, 0.1, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.55, 0.5, 14]} /><meshStandardMaterial color="#e8d8c0" roughness={0.9} /></mesh>
      <mesh position={[0, -0.28, 0]}><boxGeometry args={[0.34, 0.24, 0.34]} /><meshStandardMaterial color="#8a5a32" roughness={1} /></mesh>
      <mesh position={[0, 0.0, 0]}><sphereGeometry args={[0.07, 8, 6]} /><meshBasicMaterial color="#ffb040" /></mesh>
    </group>)}
  </>);
}

/* ---------------- WISH: dancing among the stars (galaxy) ---------------- */
function Galaxy() {
  const NS = 1800, stars = useRef<THREE.Points>(null!), band = useRef<THREE.MeshBasicMaterial>(null!), neb = useRef<THREE.MeshBasicMaterial[]>([]), floor = useRef<THREE.MeshStandardMaterial>(null!), orbs = useRef<THREE.InstancedMesh>(null!), sm = useRef<THREE.PointsMaterial>(null!), planets = useRef<THREE.Group>(null!), comet = useRef<THREE.Mesh>(null!), cs = useRef({ t: 0, x: 0, y: 0 });
  const dummy = useMemo(() => new THREE.Object3D(), []), tmp = useMemo(() => new THREE.Color(), []);
  const pos = useMemo(() => { const a = new Float32Array(NS * 3), c = new Float32Array(NS * 3), col = new THREE.Color(); for (let k = 0; k < NS; k++) { const th = rnd(0, 6.3), u = rnd(-0.1, 1), s = Math.sqrt(1 - u * u), r = rnd(90, 150); a[k * 3] = Math.cos(th) * s * r; a[k * 3 + 1] = u * r; a[k * 3 + 2] = Math.sin(th) * s * r - 30; col.set(pickOf(['#ffffff', '#cfe0ff', '#ffd8f0', '#fff2c8', '#c8f0ff'])); c[k * 3] = col.r; c[k * 3 + 1] = col.g; c[k * 3 + 2] = col.b; } return { a, c }; }, []);
  const bandTex = useMemo(() => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const x = cv.getContext('2d')!, g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(120,100,255,0)'); g.addColorStop(0.5, 'rgba(210,190,255,.85)'); g.addColorStop(1, 'rgba(120,100,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 64); for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.8})`; x.fillRect(Math.random() * 256, 12 + Math.random() * 40, 1.4, 1.4); } return new THREE.CanvasTexture(cv); }, []);
  const nebTex = useMemo(() => [radialTex('rgba(190,90,255,.55)'), radialTex('rgba(255,100,190,.5)'), radialTex('rgba(80,200,255,.5)'), radialTex('rgba(255,170,90,.4)')], []);
  const O = useMemo(() => Array.from({ length: 14 }, (_, k) => ({ r: rnd(5.5, 9), y: rnd(0.4, 2.4), sp: rnd(0.25, 0.7) * (k % 2 ? 1 : -1), ph: rnd(0, 6.3), c: pickOf(['#9ad0ff', '#ffb0f0', '#d0b0ff', '#fff0b0']) })), []);
  useEffect(() => { O.forEach((o, i) => orbs.current.setColorAt(i, tmp.set(o.c))); if (orbs.current.instanceColor) orbs.current.instanceColor.needsUpdate = true; }, [O, tmp]);
  useFrame(({ clock }, dt) => {
    dt = Math.min(dt, 0.05); const T = clock.elapsedTime, k = K.galaxy;
    if (sm.current) sm.current.opacity = k * (0.8 + 0.2 * Math.sin(T * 1.7)); if (band.current) band.current.opacity = k * 0.75; if (floor.current) floor.current.opacity = k * 0.92;
    neb.current.forEach((m, i) => { if (m) m.opacity = k * (0.5 + 0.12 * Math.sin(T * 0.3 + i)); });
    if (stars.current) stars.current.rotation.y = T * 0.004;
    if (planets.current) planets.current.rotation.y = T * 0.02;
    O.forEach((o, i) => { const a = T * o.sp + o.ph; dummy.position.set(Math.cos(a) * o.r, o.y + Math.sin(T * 1.3 + o.ph) * 0.25, Math.sin(a) * o.r - 2); dummy.scale.setScalar(0.12 + 0.03 * Math.sin(T * 4 + o.ph)); dummy.updateMatrix(); orbs.current.setMatrixAt(i, dummy.matrix); });
    orbs.current.instanceMatrix.needsUpdate = true;
    const c = cs.current; if (c.t <= 0 && Math.random() < 0.012) { c.t = 1; c.x = rnd(-30, 10); c.y = rnd(14, 26); } if (c.t > 0) { c.t -= dt * 1.3; c.x += 34 * dt; c.y -= 10 * dt; }
    if (comet.current) { comet.current.visible = c.t > 0; comet.current.position.set(c.x, c.y, -45); comet.current.rotation.z = -0.28; (comet.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, c.t); }
  });
  return (<>
    <points ref={stars} frustumCulled={false}><bufferGeometry><bufferAttribute attach="attributes-position" count={NS} array={pos.a} itemSize={3} /><bufferAttribute attach="attributes-color" count={NS} array={pos.c} itemSize={3} /></bufferGeometry><pointsMaterial ref={sm} size={2.2} sizeAttenuation={false} vertexColors transparent opacity={0} depthWrite={false} fog={false} /></points>
    <mesh position={[0, 46, -110]} rotation={[0.35, 0, 0.35]}><planeGeometry args={[260, 60]} /><meshBasicMaterial ref={band} map={bandTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} /></mesh>
    {([[-34, 26, -90, 70], [30, 36, -100, 80], [0, 16, -110, 90], [-10, 54, -95, 70]] as [number, number, number, number][]).map(([x, y, z, sz], i) => <mesh key={i} position={[x, y, z]}><planeGeometry args={[sz, sz]} /><meshBasicMaterial ref={m => { if (m) neb.current[i] = m; }} map={nebTex[i]} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} /></mesh>)}
    <group ref={planets}>
      <group position={[-30, 22, -85]} rotation={[0.3, 0, 0.35]}><mesh><sphereGeometry args={[6, 24, 18]} /><meshStandardMaterial color="#c89a6a" emissive="#6a4a2a" emissiveIntensity={0.4} roughness={0.9} /></mesh><mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.06]}><torusGeometry args={[9.5, 1.3, 6, 48]} /><meshStandardMaterial color="#e8d4a8" emissive="#8a7a50" emissiveIntensity={0.4} /></mesh></group>
      <mesh position={[32, 15, -75]}><sphereGeometry args={[3, 20, 14]} /><meshStandardMaterial color="#6aa8ff" emissive="#2a4a9a" emissiveIntensity={0.6} roughness={0.8} /></mesh>
      <mesh position={[8, 30, -95]}><sphereGeometry args={[1.6, 16, 12]} /><meshStandardMaterial color="#f4d8e8" emissive="#a07090" emissiveIntensity={0.5} /></mesh>
    </group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, -2]}><circleGeometry args={[9.5, 56]} /><meshStandardMaterial ref={floor} color="#0a0a34" emissive="#14146a" emissiveIntensity={0.55} roughness={0.05} metalness={0.6} transparent opacity={0} depthWrite={false} /></mesh>
    <instancedMesh ref={orbs} args={[undefined, undefined, 14]} frustumCulled={false}><sphereGeometry args={[1, 10, 8]} /><meshBasicMaterial /></instancedMesh>
    <mesh ref={comet} visible={false}><boxGeometry args={[4, 0.06, 0.06]} /><meshBasicMaterial color="#ffffff" transparent opacity={1} fog={false} /></mesh>
  </>);
}

/* ---------------- WISH: a rainy night street, one umbrella ---------------- */
function RainStreet() {
  const NR = 900, drops = useRef<THREE.InstancedMesh>(null!), road = useRef<THREE.MeshStandardMaterial>(null!), pud = useRef<THREE.InstancedMesh>(null!), umb = useRef<THREE.Group>(null!), neon = useRef<THREE.MeshBasicMaterial[]>([]), win = useRef<THREE.InstancedMesh>(null!), cones = useRef<THREE.MeshBasicMaterial[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []), tmp = useMemo(() => new THREE.Color(), []);
  const R = useMemo(() => Array.from({ length: NR }, () => ({ x: rnd(-14, 14), y: rnd(0, 9), z: rnd(-22, 6), v: rnd(11, 15) })), []);
  const bld = useMemo(() => { const out: { x: number; z: number; h: number; w: number; c: string }[] = []; for (const sd of [-1, 1]) for (let k = 0; k < 8; k++) out.push({ x: sd * (10.5 + rnd(0, 1.5)), z: 3 - k * 4.6, h: rnd(7, 12), w: rnd(5, 6.2), c: pickOf(['#3a2f3f', '#2f3445', '#4a3a35', '#35404a']) }); return out; }, []);
  const winPts = useMemo(() => { const out: [number, number, number][] = []; bld.forEach(b => { const fx = b.x > 0 ? b.x - b.w / 2 - 0.03 : b.x + b.w / 2 + 0.03; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) if (Math.random() < 0.7) out.push([fx, 1.6 + r * (b.h / 4.4), b.z - 1.6 + c * 1.6]); }); return out.slice(0, 220); }, [bld]);
  const puds = useMemo(() => Array.from({ length: 26 }, () => ({ x: rnd(-8, 8), z: rnd(-14, 4), s: rnd(0.4, 1.1), c: pickOf(['#ff7ad0', '#6adcff', '#ffc880', '#ff7ad0']) })), []);
  const signs = useMemo(() => [[-9.3, 3.4, -2, '#ff4fa8'], [9.3, 4.2, -6, '#4ae0ff'], [-9.3, 5, -11, '#ffd24a'], [9.3, 3.6, -15, '#ff6a6a'], [-9.3, 4, -19, '#7affc0']] as [number, number, number, string][], []);
  useEffect(() => {
    winPts.forEach((p, i) => { dummy.position.set(...p); dummy.scale.set(0.05, 0.8, 0.55); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); win.current.setMatrixAt(i, dummy.matrix); });
    for (let i = winPts.length; i < 220; i++) { dummy.position.set(0, -50, 0); dummy.updateMatrix(); win.current.setMatrixAt(i, dummy.matrix); }
    win.current.instanceMatrix.needsUpdate = true;
    puds.forEach((p, i) => { dummy.position.set(p.x, 0.045, p.z); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(p.s * 1.4, p.s, 1); dummy.updateMatrix(); pud.current.setMatrixAt(i, dummy.matrix); pud.current.setColorAt(i, tmp.set(p.c)); });
    pud.current.instanceMatrix.needsUpdate = true; if (pud.current.instanceColor) pud.current.instanceColor.needsUpdate = true;
  }, [winPts, puds, dummy, tmp]);
  useFrame(({ clock }, dt) => {
    dt = Math.min(dt, 0.05); const T = clock.elapsedTime, k = K.rainstreet;
    if (road.current) road.current.opacity = k;
    neon.current.forEach((m, i) => { if (m) m.opacity = k * (0.8 + 0.2 * Math.sin(T * 3 + i * 2) * (i === 2 ? Math.sin(T * 17) : 1)); });
    cones.current.forEach(m => { if (m) m.opacity = k * 0.12; });
    if (umb.current) { umb.current.rotation.z = Math.sin(T * 0.8) * 0.02; umb.current.visible = k > 0.4; }
    if (drops.current) {
      R.forEach((r, i) => {
        r.y -= r.v * dt; r.x -= 1.3 * dt; if (r.y < 0) { r.y = 9; r.x = rnd(-14, 14); r.z = rnd(-22, 6); }
        const dx = r.x, dz = r.z - 0.6, covered = dx * dx + dz * dz < 2.4 && r.y < 3.4;   // the umbrella keeps the rain off them
        dummy.position.set(r.x, r.y, r.z); dummy.rotation.set(0, 0, 0.1); dummy.scale.set(1, covered ? 0.0001 : 1, 1); dummy.updateMatrix(); drops.current.setMatrixAt(i, dummy.matrix);
      });
      drops.current.instanceMatrix.needsUpdate = true;
    }
  });
  return (<>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -12]}><planeGeometry args={[70, 60]} /><meshStandardMaterial ref={road} color="#1a1e30" roughness={0.08} metalness={0.5} emissive="#0a1428" emissiveIntensity={0.6} transparent opacity={0} depthWrite={false} /></mesh>
    <instancedMesh ref={pud} args={[undefined, undefined, 26]} frustumCulled={false}><circleGeometry args={[1, 14]} /><meshBasicMaterial transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} /></instancedMesh>
    {bld.map((b, k) => <mesh key={k} position={[b.x, b.h / 2, b.z]} castShadow><boxGeometry args={[b.w, b.h, 4.4]} /><meshStandardMaterial color={b.c} roughness={0.9} emissive="#10162a" emissiveIntensity={0.3} /></mesh>)}
    <instancedMesh ref={win} args={[undefined, undefined, 220]} frustumCulled={false}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#ffd49a" /></instancedMesh>
    {signs.map(([x, y, z, c], i) => <group key={i} position={[x, y, z]}><mesh><boxGeometry args={[0.15, 0.7, 1.6]} /><meshBasicMaterial ref={m => { if (m) neon.current[i] = m; }} color={c} transparent opacity={0} /></mesh><mesh><boxGeometry args={[0.1, 1.3, 2.4]} /><meshBasicMaterial color={c} transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh></group>)}
    {Array.from({ length: 8 }, (_, k) => { const sd = k % 2 ? 1 : -1, z = 3 - Math.floor(k / 2) * 6; return <group key={k} position={[sd * 6, 0, z]}><mesh position={[0, 1.8, 0]}><cylinderGeometry args={[0.05, 0.07, 3.6, 8]} /><meshStandardMaterial color="#14141c" /></mesh><mesh position={[0, 3.7, 0]}><sphereGeometry args={[0.18, 10, 8]} /><meshBasicMaterial color="#ffe0a0" /></mesh>
      <mesh position={[0, 1.85, 0]}><coneGeometry args={[1.5, 3.7, 14, 1, true]} /><meshBasicMaterial ref={m => { if (m) cones.current[k] = m; }} color="#ffd890" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} /></mesh></group>; })}
    <instancedMesh ref={drops} args={[undefined, undefined, NR]} frustumCulled={false}><boxGeometry args={[0.012, 0.55, 0.012]} /><meshBasicMaterial color="#cfe6ff" transparent opacity={0.5} depthWrite={false} /></instancedMesh>
    {/* the umbrella held over both of them */}
    <group ref={umb} position={[0, 0, 0.6]} visible={false}>
      <mesh position={[0, 2.95, 0]} scale={[1, 0.5, 1]}><sphereGeometry args={[1.5, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#d8304a" roughness={0.6} side={THREE.DoubleSide} emissive="#6a0a1a" emissiveIntensity={0.3} /></mesh>
      {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[0, 2.95, 0]} rotation={[0, (i * Math.PI) / 4, 0]}><torusGeometry args={[1.5, 0.012, 4, 24, Math.PI / 2]} /><meshStandardMaterial color="#f4e8e0" /></mesh>)}
      <mesh position={[0, 2.2, 0]}><cylinderGeometry args={[0.022, 0.022, 1.6, 8]} /><meshStandardMaterial color="#2a1a14" /></mesh>
      <mesh position={[0, 3.78, 0]}><coneGeometry args={[0.04, 0.2, 8]} /><meshStandardMaterial color="#ffd870" /></mesh>
    </group>
  </>);
}

/* ---------------- WISH: Venice-style canals and a gondola ---------------- */
function Venice() {
  const gond = useRef<THREE.Group[]>([]), water = useRef<THREE.MeshStandardMaterial>(null!), cand = useRef<THREE.InstancedMesh>(null!), win = useRef<THREE.InstancedMesh>(null!), refl = useRef<THREE.InstancedMesh>(null!), bulbs = useRef<THREE.InstancedMesh>(null!), stone = useRef<THREE.MeshStandardMaterial>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const far = useMemo(() => Array.from({ length: 11 }, (_, i) => ({ x: -31 + i * 6.2, h: rnd(9, 14), c: pickOf(['#e8b878', '#d88a6a', '#e8d4a0', '#c8785a', '#a8c4b0', '#e0a090']), roof: pickOf(['#9a3a2a', '#8a4a30']) })), []);
  const near = useMemo(() => ([[-13, -6, 7], [-18.5, -9, 9], [13, -6, 8], [18.5, -9, 6.5]] as [number, number, number][]).map(([x, z, h]) => ({ x, z, h, c: pickOf(['#e8b878', '#d88a6a', '#e0a090', '#e8d4a0']) })), []);
  const winPts = useMemo(() => { const out: [number, number][] = []; far.forEach(b => { for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) if (Math.random() < 0.75) out.push([b.x - 1.9 + c * 1.9, 1.8 + r * (b.h / 4.4)]); }); return out.slice(0, 160); }, [far]);
  const C = useMemo(() => Array.from({ length: 34 }, () => ({ x: rnd(-22, 22), z: rnd(-21, -13), v: rnd(0.08, 0.25), ph: rnd(0, 6.3) })), []);
  const strs = useMemo(() => { const out: [number, number, number][] = []; for (const z of [-2, -6, -10]) for (let k = 0; k <= 22; k++) { const u = k / 22; out.push([-15 + u * 30, 5.6 - Math.sin(u * Math.PI) * 0.9, z]); } return out; }, []);
  useEffect(() => {
    winPts.forEach(([x, y], i) => { dummy.position.set(x, y, -21.95); dummy.scale.set(0.8, 1.1, 0.05); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); win.current.setMatrixAt(i, dummy.matrix); });
    for (let i = winPts.length; i < 160; i++) { dummy.position.set(0, -50, 0); dummy.updateMatrix(); win.current.setMatrixAt(i, dummy.matrix); }
    win.current.instanceMatrix.needsUpdate = true;
    strs.forEach((p, i) => { dummy.position.set(...p); dummy.scale.setScalar(0.07); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); bulbs.current.setMatrixAt(i, dummy.matrix); }); bulbs.current.instanceMatrix.needsUpdate = true;
  }, [winPts, strs, dummy]);
  useFrame(({ clock }, dt) => {
    dt = Math.min(dt, 0.05); const T = clock.elapsedTime, k = K.venice;
    if (water.current) water.current.opacity = k; if (stone.current) stone.current.opacity = k;
    gond.current.forEach((g, i) => { if (!g) return; const dir = i ? -1 : 1, x = ((T * 0.55 * dir + i * 17) % 44 + 44) % 44 - 22; g.position.set(x, -0.2 + Math.sin(T * 1.4 + i) * 0.03, -17.2 + i * 2.4); g.rotation.y = dir > 0 ? 0 : Math.PI; g.rotation.z = Math.sin(T * 1.1 + i) * 0.03; });
    C.forEach((c, i) => { c.x += c.v * dt; if (c.x > 24) c.x = -24; dummy.position.set(c.x, -0.27, c.z + Math.sin(T * 0.6 + c.ph) * 0.2); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.setScalar(0.1 + 0.015 * Math.sin(T * 5 + c.ph)); dummy.updateMatrix(); cand.current.setMatrixAt(i, dummy.matrix); });
    cand.current.instanceMatrix.needsUpdate = true;
    winPts.forEach(([x], i) => { dummy.position.set(x, -0.26, -19.2); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(0.45 + 0.1 * Math.sin(T * 2 + i), 2.4 + 0.5 * Math.sin(T * 1.7 + i * 1.3), 1); dummy.updateMatrix(); refl.current.setMatrixAt(i, dummy.matrix); });
    for (let i = winPts.length; i < 160; i++) { dummy.position.set(0, -50, 0); dummy.updateMatrix(); refl.current.setMatrixAt(i, dummy.matrix); }
    refl.current.instanceMatrix.needsUpdate = true;
  });
  return (<>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, -17]}><planeGeometry args={[240, 9]} /><meshStandardMaterial ref={water} color="#0e3a4a" roughness={0.1} metalness={0.3} emissive="#0a3a50" emissiveIntensity={0.5} transparent opacity={0} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -2]}><circleGeometry args={[9.5, 48]} /><meshStandardMaterial ref={stone} color="#c8bca8" roughness={0.95} transparent opacity={0} depthWrite={false} /></mesh>
    {[-12.3, -21.7].map(z => <mesh key={z} position={[0, -0.05, z]}><boxGeometry args={[240, 0.5, 0.6]} /><meshStandardMaterial color="#b8ac98" roughness={1} /></mesh>)}
    {far.map((b, i) => <group key={i} position={[b.x, 0, -24.5]}><mesh position={[0, b.h / 2, 0]} castShadow><boxGeometry args={[6, b.h, 5]} /><meshStandardMaterial color={b.c} roughness={0.9} emissive="#40281a" emissiveIntensity={0.22} /></mesh><mesh position={[0, b.h + 0.4, 0]}><boxGeometry args={[6.3, 0.8, 5.3]} /><meshStandardMaterial color={b.roof} roughness={0.9} /></mesh></group>)}
    {near.map((b, i) => <group key={i} position={[b.x, 0, b.z]}><mesh position={[0, b.h / 2, 0]} castShadow><boxGeometry args={[6, b.h, 5]} /><meshStandardMaterial color={b.c} roughness={0.9} emissive="#40281a" emissiveIntensity={0.22} /></mesh><mesh position={[0, b.h + 0.4, 0]}><boxGeometry args={[6.3, 0.8, 5.3]} /><meshStandardMaterial color="#9a3a2a" roughness={0.9} /></mesh></group>)}
    <instancedMesh ref={win} args={[undefined, undefined, 160]} frustumCulled={false}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#ffd890" /></instancedMesh>
    <instancedMesh ref={refl} args={[undefined, undefined, 160]} frustumCulled={false}><planeGeometry args={[1, 1]} /><meshBasicMaterial color="#ffb860" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} /></instancedMesh>
    <instancedMesh ref={cand} args={[undefined, undefined, 34]} frustumCulled={false}><circleGeometry args={[1, 10]} /><meshBasicMaterial color="#ffd070" /></instancedMesh>
    <instancedMesh ref={bulbs} args={[undefined, undefined, strs.length]} frustumCulled={false}><sphereGeometry args={[1, 6, 5]} /><meshBasicMaterial color="#ffe6a8" /></instancedMesh>
    {/* the little arched bridge */}
    <group position={[0, 0, -17]}>
      <mesh position={[0, 1.45, 0]}><boxGeometry args={[3, 0.3, 4]} /><meshStandardMaterial color="#cfc3b0" roughness={0.9} /></mesh>
      {[-1, 1].map(s => <mesh key={s} position={[0, 0.95, s * 3.6]} rotation={[s * 0.32, 0, 0]}><boxGeometry args={[3, 0.3, 3.6]} /><meshStandardMaterial color="#cfc3b0" roughness={0.9} /></mesh>)}
      {[-1.4, 1.4].map(x => <mesh key={x} position={[x, 1.9, 0]}><boxGeometry args={[0.15, 0.55, 9]} /><meshStandardMaterial color="#bfb39f" roughness={0.9} /></mesh>)}
    </group>
    {/* gondolas */}
    {[0, 1].map(i => <group key={i} ref={g => { if (g) gond.current[i] = g; }} position={[0, -0.2, -17]}>
      <mesh rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.55]}><capsuleGeometry args={[0.28, 2.6, 4, 12]} /><meshStandardMaterial color="#14141a" roughness={0.4} /></mesh>
      {[-1.65, 1.65].map(x => <mesh key={x} position={[x, 0.32, 0]} scale={[0.1, 0.5, 0.06]}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color="#14141a" /></mesh>)}
      <mesh position={[0.3, 0.18, 0]}><boxGeometry args={[0.8, 0.14, 0.42]} /><meshStandardMaterial color="#9a1a30" roughness={0.8} /></mesh>
      <mesh position={[1.65, 0.78, 0]}><sphereGeometry args={[0.07, 8, 6]} /><meshBasicMaterial color="#ffd070" /></mesh>
      <group position={[-1.3, 0.35, 0]}><mesh position={[0, 0.3, 0]}><capsuleGeometry args={[0.1, 0.4, 4, 8]} /><meshStandardMaterial color="#f4f0f0" /></mesh><mesh position={[0, 0.72, 0]}><sphereGeometry args={[0.1, 10, 8]} /><meshStandardMaterial color="#e8c8a8" /></mesh><mesh position={[0, 0.82, 0]}><cylinderGeometry args={[0.13, 0.13, 0.04, 12]} /><meshStandardMaterial color="#d8c070" /></mesh>
        <mesh position={[-0.5, 0.3, 0.14]} rotation={[0, 0, 0.9]}><boxGeometry args={[1.5, 0.03, 0.03]} /><meshStandardMaterial color="#5a3a24" /></mesh></group>
    </group>)}
    {Array.from({ length: 10 }, (_, k) => <group key={k} position={[-18 + k * 4, 0, -12.1]}><mesh position={[0, 1.4, 0]}><cylinderGeometry args={[0.04, 0.06, 2.8, 8]} /><meshStandardMaterial color="#14141c" /></mesh><mesh position={[0, 2.9, 0]}><sphereGeometry args={[0.16, 10, 8]} /><meshBasicMaterial color="#ffe0a0" /></mesh></group>)}
  </>);
}

/* ---------------- WISH: a rainbow waterfall ---------------- */
function RainbowFalls() {
  const NF = 280, NB = 18, fall = useRef<THREE.MeshBasicMaterial[]>([]), tex = useMemo(() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const x = cv.getContext('2d')!; x.fillStyle = 'rgba(190,230,255,.55)'; x.fillRect(0, 0, 64, 256); for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.6})`; x.fillRect(Math.random() * 64, Math.random() * 256, 1 + Math.random() * 2.5, 20 + Math.random() * 80); } const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3); return t; }, []);
  const bow = useRef<THREE.MeshBasicMaterial[]>([]), lake = useRef<THREE.MeshStandardMaterial>(null!), meadow = useRef<THREE.MeshStandardMaterial>(null!), mist = useRef<THREE.MeshBasicMaterial[]>([]), fl = useRef<THREE.InstancedMesh>(null!), sunM = useRef<THREE.MeshBasicMaterial>(null!), bf = useRef<THREE.Group[]>([]), wings = useRef<THREE.Mesh[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []), tmp = useMemo(() => new THREE.Color(), []), halo = useMemo(() => radialTex('rgba(255,244,200,.9)'), []), mistTex = useMemo(() => radialTex('rgba(255,255,255,.85)'), []);
  const F = useMemo(() => Array.from({ length: NF }, () => { const a = rnd(0, 6.3), r = rnd(3.4, 16); return { x: Math.cos(a) * r, z: Math.sin(a) * r - 3, s: rnd(0.07, 0.13), c: pickOf(['#ff6a9a', '#ffd23a', '#ffffff', '#b07aff', '#ff9a4a', '#6ac8ff']) }; }), []);
  const BF = useMemo(() => Array.from({ length: NB }, () => ({ cx: rnd(-8, 8), cz: rnd(-9, 3), cy: rnd(0.8, 2.6), rx: rnd(0.8, 2.5), rz: rnd(0.6, 1.8), sp: rnd(0.3, 0.8), ph: rnd(0, 6.3), c: pickOf(['#ffb04a', '#ff6ab0', '#6ab8ff', '#fff06a', '#c08aff']) })), []);
  const COLS = ['#ff3b3b', '#ff9a3b', '#ffe53b', '#4cd964', '#3bb0ff', '#4a5bff', '#a64aff'];
  useEffect(() => { F.forEach((f, i) => { dummy.position.set(f.x, 0.12, f.z); dummy.scale.setScalar(f.s); dummy.updateMatrix(); fl.current.setMatrixAt(i, dummy.matrix); fl.current.setColorAt(i, tmp.set(f.c)); }); fl.current.instanceMatrix.needsUpdate = true; if (fl.current.instanceColor) fl.current.instanceColor.needsUpdate = true; }, [F, dummy, tmp]);
  useFrame(({ clock }, dt) => {
    dt = Math.min(dt, 0.05); const T = clock.elapsedTime, k = K.rainbow;
    tex.offset.y -= dt * 0.9;
    fall.current.forEach(m => { if (m) m.opacity = k * 0.85; });
    bow.current.forEach((m, i) => { if (m) m.opacity = k * (0.5 + 0.08 * Math.sin(T * 0.8 + i)); });
    if (lake.current) lake.current.opacity = k; if (meadow.current) meadow.current.opacity = k; if (sunM.current) sunM.current.opacity = k;
    mist.current.forEach((m, i) => { if (m) m.opacity = k * (0.55 + 0.15 * Math.sin(T * 1.1 + i * 2)); });
    bf.current.forEach((g, i) => { if (!g) return; const b = BF[i], a = T * b.sp + b.ph; g.position.set(b.cx + Math.cos(a) * b.rx, b.cy + Math.sin(a * 2.2) * 0.3, b.cz + Math.sin(a) * b.rz); g.rotation.y = -a + Math.PI / 2; const f = Math.sin(T * 14 + b.ph) * 0.9; g.children.forEach((w, j) => { w.rotation.x = j ? f : -f; }); });
    void wings;
  });
  return (<>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, -10]}><planeGeometry args={[120, 60]} /><meshStandardMaterial ref={meadow} color="#7ac45a" roughness={1} transparent opacity={0} depthWrite={false} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, -26]}><planeGeometry args={[60, 24]} /><meshStandardMaterial ref={lake} color="#2ab8d8" emissive="#1a88b0" emissiveIntensity={0.4} roughness={0.08} metalness={0.2} transparent opacity={0} /></mesh>
    {([[-12, -40, 8, 28], [-6, -42, 6, 32], [6, -42, 6, 32], [12, -40, 8, 26], [-18, -38, 7, 20], [18, -38, 7, 22]] as [number, number, number, number][]).map(([x, z, r, h], i) => <mesh key={i} position={[x, h / 2 - 1, z]} castShadow><cylinderGeometry args={[r * 0.8, r, h, 7]} /><meshStandardMaterial color="#7a8a78" flatShading roughness={1} /></mesh>)}
    {[[0, 13, -38, 8, 28, 1], [-9, 8, -34, 3, 18, 0.7], [9, 8, -34, 3, 18, 0.7]].map(([x, y, z, w, h, o], i) => <mesh key={i} position={[x, y, z]}><planeGeometry args={[w, h]} /><meshBasicMaterial ref={m => { if (m) fall.current[i] = m; }} map={tex} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} /></mesh>)}
    {[0, 1, 2].map(i => <mesh key={i} position={[-8 + i * 8, 1.4, -33]}><planeGeometry args={[14, 8]} /><meshBasicMaterial ref={m => { if (m) mist.current[i] = m; }} map={mistTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>)}
    {COLS.map((c, i) => <mesh key={i} position={[0, -4, -52]}><torusGeometry args={[36 - i * 1.15, 0.6, 6, 80, Math.PI]} /><meshBasicMaterial ref={m => { if (m) bow.current[i] = m; }} color={c} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} /></mesh>)}
    <mesh position={[-34, 34, -96]}><sphereGeometry args={[6, 24, 18]} /><meshBasicMaterial ref={sunM} color="#fff4c0" transparent opacity={0} fog={false} /></mesh>
    <mesh position={[-34, 34, -95]}><planeGeometry args={[70, 70]} /><meshBasicMaterial map={halo} transparent opacity={0.8} depthWrite={false} fog={false} blending={THREE.AdditiveBlending} /></mesh>
    <instancedMesh ref={fl} args={[undefined, undefined, NF]} frustumCulled={false}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial /></instancedMesh>
    {BF.map((b, i) => <group key={i} ref={g => { if (g) bf.current[i] = g; }}>
      {[0, 1].map(j => <mesh key={j} position={[0, 0, j ? 0.07 : -0.07]} rotation={[0, 0, 0]}><planeGeometry args={[0.16, 0.16]} /><meshBasicMaterial color={b.c} side={THREE.DoubleSide} /></mesh>)}
    </group>)}
  </>);
}

export function FountainSet() {
  return (<>
    <Sky /><Mountains /><Plaza />
    <Theme name="castle"><Castle /></Theme>
    <Theme name="snow"><Snow /></Theme>
    <Theme name="blossom"><Blossom /></Theme>
    <Theme name="city"><City /></Theme>
    <Theme name="lanterns"><Lanterns /></Theme>
    <Theme name="glowsea"><GlowSea /></Theme>
    <Theme name="forest"><Forest /></Theme>
    <Theme name="balloons"><Balloons /></Theme>
    <Theme name="galaxy"><Galaxy /></Theme>
    <Theme name="rainstreet"><RainStreet /></Theme>
    <Theme name="venice"><Venice /></Theme>
    <Theme name="rainbow"><RainbowFalls /></Theme>
  </>);
}
