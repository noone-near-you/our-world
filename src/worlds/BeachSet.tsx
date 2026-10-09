import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BODY, FX, tkx } from './anchors';
import { setOceanProximity } from '../audio/ambient';

/* ---------- THE BEACH: low-poly look (flat-shaded facets) after the reference: palms + green hill on the left, turquoise sea on a diagonal shore, rock island, white clouds ---------- */
const hash = (a: number, b: number) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
/** make a geometry flat-shaded with a slightly different colour on every facet */
function facets(g: THREE.BufferGeometry, color: (x: number, y: number, z: number) => THREE.Color, jitter = 0.05) {
  const n = g.index ? g.toNonIndexed() : g, p = n.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let f = 0; f < p.count; f += 3) {
    const cx = (p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3, cy = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3, cz = (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3;
    c.copy(color(cx, cy, cz)); const j = 1 + (hash(cx * 3.1 + f, cz * 1.7) - 0.5) * 2 * jitter; c.multiplyScalar(j);
    for (let k = 0; k < 3; k++) { col[(f + k) * 3] = c.r; col[(f + k) * 3 + 1] = c.g; col[(f + k) * 3 + 2] = c.b; } }
  n.setAttribute('color', new THREE.BufferAttribute(col, 3)); return n;
}
const flat = (extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => <meshStandardMaterial vertexColors flatShading roughness={0.9} {...extra} />;
const col = (h: string) => new THREE.Color(h);

/** a faceted lump (rock / bush / hill): icosahedron with jittered vertices */
function lump(detail: number, seed: number, c: string, amp = 0.18) {
  const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position;
  for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k), z = p.getZ(k), j = 1 + (hash(x * 9 + seed, z * 7 + y) - 0.5) * amp; p.setXYZ(k, x * j, y * j, z * j); }
  g.computeVertexNormals(); return facets(g, () => col(c), 0.07);
}
const Lump = ({ p, s, c, d = 1, seed = 1, amp }: { p: [number, number, number]; s: [number, number, number]; c: string; d?: number; seed?: number; amp?: number }) => {
  const g = useMemo(() => lump(d, seed, c, amp), [d, seed, c, amp]);
  return <mesh position={p} scale={s} geometry={g} castShadow receiveShadow>{flat()}</mesh>;
};

function Palm({ p, h = 5, lean = 0.15, s = 1, rot = 0 }: { p: [number, number, number]; h?: number; lean?: number; s?: number; rot?: number }) {
  const segs = 7, trunk = useMemo(() => {
    const out: { y: number; x: number; r: number; l: number; a: number }[] = []; let x = 0, y = 0;
    for (let k = 0; k < segs; k++) { const l = h / segs, a = lean * (0.4 + k / segs * 0.9); out.push({ x: x + Math.sin(a) * l / 2, y: y + Math.cos(a) * l / 2, r: 0.2 - k * 0.018, l, a }); x += Math.sin(a) * l; y += Math.cos(a) * l; }
    return { segs: out, topX: x, topY: y };
  }, [h, lean]);
  const frond = useMemo(() => { const g = new THREE.ConeGeometry(0.42, 2.5, 4); g.rotateZ(-Math.PI / 2); g.translate(1.25, 0, 0); g.scale(1, 1, 0.22); return facets(g, (x) => col(x > 1.2 ? '#5fb046' : '#3f8f35'), 0.1); }, []);
  return (<group position={p} scale={s} rotation={[0, rot, 0]}>
    {trunk.segs.map((q, k) => <mesh key={k} position={[q.x, q.y, 0]} rotation={[0, 0, -q.a]} castShadow><cylinderGeometry args={[q.r - 0.018, q.r, q.l + 0.02, 7]} /><meshStandardMaterial color={k % 2 ? '#8a5a37' : '#7a4c2d'} flatShading roughness={0.9} /></mesh>)}
    <group position={[trunk.topX, trunk.topY, 0]}>
      {Array.from({ length: 9 }, (_, k) => <mesh key={k} geometry={frond} rotation={[0, (k / 9) * Math.PI * 2 + 0.3, -0.35 - (k % 3) * 0.22]} scale={[1 - (k % 2) * 0.12, 1, 1]} castShadow>{flat()}</mesh>)}
      <mesh position={[0, -0.05, 0]} castShadow><icosahedronGeometry args={[0.2, 0]} /><meshStandardMaterial color="#6b4428" flatShading /></mesh></group>
  </group>);
}

