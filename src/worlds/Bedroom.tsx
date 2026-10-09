import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { sfx, startHeavyBreath, stopHeavyBreath, type Sfx } from '../audio/audio';
import { get, set, useGame, subscribe } from '../state/store';
import { registerActRunner } from '../story/engine';
import type { Act } from '../story/script';
import { anch, tk, tkx, HEADW } from './anchors';
import { BeachSet, PoolSet, SKY } from './BeachSet';

import { ACTS, Person, mat, Ell, Cap, type Ctl, type V3 } from './rig';

/* ---------- the room (rounded furniture, matches the reference) ---------- */
const W = '#5b3a28', W2 = '#7a5236';
const Box = ({ p, s, c, r, k }: { p: V3; s: V3; c: string; r?: V3; k?: number }) =>
  <RoundedBox args={s} radius={k ?? Math.min(0.04, Math.min(...s) * 0.4)} smoothness={3} position={p} rotation={r} castShadow receiveShadow><meshStandardMaterial color={c} roughness={0.85} /></RoundedBox>;
const Plant = ({ p, sc = 1 }: { p: V3; sc?: number }) => (
  <group position={p} scale={sc}><mesh position={[0, 0.1, 0]} castShadow><cylinderGeometry args={[0.13, 0.1, 0.2, 20]} />{mat('#8a6a52', 0.9)}</mesh>
    {[0, 1, 2, 3, 4, 5].map(k => <mesh key={k} position={[Math.sin(k * 1.05) * 0.07, 0.34, Math.cos(k * 1.05) * 0.07]} rotation={[Math.cos(k * 1.05) * 0.55, 0, -Math.sin(k * 1.05) * 0.55]} castShadow><capsuleGeometry args={[0.03, 0.26, 4, 8]} />{mat('#4d8a45', 0.7)}</mesh>)}</group>);
function Clock() {
  const sec = useRef<THREE.Group>(null!), min = useRef<THREE.Group>(null!), hr = useRef<THREE.Group>(null!);
  useFrame(() => { const n = new Date(); sec.current.rotation.z = -n.getSeconds() / 60 * Math.PI * 2; min.current.rotation.z = -(n.getMinutes() + n.getSeconds() / 60) / 60 * Math.PI * 2; hr.current.rotation.z = -((n.getHours() % 12) + n.getMinutes() / 60) / 12 * Math.PI * 2; });
  return (<group position={[0.55, 3.05, -2.94]} rotation={[Math.PI / 2, 0, 0]}>
    <mesh><cylinderGeometry args={[0.42, 0.42, 0.06, 32]} />{mat('#3a2c25')}</mesh>
    <mesh position={[0, 0.032, 0]}><cylinderGeometry args={[0.36, 0.36, 0.02, 32]} />{mat('#efe8d8')}</mesh>
    <group position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <group ref={hr}><Box p={[0, 0.1, 0]} s={[0.035, 0.22, 0.01]} c="#222" /></group>
      <group ref={min}><Box p={[0, 0.14, 0.01]} s={[0.025, 0.3, 0.01]} c="#222" /></group>
      <group ref={sec}><Box p={[0, 0.14, 0.02]} s={[0.012, 0.32, 0.01]} c="#c8553d" /></group></group></group>);
}

const SKY_MORNING = new THREE.Color('#b8d9f5');
const SKY_AFTERNOON = new THREE.Color('#9ccbf2');
const SKY_EVENING = new THREE.Color('#f0b07a'); // pale orange
const SKY_NIGHT = new THREE.Color('#16224a');
function Window() {
  // real-time sky outside the bedroom window
  const sky = useRef<THREE.MeshBasicMaterial>(null!);
  const star = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff6d6', transparent: true, opacity: 0 }), []);
  const pts = useMemo(() => Array.from({ length: 26 }, (_, k) => [(((k * 53) % 100) / 100 - 0.5) * 1.0, (((k * 37) % 100) / 100 - 0.5) * 1.1] as [number, number]), []);
  const target = useRef(new THREE.Color('#9ccbf2'));
  useFrame((_, dt) => {
    if (!sky.current) return;
    const tod = get().tod;
    if (tod === 'morning') target.current.copy(SKY_MORNING);
    else if (tod === 'afternoon') target.current.copy(SKY_AFTERNOON);
    else if (tod === 'evening') target.current.copy(SKY_EVENING);
    else target.current.copy(SKY_NIGHT);
    sky.current.color.lerp(target.current, 1 - Math.exp(-2.2 * dt));
    const starT = tod === 'night' ? 1 : tod === 'evening' ? 0.25 : 0;
    star.opacity += (starT - star.opacity) * (1 - Math.exp(-2 * dt));
  });
  return (<group>
    <mesh position={[2.9, 2.55, -3.0]}><boxGeometry args={[1.5, 1.7, 0.06]} /><meshBasicMaterial ref={sky} color="#9ccbf2" /></mesh>
    <group position={[2.9, 2.55, -2.965]}>{pts.map((q, k) => <mesh key={k} position={[q[0], q[1], 0]} material={star}><boxGeometry args={[0.025, 0.025, 0.005]} /></mesh>)}</group>
  </group>);
}

/* ---------- lamp shade glow (follows tk.l), bedside table with the table lamp, and the blanket they pull over themselves ---------- */
const LampMat = ({ on = '#ffd48a', off = '#43342a' }: { on?: string; off?: string }) => {
  const m = useRef<THREE.MeshBasicMaterial>(null!), a = useMemo(() => new THREE.Color(on), [on]), b = useMemo(() => new THREE.Color(off), [off]);
  useFrame(() => { m.current.color.copy(b).lerp(a, tk.l); });
  return <meshBasicMaterial ref={m} side={THREE.DoubleSide} />;
};
const TableLamp = () => (
  <group position={[1.3, 0, -2.35]}>
    <Box p={[0, 0.28, 0]} s={[0.55, 0.56, 0.5]} c={W} /><Box p={[0, 0.3, 0.255]} s={[0.46, 0.2, 0.02]} c="#4a2f20" /><Box p={[0, 0.575, 0]} s={[0.6, 0.03, 0.55]} c={W2} />
    <mesh position={[0, 0.62, 0]} castShadow><cylinderGeometry args={[0.1, 0.12, 0.05, 20]} />{mat('#2a2220')}</mesh>
    <mesh position={[0, 0.8, 0]}><cylinderGeometry args={[0.018, 0.018, 0.34, 8]} />{mat('#2a2220')}</mesh>
    <mesh position={[0, 1.0, 0]}><cylinderGeometry args={[0.12, 0.2, 0.26, 24, 1, true]} /><LampMat /></mesh>
    <mesh position={[0, 1.13, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.12, 24]} /><LampMat on="#fff0c8" off="#2e2620" /></mesh>
  </group>);
