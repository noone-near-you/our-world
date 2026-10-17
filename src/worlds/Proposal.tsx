import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { get, useGame } from '../state/store';
import { fireworkSfx } from '../audio/proposalAudio';

/* ================= SECRET WORLD: the proposal =================
 * Night, outdoor wedding stage with a flower arch, fairy lights, a crowd of guests, mountains and stars.
 * Stage top is y = 0, the stage is centred at z = -1.2 (where both characters stand). Fireworks run while store.fireworks is true. */
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pickOf = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const GROUND = -0.55, SZ = -1.2;
const FLOWER_COLS = ['#ffffff', '#ffd6e4', '#ff9fbb', '#fff0c8', '#f6c8ff', '#ffb8a8'];

export function Mountains() {
  const mts = useMemo(() => ([[-70, -64, 26, 30], [-38, -74, 30, 38], [0, -84, 38, 46], [42, -72, 30, 36], [76, -64, 26, 28], [-112, -86, 34, 32], [112, -86, 34, 34]] as number[][]).map(([x, z, r, h]) => {
    const g = new THREE.ConeGeometry(r, h, 8, 4), p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let k = 0; k < p.count; k++) {
      const px = p.getX(k), py = p.getY(k), pz = p.getZ(k), edge = Math.abs(py + h / 2) > 0.5 * h ? 0 : 1;
      const j = 1 + (Math.sin(px * 1.7 + pz * 2.3 + x) * 0.5 + Math.sin(px * 0.6 - pz * 0.9)) * 0.1 * edge;
      p.setXYZ(k, px * j, py + Math.sin(px * 0.9 + pz * 1.3) * 0.04 * h * edge, pz * j);
    }
    for (let k = 0; k < p.count; k++) { const t = (p.getY(k) + h / 2) / h; c.set('#161f38').lerp(new THREE.Color('#2e3d66'), Math.min(1, t * 1.3)); if (t > 0.7) c.lerp(new THREE.Color('#c4d2f0'), (t - 0.7) / 0.3 * 0.85); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    return { g, x, z, h };
  }), []);
  return <>{mts.map((m, k) => <mesh key={k} geometry={m.g} position={[m.x, m.h / 2 + GROUND - 1, m.z]}><meshStandardMaterial vertexColors flatShading roughness={1} /></mesh>)}</>;
}

/** 1 = full night sky, 0 = no stars/moon (e.g. a sunrise wish) */
export const skyK = { v: 1 };
export function Sky() {
  const stars = useMemo(() => { const a = new Float32Array(900 * 3); for (let k = 0; k < 900; k++) { const th = Math.random() * Math.PI * 2, u = rnd(0.1, 1), r = 110, s = Math.sqrt(1 - u * u); a[k * 3] = Math.cos(th) * s * r; a[k * 3 + 1] = u * r; a[k * 3 + 2] = Math.sin(th) * s * r - 20; } return a; }, []);
  const lights = useMemo(() => { const a = new Float32Array(70 * 3); for (let k = 0; k < 70; k++) { a[k * 3] = rnd(-70, 70); a[k * 3 + 1] = rnd(-0.3, 2.2); a[k * 3 + 2] = rnd(-58, -44); } return a; }, []);
  const tw = useRef<THREE.PointsMaterial>(null!), vil = useRef<THREE.PointsMaterial>(null!), moon = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => { const k = skyK.v; if (tw.current) tw.current.opacity = (0.8 + 0.15 * Math.sin(clock.elapsedTime * 1.3)) * k; if (vil.current) vil.current.opacity = 0.9 * k; if (moon.current) moon.current.visible = k > 0.35; });
  return (<>
    <points frustumCulled={false}><bufferGeometry><bufferAttribute attach="attributes-position" count={900} array={stars} itemSize={3} /></bufferGeometry><pointsMaterial ref={tw} size={1.7} sizeAttenuation={false} color="#ffffff" transparent opacity={0.85} depthWrite={false} fog={false} /></points>
    <points frustumCulled={false}><bufferGeometry><bufferAttribute attach="attributes-position" count={70} array={lights} itemSize={3} /></bufferGeometry><pointsMaterial ref={vil} size={3} sizeAttenuation={false} color="#ffd890" transparent opacity={0.9} depthWrite={false} fog={false} /></points>
    <group ref={moon}>
      <mesh position={[-30, 34, -92]}><sphereGeometry args={[4.2, 24, 18]} /><meshBasicMaterial color="#f7f3e2" fog={false} /></mesh>
      <mesh position={[-30, 34, -92]}><sphereGeometry args={[9, 24, 18]} /><meshBasicMaterial color="#9fb2ff" transparent opacity={0.12} depthWrite={false} fog={false} blending={THREE.AdditiveBlending} /></mesh>
    </group>
  </>);
}