function Cloud({ p, s = 1, v = 0.15 }: { p: [number, number, number]; s?: number; v?: number }) {
  const g = useRef<THREE.Group>(null!), x0 = p[0];
  useFrame(({ clock }) => { g.current.position.x = ((x0 + clock.elapsedTime * v + 40) % 80) - 40; });
  return (<group ref={g} position={p} scale={s}>
    {([[0, 0, 0, 1.5, 0.9], [1.5, -0.1, 0.2, 1.1, 0.75], [-1.4, -0.15, 0, 1.0, 0.7], [0.4, 0.5, -0.1, 1.0, 0.7]] as number[][]).map(([x, y, z, rx, ry], k) =>
      <mesh key={k} position={[x, y, z]} scale={[rx, ry, 0.8]}><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#ffffff" flatShading emissive="#ffffff" emissiveIntensity={0.35} /></mesh>)}</group>);
}

/** a white-and-cushion sun lounger like the reference: wood frame, white mattress, a back that tilts up/down */
export function Lounger({ x, z = -0.95 }: { x: number; z?: number }) {
  const back = useRef<THREE.Group>(null!), wood = '#a67844', cush = '#f7f3ea';
  useFrame(() => { back.current.rotation.x = -tkx.ba; });
  return (<group position={[x, 0, z]}>
    <RoundedBox args={[0.74, 0.07, 1.62]} radius={0.03} position={[0, 0.5, 0.62]} castShadow><meshStandardMaterial color={wood} roughness={0.7} /></RoundedBox>
    <RoundedBox args={[0.68, 0.09, 1.58]} radius={0.04} smoothness={3} position={[0, 0.58, 0.64]} castShadow receiveShadow><meshStandardMaterial color={cush} roughness={0.95} /></RoundedBox>
    {[[-0.34, -0.14], [0.34, -0.14], [-0.34, 1.3], [0.34, 1.3]].map(([lx, lz], k) => <mesh key={k} position={[lx, 0.25, lz]} castShadow><boxGeometry args={[0.06, 0.5, 0.06]} /><meshStandardMaterial color={wood} roughness={0.7} /></mesh>)}
    {[-0.38, 0.38].map(sx => <RoundedBox key={sx} args={[0.05, 0.05, 0.9]} radius={0.02} position={[sx, 0.72, 0.1]} castShadow><meshStandardMaterial color="#5a3d22" roughness={0.6} /></RoundedBox>)}
    <group ref={back} position={[0, 0.58, -0.17]}>
      <RoundedBox args={[0.74, 1.05, 0.06]} radius={0.025} position={[0, 0.52, -0.1]} castShadow><meshStandardMaterial color={wood} roughness={0.7} /></RoundedBox>
      <RoundedBox args={[0.68, 1.0, 0.1]} radius={0.045} smoothness={3} position={[0, 0.52, -0.04]} castShadow receiveShadow><meshStandardMaterial color={cush} roughness={0.95} /></RoundedBox></group>
    <mesh position={[0.36, 0.1, -0.22]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.1, 0.1, 0.05, 14]} /><meshStandardMaterial color="#e8c24a" roughness={0.5} /></mesh>
  </group>);
}

const SHORE = { x: 0, z: -3.5, a: -0.4636 };   // the shoreline passes through (0,-3.5) and runs diagonally: far on the left, near on the right
const skyDay = new THREE.Color('#6fc4f6'), skyDusk = new THREE.Color('#f8b982');
export function BeachSet() {
  const sand = useMemo(() => { const g = new THREE.PlaneGeometry(46, 28, 20, 14); g.rotateX(-Math.PI / 2); g.translate(0, 0, 2); const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) p.setY(k, (hash(p.getX(k) * 1.3, p.getZ(k) * 0.7) - 0.5) * 0.045);
    return facets(g, (x, _y, z) => { const wet = Math.max(0, 1 - Math.abs(z + 6.5 + 0.5 * (x + 6) - 0.2) / 1.6); return col('#ecd6a0').lerp(col('#cdb27c'), wet * 0.5); }, 0.045); }, []);
  const sea = useMemo(() => { const g = new THREE.PlaneGeometry(80, 42, 24, 14); g.rotateX(-Math.PI / 2); g.translate(0, 0, -21);
    const base = Float32Array.from(g.attributes.position.array as Float32Array);
    const ng = facets(g, (_x, _y, z) => { const u = Math.min(1, -z / 22); return col('#6fe3d6').lerp(col('#2fb6d8'), Math.min(1, -z / 5)).lerp(col('#1c78c4'), u); }, 0.05); return { g: ng, base: Float32Array.from(ng.attributes.position.array as Float32Array) }; }, []);
  const foam = useMemo(() => { const g = new THREE.PlaneGeometry(80, 0.55, 80, 2); g.rotateX(-Math.PI / 2); const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) p.setZ(k, p.getZ(k) + Math.sin(p.getX(k) * 0.7) * 0.14 + (hash(p.getX(k), p.getZ(k)) - 0.5) * 0.12); g.computeVertexNormals(); return g; }, []);
  const seaMat = useRef<THREE.MeshStandardMaterial>(null!), fo = [useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!)];
  useFrame(({ clock }) => {
    if (!seaMat.current || !fo[0].current || !fo[1].current) return;
    const T = clock.elapsedTime, p = sea.g.attributes.position as THREE.BufferAttribute, base = sea.base;
    for (let k = 0; k < p.count; k++) {
      const x = base[k * 3], z = base[k * 3 + 2];
      p.setY(k, 0.07 + 0.04 * Math.sin(x * 0.55 + T * 0.9 + z * 0.3) * Math.min(1, -z / 3) + 0.025 * Math.sin(z * 1.1 - T * 1.3 + x * 0.2) * Math.min(1, -z / 3));
    }
    p.needsUpdate = true;
    seaMat.current.color.set('#ffffff').lerp(col('#ffc9a0'), tkx.d * 0.7);
    fo[0].current.position.z = 0.15 + 0.3 * Math.sin(T * 0.8);
    fo[1].current.position.z = -0.55 + 0.25 * Math.sin(T * 0.8 + 2);
    (fo[0].current.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.35 * Math.sin(T * 0.8 + 1.4);
  });
  return (<>
    <mesh geometry={sand} receiveShadow>{flat({ roughness: 1 })}</mesh>
    <group position={[SHORE.x, 0.04, SHORE.z]} rotation={[0, SHORE.a, 0]}>
      <mesh geometry={sea.g} receiveShadow><meshStandardMaterial ref={seaMat} vertexColors flatShading roughness={0.3} metalness={0.05} /></mesh>
      <mesh ref={fo[0]} geometry={foam} position={[0, 0.07, 0.15]}><meshBasicMaterial color="#ffffff" transparent opacity={0.8} /></mesh>
      <mesh ref={fo[1]} geometry={foam} position={[0, 0.07, -0.55]} scale={[1, 1, 0.7]}><meshBasicMaterial color="#ffffff" transparent opacity={0.55} /></mesh>
    </group>
    {/* far rock island */}
    <group position={[8, 0, -26]}><Lump p={[0, 0.8, 0]} s={[3.2, 1.3, 1.8]} c="#8d7c6a" seed={3} /><Lump p={[1.6, 0.6, 0.2]} s={[1.8, 1.0, 1.3]} c="#a69078" seed={4} /><Lump p={[-1.8, 0.4, 0.3]} s={[1.5, 0.7, 1.1]} c="#7d6e5e" seed={5} /></group>
    {/* green hill + bushes + rocks on the left */}
    <Lump p={[-10, 0.2, -7]} s={[6, 2.6, 4]} c="#6ab04f" d={2} seed={7} amp={0.3} /><Lump p={[-7.2, 0.2, -9]} s={[4.5, 2.0, 3]} c="#549b41" d={2} seed={8} amp={0.3} />
    <Lump p={[-5.6, 0.35, -3.2]} s={[0.9, 0.55, 0.8]} c="#3f8f3a" seed={9} /><Lump p={[-4.7, 0.3, -3.8]} s={[0.7, 0.45, 0.6]} c="#59a64a" seed={10} /><Lump p={[-6.3, 0.4, -4.4]} s={[1.1, 0.7, 0.9]} c="#4a9a40" seed={11} />
    <Lump p={[-4.2, 0.25, -1.4]} s={[0.55, 0.38, 0.45]} c="#8d8a82" d={0} seed={12} /><Lump p={[-3.6, 0.1, -0.7]} s={[0.22, 0.14, 0.2]} c="#9a978e" d={0} seed={13} /><Lump p={[4.6, 0.12, -0.1]} s={[0.25, 0.16, 0.22]} c="#8d8a82" d={0} seed={14} /><Lump p={[3.2, 0.08, 1.4]} s={[0.16, 0.1, 0.14]} c="#a29f96" d={0} seed={15} />
    <Palm p={[-5.2, 0, -3.0]} h={6.2} lean={0.12} s={1.05} /><Palm p={[-7.0, 0, -4.6]} h={4.6} lean={-0.14} s={0.95} rot={1.2} /><Palm p={[-3.8, 0, -5.8]} h={3.6} lean={0.2} s={0.9} rot={2.4} />
    <Cloud p={[-8, 9, -22]} s={1.8} v={0.12} /><Cloud p={[12, 11, -26]} s={2.2} v={0.08} /><Cloud p={[2, 7.5, -20]} s={1.2} v={0.1} />
    <Lounger x={-0.55} /><Lounger x={0.25} />
    <Splash />
  </>);
}