function Blanket() {   // slides over the two of them once they are lying down (driven by tk.b)
  const g = useRef<THREE.Group>(null!);
  useFrame(() => { const u = THREE.MathUtils.clamp((tk.b - 0.55) / 0.4, 0, 1), e = u * u * (3 - 2 * u); g.current.visible = e > 0.01; g.current.scale.y = Math.max(e, 0.001); });
  return (<group ref={g} position={[-0.55, 0.72, -1.55]} visible={false}>
    <Box p={[0, 0.36, 0]} s={[2.4, 0.74, 1.62]} c="#e7bfc8" k={0.2} /><Box p={[-1.12, 0.46, 0]} s={[0.22, 0.34, 1.66]} c="#f6e3e6" k={0.1} /><Box p={[0.3, 0.74, 0]} s={[0.1, 0.03, 1.5]} c="#d9a5b1" k={0.015} />
    <Box p={[-1.8, 0.2, -0.4]} s={[0.7, 0.3, 0.85]} c="#f3eee4" k={0.13} />
  </group>);
}

/* ---------- the worlds. Each set only draws the place; the seat for the two of them is always at the same spot ---------- */
const Bench = ({ c = '#8a6a4a' }: { c?: string }) => (<group position={[-0.15, 0, -0.95]}><Box p={[0, 0.62, 0]} s={[2.6, 0.14, 0.8]} c={c} />{[-1.1, 1.1].map(sx => <Box key={sx} p={[sx, 0.28, 0]} s={[0.14, 0.56, 0.7]} c={c} />)}</group>);
function BedroomSet() { return (<>
    {/* walls + floor */}
    <Box p={[0, 2, -3.05]} s={[9, 4, 0.1]} c="#dcc59c" /><Box p={[-4.5, 2, 0]} s={[0.1, 4, 6.2]} c="#cdb48a" />
    {Array.from({ length: 14 }, (_, k) => <Box key={k} p={[0, -0.02, 3 - k * 0.46]} s={[9, 0.04, 0.45]} c={k % 2 ? '#8b5a3b' : '#7f5035'} />)}
    <Box p={[-4.4, 0.06, 0]} s={[0.1, 0.12, 6.2]} c={W} /><Box p={[0, 0.06, -2.95]} s={[9, 0.12, 0.1]} c={W} />
    {/* rug */}
    <mesh position={[0.2, 0.02, 0.3]} scale={[1, 1, 0.62]} receiveShadow><cylinderGeometry args={[3.1, 3.1, 0.04, 48]} />{mat('#e6dbc6')}</mesh>
    {/* bed */}
    <group position={[-1.0, 0, -1.55]}>
      <Box p={[0, 0.3, 0]} s={[3.6, 0.3, 2.1]} c={W} /><Box p={[0, 0.55, 0]} s={[3.4, 0.22, 1.95]} k={0.09} c="#f0ebe0" />
      <Box p={[-1.85, 0.95, 0]} s={[0.14, 1.3, 2.1]} c={W} /><Box p={[-1.85, 1.62, 0]} s={[0.18, 0.12, 2.2]} c={W2} />
      <Box p={[-1.35, 0.8, -0.5]} s={[0.55, 0.28, 0.85]} k={0.13} r={[0, 0, -0.2]} c="#f6f2ea" /><Box p={[-1.35, 0.8, 0.5]} s={[0.55, 0.28, 0.85]} k={0.13} r={[0, 0, -0.2]} c="#faf6ee" />
      <Box p={[0.55, 0.69, 0.0]} s={[2.4, 0.08, 2.0]} c="#fbf8f1" /><Box p={[1.4, 0.58, 0.97]} s={[0.9, 0.2, 0.1]} c="#ece6d8" /></group>
    {/* wall lamp */}
    <group position={[-2.6, 2.55, -2.95]}><Box p={[0, 0, 0]} s={[0.12, 0.3, 0.12]} c="#2a2220" /><Box p={[0.15, 0.1, 0.1]} s={[0.3, 0.06, 0.06]} c="#2a2220" />
      <mesh position={[0.3, -0.02, 0.14]}><cylinderGeometry args={[0.1, 0.2, 0.28, 24]} /><LampMat /></mesh></group>
    <TableLamp /><Blanket />
    <Clock />
    {/* window + curtains */}
    <Window />
    <Box p={[2.9, 3.42, -2.95]} s={[1.7, 0.08, 0.1]} c={W} /><Box p={[2.9, 1.68, -2.93]} s={[1.6, 0.1, 0.16]} c={W} /><Box p={[2.9, 2.55, -2.95]} s={[0.05, 1.7, 0.04]} c={W} />
    <Box p={[2.0, 2.5, -2.85]} s={[0.4, 1.95, 0.14]} c="#d6c7a4" /><Box p={[3.8, 2.5, -2.85]} s={[0.4, 1.95, 0.14]} c="#d6c7a4" />
    {/* shelf, bookcase, desk, chair, dresser */}
    <Box p={[-3.6, 2.0, -2.8]} s={[1.1, 0.07, 0.35]} c={W2} /><Plant p={[-3.95, 2.04, -2.8]} sc={1.1} /><Box p={[-3.3, 2.3, -2.82]} s={[0.4, 0.34, 0.04]} c={W} /><Box p={[-3.3, 2.3, -2.79]} s={[0.3, 0.24, 0.02]} c="#7da07a" />
    <group position={[-3.9, 0, -1.9]}><Box p={[0, 0.9, 0]} s={[0.7, 1.8, 0.4]} c={W} /><Box p={[0, 0.88, 0.12]} s={[0.58, 0.04, 0.2]} c={W2} /><Box p={[0, 1.3, 0.12]} s={[0.58, 0.04, 0.2]} c={W2} />
      {['#3f6a4d', '#8a4a3a', '#a07a4a', '#4a5a7a'].map((c, k) => <Box key={k} p={[-0.2 + k * 0.12, 1.05, 0.15]} s={[0.09, 0.34, 0.2]} c={c} />)}<Plant p={[0, 0.4, 0.1]} sc={0.8} /></group>
    <group position={[3.0, 0, -2.4]}><Box p={[0, 1.0, 0]} s={[2.4, 0.08, 0.9]} c={W2} />{[-1.1, 1.1].map(x => <Box key={x} p={[x, 0.5, 0]} s={[0.08, 1.0, 0.8]} c={W} />)}<Box p={[0, 0.85, 0]} s={[2.2, 0.2, 0.7]} c={W} />
      <Box p={[-0.4, 1.03, 0.0]} s={[0.6, 0.03, 0.4]} c="#505458" /><Box p={[-0.4, 1.26, -0.2]} s={[0.6, 0.4, 0.03]} r={[-0.15, 0, 0]} c="#2a2c30" /><Box p={[0.5, 1.15, 0.0]} s={[0.3, 0.22, 0.03]} c={W} /><Plant p={[0.9, 1.05, -0.05]} sc={1.2} /></group>
    <group position={[2.9, 0, -1.4]}><Box p={[0, 0.5, 0]} s={[0.55, 0.06, 0.55]} c={W} /><Box p={[0, 0.95, -0.25]} s={[0.55, 0.8, 0.06]} c={W} />{[-0.24, 0.24].map(x => <Box key={x} p={[x, 0.25, 0.22]} s={[0.06, 0.5, 0.06]} c={W} />)}</group>
    <group position={[3.7, 0, 0.1]}><Box p={[0, 0.5, 0]} s={[1.3, 1.0, 1.1]} c={W} /><Box p={[0, 1.02, 0]} s={[1.4, 0.07, 1.2]} c={W2} /><Box p={[0, 0.7, 0.56]} s={[1.1, 0.35, 0.03]} c="#4a2f20" /><Box p={[0, 0.3, 0.56]} s={[1.1, 0.35, 0.03]} c="#4a2f20" /></group>
    </>); }
