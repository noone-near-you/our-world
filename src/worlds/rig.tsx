import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { sfx, type Sfx } from '../audio/audio';
import { Outlines } from '@react-three/drei';
import { get, set, useGame, subscribe } from '../state/store';
import { tk, tkx, HEADW, BODY, FX } from './anchors';
import type { Act } from '../story/script';

/* ================= ANIMATION DATA (edit the rows to change any scene) =================
 * Times in seconds. Anything a row does not mention falls back to the resting pose, and every change is eased.
 * d = +1 for him (left), -1 for her (right); "toward her/him" is always +d.
 * Body: x slide, yaw/lean/roll torso. Head (relative to torso): hy yaw, hp nod, hr tilt.
 * Arms: nS/nZ/nE near arm (shoulder, sideways, elbow) and fS/fZ/fE far arm. nik/fik 0..1 = let the arm REACH a real target
 *       (her back, his nose, his shoulder...) instead of the hand-set angles. nfc/ffc/nic/fic = finger / index-finger curl.
 * Face: eye open, sm smile, mo mouth open, mp pucker, tg tongue, bl blush, br brows up, bt brows worried(+)/angry(-), bs one brow up.
 * ks = lips seek each other (the kiss). sh = laugh shake. */
type P = Record<string, number>;
type Row = { t: number; p: [P, P] };
const R = (t: number, bf: P = {}, gf: P = {}): Row => ({ t, p: [bf, gf] });
const base = (d: number): P => ({ x: 0, yaw: d * 0.18, lean: 0, roll: 0, hy: d * 0.42, hp: 0.04, hr: 0, nS: -0.06, nZ: 0.02, nE: -0.32, fS: -0.06, fZ: -0.02, fE: -0.32, nik: 0, fik: 0,
  nfc: 0.35, ffc: 0.35, nic: 0.35, fic: 0.35, eye: 1, sm: 0.35, mo: 0, mp: 0, tg: 0, bl: 0.1, br: 0, bt: 0, bs: 0, sh: 0, ks: 0 });
const hugP = (d: number, a: number): P => ({ yaw: d * (0.18 + 0.87 * a), x: d * 0.17 * a, lean: 0.06 * a, roll: -d * 0.05 * a, hy: d * (0.42 - 1.32 * a), hp: 0.04 + 0.06 * a, hr: -d * 0.2 * a,
  eye: 1 - 0.96 * a, sm: 0.35 + 0.6 * a, bl: 0.1 + 0.6 * a, nik: a, fik: a, nfc: 0.45, ffc: 0.45, br: 0.2 * a });
const kissP = (d: number, a: number): P => ({ yaw: d * (0.18 + 0.72 * a), x: d * 0.07 * a, lean: 0.1 * a, roll: -d * 0.09 * a, hy: d * (0.42 + 0.08 * a), hp: 0.04 + d * 0.1 * a, hr: 0.42 * a,
  eye: 1 - 0.97 * a, sm: 0.35 - 0.25 * a, mp: a, bl: 0.1 + 0.85 * a, br: 0.25 * a, ks: a, nik: 0.9 * a, nfc: 0.2 });
const after = (d: number): P => ({ ...kissP(d, 0.12), eye: 1, sm: 1, mp: 0, mo: 0.15, bl: 0.95, ks: 0, nik: 0, hy: d * 0.3, hp: 0.12, br: 0.4, bt: 0.3 });
export const ACTS: Record<Act, { dur: number; rows: Row[]; ev: [number, Sfx | 'hearts'][]; zoom: number; lines: string[] }> = {
  hug: { dur: 4.6, zoom: 0.74, lines: ['Mmm... five more minutes like this.', 'You always feel like home.'], ev: [[0.95, 'hug'], [1.6, 'hearts'], [2.8, 'foh']], rows: [
    R(0), R(0.9, hugP(1, 0.5), hugP(-1, 0.5)), R(1.8, hugP(1, 1), hugP(-1, 1)), R(2.7, hugP(1, 1.1), hugP(-1, 1.1)), R(3.6, hugP(1, 1), hugP(-1, 1)),
    R(4.6, { sm: 1, mo: 0.2, bl: 0.7 }, { sm: 1, mo: 0.2, bl: 0.7 })] },
  kiss: { dur: 5.4, zoom: 0.66, lines: ['*soft kiss*  ...okay, I\u2019m blushing now.', 'Just a little one. Maybe two.'], ev: [[2.05, 'kiss'], [2.15, 'hearts'], [4.0, 'sigh']], rows: [
    R(0, { hy: 0.42 }, { hy: -0.42 }), R(0.6, { eye: 0.7, sm: 0.7, bl: 0.4, hy: 0.3 }, { eye: 0.6, sm: 0.8, bl: 0.5, hy: -0.3 }),
    R(1.3, kissP(1, 0.5), kissP(-1, 0.5)), R(2.1, kissP(1, 1), kissP(-1, 1)), R(3.2, kissP(1, 1), kissP(-1, 1)), R(4.0, after(1), after(-1)), R(5.4)] },
  tease: { dur: 5.0, zoom: 0.82, lines: ['Hehe, look at you going red!', 'Don\u2019t pretend you don\u2019t like it.'], ev: [[0.3, 'tease'], [1.7, 'poke'], [2.3, 'fuhh'], [3.2, 'laugh']], rows: [
    R(0), R(0.7, { sm: 0.6, bl: 0.25 }, { yaw: -0.5, lean: 0.1, eye: 0.65, sm: 0.95, bs: 1, br: 0.3, nS: -0.95, nE: -1.1, nic: 0, nfc: 1, bl: 0.3 }),
    R(1.3, { lean: -0.05, hy: 0.3, bl: 0.5 }, { yaw: -0.7, x: -0.14, roll: 0.16, lean: 0.14, eye: 0.6, sm: 1, bs: 1, nik: 1, nic: 0, nfc: 1, tg: 0.6 }),
    R(1.7, { yaw: 0.05, lean: -0.2, roll: 0.1, hp: -0.18, eye: 0.15, sm: 0.1, mp: 0.5, bl: 0.9, br: 0.3, bt: 0.5 }, { yaw: -0.7, x: -0.14, roll: 0.16, lean: 0.14, eye: 0.5, sm: 1, nik: 1, nic: 0, nfc: 1, tg: 0.8, sh: 0.02 }),
    R(2.3, { lean: -0.12, hp: 0.05, eye: 1, sm: 0, mp: 0, bl: 0.95, br: 0.6, bt: 0.9, hy: 0.45 }, { yaw: -0.4, x: -0.04, lean: 0.06, eye: 0.2, sm: 1, mo: 0.7, tg: 0, sh: 0.05, bl: 0.6, nik: 0, nS: -0.4, nE: -1.2 }),
    R(3.2, { lean: -0.05, eye: 0.3, sm: 1, mo: 0.6, sh: 0.04, bl: 0.9 }, { yaw: -0.3, eye: 0.15, sm: 1, mo: 0.8, sh: 0.06, bl: 0.6 }),
    R(4.0, { sm: 1, bl: 0.7, hy: 0.5 }, { sm: 1, mo: 0.2, bl: 0.5 }), R(5.0)] },
  slap: { dur: 4.0, zoom: 0.85, lines: ['Hey! What did I even do?!', 'Ow... okay okay, I deserved that.'], ev: [[1.1, 'slap'], [2.1, 'laugh']], rows: [
    R(0), R(0.6, { hy: 0.5, sm: 0.6 }, { yaw: -0.55, lean: 0.05, eye: 0.6, sm: 0.8, bs: 1, bt: -0.5, nS: 0.9, nE: -0.5, nfc: 0, nic: 0 }),
    R(0.95, { hy: 0.5 }, { yaw: -0.75, lean: 0.12, eye: 0.6, sm: 0.5, bt: -0.7, nS: 1.0, nE: -0.35, nfc: 0, nic: 0, nik: 0.2 }),
    R(1.1, { x: -0.07, roll: 0.1, hy: -0.95, hr: 0.18, hp: 0.1, eye: 1.15, sm: 0, mo: 0.8, bl: 0.9, br: 0.8, bt: 0.6 }, { yaw: -0.8, lean: 0.14, eye: 0.5, sm: 0.5, bt: -0.7, nik: 1, nfc: 0, nic: 0 }),
    R(1.7, { x: -0.04, hy: -0.7, hr: 0.1, eye: 0.7, mo: 0.2, bl: 0.9, nik: 0.85 }, { yaw: -0.5, nS: -0.8, nE: -1.0, nik: 0, nfc: 0, eye: 0.4, sm: 1, mo: 0.4, sh: 0.03 }),
    R(2.5, { hy: 0.15, eye: 0.5, sm: 0, bl: 0.85, bt: 0.8, br: 0.4, nik: 0.85 }, { yaw: -0.3, eye: 0.15, sm: 1, mo: 0.9, sh: 0.06, nS: -0.3, nE: -1.2, bl: 0.5 }),
    R(3.3, { hy: 0.5, eye: 1, sm: 0.6, bl: 0.6 }, { eye: 0.5, sm: 1, mo: 0.3 }), R(4.0)] },
  flower: { dur: 4.8, zoom: 0.72, lines: ['There…', 'Perfect.'], ev: [[0.4, 'chime'], [2.4, 'foh'], [3.6, 'fuhh']], rows: [
    R(0),
    R(0.7, { yaw: 0.55, lean: 0.06, hy: 0.55, sm: 0.7, bl: 0.3, nS: -0.7, nE: -0.6, nfc: 0.2 }, { yaw: -0.35, hy: -0.25, hp: 0.08, sm: 0.85, eye: 0.9, bl: 0.35 }),
    R(1.6, { yaw: 0.7, lean: 0.1, x: 0.06, hy: 0.6, hp: 0.12, sm: 0.8, bl: 0.4, nik: 1, nfc: 0.15, nic: 0.1 }, { yaw: -0.45, hy: -0.35, hp: 0.15, hr: 0.12, sm: 0.95, eye: 0.75, bl: 0.5 }),
    R(2.6, { yaw: 0.72, lean: 0.12, x: 0.08, hy: 0.55, hp: 0.15, sm: 0.9, bl: 0.45, nik: 1, nfc: 0.1 }, { yaw: -0.5, hy: -0.4, hp: 0.18, hr: 0.15, sm: 1, eye: 0.6, bl: 0.55, br: 0.2 }),
    R(3.5, { yaw: 0.5, lean: 0.05, hy: 0.45, sm: 1, bl: 0.5, nik: 0.3, nS: -0.35, nE: -1.0 }, { yaw: -0.3, hy: -0.25, hp: 0.08, sm: 1, eye: 0.9, bl: 0.45 }),
    R(4.8, { sm: 1, bl: 0.4 }, { sm: 1, bl: 0.4 })] },
};
const sm = (x: number) => x * x * (3 - 2 * x);
function sample(rows: Row[], t: number, who: 0 | 1, b: P): P {
  let i = 0; while (i < rows.length - 2 && t > rows[i + 1].t) i++;
  const A = rows[i], B = rows[i + 1], u = sm(Math.max(0, Math.min(1, (t - A.t) / (B.t - A.t)))), o: P = {};
  for (const k in b) { const a = A.p[who][k] ?? b[k], c = B.p[who][k] ?? b[k]; o[k] = a + (c - a) * u; }
  return o;
}
export type Ctl = MutableRefObject<{ act: Act | null; t0: number; zoom: number }>;

