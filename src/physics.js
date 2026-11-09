// The ball: clubs, flight through the air (drag, backspin lift, side spin from
// the snap, wind), bouncing, rolling down slopes, trees, water and the hole.
// Units are yards and seconds; z is height above the sea, as the terrain is.

import { lieAt, groundAt, groundSlope, treesNear } from './world.js';

export const G = 10.73;          // gravity, yards / s^2
export const MPH = 0.4889;       // yards / s per mph
const DRAG = 0.0040;             // per yard
const LIFT = 0.0034;             // per yard, at full backspin
const DT = 1 / 120;
export const CUP_R = 0.06;       // yards (a 4.25 inch hole is 0.059)

export const CLUBS = [
  { key: '1W', name: 'DRIVER', carry: 245, launch: 11, spin: 0.8, check: 0 },
  { key: '3W', name: '3 WOOD', carry: 225, launch: 12, spin: 0.85, check: 0.02 },
  { key: '5W', name: '5 WOOD', carry: 208, launch: 14, spin: 0.9, check: 0.05 },
  { key: '3I', name: '3 IRON', carry: 192, launch: 13, spin: 0.92, check: 0.08 },
  { key: '4I', name: '4 IRON', carry: 182, launch: 14, spin: 0.95, check: 0.1 },
  { key: '5I', name: '5 IRON', carry: 172, launch: 15.5, spin: 1, check: 0.14 },
  { key: '6I', name: '6 IRON', carry: 161, launch: 17, spin: 1.03, check: 0.18 },
  { key: '7I', name: '7 IRON', carry: 150, launch: 19, spin: 1.06, check: 0.22 },
  { key: '8I', name: '8 IRON', carry: 138, launch: 21, spin: 1.1, check: 0.27 },
  { key: '9I', name: '9 IRON', carry: 125, launch: 24, spin: 1.14, check: 0.32 },
  { key: 'PW', name: 'P WEDGE', carry: 110, launch: 27, spin: 1.18, check: 0.38 },
  { key: 'SW', name: 'S WEDGE', carry: 88, launch: 33, spin: 1.22, check: 0.45 },
  { key: 'LW', name: 'L WEDGE', carry: 62, launch: 40, spin: 1.25, check: 0.5 },
  { key: 'PT', name: 'PUTTER', carry: 0, launch: 0, spin: 0, check: 0, putter: true },
];
export const PUTTER = CLUBS.length - 1;

// How each surface treats a ball: bounce (rest), speed kept along the ground on a
// bounce (keep), rolling friction (mu), and what a full shot from it gets (lie).
export const GROUND = {
  tee: { rest: 0.3, keep: 0.62, mu: 0.13, lie: [1, 1] },
  fairway: { rest: 0.3, keep: 0.6, mu: 0.15, lie: [1, 1] },
  fringe: { rest: 0.28, keep: 0.55, mu: 0.12, lie: [0.95, 0.98] },
  green: { rest: 0.22, keep: 0.5, mu: 0.068, lie: [1, 1] },
  rough: { rest: 0.12, keep: 0.32, mu: 0.4, lie: [0.76, 0.9] },
  trees: { rest: 0.12, keep: 0.25, mu: 0.5, lie: [0.5, 0.68] },
  waste: { rest: 0.25, keep: 0.5, mu: 0.25, lie: [0.82, 0.92] },
  bunker: { rest: 0.02, keep: 0.08, mu: 2.2, lie: [0.66, 0.78] },
  water: { rest: 0, keep: 0, mu: 9, lie: [0, 0] },
  oob: { rest: 0.3, keep: 0.6, mu: 0.13, lie: [1, 1] },
};
export const LIE_NAMES = {
  tee: 'TEE', fairway: 'FAIRWAY', fringe: 'FRINGE', green: 'GREEN', rough: 'ROUGH', trees: 'TREES',
  waste: 'WASTE GROUND', bunker: 'BUNKER', water: 'WATER', oob: 'OUT OF BOUNDS',
};

