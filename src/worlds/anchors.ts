import * as THREE from 'three';
// Screen positions (px) of their heads, written by the 3D scene every frame and read by the speech bubbles. tk: 0 = day, 1 = night.
export const anch = { him: { x: 0, y: 0 }, her: { x: 0, y: 0 }, mid: { x: 0, y: 0 } };
export const tk = { v: 0, l: 1, b: 0 };   // v: 0 day / 1 night, l: 1 lamp lit / 0 lamp off, b: 0 sitting / 1 lying in bed

export const tkx = { d: 0, ba: 0.55 };   // d: 0 day / 1 dusk (beach sky), ba: lounger backrest angle (rad from upright)
export const HEADW = [new THREE.Vector3(), new THREE.Vector3()];     // where each head is in the world (bubbles follow it when they walk about)
export const BODY = [{ x: 0, z: 0, sink: 0 }, { x: 0, z: 0, sink: 0 }];   // root position + how deep in the water
export const FX: { q: [number, number, number, number][] } = { q: [] };   // splash requests: x, y, z, strength

export const dsc = { v: 0 };   // 0 = normal room light, 1 = disco mode (dimmed room); written by Scene every frame
export const mood = { c: new THREE.Color('#ffbf70'), w: 0 };   // bedroom mood light: current colour + how strongly it is applied (0..1)
export const wet = { v: 0 };   // 0 = dry, 1 = rainy weather (dims light, greys the sky); written by Scene every frame