/** flower-covered arch behind the couple + fairy lights, lamp posts, carpet, petals */
function StageDecor() {
  const fl = useRef<THREE.InstancedMesh>(null!), lf = useRef<THREE.InstancedMesh>(null!), bulbs = useRef<THREE.InstancedMesh>(null!), pet = useRef<THREE.InstancedMesh>(null!);
  const flowers = useMemo(() => Array.from({ length: 190 }, () => {
    const onArc = Math.random() < 0.6;
    if (onArc) { const a = Math.random() * Math.PI, r = 1.5 + rnd(-0.1, 0.12); return { p: [Math.cos(a) * r, 3.2 + Math.sin(a) * r, -2.7 + rnd(-0.12, 0.12)] as [number, number, number], s: rnd(0.07, 0.15), c: pickOf(FLOWER_COLS) }; }
    const sd = Math.random() < 0.5 ? -1 : 1; return { p: [sd * (1.5 + rnd(-0.1, 0.12)), rnd(0.1, 3.2), -2.7 + rnd(-0.12, 0.12)] as [number, number, number], s: rnd(0.07, 0.15), c: pickOf(FLOWER_COLS) };
  }), []);
  const leaves = useMemo(() => Array.from({ length: 130 }, () => { const a = Math.random() * Math.PI, sd = Math.random() < 0.5 ? -1 : 1, onArc = Math.random() < 0.55, r = 1.5; return { p: (onArc ? [Math.cos(a) * r, 3.2 + Math.sin(a) * r, -2.72] : [sd * 1.5, rnd(0.1, 3.2), -2.72]) as [number, number, number], s: rnd(0.08, 0.16) }; }), []);
  const bulbPts = useMemo(() => {
    const out: [number, number, number][] = [], seg = (a: number[], b: number[], n: number, sag: number) => { for (let k = 0; k <= n; k++) { const u = k / n; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - Math.sin(u * Math.PI) * sag, a[2] + (b[2] - a[2]) * u]); } };
    seg([-4.2, 3.3, -0.2], [4.2, 3.3, -0.2], 22, 0.5); seg([-4.2, 3.3, -2.8], [4.2, 3.3, -2.8], 22, 0.5); seg([-4.2, 3.3, -0.2], [-4.2, 3.3, -2.8], 10, 0.3); seg([4.2, 3.3, -0.2], [4.2, 3.3, -2.8], 10, 0.3);
    for (let k = 0; k < 26; k++) { const a = (k / 25) * Math.PI; out.push([Math.cos(a) * 1.38, 3.2 + Math.sin(a) * 1.38, -2.5]); }
    return out;
  }, []);
  const petals = useMemo(() => Array.from({ length: 110 }, () => {
    const onStage = Math.random() < 0.4;
    return onStage ? { p: [rnd(-0.75, 0.75), 0.012, rnd(-2.2, 0.8)] as [number, number, number] } : { p: [rnd(-0.8, 0.8), GROUND + 0.012, rnd(1.7, 9)] as [number, number, number] };
  }), []);
  useEffect(() => {
    const d = new THREE.Object3D(), c = new THREE.Color();
    flowers.forEach((f, k) => { d.position.set(...f.p); d.scale.setScalar(f.s); d.rotation.set(0, 0, 0); d.updateMatrix(); fl.current.setMatrixAt(k, d.matrix); fl.current.setColorAt(k, c.set(f.c)); });
    leaves.forEach((f, k) => { d.position.set(...f.p); d.scale.set(f.s * 1.4, f.s * 0.7, f.s); d.rotation.set(0, 0, Math.random() * 3); d.updateMatrix(); lf.current.setMatrixAt(k, d.matrix); });
    bulbPts.forEach((p, k) => { d.position.set(...p); d.scale.setScalar(0.045); d.rotation.set(0, 0, 0); d.updateMatrix(); bulbs.current.setMatrixAt(k, d.matrix); });
    petals.forEach((f, k) => { d.position.set(...f.p); d.scale.setScalar(0.05); d.rotation.set(-Math.PI / 2, 0, Math.random() * 6); d.updateMatrix(); pet.current.setMatrixAt(k, d.matrix); pet.current.setColorAt(k, c.set(Math.random() < 0.7 ? '#ff9fbb' : '#ffffff')); });
    [fl, lf, bulbs, pet].forEach(r => { r.current.instanceMatrix.needsUpdate = true; if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true; });
  }, [flowers, leaves, bulbPts, petals]);
  const lamps = useRef<THREE.PointLight[]>([]);
  useFrame(({ clock }) => { const T = clock.elapsedTime; lamps.current.forEach((l, k) => { if (l) l.intensity = 7 + Math.sin(T * 6 + k * 2) * 0.8 + Math.sin(T * 11 + k) * 0.5; }); });
  return (<>
    {/* ground, stage, steps */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND, -14]} receiveShadow><planeGeometry args={[170, 130]} /><meshStandardMaterial color="#15241a" roughness={1} /></mesh>
    <mesh position={[0, -0.275, SZ]} receiveShadow castShadow><boxGeometry args={[8, 0.55, 4.2]} /><meshStandardMaterial color="#5b3d29" roughness={0.8} /></mesh>
    <mesh position={[0, -0.01, SZ]} receiveShadow><boxGeometry args={[8.1, 0.025, 4.3]} /><meshStandardMaterial color="#7a5538" roughness={0.7} /></mesh>
    <mesh position={[0, -0.41, 1.25]} receiveShadow><boxGeometry args={[2.2, 0.27, 0.7]} /><meshStandardMaterial color="#6a4830" roughness={0.8} /></mesh>
    <mesh position={[0, 0.0, 1.0 - 0.0]}><boxGeometry args={[8, 0.025, 0.03]} /><meshBasicMaterial color="#ffd9a0" /></mesh>
    {/* red carpet: stage, step, then down the aisle toward the camera */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, -0.7]} receiveShadow><planeGeometry args={[1.5, 3.4]} /><meshStandardMaterial color="#8a1a2a" roughness={0.95} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.272, 1.25]}><planeGeometry args={[1.5, 0.72]} /><meshStandardMaterial color="#8a1a2a" roughness={0.95} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND + 0.005, 5.6]} receiveShadow><planeGeometry args={[1.5, 8]} /><meshStandardMaterial color="#8a1a2a" roughness={0.95} /></mesh>
    {/* flower arch */}
    {[-1.5, 1.5].map(x => <mesh key={x} position={[x, 1.6, -2.7]} castShadow><cylinderGeometry args={[0.07, 0.08, 3.2, 10]} /><meshStandardMaterial color="#f4efe6" roughness={0.5} /></mesh>)}
    <mesh position={[0, 3.2, -2.7]} castShadow><torusGeometry args={[1.5, 0.06, 8, 40, Math.PI]} /><meshStandardMaterial color="#f4efe6" roughness={0.5} /></mesh>
    <instancedMesh ref={lf} args={[undefined, undefined, 130]} frustumCulled={false}><sphereGeometry args={[1, 6, 5]} /><meshStandardMaterial color="#3f8f45" roughness={0.9} /></instancedMesh>
    <instancedMesh ref={fl} args={[undefined, undefined, 190]} frustumCulled={false}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial roughness={0.7} emissive="#ffffff" emissiveIntensity={0.12} /></instancedMesh>
    <instancedMesh ref={pet} args={[undefined, undefined, 110]} frustumCulled={false}><circleGeometry args={[1, 7]} /><meshStandardMaterial roughness={0.9} side={THREE.DoubleSide} /></instancedMesh>
    {/* lamp posts + fairy lights */}
    {([[-4.2, -0.2], [4.2, -0.2], [-4.2, -2.8], [4.2, -2.8]] as [number, number][]).map(([x, z], k) => <group key={k} position={[x, 0, z]}>
      <mesh position={[0, 1.65, 0]} castShadow><cylinderGeometry args={[0.05, 0.06, 3.3, 8]} /><meshStandardMaterial color="#2a2018" roughness={0.8} /></mesh>
      <mesh position={[0, 3.35, 0]}><sphereGeometry args={[0.12, 10, 8]} /><meshBasicMaterial color="#ffe0a0" /></mesh>
      <pointLight ref={l => { if (l) lamps.current[k] = l; }} position={[0, 3.2, 0.2]} intensity={7} distance={9} decay={2} color="#ffc878" />
    </group>)}
    <instancedMesh ref={bulbs} args={[undefined, undefined, 80]} frustumCulled={false}><sphereGeometry args={[1, 6, 5]} /><meshBasicMaterial color="#ffe6a8" /></instancedMesh>
    {/* lanterns along the stage front and the aisle */}
    {Array.from({ length: 14 }, (_, k) => { const sd = k % 2 ? 1 : -1, row = Math.floor(k / 2); return <mesh key={k} position={[sd * 1.05, row < 2 ? 0.1 : GROUND + 0.12, row < 2 ? 0.8 - row * 0.0 + row * 0.5 - 0.5 : 2.2 + (row - 2) * 1.3]}><cylinderGeometry args={[0.07, 0.07, 0.2, 8]} /><meshBasicMaterial color="#ffd48a" /></mesh>; })}
  </>);
}