function GardenSet() {
  const cols = ['#e86a8a', '#f5c542', '#ffffff', '#b47cf0', '#ff9ec0', '#f0a030', '#c070e0'];
  return (<>
    <Box p={[0, -0.05, 0]} s={[36, 0.1, 20]} c="#5c9a4a" k={0.04} />
    <Box p={[0, 0.35, -5.5]} s={[20, 0.9, 1.2]} c="#3f7a3a" />
    {/* trees */}
    {[[-4.2, -3.2, 1.15, 2.6], [4.5, -3.6, 1.05, 2.3], [-6.5, -1.5, 0.9, 2.0], [6.2, -2.0, 1.0, 2.4]].map(([tx, tz, sc, h], k) => (
      <group key={k} position={[tx, 0, tz]} scale={sc}>
        <mesh position={[0, h * 0.45, 0]} castShadow><cylinderGeometry args={[0.16, 0.22, h * 0.9, 8]} />{mat('#6b4a32')}</mesh>
        <Ell p={[0, h * 1.05, 0]} s={[1.3, 1.1, 1.3]} c="#3e8a3e" r={0.85} />
        <Ell p={[0.45, h * 0.9, 0.2]} s={[0.9, 0.75, 0.9]} c="#4a9a45" r={0.85} />
        <Ell p={[-0.4, h * 0.95, -0.15]} s={[0.85, 0.7, 0.85]} c="#358a38" r={0.85} />
      </group>
    ))}
    {/* bushes */}
    {[[-2.8, -1.6], [3.2, -1.8], [-3.5, 0.8], [2.6, 1.0]].map(([bx, bz], k) => (
      <group key={k} position={[bx, 0, bz]}>
        <Ell p={[0, 0.35, 0]} s={[0.55, 0.4, 0.5]} c="#4a9a45" r={0.85} />
        <Ell p={[0.2, 0.28, 0.1]} s={[0.35, 0.28, 0.35]} c="#3e8a3e" r={0.85} />
      </group>
    ))}
    {/* stone path */}
    {Array.from({ length: 7 }, (_, k) => (
      <Box key={k} p={[-1.4 + k * 0.55, 0.02, 1.1 - k * 0.08]} s={[0.45, 0.05, 0.35]} c={k % 2 ? '#c8c0b0' : '#b8b0a0'} k={0.02} />
    ))}
    {/* flowers */}
    {Array.from({ length: 40 }, (_, k) => {
      const x = ((k * 47) % 100) / 100 * 10 - 5, z = -2.6 + ((k * 31) % 100) / 100 * 2.4;
      return <group key={k} position={[x, 0, z]}>
        <mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.01, 0.01, 0.14, 4]} />{mat('#3a7a3a')}</mesh>
        <Ell p={[0, 0.16, 0]} s={[0.05, 0.03, 0.05]} c={cols[k % cols.length]} />
      </group>;
    })}
    {/* pots */}
    <group position={[2.4, 0, 0.6]}>
      <mesh position={[0, 0.2, 0]} castShadow><cylinderGeometry args={[0.28, 0.22, 0.4, 10]} />{mat('#c47a4a')}</mesh>
      <Ell p={[0, 0.5, 0]} s={[0.35, 0.25, 0.35]} c="#4a9a45" />
      <Ell p={[0.05, 0.62, 0.05]} s={[0.05, 0.03, 0.05]} c="#ff8fb0" />
    </group>
    {/* fence */}
    {[-3, -1.5, 0, 1.5, 3].map((x, k) => <Box key={k} p={[x, 0.55, -4.8]} s={[0.08, 1.1, 0.08]} c="#8a6a48" />)}
    <Box p={[0, 0.9, -4.8]} s={[7, 0.06, 0.06]} c="#8a6a48" />
    <Box p={[0, 0.45, -4.8]} s={[7, 0.06, 0.06]} c="#8a6a48" />
    {/* wooden bench at couple seat */}
    <group position={[-0.15, 0, -0.95]}>
      <Box p={[0, 0.42, 0]} s={[2.2, 0.1, 0.7]} c="#8b6a42" />
      <Box p={[0, 0.85, -0.28]} s={[2.2, 0.7, 0.1]} c="#7a5a38" />
      {[-0.95, 0.95].map(sx => <group key={sx}>
        <Box p={[sx, 0.22, 0.25]} s={[0.1, 0.44, 0.1]} c="#6a4a2e" />
        <Box p={[sx, 0.22, -0.25]} s={[0.1, 0.44, 0.1]} c="#6a4a2e" />
        <Box p={[sx, 0.7, -0.05]} s={[0.1, 0.5, 0.12]} c="#7a5a38" />
      </group>)}
      <Box p={[-1.05, 0.62, 0]} s={[0.1, 0.08, 0.65]} c="#8b6a42" />
      <Box p={[1.05, 0.62, 0]} s={[0.1, 0.08, 0.65]} c="#8b6a42" />
    </group>
  </>);
}
/* Rising steam from the pot – only visible while cooking (game.steam) */
function PotSteam() {
  const on = useGame(g => g.steam);
  const g = useRef<THREE.Group>(null!);
  const mats = useRef<THREE.MeshBasicMaterial[]>([]);
  const puffs = useMemo(() => Array.from({ length: 7 }, (_, i) => ({
    x: (i % 3 - 1) * 0.07 + (i > 3 ? 0.02 : 0),
    z: ((i * 0.37) % 1 - 0.5) * 0.1,
    phase: i * 0.85,
    scale: 0.06 + (i % 3) * 0.02,
    speed: 0.35 + (i % 4) * 0.08,
  })), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const grp = g.current; if (!grp) return;
    // fade group in/out
    const target = on ? 1 : 0;
    grp.visible = grp.userData.a > 0.02 || on;
    grp.userData.a = THREE.MathUtils.damp(grp.userData.a ?? 0, target, 2.2, 1 / 60);
    const a = grp.userData.a as number;
    puffs.forEach((p, i) => {
      const m = grp.children[i] as THREE.Mesh;
      if (!m) return;
      const cycle = ((t * p.speed + p.phase) % 2.4) / 2.4; // 0→1 loop
      const y = 0.48 + cycle * 0.95;
      const swell = 0.55 + cycle * 1.1;
      m.position.set(p.x + Math.sin(t * 0.7 + p.phase) * 0.03, y, p.z);
      m.scale.setScalar(p.scale * swell);
      const mat = mats.current[i];
      if (mat) mat.opacity = a * (1 - cycle) * 0.45;
    });
  });
  return (
    <group ref={g} userData={{ a: 0 }} visible={false}>
      {puffs.map((p, i) => (
        <mesh key={i} position={[p.x, 0.5, p.z]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial
            ref={el => { if (el) mats.current[i] = el; }}
            color="#f8f4ee"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
function KitchenSet() { return (<>
  {/* floor + walls */}
  <Box p={[0, -0.02, 0]} s={[14, 0.04, 12]} c="#d9cfbf" />
  <Box p={[0, 2, -3.2]} s={[14, 4.2, 0.12]} c="#f0e6d4" />
  <Box p={[-5.2, 2, 0]} s={[0.12, 4.2, 8]} c="#e8dcc8" />
  <Box p={[5.2, 2, 0]} s={[0.12, 4.2, 8]} c="#e8dcc8" />
  {/* back lower cabinets + counter */}
  <Box p={[1.4, 0.42, -2.75]} s={[7.2, 0.84, 0.85]} c="#c4a882" />
  <Box p={[1.4, 0.88, -2.7]} s={[7.4, 0.08, 0.95]} c="#8b6a48" />
  {/* upper cabinets */}
  <Box p={[-0.6, 2.85, -2.95]} s={[3.6, 0.9, 0.55]} c="#c4a882" />
  <Box p={[3.4, 2.85, -2.95]} s={[3.2, 0.9, 0.55]} c="#c4a882" />
  {/* fridge */}
  <Box p={[-3.6, 1.15, -2.55]} s={[1.15, 2.3, 0.95]} c="#cfd6da" />
  <Box p={[-3.6, 1.7, -2.05]} s={[0.95, 0.06, 0.04]} c="#9aa3a8" />
  <Box p={[-3.6, 0.7, -2.05]} s={[0.95, 0.06, 0.04]} c="#9aa3a8" />
  {/* stove + pot */}
  <Box p={[1.8, 0.95, -2.55]} s={[1.6, 0.08, 0.7]} c="#3a3a3e" />
  <Box p={[1.5, 0.98, -2.45]} s={[0.35, 0.04, 0.35]} c="#2a2a2e" />
  <Box p={[2.1, 0.98, -2.45]} s={[0.35, 0.04, 0.35]} c="#2a2a2e" />
  <group position={[1.8, 1.0, -2.5]}>
    <mesh position={[0, 0.22, 0]} castShadow><cylinderGeometry args={[0.32, 0.28, 0.38, 16]} />{mat('#e8e0d4')}</mesh>
    <mesh position={[0, 0.42, 0]} castShadow><cylinderGeometry args={[0.34, 0.34, 0.06, 16]} />{mat('#d4ccc0')}</mesh>
    <mesh position={[0.28, 0.42, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.03, 0.03, 0.18, 8]} />{mat('#c8c0b4')}</mesh>
    <mesh position={[-0.28, 0.42, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.03, 0.03, 0.18, 8]} />{mat('#c8c0b4')}</mesh>
    <PotSteam />
  </group>
  {/* range hood */}
  <Box p={[1.8, 2.55, -2.7]} s={[1.8, 0.12, 0.7]} c="#6a5a4a" />
  <Box p={[1.8, 2.2, -2.85]} s={[0.15, 0.6, 0.15]} c="#5a4a3a" />
  {/* island / prep counter */}
  <Box p={[0.6, 0.42, -0.4]} s={[3.4, 0.84, 1.1]} c="#c4a882" />
  <Box p={[0.6, 0.88, -0.4]} s={[3.55, 0.08, 1.2]} c="#8b6a48" />
  {/* cutting board + tomatoes */}
  <Box p={[1.1, 0.95, -0.25]} s={[0.7, 0.04, 0.45]} c="#b8956a" />
  <Ell p={[0.95, 1.0, -0.2]} s={[0.12, 0.1, 0.12]} c="#e85a4a" />
  <Ell p={[1.15, 1.0, -0.15]} s={[0.1, 0.08, 0.1]} c="#d44a3a" />
  <Ell p={[1.25, 1.0, -0.3]} s={[0.11, 0.09, 0.11]} c="#e85a4a" />
  {/* veggies on island */}
  <Ell p={[-0.4, 0.98, -0.15]} s={[0.14, 0.12, 0.14]} c="#e8a030" />
  <Ell p={[-0.15, 0.98, -0.25]} s={[0.13, 0.11, 0.13]} c="#4a9a45" />
  <Ell p={[-0.55, 0.96, -0.4]} s={[0.08, 0.18, 0.08]} c="#e07040" />
  <Ell p={[-0.25, 0.98, -0.45]} s={[0.16, 0.12, 0.12]} c="#5a9a4a" />
  {/* bowl of tomatoes on side */}
  <mesh position={[3.4, 0.98, -2.4]} castShadow><cylinderGeometry args={[0.22, 0.18, 0.14, 12]} />{mat('#e8dcc4')}</mesh>
  <Ell p={[3.35, 1.08, -2.35]} s={[0.1, 0.09, 0.1]} c="#e85a4a" />
  <Ell p={[3.5, 1.08, -2.42]} s={[0.09, 0.08, 0.09]} c="#d44a3a" />
  <Ell p={[3.42, 1.1, -2.5]} s={[0.08, 0.07, 0.08]} c="#e85a4a" />
  {/* bottle */}
  <mesh position={[3.9, 1.15, -2.45]} castShadow><cylinderGeometry args={[0.06, 0.07, 0.4, 10]} />{mat('#2a5a3a')}</mesh>
  {/* plants */}
  <Plant p={[-4.4, 0.02, -1.8]} sc={1.15} />
  <Plant p={[4.0, 0.92, -2.55]} sc={0.9} />
  <Plant p={[-4.0, 0.02, 1.2]} sc={0.85} />
  {/* window with sky */}
  <mesh position={[-5.1, 2.4, -1.0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[1.4, 1.5, 0.06]} /><meshBasicMaterial color="#9ccbf2" /></mesh>
  <Box p={[-5.05, 2.4, -1.0]} s={[0.08, 1.6, 1.5]} c="#8b6a48" />
  {/* pendant lights */}
  {[0.2, 1.8].map(px => (
    <group key={px} position={[px, 3.35, -1.0]}>
      <Box p={[0, 0.35, 0]} s={[0.02, 0.7, 0.02]} c="#333" />
      <mesh position={[0, 0, 0]}><coneGeometry args={[0.22, 0.28, 16]} /><meshStandardMaterial color="#d98a4a" emissive="#ffb870" emissiveIntensity={0.55} /></mesh>
    </group>
  ))}
  {/* side shelf with jars */}
  <Box p={[-4.6, 2.6, -2.7]} s={[0.9, 0.08, 0.4]} c="#8b6a48" />
  <mesh position={[-4.75, 2.78, -2.65]}><cylinderGeometry args={[0.08, 0.08, 0.22, 10]} />{mat('#4a7a9a')}</mesh>
  <mesh position={[-4.5, 2.78, -2.7]}><cylinderGeometry args={[0.07, 0.07, 0.2, 10]} />{mat('#c45a4a')}</mesh>
  <Bench c="#b08a62" />
</>); }
/* ---------- SHOWER: glass stall, steam, tiled bathroom ---------- */
function ShowerSteam() {
  const on = useGame(g => g.showerOn);
  const g = useRef<THREE.Group>(null!);
  const mats = useRef<THREE.MeshBasicMaterial[]>([]);
  const puffs = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    x: (i % 6 - 2.5) * 0.18,
    z: ((i * 0.37) % 1 - 0.5) * 0.7,
    phase: i * 0.41,
    scale: 0.22 + (i % 5) * 0.05,
    speed: 0.14 + (i % 4) * 0.03,
  })), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const grp = g.current; if (!grp) return;
    const target = on ? 1 : 0;
    grp.visible = (grp.userData.a ?? 0) > 0.02 || on;
    grp.userData.a = THREE.MathUtils.damp(grp.userData.a ?? 0, target, 1.4, 1 / 60);
    const a = grp.userData.a as number;
    puffs.forEach((p, i) => {
      const m = grp.children[i] as THREE.Mesh;
      if (!m) return;
      const cycle = ((t * p.speed + p.phase) % 4.0) / 4.0;
      m.position.set(p.x + Math.sin(t * 0.4 + p.phase) * 0.12, 0.2 + cycle * 2.8, p.z + Math.cos(t * 0.3 + p.phase) * 0.06);
      m.scale.setScalar(p.scale * (0.6 + cycle * 1.6));
      const mat = mats.current[i];
      if (mat) mat.opacity = a * (1 - cycle) * (0.22 + 0.18 * Math.sin(t + p.phase));
    });
  });
  return (
    <group ref={g} userData={{ a: 0 }} position={[0, 0, 0]} visible={false}>
      {puffs.map((p, i) => (
        <mesh key={i} position={[p.x, 0.3, p.z]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshBasicMaterial ref={el => { if (el) mats.current[i] = el; }} color="#eef2f6" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
function ShowerWater() {
  const on = useGame(g => g.showerOn);
  const g = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    const grp = g.current; if (!grp) return;
    grp.visible = on;
    if (!on) return;
    const t = clock.elapsedTime;
    grp.children.forEach((ch, i) => {
      const m = ch as THREE.Mesh;
      const y = 2.2 - ((t * 2.8 + i * 0.17) % 2.0);
      m.position.y = y;
      const mat = m.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = 0.25 + 0.2 * Math.sin(t * 8 + i);
    });
  });
  return (
    <group ref={g} position={[0.15, 0, -0.15]} visible={false}>
      {Array.from({ length: 28 }, (_, i) => (
        <mesh key={i} position={[(i % 5 - 2) * 0.07, 1.5, (Math.floor(i / 5) - 2) * 0.06]}>
          <cylinderGeometry args={[0.006, 0.004, 0.35 + (i % 3) * 0.08, 4]} />
          <meshBasicMaterial color="#c8e4f5" transparent opacity={0.3} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
function ShowerClothes() {
  const naked = useGame(g => g.naked);
  if (!naked) return null;
  // piles of clothes on the floor outside / inside stall
  return (
    <group>
      {/* his trunks */}
      <mesh position={[-0.55, 0.04, 0.85]} rotation={[-0.2, 0.4, 0.3]} castShadow>
        <boxGeometry args={[0.28, 0.04, 0.2]} /><meshStandardMaterial color="#1a1a1e" roughness={0.9} />
      </mesh>
      {/* her bikini top */}
      <mesh position={[0.35, 0.035, 0.9]} rotation={[0.1, -0.5, 0.2]} castShadow>
        <boxGeometry args={[0.16, 0.03, 0.12]} /><meshStandardMaterial color="#ff6b9a" roughness={0.85} />
      </mesh>
      {/* her bikini bottom */}
      <mesh position={[0.5, 0.03, 0.75]} rotation={[-0.15, 0.8, 0]} castShadow>
        <boxGeometry args={[0.14, 0.025, 0.1]} /><meshStandardMaterial color="#ff6b9a" roughness={0.85} />
      </mesh>
      {/* casual bits if any */}
      <mesh position={[-0.2, 0.03, 1.0]} rotation={[0, 0.3, 0.1]}>
        <boxGeometry args={[0.35, 0.02, 0.22]} /><meshStandardMaterial color="#4a6b40" roughness={0.95} />
      </mesh>
    </group>
  );
}

/** Shaped discarded clothes on the pool rim edge (not flat rectangles) */
function PoolClothes() {
  const naked = useGame(g => g.naked);
  const world = useGame(g => g.world);
  if (!naked || world !== 'pool') return null;
  // right rim top ≈ y=0.18, x≈4.15
  return (
    <group>
      {/* his dark trunks – folded capsule shape */}
      <group position={[4.2, 0.2, -1.55]} rotation={[-0.15, 0.6, 0.25]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.07, 0.18, 4, 8]} />
          <meshStandardMaterial color="#1a1a22" roughness={0.85} />
        </mesh>
        <mesh position={[0.04, 0.02, 0.02]} rotation={[0.3, 0.2, 0.4]} castShadow>
          <capsuleGeometry args={[0.055, 0.12, 4, 8]} />
          <meshStandardMaterial color="#22222a" roughness={0.85} />
        </mesh>
      </group>
      {/* her pink bikini top – two cups + strap */}
      <group position={[4.25, 0.21, -0.7]} rotation={[0.1, -0.4, 0.15]}>
        <mesh position={[-0.055, 0, 0]} castShadow>
          <sphereGeometry args={[0.055, 10, 8]} />
          <meshStandardMaterial color="#ff6b9a" roughness={0.8} />
        </mesh>
        <mesh position={[0.055, 0, 0]} castShadow>
          <sphereGeometry args={[0.055, 10, 8]} />
          <meshStandardMaterial color="#ff6b9a" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.01, -0.01]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.14, 6]} />
          <meshStandardMaterial color="#ee5a88" roughness={0.75} />
        </mesh>
      </group>
      {/* her bikini bottom – soft folded shape */}
      <group position={[4.15, 0.195, -0.55]} rotation={[-0.2, 0.9, 0.1]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.06, 0.1, 4, 8]} />
          <meshStandardMaterial color="#ff6b9a" roughness={0.8} />
        </mesh>
        <mesh position={[0.02, 0.01, 0.03]} rotation={[0.4, 0.3, -0.2]} castShadow>
          <capsuleGeometry args={[0.045, 0.08, 4, 8]} />
          <meshStandardMaterial color="#ee5a88" roughness={0.8} />
        </mesh>
      </group>
      {/* his casual green shirt – crumpled */}
      <group position={[4.3, 0.19, -1.7]} rotation={[0.05, 0.35, 0.2]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.09, 0.22, 4, 8]} />
          <meshStandardMaterial color="#4a6b40" roughness={0.92} />
        </mesh>
        <mesh position={[0.05, 0.03, 0.04]} rotation={[-0.3, 0.5, 0.4]} castShadow>
          <capsuleGeometry args={[0.06, 0.14, 4, 8]} />
          <meshStandardMaterial color="#3d5c35" roughness={0.92} />
        </mesh>
      </group>
      {/* her pink top – soft pile */}
      <group position={[4.35, 0.185, -0.9]} rotation={[0.1, -0.25, -0.15]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.08, 0.16, 4, 8]} />
          <meshStandardMaterial color="#d98a96" roughness={0.9} />
        </mesh>
        <mesh position={[-0.04, 0.02, 0.03]} rotation={[0.35, 0.2, 0.5]} castShadow>
          <sphereGeometry args={[0.07, 8, 6]} />
          <meshStandardMaterial color="#c87a88" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}
function BodySteamCover() {
  const naked = useGame(g => g.naked);
  const g = useRef<THREE.Group>(null!);
  const mats = useRef<THREE.MeshBasicMaterial[]>([]);
  const puffs = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    x: (i % 6 - 2.5) * 0.16,
    z: ((i * 0.31) % 1 - 0.5) * 0.45,
    phase: i * 0.37,
    scale: 0.28 + (i % 4) * 0.06,
    y0: 0.35 + (i % 5) * 0.12,
  })), []);
  useFrame(({ clock }) => {
    const grp = g.current; if (!grp) return;
    const on = naked;
    grp.visible = on;
    if (!on) return;
    const t = clock.elapsedTime;
    puffs.forEach((p, i) => {
      const m = grp.children[i] as THREE.Mesh;
      if (!m) return;
      m.position.set(p.x + Math.sin(t * 0.5 + p.phase) * 0.06, p.y0 + Math.sin(t * 0.7 + p.phase) * 0.08, p.z);
      m.scale.setScalar(p.scale * (1 + 0.15 * Math.sin(t + p.phase)));
      const mat = mats.current[i];
      if (mat) mat.opacity = 0.45 + 0.2 * Math.sin(t * 1.2 + p.phase);
    });
  });
  // covers both characters mid-body (shoulders to knees area in stall)
  return (
    <group ref={g} position={[0.05, 0.55, -0.5]} visible={false}>
      {puffs.map((p, i) => (
        <mesh key={i} position={[p.x, p.y0, p.z]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshBasicMaterial ref={el => { if (el) mats.current[i] = el; }} color="#eef4f8" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
function ShowerSet() {
  const tile = '#b8c0c6', tile2 = '#a8b2ba', frame = '#3a3e44', glass = '#c5d2dc';
  return (<>
    <Box p={[0, -0.02, 0]} s={[12, 0.04, 10]} c="#d0d6dc" />
    <Box p={[0, 2, -2.9]} s={[12, 4.2, 0.12]} c={tile} />
    <Box p={[-4.5, 2, 0]} s={[0.12, 4.2, 7]} c={tile2} />
    <Box p={[4.5, 2, 0]} s={[0.12, 4.2, 7]} c={tile2} />
    {Array.from({ length: 10 }, (_, k) => (
      <Box key={k} p={[-4.0 + k * 0.9, 2.2, -2.84]} s={[0.7, 0.7, 0.02]} c={k % 2 ? '#c4ccd2' : '#aeb6bc'} />
    ))}
    {/* glass stall — centered so couple stand fully inside */}
    <group position={[0.05, 0, -0.55]}>
      <Box p={[0, 0.06, 0]} s={[2.4, 0.14, 2.0]} c="#9aa3aa" />
      {/* side / back glass */}
      <Box p={[-1.15, 1.55, 0]} s={[0.05, 2.9, 1.95]} c={glass} />
      <Box p={[1.15, 1.55, 0]} s={[0.05, 2.9, 1.95]} c={glass} />
      <Box p={[0, 1.55, -0.95]} s={[2.25, 2.9, 0.05]} c={glass} />
      {/* open front – thin frame only */}
      <Box p={[-1.15, 1.55, 0]} s={[0.04, 3.0, 0.07]} c={frame} />
      <Box p={[1.15, 1.55, 0]} s={[0.04, 3.0, 0.07]} c={frame} />
      <Box p={[0, 3.05, 0]} s={[2.35, 0.06, 2.0]} c={frame} />
      <Box p={[-1.1, 1.4, 0.7]} s={[0.07, 0.3, 0.04]} c="#2a2e32" />
      {/* shower head */}
      <Box p={[0.2, 2.85, -0.55]} s={[0.07, 0.07, 0.45]} c="#6a7078" />
      <mesh position={[0.2, 2.7, -0.3]} rotation={[0.5, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.07, 18]} />{mat('#5a6068')}
      </mesh>
      <mesh position={[0.95, 1.55, -0.8]}><cylinderGeometry args={[0.1, 0.1, 0.06, 16]} />{mat('#4a5058')}</mesh>
      <Box p={[0.9, 1.95, -0.85]} s={[0.32, 0.45, 0.1]} c="#8a929a" />
      <mesh position={[0.85, 1.9, -0.8]}><cylinderGeometry args={[0.04, 0.045, 0.2, 8]} />{mat('#2a2a2e')}</mesh>
      <mesh position={[0.98, 1.9, -0.8]}><cylinderGeometry args={[0.04, 0.045, 0.18, 8]} />{mat('#e8a0b8')}</mesh>
      <ShowerWater />
      <ShowerSteam />
    </group>
    {/* vanity */}
    <Box p={[-2.9, 0.55, -1.9]} s={[1.6, 0.12, 0.7]} c="#e8ecf0" />
    <Box p={[-2.9, 0.25, -1.9]} s={[1.5, 0.5, 0.65]} c="#4a5058" />
    <Box p={[-2.9, 0.62, -1.75]} s={[0.7, 0.08, 0.4]} c="#f0f4f8" />
    <mesh position={[-2.6, 0.85, -1.65]}><cylinderGeometry args={[0.03, 0.04, 0.25, 8]} />{mat('#8a9098')}</mesh>
    <Box p={[-2.9, 2.1, -2.25]} s={[0.9, 1.1, 0.04]} c="#2a2e32" />
    <Box p={[-2.9, 2.1, -2.22]} s={[0.75, 0.95, 0.02]} c="#a8c0d0" />
    <Box p={[3.3, 1.6, -1.6]} s={[0.06, 0.06, 0.7]} c="#4a5058" />
    <Box p={[3.3, 1.35, -1.6]} s={[0.12, 0.7, 0.35]} c="#6a7078" />
    <Plant p={[3.1, 0.02, 1.2]} sc={0.7} />
    <ShowerClothes />
    <BodySteamCover />
  </>);
}
const CFG: Record<string, { bg: string; hemi: [string, string, number]; sun: [string, number]; lamp: number; Set: () => JSX.Element }> = {
  bedroom: { bg: '#1a1410', hemi: ['#ffe9c8', '#5a4230', 1], sun: ['#ffe0a8', 1.9], lamp: 5, Set: BedroomSet },
  kitchen: { bg: '#2b211a', hemi: ['#fff1d8', '#6a5a48', 1], sun: ['#ffe8c0', 1.2], lamp: 3, Set: KitchenSet },
  garden: { bg: '#bfe3f5', hemi: ['#fff6e0', '#6a8f4a', 1.15], sun: ['#fff0c8', 2.2], lamp: 0, Set: GardenSet },
  beach: { bg: '#6fc4f6', hemi: ['#f2f8ff', '#d9c28a', 1.25], sun: ['#fff4d8', 2.3], lamp: 0, Set: BeachSet },
  pool: { bg: '#c8b8a0', hemi: ['#fff0e0', '#8a7a68', 1.05], sun: ['#ffe8c8', 0.6], lamp: 2.2, Set: PoolSet },
  shower: { bg: '#2a3038', hemi: ['#e8f0f6', '#6a7888', 1.1], sun: ['#d8e4f0', 1.3], lamp: 2, Set: ShowerSet },
};
const NIGHT_BG = new THREE.Color('#0d1226');
const _v = new THREE.Vector3();
const proj = (cam: THREE.Camera, size: { width: number; height: number }, x: number, y: number, z: number) => { _v.set(x, y, z).project(cam); return { x: (_v.x + 1) / 2 * size.width, y: (1 - _v.y) / 2 * size.height }; };
function Scene({ ctl }: { ctl: Ctl }) {
  const [, tick] = useState(0);
  useEffect(() => subscribe(() => tick(n => n + 1)), []);
  const g0 = get();
  const tod = g0.tod, world = g0.world, cfg = CFG[world] ?? CFG.bedroom;
  const lampOn = g0.lamp, pose = g0.pose;
  const moon = useRef<THREE.DirectionalLight>(null!), tbl = useRef<THREE.PointLight>(null!);
  const rg = useRef({ bw: 0, sw: 0, hw: 0 }), fog = useRef(new THREE.Fog('#6fc4f6', 28, 80)), hemi = useRef<THREE.HemisphereLight>(null!), lamp = useRef<THREE.PointLight>(null!), sun = useRef<THREE.DirectionalLight>(null!), st = useRef({ x: 1.9, lx: 0.6 }), bg = useRef(new THREE.Color());

  // hard-snap lighting colors when world changes (args only apply on first mount)
  useEffect(() => {
    if (hemi.current) {
      hemi.current.color.set(cfg.hemi[0]);
      hemi.current.groundColor.set(cfg.hemi[1]);
      hemi.current.intensity = cfg.hemi[2];
    }
    if (sun.current) {
      sun.current.color.set(cfg.sun[0]);
      sun.current.intensity = cfg.sun[1];
    }
    if (lamp.current) lamp.current.intensity = cfg.lamp;
    // reset damp state so outdoor zoom engages immediately
    rg.current.bw = world === 'beach' ? 1 : 0;
    rg.current.sw = world === 'pool' ? 1 : 0;
  }, [world, cfg]);

  useFrame(({ camera, clock, size, scene }, dt) => {
    // lights may be null for a frame after Canvas remount — never crash (black screen)
    if (!hemi.current || !lamp.current || !sun.current || !moon.current || !tbl.current) return;
    const T = clock.elapsedTime, L = THREE.MathUtils.lerp, D = THREE.MathUtils.damp;
    // always read live state (R3F can keep stale closures)
    const g = get();
    const worldNow = g.world;
    const todNow = g.tod;
    const poseNow = g.pose;
    const lampOnNow = g.lamp;
    const cfgNow = CFG[worldNow] ?? CFG.bedroom;
    const inBed = worldNow === 'bedroom';
    tk.v = D(tk.v, todNow === 'night' ? 1 : todNow === 'evening' ? 0.55 : 0, 1.4, dt);
    tk.l = D(tk.l, inBed && !lampOnNow ? 0 : 1, 3.2, dt);
    tk.b = D(tk.b, poseNow === 'bed' ? 1 : 0, 1.7, dt);
    const dim = 1 - (1 - tk.l) * (0.62 + 0.3 * tk.v);
    hemi.current.intensity = L(cfgNow.hemi[2], cfgNow.hemi[2] * 0.6, tk.v) * dim;
    lamp.current.intensity = L(cfgNow.lamp, cfgNow.lamp * 3.2, tk.v) * tk.l;
    sun.current.intensity = L(cfgNow.sun[1], 0, tk.v) * (1 - (1 - tk.l) * 0.7);
    moon.current.intensity = inBed ? 0.6 * tk.v * (1 - 0.5 * tk.l) : 0;
    tbl.current.intensity = inBed ? (3 + 15 * tk.v) * tk.l : 0;
    const onB = worldNow === 'beach', onP = worldNow === 'pool', onSh = worldNow === 'shower', onOut = onB || onP, pz = poseNow, R2 = rg.current;
    tkx.d = D(tkx.d, onB && (todNow === 'evening' || todNow === 'night') ? (todNow === 'night' ? 1 : 0.7) : 0, 0.7, dt);
    const liveAct = !!ctl.current.act && T - ctl.current.t0 < ACTS[ctl.current.act].dur;
    tkx.ba = D(tkx.ba, onOut && pz === 'rest' && !liveAct ? 1.05 : 0.55, 2.5, dt);
    if (onB) { bg.current.copy(SKY.day).lerp(SKY.dusk, tkx.d).lerp(NIGHT_BG, tk.v); scene.background = bg.current; fog.current.color.copy(bg.current); scene.fog = fog.current; sun.current.color.set('#fff4d8').lerp(new THREE.Color('#ff9a55'), tkx.d); sun.current.intensity *= 1 - 0.45 * tkx.d; hemi.current.intensity *= 1 - 0.25 * tkx.d; }
    else { scene.fog = null; scene.background = bg.current.set(cfgNow.bg).lerp(NIGHT_BG, tk.v); }
    const c = ctl.current; if (c.act && c.t0 < 0) c.t0 = T;
    const z = c.act && T - c.t0 < ACTS[c.act].dur ? c.zoom : 1, asp = size.width / size.height, cam = camera as THREE.PerspectiveCamera;
    // pool: frame the BACK edge where they sit (against the back wall, facing the camera)
    const zoomOut = onP ? 1.32 : 1;
    st.current.x = D(st.current.x, (z < 1 ? 0.9 : 1.9) + Math.sin(T * 0.2) * 0.08, 3, dt);
    st.current.lx = D(st.current.lx, (z < 1 ? -0.1 : 0.6) + (onP ? -0.6 : 0), 3, dt); const bb = tk.b;
    cam.fov = D(cam.fov, (asp >= 1.6 ? 36 : Math.min(60, 36 * 1.6 / asp)) * z * zoomOut * (1 - 0.42 * bb) * (1 - 0.3 * rg.current.sw), 3, dt); const sw = onB && (pz === 'wade' || pz === 'swim'); R2.bw = D(R2.bw, onB ? 1 : 0, 2.5, dt); R2.sw = D(R2.sw, sw ? 1 : 0, 2.2, dt);
    const camZ = onP ? 6.8 : 6.2;
    cam.position.set(L(L(st.current.x, -0.5, bb), 3.4, R2.sw), L(L(onP ? 2.6 : 2.6, 5.0, bb) - 0.3 * R2.bw, 2.5, R2.sw), L(camZ, 3.8, R2.sw));
    cam.lookAt(L(L(st.current.lx, -0.95, bb), 2.4, R2.sw), L(L(1.2, 1.15, bb) + 0.5 * R2.bw, 1.0, R2.sw), L(L(onP ? -2.9 : -0.6, -1.5, bb), -3.8, R2.sw)); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    // always follow real head positions (sit on shower bench, stand, wade…) except pure bed-lie uses fixed anchors
    const walkAbout = pz === 'stand' || pz === 'wade' || pz === 'swim' || pz === 'sit' || worldNow !== 'bedroom';
    R2.hw = D(R2.hw, poseNow === 'bed' ? 0 : 1, 6, dt);
    const headScreen = (k: 0 | 1) => proj(cam, size, HEADW[k].x, HEADW[k].y + 0.55, HEADW[k].z);
    const baseHim = proj(cam, size, L(-0.5, -2.1, bb), L(1.95, 2.05, bb), L(-0.7, -1.8, bb));
    const baseHer = proj(cam, size, L(0.25, -2.1, bb), L(1.95, 1.8, bb), L(-0.7, -1.3, bb));
    // HEADW is 0,0,0 before first character frame — never use that (puts bubble on legs)
    const headOk = (k: 0 | 1) => HEADW[k].y > 0.8 && Math.abs(HEADW[k].x) < 20;
    const h0 = headOk(0) ? headScreen(0) : baseHim;
    const h1 = headOk(1) ? headScreen(1) : baseHer;
    const useH = headOk(0) ? R2.hw : 0;
    anch.him = { x: L(baseHim.x, h0.x, useH), y: L(baseHim.y, h0.y, useH) };
    anch.her = { x: L(baseHer.x, h1.x, headOk(1) ? R2.hw : 0), y: L(baseHer.y, h1.y, headOk(1) ? R2.hw : 0) };
    anch.mid = { x: (anch.him.x + anch.her.x) / 2, y: Math.min(anch.him.y, anch.her.y) + 30 };
  });
  return (<>
    <ambientLight intensity={0.45} />
    <hemisphereLight ref={hemi} args={[cfg.hemi[0], cfg.hemi[1], 1]} />
    <pointLight ref={lamp} position={[-2.2, 2.6, -1.8]} intensity={cfg.lamp} distance={9} color="#ffbf70" castShadow shadow-mapSize={[512, 512]} />
    <directionalLight ref={sun} position={[4, 5, -1]} intensity={cfg.sun[1]} color={cfg.sun[0]} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} />
    <pointLight ref={tbl} position={[1.3, 1.05, -2.15]} intensity={0} distance={8} color="#ffbf70" />
    <directionalLight ref={moon} position={[3.2, 3.2, -1.5]} intensity={0} color="#8fa8ff" />
    <group key={`world-${world}`}>
      {world === 'bedroom' && <BedroomSet />}
      {world === 'kitchen' && <KitchenSet />}
      {world === 'garden' && <GardenSet />}
      {world === 'beach' && <BeachSet />}
      {world === 'pool' && <PoolSet />}
      {world === 'shower' && <ShowerSet />}
    </group>
    <PoolClothes />
    <Person i={0} ctl={ctl} x={-0.55} skin="#e3b48c" hair="#2a2220" top="#4a6b40" pants="#2e2e32" />
    <Person i={1} ctl={ctl} x={0.25} skin="#edc3a0" hair="#7a4a34" top="#d98a96" pants="#2e2e32" long clip />
  </>);
}

const hearts = () => { for (let i = 0; i < 8; i++) setTimeout(() => {
  const h = document.createElement('span'); h.className = 'heart'; h.textContent = '\u2665'; h.style.left = `${anch.mid.x + (Math.random() - 0.5) * 80}px`; h.style.top = `${anch.mid.y + Math.random() * 20}px`;
  h.style.fontSize = `${14 + Math.random() * 12}px`; h.style.setProperty('--d', `${1.6 + Math.random()}s`); h.style.setProperty('--dx', `${(Math.random() - 0.5) * 50}px`);
  document.body.appendChild(h); h.addEventListener('animationend', () => h.remove()); }, i * 120); };
export default function Bedroom() {
  const world = useGame(g => g.world);
  const ctl: Ctl = useRef({ act: null, t0: 0, zoom: 1 });
  useEffect(() => { registerActRunner(a => new Promise<void>(res => {
    const def = ACTS[a]; ctl.current = { act: a, t0: -1, zoom: def.zoom };
    // pool or ocean hug: her heavy breathing only while they're touching
    const waterHug = a === 'hug' && (get().world === 'pool' || get().world === 'beach');
    if (waterHug) startHeavyBreath(def.dur * 1000);
    def.ev.forEach(([at, e]) => setTimeout(() => { if (e === 'hearts') hearts(); else { sfx(e); if (e === 'kiss' || e === 'slap') navigator.vibrate?.(30); } }, at * 1000));
    setTimeout(() => {
      if (waterHug) stopHeavyBreath();
      ctl.current.act = null;
      res();
    }, def.dur * 1000 + 300);
  })); }, []);
  // keep ONE WebGL context — only swap world sets inside Scene (remounting Canvas goes black)
  const bg =
    world === 'beach' ? '#6fc4f6' :
    world === 'pool' ? '#7ec8f0' :
    world === 'shower' ? '#2a3038' :
    world === 'garden' ? '#bfe3f5' :
    world === 'kitchen' ? '#2b211a' : '#1a1410';
  // pause 3D when the tab/app is hidden — no quality loss while playing, less heat in background
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  return (
    <div className="bedroom" style={{ background: bg }}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        frameloop={visible ? 'always' : 'never'}
        gl={{ antialias: true, powerPreference: 'default', alpha: false }}
        camera={{ position: [0, 2, 5.6], fov: 50 }}
        onCreated={({ gl, scene }) => {
          gl.setClearColor(bg);
          scene.background = null; // Scene useFrame sets per-world color
        }}
      >
        <Scene ctl={ctl} />
      </Canvas>
    </div>
  );
}