// Per tree sprite: where its canopy starts (fraction of height) and its radius (fraction of height).
const TREE_SHAPE = {
  'tree-palm': [0.72, 0.28], 'tree-cactus': [0.05, 0.12], 'tree-poplar': [0.15, 0.12], 'tree-fir': [0.1, 0.2],
  'tree-snowpine': [0.12, 0.22], 'tree-pine': [0.55, 0.2], 'bush-gorse': [0, 0.5], 'bush-green': [0, 0.5],
};

// One step of flight. `s` is the ball state; spin decays as it flies.
function flyStep(s, wind, dt) {
  const ax0 = s.vx - wind.x, ay0 = s.vy - wind.y, az0 = s.vz;
  const sp = Math.hypot(ax0, ay0, az0);
  // Spin axis: horizontal and square to the line of flight, tilted by side spin.
  const hl = Math.hypot(s.vx, s.vy) || 1;
  const rxh = s.vy / hl, ryh = -s.vx / hl; // right of the line of flight
  const ct = Math.cos(s.tilt), st = Math.sin(s.tilt);
  const axx = rxh * ct, axy = ryh * ct, axz = st;
  // Lift = axis x air velocity.
  const lx = axy * az0 - axz * ay0, ly = axz * ax0 - axx * az0, lz = axx * ay0 - axy * ax0;
  const kL = LIFT * s.spin * sp;
  s.vx += (-DRAG * sp * ax0 + kL * lx) * dt;
  s.vy += (-DRAG * sp * ay0 + kL * ly) * dt;
  s.vz += (-G - DRAG * sp * az0 + kL * lz) * dt;
  s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
  s.spin *= Math.exp(-dt / 6);
}

// Carry on flat, calm ground for a ball speed, used to set the speed for a club and power.
function flatCarry(club, speed) {
  const a = (club.launch * Math.PI) / 180;
  const s = { x: 0, y: 0, z: 0, vx: 0, vy: speed * Math.cos(a), vz: speed * Math.sin(a), spin: club.spin, tilt: 0 };
  const calm = { x: 0, y: 0 };
  for (let i = 0; i < 4000; i++) {
    flyStep(s, calm, DT);
    if (s.z <= 0 && s.vz < 0) return s.y;
  }
  return s.y;
}

const speedCache = new Map();
// Ball speed that carries `carry` yards with this club.
export function speedFor(club, carry) {
  const key = `${club.key}:${Math.round(carry)}`;
  if (speedCache.has(key)) return speedCache.get(key);
  let lo = 5, hi = 140;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (flatCarry(club, mid) < carry) lo = mid; else hi = mid;
  }
  speedCache.set(key, (lo + hi) / 2);
  return (lo + hi) / 2;
}

// Where in a lie's range a ball sits, the same for the same spot.
export function lieFactor(lie, x, y) {
  const [a, b] = GROUND[lie]?.lie ?? [1, 1];
  const u = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
  return a + (b - a) * u;
}

function hitTree(world, s) {
  for (const t of treesNear(world, s.x, s.y)) {
    if (!t.solid && s.z > t.h + t.height) continue;
    const [c0, rf] = TREE_SHAPE[t.name] ?? [0.3, 0.3];
    const dz = s.z - t.h;
    if (dz < 0 || dz > t.height * 0.97) continue;
    const d = Math.hypot(s.x - t.x, s.y - t.y);
    const canopy = dz > t.height * c0 && d < t.height * rf * (0.7 + 0.3 * Math.sin(Math.PI * (dz / t.height)));
    const trunk = d < 0.35;
    if (canopy || trunk) return t;
  }
  return null;
}