/** ~110 guests: standing in rows on both sides, behind the stage and along the aisle; they sway, and clap + jump when the story cheers */
function Crowd() {
  const people = useMemo(() => {
    const out: { x: number; z: number; ry: number; h: number; ph: number; skin: string; hair: string; cloth: string; sp: number }[] = [];
    const SKINS = ['#f3cfae', '#e3b48c', '#c88a5c', '#8a5a3a', '#edc3a0', '#a86b48'], HAIRS = ['#1c1512', '#2a2220', '#4a3020', '#7a4a34', '#caa86a', '#8a8a8a'];
    const CLOTH = ['#1c2030', '#2a2a38', '#3a2a3a', '#d8b8c8', '#9ab0d8', '#c8a8e0', '#e8d0b0', '#6a8a7a', '#b86a7a', '#4a5a8a', '#e8e0d0', '#8a3a4a'];
    const add = (x: number, z: number) => { const tx = 0, tz = SZ; out.push({ x, z, ry: Math.atan2(tx - x, tz - z), h: rnd(0.92, 1.1), ph: Math.random() * 6.3, skin: pickOf(SKINS), hair: pickOf(HAIRS), cloth: pickOf(CLOTH), sp: rnd(0.8, 1.2) }); };
    for (const sd of [-1, 1]) for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) add(sd * (4.8 + r * 0.95 + rnd(-0.2, 0.2)), -3.2 + c * 1.15 + rnd(-0.25, 0.25));
    for (let r = 0; r < 2; r++) for (let c = 0; c < 12; c++) add(-6.6 + c * 1.2 + rnd(-0.25, 0.25), -5.2 - r * 1.2 + rnd(-0.2, 0.2));
    for (const sd of [-1, 1]) for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) add(sd * (1.6 + c * 1.0 + rnd(-0.2, 0.2)), 2.8 + r * 1.3 + rnd(-0.2, 0.2));
    return out;
  }, []);
  const N = people.length;
  const body = useRef<THREE.InstancedMesh>(null!), head = useRef<THREE.InstancedMesh>(null!), hair = useRef<THREE.InstancedMesh>(null!), armL = useRef<THREE.InstancedMesh>(null!), armR = useRef<THREE.InstancedMesh>(null!);
  const geo = useMemo(() => ({
    body: new THREE.CapsuleGeometry(0.19, 0.6, 4, 10).translate(0, 0.62, 0),
    head: new THREE.SphereGeometry(0.14, 12, 10).translate(0, 1.36, 0),
    hair: new THREE.SphereGeometry(0.155, 12, 8, 0, Math.PI * 2, 0, 1.95).translate(0, 1.39, -0.012),
    arm: new THREE.CapsuleGeometry(0.05, 0.3, 3, 6).translate(0, -0.2, 0),
  }), []);
  const tmp = useMemo(() => ({ dp: new THREE.Object3D(), da: new THREE.Object3D(), m: new THREE.Matrix4(), c: new THREE.Color() }), []);
  useEffect(() => {
    people.forEach((p, k) => {
      body.current.setColorAt(k, tmp.c.set(p.cloth)); armL.current.setColorAt(k, tmp.c.set(p.cloth)); armR.current.setColorAt(k, tmp.c.set(p.cloth));
      head.current.setColorAt(k, tmp.c.set(p.skin)); hair.current.setColorAt(k, tmp.c.set(p.hair));
    });
    [body, head, hair, armL, armR].forEach(r => { if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true; });
  }, [people, tmp]);
  useFrame(({ clock }) => {
    if (!body.current) return;
    const T = clock.elapsedTime, ch = Math.max(0, 1 - (Date.now() - get().cheer) / 6500), k2 = ch * ch * (3 - 2 * ch);
    const { dp, da, m } = tmp;
    for (let k = 0; k < N; k++) {
      const p = people[k], jump = k2 * 0.11 * Math.abs(Math.sin(T * 7 * p.sp + p.ph)), sway = 0.01 * Math.sin(T * 1.4 + p.ph);
      dp.position.set(p.x, GROUND + jump + sway, p.z); dp.rotation.set(0, p.ry + 0.05 * Math.sin(T * 0.6 + p.ph), 0); dp.scale.set(1, p.h, 1); dp.updateMatrix();
      body.current.setMatrixAt(k, dp.matrix); head.current.setMatrixAt(k, dp.matrix); hair.current.setMatrixAt(k, dp.matrix);
      const clap = Math.sin(T * 13 * p.sp + p.ph);
      for (const [mesh, sd] of [[armL, 1], [armR, -1]] as [MutableRefObject<THREE.InstancedMesh>, number][]) {
        da.position.set(sd * 0.21, 1.03, 0);
        da.rotation.set(-1.25 * k2 + 0.05 * Math.sin(T * 1.2 + p.ph), 0, sd * (0.08 + k2 * (0.1 - 0.28 * (0.5 + 0.5 * clap))));
        da.scale.set(1, 1, 1); da.updateMatrix(); m.multiplyMatrices(dp.matrix, da.matrix); mesh.current.setMatrixAt(k, m);
      }
    }
    [body, head, hair, armL, armR].forEach(r => { r.current.instanceMatrix.needsUpdate = true; });
  });
  const mat = <meshStandardMaterial roughness={0.8} />;
  return (<>
    <instancedMesh ref={body} args={[geo.body, undefined, N]} frustumCulled={false} castShadow>{mat}</instancedMesh>
    <instancedMesh ref={head} args={[geo.head, undefined, N]} frustumCulled={false}>{mat}</instancedMesh>
    <instancedMesh ref={hair} args={[geo.hair, undefined, N]} frustumCulled={false}>{mat}</instancedMesh>
    <instancedMesh ref={armL} args={[geo.arm, undefined, N]} frustumCulled={false}>{mat}</instancedMesh>
    <instancedMesh ref={armR} args={[geo.arm, undefined, N]} frustumCulled={false}>{mat}</instancedMesh>
  </>);
}