/* ================= the people ================= */
export const mat = (c: string, r = 0.8) => <meshStandardMaterial color={c} roughness={r} />;
export type V3 = [number, number, number];
export const Ell = ({ p, s, c, r = 0.8 }: { p: V3; s: V3; c: string; r?: number }) => <mesh position={p} scale={s} castShadow><sphereGeometry args={[1, 20, 14]} />{mat(c, r)}</mesh>;
export const Cap = ({ p, r, l, c, rot, s }: { p: V3; r: number; l: number; c: string; rot?: V3; s?: V3 }) => <mesh position={p} rotation={rot} scale={s} castShadow><capsuleGeometry args={[r, l, 6, 14]} />{mat(c)}</mesh>;
// Shared between the two people each frame: where the lips, noses, backs and shoulders are in the world (so hands and lips can FIND each other).
interface Pts { nose: THREE.Object3D; jaw: THREE.Object3D; sh: THREE.Object3D; bk: [THREE.Object3D, THREE.Object3D]; lip: THREE.Object3D; torso: THREE.Object3D }
const PT: (Pts | null)[] = [null, null];
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), q1 = new THREE.Quaternion(), qt = new THREE.Quaternion(), UP_Y = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const clamp = THREE.MathUtils.clamp;
/** Two-bone reach: puts the fingertip on a world point. Returns the shoulder rotation and elbow bend (in the torso's space). */
function reach(shoulder: THREE.Object3D, torso: THREE.Object3D, world: THREE.Vector3, side: number, out: { q: THREE.Quaternion; e: number }) {
  const L1 = 0.28, L2 = 0.36, t = torso.worldToLocal(v1.copy(world)).sub(shoulder.position), D = clamp(t.length(), 0.14, L1 + L2 - 0.02), d = t.normalize();
  const al = Math.acos(clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1)), pole = v2.set(side * 0.6, -1, -0.45), perp = pole.sub(v3.copy(d).multiplyScalar(pole.dot(d))).normalize();
  const u = v3.copy(d).multiplyScalar(Math.cos(al)).addScaledVector(perp, Math.sin(al)), f = d.clone().multiplyScalar(D).addScaledVector(u, -L1).normalize();
  q1.setFromUnitVectors(DOWN, u); const fl = f.applyQuaternion(q1.clone().invert()), tau = Math.atan2(fl.x, fl.z);
  out.q.copy(q1).multiply(qt.setFromAxisAngle(UP_Y, tau)); fl.applyAxisAngle(UP_Y, -tau); out.e = Math.atan2(-fl.z, -fl.y);
}
// where each of them lies in bed (root position): he is behind her, she is nearer the camera; both heads land on the pillows
const BED_X = [-0.4, -0.05], BED_Y = [1.2, 0.98], BED_Z = [-1.9, -1.28];
const ik = { q: new THREE.Quaternion(), e: 0 }, fk = new THREE.Quaternion(), eu = new THREE.Euler();