/** splashes (droplets) + ripple rings round whoever is standing in the water */
function Splash() {
  const N = 140, mesh = useRef<THREE.InstancedMesh>(null!), P = useMemo(() => Array.from({ length: N }, () => ({ x: 0, y: -9, z: 0, vx: 0, vy: 0, vz: 0, l: 0 })), []), dummy = useMemo(() => new THREE.Object3D(), []), next = useRef(0);
  const rings = [useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!)];
  useFrame(({ clock }, dt) => {
    for (const [x, y, z, s] of FX.q.splice(0)) for (let k = 0; k < 14 * s; k++) { const q = P[next.current++ % N], a = Math.random() * 6.28, v = 0.6 + Math.random() * 1.6; q.x = x; q.y = y; q.z = z; q.vx = Math.cos(a) * v; q.vz = Math.sin(a) * v * 0.7 + 0.4; q.vy = 2 + Math.random() * 2.6; q.l = 0.7 + Math.random() * 0.5; }
    for (let k = 0; k < N; k++) { const q = P[k]; if (q.l > 0) { q.l -= dt; q.vy -= 9 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; if (q.y < 0.06) q.l = 0; }
      dummy.position.set(q.x, q.y, q.z); dummy.scale.setScalar(q.l > 0 ? 0.045 + q.l * 0.05 : 0.0001); dummy.updateMatrix(); if (mesh.current) mesh.current.setMatrixAt(k, dummy.matrix); }
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
    const T = clock.elapsedTime;
    rings.forEach((r, k) => {
      if (!r.current) return;
      const body = BODY[k >> 1], on = body.sink > 0.3, ph = ((T * 0.7 + (k & 1) * 0.5 + k * 0.13) % 1);
      r.current.visible = on;
      if (on) {
        r.current.position.set(body.x, 0.12, body.z);
        r.current.scale.setScalar(0.25 + ph * 0.9);
        (r.current.material as THREE.MeshBasicMaterial).opacity = (1 - ph) * 0.6;
      }
    });
    // ocean waves volume from how deep they are (gradual via ambient fade)
    const avgSink = (BODY[0].sink + BODY[1].sink) * 0.5;
    const near = Math.min(1, 0.2 + avgSink * 0.9 + Math.max(0, -BODY[0].z - 1.5) * 0.15);
    setOceanProximity(near);
  });
  return (<>
    <instancedMesh ref={mesh} args={[undefined, undefined, N]} frustumCulled={false}><icosahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#7ec8f0" transparent opacity={0.85} /></instancedMesh>
    {rings.map((r, k) => <mesh key={k} ref={r} rotation={[-Math.PI / 2, 0, 0]} visible={false}><ringGeometry args={[0.92, 1, 40]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.5} depthWrite={false} /></mesh>)}
  </>);
}
export const SKY = { day: skyDay, dusk: skyDusk };