/* ---------- fireworks ---------- */
const MAXP = 2600;
const PALS = [['#ffd36b', '#fff2c0'], ['#ff7fb5', '#ffd0e4'], ['#ffffff', '#cfe8ff'], ['#7fc8ff', '#d8f0ff'], ['#b48cff', '#ecdcff'], ['#ff6a6a', '#ffd0c0'], ['#7dffb0', '#e0ffe8']];
export function Fireworks({ activeRef, spread = 13, zr = [-27, -19], hr = [8.5, 13] }: { activeRef?: MutableRefObject<boolean>; spread?: number; zr?: [number, number]; hr?: [number, number] }) {
  const stOn = useGame(g => g.fireworks);
  const stRef = useRef(stOn); stRef.current = stOn;
  const pts = useRef<THREE.Points>(null!);
  const S = useMemo(() => ({ pos: new Float32Array(MAXP * 3).fill(-999), col: new Float32Array(MAXP * 3), vel: new Float32Array(MAXP * 3), life: new Float32Array(MAXP), max: new Float32Array(MAXP), base: new Float32Array(MAXP * 3), drag: new Float32Array(MAXP), grav: new Float32Array(MAXP), ph: new Float32Array(MAXP), next: 0, tNext: 0, rockets: [] as { x: number; y: number; z: number; vy: number; ty: number; vx: number }[] }), []);
  const tex = useMemo(() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d')!, g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); }, []);
  const col = useMemo(() => new THREE.Color(), []);
  const spawn = (x: number, y: number, z: number, vx: number, vy: number, vz: number, c: THREE.Color, life: number, drag: number, grav: number) => {
    const k = S.next++ % MAXP;
    S.pos[k * 3] = x; S.pos[k * 3 + 1] = y; S.pos[k * 3 + 2] = z; S.vel[k * 3] = vx; S.vel[k * 3 + 1] = vy; S.vel[k * 3 + 2] = vz;
    S.base[k * 3] = c.r; S.base[k * 3 + 1] = c.g; S.base[k * 3 + 2] = c.b; S.life[k] = life; S.max[k] = life; S.drag[k] = drag; S.grav[k] = grav; S.ph[k] = Math.random() * 6.3;
  };
  const explode = (x: number, y: number, z: number) => {
    const [c1, c2] = pickOf(PALS), r = Math.random(), a = new THREE.Color(c1), b = new THREE.Color(c2);
    fireworkSfx(0.12 + Math.random() * 0.2, 0.55 + Math.random() * 0.4);
    if (r < 0.22) { // heart
      const n = 120; for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2, hx = 16 * Math.pow(Math.sin(t), 3), hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); spawn(x, y, z, hx * 0.45, hy * 0.45 + 0.5, rnd(-0.3, 0.3), new THREE.Color('#ff7fb5').lerp(b, Math.random() * 0.3), rnd(2.2, 2.7), 1.6, 0.5); }
    } else if (r < 0.38) { // ring
      const n = 90, tilt = rnd(-0.6, 0.6); for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; spawn(x, y, z, Math.cos(t) * 7, Math.sin(t) * 7 * Math.cos(tilt), Math.sin(t) * 7 * Math.sin(tilt), a, rnd(2, 2.5), 1.5, 1); }
    } else if (r < 0.63) { // willow (long golden fall)
      const n = 110; for (let i = 0; i < n; i++) { const v = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(3, 6.5)); spawn(x, y, z, v.x, v.y, v.z, new THREE.Color('#ffd36b').lerp(new THREE.Color('#fff2c0'), Math.random() * 0.5), rnd(3.4, 4.6), 0.95, 2.4); }
    } else { // peony: coloured sphere with a lighter core
      const n = 150; for (let i = 0; i < n; i++) { const v = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(i < 40 ? rnd(2, 4) : rnd(6, 9)); spawn(x, y, z, v.x, v.y, v.z, i < 40 ? b : a, rnd(1.8, 2.7), 1.5, 1.5); }
    }
  };
  useEffect(() => {
    const g = pts.current.geometry; g.setAttribute('position', new THREE.BufferAttribute(S.pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(S.col, 3).setUsage(THREE.DynamicDrawUsage));
  }, [S]);
  useFrame(({ clock }, dt) => {
    if (!pts.current) return;
    dt = Math.min(dt, 0.05); const T = clock.elapsedTime;
    const on = activeRef ? activeRef.current : stRef.current;
    if (on && T > S.tNext) {   // launch 1–2 rockets
      const n = Math.random() < 0.35 ? 2 : 1;
      for (let i = 0; i < n; i++) S.rockets.push({ x: rnd(-spread, spread), y: GROUND, z: rnd(zr[0], zr[1]), vy: rnd(15, 19), ty: rnd(hr[0], hr[1]), vx: rnd(-0.8, 0.8) });
      S.tNext = T + rnd(0.5, 1.2);
    }
    for (let k = S.rockets.length - 1; k >= 0; k--) {
      const r = S.rockets[k]; r.y += r.vy * dt; r.x += r.vx * dt;
      spawn(r.x, r.y, r.z, rnd(-0.3, 0.3), rnd(-0.6, 0.1), rnd(-0.3, 0.3), col.set('#ffcf80'), 0.5, 1.2, 1);
      if (r.y >= r.ty) { explode(r.x, r.y, r.z); S.rockets.splice(k, 1); }
    }
    for (let k = 0; k < MAXP; k++) {
      if (S.life[k] > 0) {
        S.life[k] -= dt; const dr = Math.exp(-S.drag[k] * dt);
        S.vel[k * 3] *= dr; S.vel[k * 3 + 1] = S.vel[k * 3 + 1] * dr - S.grav[k] * dt; S.vel[k * 3 + 2] *= dr;
        S.pos[k * 3] += S.vel[k * 3] * dt; S.pos[k * 3 + 1] += S.vel[k * 3 + 1] * dt; S.pos[k * 3 + 2] += S.vel[k * 3 + 2] * dt;
        const u = Math.max(0, S.life[k] / S.max[k]), f = Math.pow(u, 0.9) * (0.75 + 0.25 * Math.sin(T * 38 + S.ph[k]));
        S.col[k * 3] = S.base[k * 3] * f; S.col[k * 3 + 1] = S.base[k * 3 + 1] * f; S.col[k * 3 + 2] = S.base[k * 3 + 2] * f;
      } else { S.pos[k * 3 + 1] = -999; S.col[k * 3] = S.col[k * 3 + 1] = S.col[k * 3 + 2] = 0; }
    }
    const g = pts.current.geometry; (g.attributes.position as THREE.BufferAttribute).needsUpdate = true; (g.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  });
  return <points ref={pts} frustumCulled={false}><bufferGeometry /><pointsMaterial size={5} sizeAttenuation={false} vertexColors map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} /></points>;
}

export function ProposalSet() {
  return (<>
    <Sky /><Mountains /><StageDecor /><Crowd /><Fireworks />
    <spotLight position={[0, 7, 3.5]} angle={0.5} penumbra={0.75} intensity={90} distance={20} decay={2} color="#ffe6c0" castShadow shadow-mapSize={[1024, 1024]} />
    <directionalLight position={[-12, 22, -18]} intensity={0.9} color="#9fb2ff" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} />
  </>);
}