/* ================= ANIME LOOK: cel shading + ink outlines + painted face ================= */
const GRAD = (() => { const t = new THREE.DataTexture(new Uint8Array([150, 208, 255]), 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const INK = '#3b2326';
const toon = (c: string, e = 0.1) => <meshToonMaterial color={c} gradientMap={GRAD} emissive={c} emissiveIntensity={e} />;
const tl = (c: string, f: number) => new THREE.Color(c).multiplyScalar(f).getStyle(), lt = (c: string, f: number) => new THREE.Color(c).lerp(new THREE.Color('#ffffff'), f).getStyle();
const outl = (o: number, s: V3 = [1, 1, 1]) => o > 0 ? <Outlines thickness={o / Math.cbrt(s[0] * s[1] * s[2])} color={INK} /> : null;
const TE = ({ p, s, c, o = 0, rot, e }: { p: V3; s: V3; c: string; o?: number; rot?: V3; e?: number }) => <mesh position={p} scale={s} rotation={rot} castShadow><sphereGeometry args={[1, 24, 16]} />{toon(c, e)}{outl(o, s)}</mesh>;
const TC = ({ p, r, l, c, rot, o = 0 }: { p: V3; r: number; l: number; c: string; rot?: V3; o?: number }) => <mesh position={p} rotation={rot} castShadow><capsuleGeometry args={[r, l, 6, 16]} />{toon(c)}{outl(o)}</mesh>;
// a pointed, flattened lock of hair (anime style). Hangs down from its origin.
function lockGeo(len: number, w: number) { const pts: THREE.Vector2[] = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector2(Math.max(0.0004, w * Math.pow(1 - t, 0.8) * (0.72 + 0.28 * Math.sin(Math.PI * Math.min(1, t * 2.4)))), -t * len)); } return new THREE.LatheGeometry(pts, 12); }
function Lock({ p, rot, len, w, c, o = 0.005 }: { p: V3; rot?: V3; len: number; w: number; c: string; o?: number }) {
  const g = useMemo(() => lockGeo(len, w), [len, w]);
  return <mesh position={p} rotation={rot} scale={[1, 1, 0.55]} geometry={g} castShadow>{toon(c, 0.07)}{outl(o, [1, 1, 0.55])}</mesh>;
}
// head shape: a sphere whose lower half tapers to a soft anime chin
const taper = (g: THREE.BufferGeometry) => { const a = g.attributes.position; for (let k = 0; k < a.count; k++) { let x = a.getX(k), y = a.getY(k), z = a.getZ(k);
  const t = clamp((-y - 0.15) / 0.85, 0, 1), kx = 1 - 0.46 * Math.pow(t, 1.3), kz = 1 - 0.2 * Math.pow(t, 1.3); a.setXYZ(k, x * kx, y, z * kz); } g.computeVertexNormals(); return g; };
const FACE_PHI = 1.8, FACE_T0 = 0.35, FACE_TL = 2.4, HS: V3 = [0.265, 0.29, 0.255];

interface FP { open: number; sm: number; mo: number; mp: number; tg: number; bl: number; br: number; bt: number; bs: number }
function paintFace(x: CanvasRenderingContext2D, f: FP, her: boolean, eyeC: string, hairC: string) {
  x.clearRect(0, 0, 384, 384); x.lineCap = 'round'; x.lineJoin = 'round';
  const ink = her ? '#2b1a1c' : tl(hairC, 0.55), cx = 192;
  for (const s of [-1, 1]) {
    const ex = cx + s * 86, ey = 232;
    if (f.bl > 0.05) { const g = x.createRadialGradient(ex + s * 4, ey + 56, 0, ex + s * 4, ey + 56, 46); g.addColorStop(0, `rgba(255,110,125,${Math.min(0.8, f.bl * 0.8)})`); g.addColorStop(1, 'rgba(255,110,125,0)');
      x.fillStyle = g; x.beginPath(); x.ellipse(ex + s * 4, ey + 56, 46, 26, 0, 0, 6.3); x.fill();
      if (f.bl > 0.55) { x.strokeStyle = `rgba(235,80,100,${(f.bl - 0.5) * 1.3})`; x.lineWidth = 3; for (let k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(ex + k * 13 - 5, ey + 64); x.lineTo(ex + k * 13 + 4, ey + 46); x.stroke(); } } }
    const by = ey - 78 - f.br * 12 - (s === 1 ? f.bs * 11 : 0);
    x.strokeStyle = tl(hairC, 0.8); x.lineWidth = 6; x.beginPath(); x.moveTo(cx + s * 54, by - f.bt * 15); x.quadraticCurveTo(ex, by - 8, ex + s * 34, by + f.bt * 7); x.stroke();
    const o = f.open;
    if (o > 0.22) {
      const eh = 46 * Math.min(o, 1.15), ew = 40;
      x.save(); x.beginPath(); x.ellipse(ex, ey, ew, eh, 0, 0, 6.3); x.clip();
      x.fillStyle = '#fff'; x.fillRect(ex - 50, ey - 60, 100, 120);
      const g = x.createLinearGradient(0, ey - eh, 0, ey + eh); g.addColorStop(0, tl(eyeC, 0.45)); g.addColorStop(0.5, eyeC); g.addColorStop(1, lt(eyeC, 0.5));
      x.fillStyle = g; x.beginPath(); x.ellipse(ex + s, ey + 4, 29, Math.min(eh + 4, 40), 0, 0, 6.3); x.fill();
      x.fillStyle = '#160c0e'; x.beginPath(); x.ellipse(ex + s, ey + 4, 12, 18 * Math.min(1, o + 0.2), 0, 0, 6.3); x.fill();
      x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(ex - 40, ey - eh, 80, eh * 0.5);
      x.fillStyle = '#fff'; x.beginPath(); x.ellipse(ex - 9, ey - 14, 9, 11, 0, 0, 6.3); x.fill(); x.beginPath(); x.ellipse(ex + 11, ey + 17, 4.5, 5.5, 0, 0, 6.3); x.fill();
      x.restore();
      x.strokeStyle = ink; x.lineWidth = her ? 9 : 7; x.beginPath(); x.moveTo(ex - ew - 2, ey + 2); x.quadraticCurveTo(ex, ey - eh * 1.28, ex + ew + 2, ey + 2); x.stroke();
      x.lineWidth = her ? 6 : 4; x.beginPath(); x.moveTo(ex + s * ew, ey - 4); x.lineTo(ex + s * (ew + 13), ey - (her ? 16 : 9)); x.stroke();
      x.lineWidth = 2.5; x.globalAlpha = 0.55; x.beginPath(); x.moveTo(ex - ew * 0.7, ey + eh * 0.92); x.quadraticCurveTo(ex, ey + eh * 1.1, ex + ew * 0.7, ey + eh * 0.92); x.stroke(); x.globalAlpha = 1;
    } else if (f.sm > 0.6) {
      x.strokeStyle = ink; x.lineWidth = 9; x.beginPath(); x.moveTo(ex - 36, ey + 12); x.quadraticCurveTo(ex, ey - 34, ex + 36, ey + 12); x.stroke();
    } else {
      x.strokeStyle = ink; x.lineWidth = 9; x.beginPath(); x.moveTo(ex - 38, ey - 6); x.quadraticCurveTo(ex, ey + 26, ex + 38, ey - 6); x.stroke();
      if (her) { x.lineWidth = 4; for (const k of [0.55, 1]) { x.beginPath(); x.moveTo(ex + s * 38 * k, ey - 6 + (1 - k) * 10); x.lineTo(ex + s * (38 * k + 9), ey - 2 + (1 - k) * 8); x.stroke(); } }
    }
  }
  x.strokeStyle = 'rgba(190,105,100,.75)'; x.lineWidth = 3; x.beginPath(); x.moveTo(186, 280); x.quadraticCurveTo(192, 287, 198, 280); x.stroke();
  const my = 324, mo = Math.max(f.mo, f.tg * 0.5); x.strokeStyle = '#8a3c46'; x.lineWidth = 4.5; x.fillStyle = '#6e2230';
  if (f.mp > 0.35 && mo < 0.2) { x.fillStyle = '#d9707a'; x.beginPath(); x.ellipse(cx, my + 2, 10 * (1 - f.mp * 0.2), 8, 0, 0, 6.3); x.fill(); }
  else if (mo > 0.1) {
    const w = 24 + f.sm * 8, dep = 8 + mo * 38, path = () => { x.beginPath(); x.moveTo(cx - w, my - f.sm * 6); x.quadraticCurveTo(cx, my + f.sm * 8, cx + w, my - f.sm * 6); x.bezierCurveTo(cx + w * 0.8, my + dep, cx - w * 0.8, my + dep, cx - w, my - f.sm * 6); };
    path(); x.fill(); x.save(); path(); x.clip();
    if (mo > 0.25) { x.fillStyle = '#fff'; x.fillRect(cx - w, my - 9, 2 * w, 9); }
    x.fillStyle = f.tg > 0.2 ? '#ff8d9d' : '#c9566a'; x.beginPath(); x.ellipse(cx, my + dep * 0.78, 15 + f.tg * 5, 9 + f.tg * 12, 0, 0, 6.3); x.fill(); x.restore(); path(); x.stroke();
  } else { x.beginPath(); x.moveTo(cx - 24, my - f.sm * 5); x.quadraticCurveTo(cx, my + 4 + f.sm * 16, cx + 24, my - f.sm * 5); x.stroke(); }
}

const floralTex = () => {   // transparent canvas with little flowers, laid over his shirt
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d')!;
  for (const [fx, fy, c] of [[24, 26, '#ff7fa0'], [86, 20, '#ffd25a'], [58, 62, '#ff9a5a'], [20, 98, '#ffd25a'], [100, 90, '#ff7fa0']] as [number, number, string][]) {
    x.fillStyle = '#2f9a4a'; x.beginPath(); x.ellipse(fx + 14, fy + 10, 9, 4, 0.6, 0, 7); x.fill();
    x.fillStyle = c; for (let k = 0; k < 5; k++) { const a = k * 1.2566; x.beginPath(); x.arc(fx + Math.cos(a) * 8, fy + Math.sin(a) * 8, 7, 0, 7); x.fill(); }
    x.fillStyle = '#fff3b0'; x.beginPath(); x.arc(fx, fy, 4, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1.6); return t;
};
const Hat = ({ band }: { band: string }) => (   // round straw sun hat: dome + wide flat brim + ribbon
  <group position={[0, 0.37, 0]} rotation={[-0.06, 0, 0]}>
    <mesh scale={[0.29, 0.26, 0.28]} castShadow><sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />{toon('#e8cf8f')}<Outlines thickness={0.007 / 0.28} color={INK} /></mesh>
    <mesh position={[0, 0.005, 0]} scale={[1, 1, 0.96]} castShadow><cylinderGeometry args={[0.5, 0.5, 0.014, 48]} />{toon('#e8cf8f')}<Outlines thickness={0.007} color={INK} /></mesh>
    <mesh position={[0, 0.045, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.97, 1]}><torusGeometry args={[0.28, 0.02, 8, 32]} />{toon(band)}</mesh>
  </group>);
/** Small flower cluster / gajra on her hair (shown after the flower act). */
function HairGajra() {
  const on = useGame(g => g.flowerInHair);
  if (!on) return null;
  return (
    <group position={[0.16, 0.52, 0.08]} rotation={[0.15, 0.4, 0.3]}>
      {/* string of small blossoms */}
      {[[0, 0, 0, '#ff8fb0'], [0.04, -0.02, 0.02, '#ffb0c8'], [-0.03, -0.03, 0.01, '#f5e6a0'], [0.06, -0.05, 0.03, '#e86a9a'], [-0.05, -0.06, 0.02, '#ff9ec0'], [0.02, -0.08, 0.04, '#f0d878']].map(([px, py, pz, c], k) => (
        <group key={k} position={[px as number, py as number, pz as number]}>
          {[[0, 0.012], [0.012, 0], [0, -0.012], [-0.012, 0]].map(([dx, dy], j) => (
            <mesh key={j} position={[dx, dy, 0]}><sphereGeometry args={[0.01, 6, 6]} />{mat(c as string)}</mesh>
          ))}
          <mesh position={[0, 0, 0.005]}><sphereGeometry args={[0.007, 6, 6]} />{mat('#f5e8a0')}</mesh>
        </group>
      ))}
    </group>
  );
}
export function Person({ i, ctl, x, skin, hair: hc, top: topIn, pants: pantsIn, long, clip }: { i: 0 | 1; ctl: Ctl; x: number; skin: string; hair: string; top: string; pants: string; long?: boolean; clip?: boolean }) {
  // R3F can miss external-store updates — force React re-render on every game state change
  const [, tick] = useState(0);
  useEffect(() => subscribe(() => tick(n => n + 1)), []);
  const gLive = get();
  const outfit = gLive.outfit, world = gLive.world, naked = gLive.naked;
  const beach = outfit === 'beach', swim = outfit === 'swim';
  // beach: flower shirt + shorts / dress + hats. swim: trunks / bikini
  const top = (swim || naked) ? skin : beach ? (long ? '#f5ecdc' : '#2b8c8c') : topIn;
  const pants = naked ? skin : swim ? (long ? '#ee6f93' : '#1f2430') : beach ? (long ? '#f5ecdc' : '#e6d6a0') : pantsIn;
  const floral = useMemo(() => (beach && !long && !naked ? floralTex() : null), [beach, long, naked]);
  const d = i === 0 ? 1 : -1, b0 = useMemo(() => base(d), [d]), cur = useRef<P>({ ...b0 }), blinkAt = useRef(2 + i), corr = useRef(new THREE.Vector3()), lag = useRef({ y: 0, p: 0, r: 0 });
  const W = useRef({ stage: i === 1 ? 0 : 2, turn: 0, ph: 0, s: i === 1 ? 1 : 0, yaw: 0, lie: 0, sink: 0, sp: 1, tr: 0 });   // stage: 0 walking in, 1 turning round, 2 seated
  const O = useRef<Record<string, THREE.Object3D>>({}), o = (k: string) => (n: THREE.Object3D | null) => { if (n) O.current[k] = n; };
  const hip = [useRef<THREE.Group>(null!), useRef<THREE.Group>(null!)], knee = [useRef<THREE.Group>(null!), useRef<THREE.Group>(null!)];
  const trim = useMemo(() => tl(top, 0.78), [top]), shine = useMemo(() => lt(hc, 0.5), [hc]), eyeC = long ? '#7a4a6a' : '#4a6a8a', lipC = long ? '#e8808a' : '#d98a84';
  const face = useMemo(() => { const cv = document.createElement('canvas'); cv.width = cv.height = 384; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; return { ctx: cv.getContext('2d')!, tex, key: '' }; }, []);
  const faceMat = useMemo(() => new THREE.MeshBasicMaterial({ map: face.tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }), [face]);
  const headG = useMemo(() => taper(new THREE.SphereGeometry(1, 48, 36)), []), patchG = useMemo(() => taper(new THREE.SphereGeometry(1, 40, 30, Math.PI / 2 - FACE_PHI / 2, FACE_PHI, FACE_T0, FACE_TL)), []);
  const torsoG = useMemo(() => new THREE.LatheGeometry([[0.12, 0], [0.135, 0.08], [0.16, 0.2], [0.18, 0.32], [0.19, 0.43], [0.165, 0.52], [0.09, 0.57], [0.055, 0.6], [0.001, 0.6]].map(([r, y]) => new THREE.Vector2(r, y)), 28), []);
  useFrame(({ clock }, dt) => {
    if (!PT[i] && O.current.lipPt && O.current.jaw && O.current.nose && O.current.sh && O.current.bk1 && O.current.torso) PT[i] = { nose: O.current.nose, jaw: O.current.jaw, sh: O.current.sh, bk: [O.current.bk0, O.current.bk1], lip: O.current.lipPt, torso: O.current.torso };
    if (!PT[0] || !PT[1]) return;
    const T = clock.elapsedTime, c = ctl.current, t = c.act ? (c.t0 < 0 ? 0 : T - c.t0) : -1, L = THREE.MathUtils.lerp, D = THREE.MathUtils.damp, w = W.current, rp = O.current.root.position, N = O.current;
    const g = get(), bedP = g.pose === 'bed';   // lying in bed: on their sides under the blanket, facing us, heads on the pillows
    let tgt: P = bedP ? { ...b0, yaw: 0, hy: 0, hp: 0.08, hr: -0.75, x: 0, nS: -0.1, nE: -0.45, fS: -0.1, fE: -0.45, sm: 0.55, bl: 0.5 } : c.act && t >= 0 && t < ACTS[c.act].dur ? sample(ACTS[c.act].rows, t, i, b0) : b0;
    const standP = g.pose === 'stand', wadeP = g.pose === 'wade', swimP = g.pose === 'swim', restP = g.pose === 'rest', onBeach = g.world === 'beach', onPool = g.world === 'pool', onLounger = onBeach || onPool, liveAct = !!c.act && t >= 0 && t < ACTS[c.act].dur;
    if (!bedP && !liveAct) {
      if (standP || (wadeP && !onPool && !onBeach)) tgt = { ...tgt, ...(long ? { yaw: d * 0.22, roll: d * 0.07, hy: d * 0.3, hp: 0.02, hr: -d * 0.16, sm: 0.7, bl: 0.35, br: 0.1, nik: 1, fik: 1, nfc: 0.2, ffc: 0.15, nic: 0.1, fic: 0.15 } : { yaw: d * 0.15, hy: d * 0.3, sm: 0.7, nik: 0, fik: 1, ffc: 0.3 }), ...(wadeP ? { yaw: d * 0.5, hy: d * 0.5, nik: 0, fik: 0, nS: -0.5, nZ: -d * 0.1, nE: -0.3, fS: -0.15, fE: -0.2, sm: 0.9 } : {}) };
      else if ((onPool || onBeach) && (wadeP || swimP)) {
        // calm in water (pool or ocean): face each other, hug-ready — no puppet swimming
        tgt = { ...tgt,
          yaw: d * 0.55, lean: 0.04, roll: 0,
          hy: d * 0.5, hp: 0.08, hr: -d * 0.08,
          eye: 0.55, sm: 0.85, mo: 0.15, bl: 0.4, sh: 0.008,
          nS: -0.55, nZ: -d * 0.25, nE: -0.55,
          fS: -0.5, fZ: d * 0.22, fE: -0.5,
          nik: 0, fik: 0, nfc: 0.15, ffc: 0.15 };
      }
      else if (swimP) { const A = Math.sin(T * 5.2 + i * 2.1), B = Math.sin(T * 5.2 + Math.PI + i * 2.1);
        tgt = { ...tgt, yaw: d * (0.6 + 0.4 * Math.sin(T * 1.9 + i)), lean: 0.12 * Math.sin(T * 3 + i), roll: 0.1 * Math.sin(T * 2.6 + i), hy: d * 0.4 + Math.sin(T * 1.7 + i) * 0.4, hp: 0.06, hr: 0.14 * Math.sin(T * 2.2 + i), eye: 0.4, sm: 1, mo: 0.5 + 0.3 * Math.sin(T * 6), bl: 0.5, sh: 0.02,
          nS: -1.2 + 0.9 * A, nZ: -d * 0.35, nE: -0.7 + 0.5 * A, fS: -1.2 + 0.9 * B, fZ: d * 0.35, fE: -0.7 + 0.5 * B, nik: 0, fik: 0, nfc: 0.1, ffc: 0.1 }; }
      else if (restP) tgt = { ...tgt, yaw: d * 0.12, hy: d * 0.55, hp: 0.75, hr: -d * 0.12, eye: 0.8, sm: 0.8, bl: 0.35, nS: -0.08, nE: -0.4, fS: -0.1, fE: -0.45, nik: 0, fik: 0 };
      else if (onLounger && g.pose === 'sit') tgt = { ...tgt, lean: onPool ? 0.04 : -tkx.ba, hp: onPool ? 0.1 : 0.1 + tkx.ba * 0.45, yaw: onPool ? d * 0.5 : tgt.yaw, hy: onPool ? d * 0.55 : tgt.hy };
    }
    if (g.sleepy > 0) tgt = { ...tgt, eye: Math.max(0.02, tgt.eye * (1 - 1.2 * g.sleepy)), sm: g.sleepy > 0.7 ? Math.min(tgt.sm, 0.5) : tgt.sm, mo: 0 };   // drowsy / asleep eyes
    const p = cur.current; for (const k in b0) p[k] = D(p[k], tgt[k], k === 'nS' || k === 'hy' || k === 'nik' ? 14 : 9, dt);
    if (i === 1) {   // her entrance: off-screen -> walks in -> turns to face him -> sits down
      if (!get().gfHere) { w.stage = 0; rp.set(x + 7, 0, -0.2); w.s = 1; }
      else if (w.stage === 0) { rp.x -= 1.9 * dt; if (rp.x <= x) { rp.x = x; w.stage = 1; w.turn = 0; } }
      else if (w.stage === 1) { w.turn += dt; if (w.turn > 0.7) w.stage = 2; }
      else if (w.s < 0.03 && !get().gfSeated) set({ gfSeated: true });
    }
    // ---- going places: stand in front, wade, swim, back to the loungers. Short hops slide, longer ones are walked (and they sink into the sea as they go in) ----
    // shower: stand = outside glass door; wade/swim = inside stall (no bench)
    // beach: wade/swim go around loungers — him left, her right (never through the bench)
    const onShower = g.world === 'shower';
    // pool: sit = on tiled edge feet in water; wade/swim = in the water facing each other
    const SPOT: Record<string, [number, number][]> = onShower
      ? {
          stand: [[-0.45, 1.15], [0.4, 1.15]],
          sit: [[-0.45, 1.15], [0.4, 1.15]],
          wade: [[-0.25, -0.55], [0.35, -0.55]],
          swim: [[-0.25, -0.55], [0.35, -0.55]],
        }
      : onPool
      ? {
          // BACK edge on the DECK — never walk across the water surface
          // approach from the sides, sit on the far rim, then step in
          stand: [[-0.4, -4.15], [0.4, -4.15]],
          sit: [[-0.35, -4.15], [0.35, -4.15]],
          wade: [[-0.28, -2.85], [0.28, -2.85]],
          swim: [[-0.22, -2.55], [0.22, -2.55]],
        }
      : { stand: [[-0.7, 0.45], [0.25, 0.45]], wade: [[1.4, -2.7], [2.0, -2.7]], swim: [[1.5, -4.0], [2.05, -4.0]] };
    let gs = SPOT[g.pose]?.[i] ?? (onShower ? [x * 0.45, 1.15] : [x, -0.95]);
    // beach: first step clear of the loungers (z≈-0.95), then head to the water
    if (onBeach && (g.pose === 'wade' || g.pose === 'swim')) {
      const sideX = i === 0 ? -1.75 : 1.55; // him left of benches, her right
      if (rp.z > -1.55) {
        gs = [sideX, Math.min(rp.z - 0.15, -1.35)]; // walk around the side first
      }
    }
    // pool: walk AROUND the water on the side deck, then along the back rim to sit
    // water roughly |x|<3.9, z in [-4.0, 0.8] — stay on |x|>=4.5 until behind the pool
    if (onPool && (g.pose === 'sit' || g.pose === 'stand')) {
      const sideX = i === 0 ? -4.55 : 4.55; // him left deck, her right deck
      const atSide = Math.abs(rp.x) >= 4.2;
      const behindPool = rp.z <= -3.9; // past the water, on the back deck
      if (!behindPool) {
        if (!atSide) {
          // 1) walk sideways onto the deck first (do not cross water)
          gs = [sideX, Math.min(rp.z, 0.6)];
        } else {
          // 2) walk along the side deck toward the back edge
          gs = [sideX, -4.15];
        }
      }
      // 3) once behind the pool, gs stays the real sit/stand spot (move inward on dry deck)
    }
    // pool: when entering water from the edge, step forward from the rim (short path is fine)
    if (onPool && (g.pose === 'wade' || g.pose === 'swim')) {
      // if still on the back deck, first walk to the rim center then in
      if (rp.z < -3.6) {
        gs = [gs[0], -3.5]; // step to the waterline first
      }
    }
    // walkA must be declared BEFORE use (TDZ crash = black screen + rising error count)
    const walkA = i === 1 && get().gfHere && w.stage === 0;
    let walkB = false, faceYaw = 0;
    if ((i === 0 || w.stage === 2) && !bedP) { const dx = gs[0] - rp.x, dz = gs[1] - rp.z, dist = Math.hypot(dx, dz);
      // short slide only when already close on dry ground — never slide across the pool
      const canSlide = dist < 1.2 && w.stage === 2 && !onBeach && !(onPool && (Math.abs(rp.x) < 4.0 && rp.z > -3.95 && rp.z < 0.9));
      if (dist > 0.03) {
        if (canSlide) {
          rp.x = D(rp.x, gs[0], 3.5, dt); rp.z = D(rp.z, gs[1], 3.5, dt);
        } else {
          const spd = walkA ? 1.15 : (onPool ? 1.55 : 1.8);
          const st = Math.min(dist, spd * dt);
          rp.x += dx / dist * st; rp.z += dz / dist * st;
          walkB = true; faceYaw = Math.atan2(dx, dz);
        }
      }
    }
    const zs = -6.5 + 0.5 * (rp.x + 6), depth = onBeach ? clamp((zs - rp.z) / 1.8, 0, 1) : 0;
    // sit: butts on dry rim. wade → upper chest. swim → shoulders
    const poolSink = onPool && (g.pose === 'wade' || g.pose === 'swim') ? (g.pose === 'swim' ? 1.55 : 1.25) : onPool && g.pose === 'sit' ? 0.03 : 0;
    const sinkT = onPool ? poolSink : 1.3 * depth * depth * (3 - 2 * depth);
    // slow damp so waterline climbs gradually as they step in
    w.sink = D(w.sink, sinkT, onPool ? 1.6 : 8, dt); BODY[i].x = rp.x; BODY[i].z = rp.z; BODY[i].sink = w.sink;
    const walking = walkA || walkB, standing = (i === 1 && w.stage < 2) || walkB || standP || wadeP || swimP;
    // pool sit keeps them "seated" (ss→0) so legs can dangle; other sitting uses same
    w.s = D(w.s, standing ? 1 : 0, w.stage === 2 ? 3.5 : 20, dt);
    // pool sit on back edge: face +Z (toward camera / pool interior) so legs hang over the water — that's
    // the rig's normal default-facing direction (yaw 0), same as every other camera-facing seated pose,
    // so no override is needed here (unlike the old right-edge seat, which had to face sideways).
    // pool in-water: face roughly toward camera / each other
    const poolInFace = onPool && (g.pose === 'wade' || g.pose === 'swim') ? (i === 0 ? 0.35 : -0.35) : 0;
    const tyaw = walkA ? -Math.PI / 2 : walkB ? faceYaw : poolInFace;
    const dy = Math.atan2(Math.sin(tyaw - w.yaw), Math.cos(tyaw - w.yaw)); w.yaw += dy * (1 - Math.exp(-7 * dt));
    const prevPh = w.ph;
    // her entrance walk: clearer step cadence
    w.ph += walking ? dt * (walkA ? 5.0 : 5.5) : 0;
    // footstep when a foot plants (phase crosses multiples of PI)
    if (walking && Math.floor(prevPh / Math.PI) !== Math.floor(w.ph / Math.PI)) {
      try { sfx('step'); } catch { /* */ }
    }
    w.lie = D(w.lie, bedP ? 1 : 0, 2.4, dt); const le = w.lie * w.lie * (3 - 2 * w.lie), ss = Math.max(w.s, le);   // le: 0 sitting .. 1 lying down
    N.root.rotation.set(0, w.yaw, le * Math.PI / 2);   // lying on the side: head to the left (headboard), face to the camera
    // no puppet bobbing in pool or ocean — stay calm and close
    if (w.lie > 0.002) rp.set(L(x, BED_X[i], le), BED_Y[i] * le, L(-0.95, BED_Z[i], le)); else rp.y = -w.sink;
    // pool floor-sit: low on the deck floor (not chair-height on a rim), legs over the edge into the water
    const poolSit = onPool && g.pose === 'sit' && !standing;
    // butt mesh sits at pelvis.y + ~0.74, so negative pelvis.y puts them on the floor
    N.pelvis.position.y = (poolSit ? -0.55 : 0.5 * ss) + (walking ? Math.abs(Math.sin(w.ph)) * 0.02 : 0);
    for (const k of [0, 1]) { const ph = k ? Math.PI : 0;
      const pop = long && standP && !walking && k === 0 ? 1 : 0;   // her weight on one leg, the other knee relaxed forward
      if (poolSit) {
        // floor sit: hips low, thighs forward into the pool, knees softly bent, feet in water
        hip[k].current.rotation.x = -0.85 + (k === 0 ? -0.04 : 0.03);
        knee[k].current.rotation.x = 0.35 + (k === 0 ? 0.05 : -0.03);
      } else {
        hip[k].current.rotation.x = L(-Math.PI / 2, 0, ss) - le * 0.25 - (walking ? Math.sin(w.ph + ph) * 0.28 : 0) - pop * 0.32;
        knee[k].current.rotation.x = L(onLounger && !standing ? 0.12 : Math.PI / 2, 0, ss) + le * 0.4 + (walking ? Math.max(0, -Math.sin(w.ph + ph + 0.9)) * 0.42 : 0) + pop * 0.5;
      }
    }
    if (long && standP) N.pelvis.position.x = D(N.pelvis.position.x, walking ? 0 : 0.04, 4, dt); else N.pelvis.position.x = D(N.pelvis.position.x, 0, 6, dt);
    const br = T + i * 0.7, idle = Math.sin(br * 1.6) * 0.012, sw = walking ? Math.sin(w.ph) * 0.5 : 0, torso = N.torso, head = N.head;
    torso.position.x = p.x; torso.position.y = 0.7 + idle * 0.6; torso.rotation.set(p.lean + idle, p.yaw, p.roll + Math.sin(T * 24) * p.sh);
    head.rotation.order = 'YXZ'; head.rotation.set(p.hp + Math.sin(T * 24 + 1) * p.sh * 0.6, p.hy + Math.sin(br * 0.5) * 0.04, p.hr);
    const lg = lag.current; lg.y = D(lg.y, p.hy, 5, dt); lg.p = D(lg.p, p.hp, 5, dt); lg.r = D(lg.r, p.hr, 5, dt);   // hair trails behind head movement
    if (N.hairBack) N.hairBack.rotation.set((lg.p - p.hp) * 1.1 + Math.sin(T * 1.3) * 0.03, (lg.y - p.hy) * 0.9, (lg.r - p.hr) * 0.9);
    // ---- lips find each other (the kiss) ----
    PT[i]!.lip.getWorldPosition(v1); const me = v1.clone(), other = PT[1 - i]!.lip.getWorldPosition(v2).clone();
    if (p.ks > 0.02) { const dl = other.sub(me), len = dl.length(); if (len > 0.001) { dl.multiplyScalar((1 - 0.02 / len) * 0.5 * Math.min(1, 9 * dt) * p.ks);
      torso.getWorldQuaternion(q1); dl.applyQuaternion(q1.invert()); corr.current.add(dl); if (corr.current.length() > 0.16) corr.current.setLength(0.16); } }
    else corr.current.multiplyScalar(Math.exp(-5 * dt));
    head.position.set(corr.current.x, 0.62 + corr.current.y, corr.current.z);
    // ---- arms: hand-set angles blended with "reach a real target" ----
    const o2 = PT[1 - i]!, mine = PT[i]!, act = c.act, live = !!act && t >= 0 && t < ACTS[act].dur;
    const sN = N.armN.getWorldPosition(v1).clone(), bkA = o2.bk[0].getWorldPosition(v2).clone(), bkB = o2.bk[1].getWorldPosition(v3).clone();
    const near = sN.distanceTo(bkA) < sN.distanceTo(bkB), back = (isN: boolean) => (isN === near ? bkA : bkB);
    const target = (isN: boolean): THREE.Vector3 | null => { const g = (n: THREE.Object3D) => n.getWorldPosition(new THREE.Vector3());
      if (standP && !live) return isN ? (long ? g(N.hairPt) : null) : g(N.hipF);   // standing pretty: hand on hip, other hand to her hair
      if (!live) return null;
      if (act === 'hug') return back(isN);
      if (act === 'kiss') return isN ? (i === 0 ? back(true) : g(o2.jaw)) : null;
      if (act === 'tease') return isN && i === 1 ? g(o2.nose) : null;
      if (act === 'slap') return isN ? (i === 1 ? g(o2.sh) : g(mine.sh)) : null;
      if (act === 'flower') return isN && i === 0 ? g(o2.jaw).add(new THREE.Vector3(0, 0.22, -0.05)) : null; // his hand to her hair
      return null; };
    for (const isN of [true, false]) { const k = isN ? 'n' : 'f', sh = N[isN ? 'armN' : 'armF'], el = N[isN ? 'elN' : 'elF'], wt = clamp(p[k + 'ik'], 0, 1), tp = wt > 0.01 ? target(isN) : null;
      fk.setFromEuler(eu.set(p[k + 'S'] + sw * (isN ? 1 : -1), 0, p[k + 'Z'])); let e = p[k + 'E'];
      if (tp) { reach(sh, torso, tp, isN ? d : -d, ik); sh.quaternion.copy(fk).slerp(ik.q, wt); e = L(e, ik.e, wt); } else sh.quaternion.copy(fk);
      el.rotation.set(e, 0, 0); N[k + 'Fin'].rotation.x = -p[k + 'fc'] * 1.4; N[k + 'Idx'].rotation.x = -p[k + 'ic'] * 1.4; }
    N.head.getWorldPosition(HEADW[i]);
    // no auto-splash while floating — only when she chooses to splash
    // ---- face: repaint the drawn face only when the expression actually changed ----
    if (T > blinkAt.current + 0.13) blinkAt.current = T + 2.5 + Math.random() * 3;
    const open = Math.min(1.2, p.eye) * (T > blinkAt.current && T < blinkAt.current + 0.13 ? 0.05 : 1), mo = Math.max(p.mo, p.tg * 0.5);
    const key = [open, p.sm, mo, p.mp, p.tg, p.bl, p.br, p.bt, p.bs].map(v => Math.round(v * 16)).join(',');
    if (key !== face.key) { face.key = key; paintFace(face.ctx, { open, sm: p.sm, mo, mp: p.mp, tg: p.tg, bl: p.bl, br: p.br, bt: p.bt, bs: p.bs }, !!long, eyeC, hc); face.tex.needsUpdate = true; }
    faceMat.color.setScalar(1 - 0.38 * tk.v);
    const pk = clamp((p.mp - 0.1) * 3, 0, 1), lb = N.lipBump; lb.scale.set(0.03 * (1 - 0.3 * p.mp) * pk + 0.0001, 0.012 * pk + 0.0001, (0.012 + 0.012 * p.mp) * pk + 0.0001); lb.position.z = 0.165 + 0.006 * p.mp;
  });
  const limb = (s: 'n' | 'f') => {
    const ts = s === 'n' ? -d : d;
    // when undressed, whole arm is continuous skin (no top/skin color break)
    const armC = naked ? skin : top;
    return (
    <group position={[(s === 'n' ? d : -d) * 0.27, 0.52, 0]} ref={o(s === 'n' ? 'armN' : 'armF')}>
      {/* shoulder ball — skin when undressed, matches sleeve when clothed */}
      <TE p={[0, 0.02, 0]} s={[0.07, 0.068, 0.068]} c={armC} o={0} />
      <TC p={[0, -0.13, 0]} r={0.06} l={0.2} c={armC} o={0.006} />
      <group position={[0, -0.26, 0]} ref={o(s === 'n' ? 'elN' : 'elF')}>
        <TE p={[0, 0.02, 0]} s={[0.052, 0.052, 0.052]} c={skin} o={0} />
        <TC p={[0, -0.11, 0]} r={0.048} l={0.16} c={skin} o={0.005} />
        <group position={[0, -0.24, 0]}>
          {/* wrist ball */}
          <TE p={[0, 0.02, 0]} s={[0.038, 0.038, 0.038]} c={skin} o={0.002} />
          <TE p={[0, -0.04, 0]} s={[0.042, 0.05, 0.024]} c={skin} o={0.004} />
          <TE p={[ts * 0.04, -0.035, 0.012]} s={[0.014, 0.032, 0.014]} c={skin} />
          <group ref={o(s + 'Idx')} position={[ts * 0.028, -0.085, 0]}><TC p={[0, -0.03, 0]} r={0.0105} l={0.045} c={skin} /></group>
          <group ref={o(s + 'Fin')} position={[0, -0.085, 0]}>{[0.009, -0.009, -0.027].map(fx => <TC key={fx} p={[ts * fx, -0.028, 0]} r={0.0105} l={0.036} c={skin} />)}</group>
        </group>
      </group>
    </group>
  ); };
  return (
    <group ref={o('root')} position={i === 1 ? [x + 7, 0, -0.2] : [x, 0, -0.95]}>
      <group ref={o('pelvis')}>
        <TE p={[0, swim || naked ? 0.74 : 0.76, 0.02]} s={swim || naked ? (long ? [0.22, 0.12, 0.18] : [0.26, 0.14, 0.2]) : [0.25, 0.16, 0.19]} c={naked ? skin : pants} o={swim || naked ? 0.004 : 0} />
        {[0, 1].map(k => <group key={k} ref={hip[k]} position={[k ? 0.1 : -0.1, 0.73, 0.02]}>
          {/* hip joint — skin when undressed / swim / beach legs, else matches pants */}
          <TE p={[0, 0.02, 0]} s={[0.088, 0.082, 0.082]} c={naked || beach || swim ? skin : pants} o={0} />
          {naked ? (
            /* undressed: continuous skin leg, overlapped capsules */
            <><TC p={[0, -0.18, 0]} r={long ? 0.09 : 0.082} l={0.28} c={skin} o={0.005} />
              <TE p={[0, -0.42, 0]} s={[0.07, 0.07, 0.07]} c={skin} o={0.003} />
              <TC p={[0, -0.5, 0]} r={0.068} l={0.18} c={skin} o={0.005} />
              <TE p={[0, -0.62, 0]} s={[0.065, 0.065, 0.065]} c={skin} /></>
          ) : beach || swim ? (
            <><TC p={[0, -0.15, 0]} r={long ? 0.092 : 0.084} l={0.22} c={swim && long ? skin : pants} o={0.006} />
              <TE p={[0, -0.32, 0]} s={[0.07, 0.07, 0.07]} c={skin} o={0.003} />
              <TC p={[0, -0.45, 0]} r={0.066} l={0.2} c={skin} o={0.005} />
              <TE p={[0, -0.58, 0]} s={[0.064, 0.064, 0.064]} c={skin} /></>
          ) : (
            <><TC p={[0, -0.28, 0]} r={0.078} l={0.42} c={pants} o={0.006} />
              <TE p={[0, -0.57, 0]} s={[0.07, 0.07, 0.07]} c={pants} /></>
          )}
          <group ref={knee[k]} position={[0, -0.57, 0]}>
            {/* knee ball — skin when bare legs */}
            <TE p={[0, 0.02, 0]} s={[0.06, 0.06, 0.06]} c={naked || beach || swim ? skin : pants} o={0} />
            <TC p={[0, -0.32, 0]} r={0.058} l={0.52} c={naked || beach || swim ? skin : pants} o={0.006} />
            <TE p={[0, -0.69, 0.07]} s={[0.075, 0.055, 0.14]} c={naked || swim ? skin : beach ? '#d9b27a' : '#fbf8f4'} o={0.006} />{!swim && !naked && (() => {
            // slippers / sandals / shoes by world
            const isBeach = world === 'beach' || outfit === 'beach';
            const isGarden = world === 'garden';
            const isKitchen = world === 'kitchen';
            const isShower = world === 'shower';
            if (isShower) return null; // barefoot in shower
            if (isBeach) {
              // open sandals
              return <><TE p={[0, -0.715, 0.06]} s={[0.07, 0.018, 0.13]} c={long ? '#f0c4a8' : '#5a4030'} />
                <TE p={[0, -0.7, 0.02]} s={[0.055, 0.012, 0.02]} c={long ? '#e8a090' : '#3a2a20'} />
                <TE p={[0.0, -0.7, 0.11]} s={[0.05, 0.01, 0.015]} c={long ? '#e8a090' : '#3a2a20'} /></>;
            }
            if (isGarden) {
              // soft sneakers
              return <TE p={[0, -0.72, 0.07]} s={[0.08, 0.028, 0.145]} c={long ? '#f5f0e8' : '#2a2a2e'} />;
            }
            if (isKitchen) {
              // house slippers
              return <TE p={[0, -0.715, 0.06]} s={[0.082, 0.022, 0.13]} c={long ? '#d4a0b0' : '#6a5a4a'} />;
            }
            // bedroom default: cozy slippers
            return <TE p={[0, -0.72, 0.07]} s={[0.078, 0.025, 0.142]} c={long ? '#e8808a' : '#4a6a8a'} />;
          })()}</group></group>)}
        <group ref={o('torso')} position={[0, 0.7, 0]}>
          <mesh geometry={torsoG} scale={[1.15, 1, 0.78]} castShadow>{toon(top)}<Outlines thickness={0.007} color={INK} /></mesh>
          {floral && <mesh geometry={torsoG} scale={[1.16, 1.005, 0.79]}><meshLambertMaterial map={floral} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} /></mesh>}
          <TC p={[0, 0.63, 0]} r={0.048} l={0.08} c={skin} />
          <TE p={[0, 0.58, 0]} s={[0.08, 0.06, 0.07]} c={skin} o={0.002} />
          {!swim && <mesh position={[0, 0.575, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.85, 1]}><torusGeometry args={[0.082, 0.016, 8, 24]} />{toon(trim)}</mesh>}
          {swim && long && !naked && <>{[-1, 1].map(sx => <TE key={sx} p={[sx * 0.075, 0.43, 0.13]} s={[0.072, 0.062, 0.04]} c={pants} o={0.004} rot={[-0.2, sx * 0.3, sx * 0.25]} />)}<TE p={[0, 0.425, 0.158]} s={[0.018, 0.02, 0.015]} c={tl(pants, 0.8)} />
            <mesh position={[0, 0.57, 0.02]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.85, 1]}><torusGeometry args={[0.085, 0.005, 6, 24]} />{toon(pants)}</mesh></>}
          {swim && !long && !naked && <>{[-1, 1].map(sx => <TE key={sx} p={[sx * 0.075, 0.405, 0.15]} s={[0.075, 0.045, 0.02]} c={tl(skin, 0.88)} rot={[0, 0, sx * 0.1]} />)}<TE p={[0, 0.25, 0.16]} s={[0.012, 0.1, 0.01]} c={tl(skin, 0.86)} />{[0.31, 0.2, 0.09].map(ay => <TE key={ay} p={[0, ay, 0.158]} s={[0.07, 0.008, 0.01]} c={tl(skin, 0.88)} />)}</>}
          {swim ? null : long ? <><TE p={[-0.035, 0.5, 0.15]} s={[0.04, 0.03, 0.015]} c="#ff6f8f" rot={[0, 0, 0.5]} o={0.003} /><TE p={[0.035, 0.5, 0.15]} s={[0.04, 0.03, 0.015]} c="#ff6f8f" rot={[0, 0, -0.5]} o={0.003} /><TE p={[0, 0.5, 0.155]} s={[0.02, 0.02, 0.015]} c="#e04a6e" /></>
            : <TE p={[0, 0.5, 0.15]} s={[0.025, 0.07, 0.012]} c={trim} />}
          <group ref={o('sh')} position={[d * 0.28, 0.56, 0]} /><group ref={o('hipF')} position={[-d * 0.2, 0.1, 0.07]} /><group ref={o('bk0')} position={[-0.2, 0.3, -0.13]} /><group ref={o('bk1')} position={[0.2, 0.3, -0.13]} />
          {limb('n')}{limb('f')}
          <group ref={o('head')} position={[0, 0.62, 0]}>
            <mesh geometry={headG} position={[0, 0.28, 0]} scale={HS} castShadow>{toon(skin, 0.14)}<Outlines thickness={0.007 / 0.26} color={INK} /></mesh>
            <mesh geometry={patchG} position={[0, 0.28, 0]} scale={[HS[0] * 1.004, HS[1] * 1.004, HS[2] * 1.004]} material={faceMat} />
            {beach && <Hat band={long ? '#ff7f7f' : '#3a6ea5'} />}
            <TE p={[-0.262, 0.25, 0]} s={[0.03, 0.05, 0.035]} c={skin} /><TE p={[0.262, 0.25, 0]} s={[0.03, 0.05, 0.035]} c={skin} />
            <TE p={[0, 0.164, 0.218]} s={[0.016, 0.02, 0.02]} c={skin} /><mesh ref={o('lipBump')} position={[0, 0.08, 0.165]} scale={0.0001}><sphereGeometry args={[1, 14, 10]} />{toon(lipC, 0.2)}</mesh>
            <group ref={o('hairPt')} position={[d * 0.3, 0.36, 0.06]} /><group ref={o('lipPt')} position={[0, 0.08, 0.17]} /><group ref={o('nose')} position={[0, 0.164, 0.232]} /><group ref={o('jaw')} position={[0, 0.2, -0.2]} />
            {/* hair: cap with an anime highlight ring, a fringe of pointed locks, side locks; her long trailing back hair; his spikes + ahoge */}
            <group position={[0, 0.285, -0.012]} rotation={[-0.55, 0, 0]} scale={[0.285, 0.31, 0.28]}>
              <mesh castShadow><sphereGeometry args={[1, 40, 28, 0, Math.PI * 2, 0, 1.9]} />{toon(hc, 0.07)}<Outlines thickness={0.007 / 0.29} color={INK} /></mesh>
              <mesh scale={1.012}><sphereGeometry args={[1, 40, 10, Math.PI / 2 - 1.4, 2.8, 0.55, 0.2]} /><meshBasicMaterial color={shine} transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} /></mesh></group>
            {/* soft fringe */}
            {(long
              ? [-0.18, -0.12, -0.06, 0, 0.06, 0.12, 0.18]
              : [-0.14, -0.07, 0, 0.07, 0.14]
            ).map((fx, k) => <Lock key={`f${fx}`} p={[fx, long ? 0.36 - Math.abs(fx) * 0.08 : 0.365 - Math.abs(fx) * 0.1, long ? 0.2 - fx * fx * 0.9 : 0.2 - fx * fx * 1.2]} rot={[long ? 0.28 : 0.35, 0, -fx * (long ? 1.1 : 1.4)]} len={long ? 0.12 : 0.09} w={long ? 0.048 : 0.042} c={hc} />)}
            {/* side locks */}
            <Lock p={[-0.255, 0.33, 0.03]} rot={[0.08, 0, 0.1]} len={long ? 0.38 : 0.12} w={0.05} c={hc} />
            <Lock p={[0.255, 0.33, 0.03]} rot={[0.08, 0, -0.1]} len={long ? 0.38 : 0.12} w={0.05} c={hc} />
            {/* boy: well-combed top + neat back (no spikes / ahoge) */}
            {!long && <>
              {[-0.1, -0.04, 0.04, 0.1].map((fx) => <Lock key={`t${fx}`} p={[fx, 0.52, -0.04]} rot={[-0.55, 0, -fx * 0.8]} len={0.07} w={0.055} c={hc} />)}
              {[-0.12, 0, 0.12].map(bx => <Lock key={`b${bx}`} p={[bx, 0.22, -0.2]} rot={[-0.05, 0, bx * 0.8]} len={0.14} w={0.06} c={hc} />)}
            </>}
            {/* girl: long smooth back + soft side fall */}
            {long && <group ref={o('hairBack')} position={[0, 0.28, -0.1]}>
              {[-0.16, -0.08, 0, 0.08, 0.16].map((bx, k) => <Lock key={bx} p={[bx * 0.9, 0.02, -0.04 - (k % 2) * 0.02]} rot={[0.12, 0, bx * 0.35]} len={0.72 + Math.abs(bx) * 0.05} w={0.09} c={hc} o={0.005} />)}
              {[-0.12, 0, 0.12].map((bx) => <Lock key={`m${bx}`} p={[bx, -0.15, -0.02]} rot={[0.2, 0, bx * 0.25]} len={0.55} w={0.07} c={hc} o={0.004} />)}
            </group>}
            {long && <><Lock p={[-0.24, 0.16, 0.06]} rot={[0.15, 0, 0.04]} len={0.48} w={0.045} c={hc} /><Lock p={[0.24, 0.16, 0.06]} rot={[0.15, 0, -0.04]} len={0.48} w={0.045} c={hc} /></>}
            {clip && <><TE p={[0.19, 0.5, 0.1]} s={[0.04, 0.022, 0.016]} c="#ff7fa0" rot={[0, 0, 0.5]} o={0.003} /><TE p={[0.23, 0.47, 0.1]} s={[0.04, 0.022, 0.016]} c="#ff7fa0" rot={[0, 0, -0.5]} o={0.003} /></>}
            {long && <HairGajra />}
          </group></group>
      </group>
    </group>);
}