/* ---------- INDOOR POOL: proper hollow basin, visible blue water, edge seating ---------- */
export function PoolSet() {
  // animated water surface with gentle vertex ripple
  const water = useMemo(() => {
    const g = new THREE.PlaneGeometry(7.6, 4.6, 32, 20);
    g.rotateX(-Math.PI / 2);
    return facets(g, (_x, _y, z) => col('#3ec0f0').lerp(col('#1a7ab8'), Math.min(1, (z + 2.2) / 3.5)), 0.025);
  }, []);
  const wMat = useRef<THREE.MeshStandardMaterial>(null!);
  const waterMesh = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (wMat.current) {
      wMat.current.emissiveIntensity = 0.1 + 0.05 * Math.sin(t * 0.8);
      wMat.current.opacity = 0.88 + 0.04 * Math.sin(t * 0.55);
    }
    // subtle vertical ripple on water surface
    if (waterMesh.current) {
      const pos = waterMesh.current.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        pos.setY(i, 0.012 * Math.sin(x * 2.1 + t * 1.4) + 0.008 * Math.sin(z * 2.8 + t * 1.1));
      }
      pos.needsUpdate = true;
    }
  });
  const tile = '#e8dcc8';
  const tileDark = '#cfc0a4';
  const tileInner = '#b8a888';
  const wood = '#6b4a32';
  // pool inner dimensions (the hole)
  const poolW = 7.8, poolD = 4.8, poolDepth = 1.7;
  const rimH = 0.18, rimT = 0.55; // rim height & thickness
  return (
    <>
      {/* surrounding deck floor (outer) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.4]} receiveShadow>
        <planeGeometry args={[18, 14]} />
        <meshStandardMaterial color={tile} roughness={0.92} flatShading />
      </mesh>

      {/* back / side walls of the room */}
      <mesh position={[0, 2.2, -4.4]} receiveShadow>
        <boxGeometry args={[15, 4.5, 0.28]} />
        <meshStandardMaterial color={tile} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[-7.0, 2.2, -0.6]} receiveShadow>
        <boxGeometry args={[0.28, 4.5, 9]} />
        <meshStandardMaterial color={tile} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[7.0, 2.2, -0.6]} receiveShadow>
        <boxGeometry args={[0.28, 4.5, 9]} />
        <meshStandardMaterial color={tile} roughness={0.9} flatShading />
      </mesh>
      {/* ceiling */}
      <mesh position={[0, 4.35, -1]} receiveShadow>
        <boxGeometry args={[15, 0.18, 10]} />
        <meshStandardMaterial color="#f0e8dc" roughness={0.95} flatShading />
      </mesh>

      {/* ===== POOL BASIN (hollow) ===== */}
      {/* outer rim frame – four sides so they can sit on the front edge */}
      {/* front rim (the edge they sit on) */}
      <RoundedBox args={[poolW + rimT * 2, rimH, rimT]} radius={0.03} position={[0, rimH / 2, -1.6 + poolD / 2 + rimT / 2]} receiveShadow>
        <meshStandardMaterial color={tileDark} roughness={0.85} flatShading />
      </RoundedBox>
      {/* back rim */}
      <RoundedBox args={[poolW + rimT * 2, rimH, rimT]} radius={0.03} position={[0, rimH / 2, -1.6 - poolD / 2 - rimT / 2]} receiveShadow>
        <meshStandardMaterial color={tileDark} roughness={0.85} flatShading />
      </RoundedBox>
      {/* left rim */}
      <RoundedBox args={[rimT, rimH, poolD]} radius={0.03} position={[-poolW / 2 - rimT / 2, rimH / 2, -1.6]} receiveShadow>
        <meshStandardMaterial color={tileDark} roughness={0.85} flatShading />
      </RoundedBox>
      {/* right rim */}
      <RoundedBox args={[rimT, rimH, poolD]} radius={0.03} position={[poolW / 2 + rimT / 2, rimH / 2, -1.6]} receiveShadow>
        <meshStandardMaterial color={tileDark} roughness={0.85} flatShading />
      </RoundedBox>

      {/* inner pool walls (visible when looking into the water) */}
      {/* front inner wall */}
      <mesh position={[0, -poolDepth / 2 + 0.02, -1.6 + poolD / 2 - 0.04]} receiveShadow>
        <boxGeometry args={[poolW, poolDepth, 0.08]} />
        <meshStandardMaterial color={tileInner} roughness={0.9} flatShading />
      </mesh>
      {/* back inner wall */}
      <mesh position={[0, -poolDepth / 2 + 0.02, -1.6 - poolD / 2 + 0.04]} receiveShadow>
        <boxGeometry args={[poolW, poolDepth, 0.08]} />
        <meshStandardMaterial color={tileInner} roughness={0.9} flatShading />
      </mesh>
      {/* left inner wall */}
      <mesh position={[-poolW / 2 + 0.04, -poolDepth / 2 + 0.02, -1.6]} receiveShadow>
        <boxGeometry args={[0.08, poolDepth, poolD]} />
        <meshStandardMaterial color={tileInner} roughness={0.9} flatShading />
      </mesh>
      {/* right inner wall */}
      <mesh position={[poolW / 2 - 0.04, -poolDepth / 2 + 0.02, -1.6]} receiveShadow>
        <boxGeometry args={[0.08, poolDepth, poolD]} />
        <meshStandardMaterial color={tileInner} roughness={0.9} flatShading />
      </mesh>
      {/* pool floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -poolDepth + 0.02, -1.6]} receiveShadow>
        <planeGeometry args={[poolW - 0.08, poolD - 0.08]} />
        <meshStandardMaterial color="#8a9aaa" roughness={0.95} flatShading />
      </mesh>

      {/* water surface – clear blue, slightly transparent, gentle ripple */}
      <mesh ref={waterMesh} geometry={water} position={[0, 0.02, -1.6]} receiveShadow>
        <meshStandardMaterial
          ref={wMat}
          vertexColors
          flatShading
          roughness={0.08}
          metalness={0.35}
          emissive="#2a9ec8"
          emissiveIntensity={0.12}
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </mesh>
      {/* water volume (depth tint) */}
      <mesh position={[0, -poolDepth / 2 + 0.05, -1.6]} receiveShadow>
        <boxGeometry args={[poolW - 0.15, poolDepth - 0.1, poolD - 0.15]} />
        <meshStandardMaterial color="#0d5a8a" roughness={0.3} flatShading transparent opacity={0.45} depthWrite={false} />
      </mesh>
      {/* soft underwater glow */}
      <pointLight position={[0, -0.4, -1.6]} intensity={0.55} distance={6} color="#4ec8f0" />

      {/* night window left */}
      <mesh position={[-5.8, 2.6, -4.2]}>
        <boxGeometry args={[1.2, 1.1, 0.08]} />
        <meshBasicMaterial color="#1a2848" />
      </mesh>
      {/* door right */}
      <mesh position={[5.2, 1.5, -4.25]}>
        <boxGeometry args={[1.15, 2.5, 0.1]} />
        <meshStandardMaterial color={wood} roughness={0.85} flatShading />
      </mesh>
      <mesh position={[5.65, 1.5, -4.18]}>
        <boxGeometry args={[0.08, 0.22, 0.12]} />
        <meshStandardMaterial color="#2a2a2e" roughness={0.6} />
      </mesh>
      {/* wall lamps */}
      {[[-5.5, 3.05, -4.1], [3.5, 3.05, -4.1]].map((p, i) => (
        <group key={i} position={p as [number, number, number]}>
          <mesh><boxGeometry args={[0.12, 0.28, 0.1]} /><meshStandardMaterial color="#3a342c" /></mesh>
          <mesh position={[0, -0.2, 0.05]}><boxGeometry args={[0.18, 0.14, 0.08]} /><meshBasicMaterial color="#ffd090" /></mesh>
          <pointLight position={[0, -0.15, 0.25]} intensity={0.7} distance={5.5} color="#ffc878" />
        </group>
      ))}
      {/* ceiling spots */}
      {[-2.2, 0, 2.2].map((x) => (
        <mesh key={x} position={[x, 4.2, -1.5]}>
          <cylinderGeometry args={[0.13, 0.13, 0.06, 12]} />
          <meshBasicMaterial color="#fff4e0" />
        </mesh>
      ))}
      {/* plant left */}
      <group position={[-5.5, 0.02, -2.6]}>
        <mesh position={[0, 0.25, 0]}><boxGeometry args={[0.7, 0.5, 0.45]} /><meshStandardMaterial color={wood} roughness={0.9} flatShading /></mesh>
        <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.18, 0.15, 0.25, 10]} /><meshStandardMaterial color="#8a6a52" /></mesh>
        {[0, 1, 2, 3, 4].map(k => (
          <mesh key={k} position={[Math.sin(k * 1.2) * 0.12, 0.95, Math.cos(k * 1.2) * 0.12]} rotation={[0.4, 0, k]}>
            <capsuleGeometry args={[0.06, 0.35, 4, 6]} />
            <meshStandardMaterial color="#4a9a45" flatShading />
          </mesh>
        ))}
      </group>
      {/* bench + towels right */}
      <group position={[5.3, 0.02, -2.0]}>
        <mesh position={[0, 0.28, 0]}><boxGeometry args={[1.2, 0.12, 0.45]} /><meshStandardMaterial color={wood} roughness={0.9} flatShading /></mesh>
        <mesh position={[-0.35, 0.12, 0]}><boxGeometry args={[0.08, 0.24, 0.4]} /><meshStandardMaterial color={wood} /></mesh>
        <mesh position={[0.35, 0.12, 0]}><boxGeometry args={[0.08, 0.24, 0.4]} /><meshStandardMaterial color={wood} /></mesh>
        <mesh position={[0.15, 0.4, 0]}><boxGeometry args={[0.45, 0.12, 0.3]} /><meshStandardMaterial color="#9ab0c0" flatShading /></mesh>
        <mesh position={[-0.15, 0.38, 0.05]}><boxGeometry args={[0.45, 0.1, 0.28]} /><meshStandardMaterial color="#d8d0c0" flatShading /></mesh>
      </group>
      <group position={[5.7, 0.02, -0.4]}>
        <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.12, 0.1, 0.2, 10]} /><meshStandardMaterial color="#8a6a52" /></mesh>
        {[0, 1, 2].map(k => (
          <mesh key={k} position={[Math.sin(k) * 0.08, 0.5, Math.cos(k) * 0.08]}>
            <capsuleGeometry args={[0.05, 0.28, 4, 6]} />
            <meshStandardMaterial color="#5aaa50" flatShading />
          </mesh>
        ))}
      </group>
      {/* splash droplets when they splash each other */}
      <Splash />
    </>
  );
}