// Play a full shot. Returns { path: [{x,y,z}] sampled every 1/60 s, end, result,
// carry, hitTree, landed }. result: 'rest' | 'water' | 'oob' | 'holed'.
export function playShot(world, from, { club, power, yaw, snap, wind, rng, lie }) {
  const hole = world.hole;
  const lf = lieFactor(lie, from.x, from.y);
  let carry = club.carry * power * lf;
  if (club.key === '1W' && lie !== 'tee') carry *= lie === 'fairway' ? 0.92 : 0.75;
  if ((lie === 'bunker') && (club.key === 'SW' || club.key === 'LW')) carry = club.carry * power * Math.min(1, lf + 0.2);
  const speed = speedFor(club, Math.max(3, carry));
  const dir = yaw + snap.push;
  const a = (club.launch * Math.PI) / 180 * (lie === 'trees' ? 0.7 : 1);
  const s = {
    x: from.x, y: from.y, z: groundAt(world, from.x, from.y) + 0.02,
    vx: speed * Math.cos(a) * Math.sin(dir), vy: speed * Math.cos(a) * Math.cos(dir), vz: speed * Math.sin(a),
    spin: club.spin * (lie === 'rough' || lie === 'trees' ? 0.6 : 1), tilt: snap.tilt,
  };
  const path = [{ x: s.x, y: s.y, z: s.z }];
  let treeHit = null, steps = 0;
  // In the air.
  for (; steps < 120 * 20; steps++) {
    flyStep(s, wind, DT);
    if (steps % 2 === 1) path.push({ x: s.x, y: s.y, z: s.z });
    const g = groundAt(world, s.x, s.y);
    if (!treeHit && path.length > 6) {
      const t = hitTree(world, s);
      if (t) {
        treeHit = t;
        const sp = Math.hypot(s.vx, s.vy) * (0.08 + 0.15 * rng());
        const ang = Math.atan2(s.vx, s.vy) + Math.PI + (rng() - 0.5) * 2.2;
        s.vx = Math.sin(ang) * sp; s.vy = Math.cos(ang) * sp; s.vz = Math.min(0, s.vz) * 0.2; s.spin = 0;
      }
    }
    if (s.z <= g && s.vz < 0) { s.z = g; break; }
  }
  const landed = { x: s.x, y: s.y };
  const out = bounceAndRoll(world, s, path, club, rng);
  out.carry = Math.hypot(landed.x - from.x, landed.y - from.y);
  out.landed = landed;
  out.hitTree = !!treeHit;
  return out;
}

// After the ball comes down: bounces, then rolls. Mutates s, extends path.
function bounceAndRoll(world, s, path, club, rng) {
  const hole = world.hole;
  let bounces = 0;
  for (;;) {
    const lie = lieAt(world, s.x, s.y);
    if (lie === 'water') return { path, end: { x: s.x, y: s.y }, result: 'water', lie };
    if (lie === 'oob') return { path, end: { x: s.x, y: s.y }, result: 'oob', lie };
    const gr = GROUND[lie];
    const vh = Math.hypot(s.vx, s.vy);
    // Holed on the fly or first bounce: rare, but lovely.
    if (Math.hypot(s.x - hole.pin.x, s.y - hole.pin.y) < CUP_R && Math.abs(s.vz) < 12 && vh < 6) {
      path.push({ x: hole.pin.x, y: hole.pin.y, z: groundAt(world, hole.pin.x, hole.pin.y) - 0.05 });
      return { path, end: { x: hole.pin.x, y: hole.pin.y }, result: 'holed', lie: 'green' };
    }
    let keep = gr.keep * Math.max(0.05, 1 - club.check * (bounces === 0 ? 1 : 0.5) * (lie === 'green' || lie === 'fringe' ? 1.9 : 1.5));
    s.vx *= keep; s.vy *= keep;
    s.vz = -s.vz * gr.rest;
    bounces++;
    if (s.vz < 1.6) break;
    // Hop.
    const wind0 = { x: 0, y: 0 };
    s.spin = 0; s.tilt = 0;
    for (let i = 0; i < 2000; i++) {
      flyStep(s, wind0, DT);
      if (i % 2 === 1) path.push({ x: s.x, y: s.y, z: s.z });
      const g = groundAt(world, s.x, s.y);
      if (s.z <= g && s.vz < 0) { s.z = g; break; }
    }
  }
  return roll(world, s, path, rng);
}

// Roll along the ground until the ball stops, drops, or finds water or out of bounds.
export function roll(world, s, path, rng) {
  const hole = world.hole;
  const dt = 1 / 120;
  let vx = s.vx, vy = s.vy, x = s.x, y = s.y;
  let lipped = false;
  for (let i = 0; i < 120 * 40; i++) {
    const lie = lieAt(world, x, y);
    if (lie === 'water') return { path, end: { x, y }, result: 'water', lie };
    if (lie === 'oob') return { path, end: { x, y }, result: 'oob', lie };
    const mu = GROUND[lie].mu;
    const sl = groundSlope(world, x, y);
    const sp = Math.hypot(vx, vy);
    const gx = -G * sl.x * 0.85, gy = -G * sl.y * 0.85; // a rolling ball feels about 5/7 of the slope; a touch more reads better
    // The hole.
    const dh = Math.hypot(x - hole.pin.x, y - hole.pin.y);
    if (dh < CUP_R) {
      if (sp < 1.45) {
        path.push({ x: hole.pin.x, y: hole.pin.y, z: groundAt(world, hole.pin.x, hole.pin.y) - 0.05 });
        return { path, end: { x: hole.pin.x, y: hole.pin.y }, result: 'holed', lie: 'green' };
      }
      if (!lipped && sp < 2.6) {
        lipped = true;
        const ang = Math.atan2(vx, vy) + (rng() < 0.5 ? 1 : -1) * (0.5 + rng() * 0.6);
        vx = Math.sin(ang) * sp * 0.55; vy = Math.cos(ang) * sp * 0.55;
      }
    }
    if (sp < 0.03) {
      const pull = Math.hypot(gx, gy);
      if (pull < mu * G * 1.35) break;
      vx += gx * dt; vy += gy * dt;
    } else {
      const fr = mu * G;
      const ox = vx, oy = vy;
      vx += (gx - (fr * vx) / sp) * dt;
      vy += (gy - (fr * vy) / sp) * dt;
      // Friction mustn't send the ball backwards.
      if (vx * ox + vy * oy < 0 && sp < fr * dt * 2) { vx = 0; vy = 0; }
    }
    x += vx * dt; y += vy * dt;
    if (i % 2 === 1) path.push({ x, y, z: groundAt(world, x, y) });
  }
  return { path, end: { x, y }, result: 'rest', lie: lieAt(world, x, y) };
}

// A putt (or a putter from off the green): straight off the face, rolling from the start.
export function playPutt(world, from, { yaw, distance, snap, rng }) {
  const lie = lieAt(world, from.x, from.y);
  const mu = GROUND[lie === 'green' ? 'green' : lie]?.mu ?? 0.13;
  // Speed that would roll `distance` yards on the flat, on the green's friction.
  const v0 = Math.sqrt(2 * GROUND.green.mu * G * Math.max(0.1, distance)) * (lie === 'green' ? 1 : Math.sqrt(mu / GROUND.green.mu) * 0.92);
  const dir = yaw + snap.push;
  const s = { x: from.x, y: from.y, vx: Math.sin(dir) * v0, vy: Math.cos(dir) * v0 };
  const path = [{ x: from.x, y: from.y, z: groundAt(world, from.x, from.y) }];
  const out = roll(world, s, path, rng);
  out.carry = 0;
  out.landed = from;
  return out;
}

// Where to drop after water: back along the path to dry land, a couple of yards short.
export function dropFromWater(world, path, from) {
  let k = path.length - 1;
  while (k > 0 && lieAt(world, path[k].x, path[k].y) === 'water') k--;
  // Step back a little further so the drop isn't on the edge.
  const p = path[k];
  const dx = from.x - p.x, dy = from.y - p.y, d = Math.hypot(dx, dy) || 1;
  for (let back = 2; back < 40; back += 1) {
    const q = { x: p.x + (dx / d) * back, y: p.y + (dy / d) * back };
    const l = lieAt(world, q.x, q.y);
    if (l !== 'water' && l !== 'oob' && l !== 'bunker') return q;
  }
  return { ...from };
}
