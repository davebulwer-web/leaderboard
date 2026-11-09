// Turns one generated hole into a world the 3D view can draw quickly: a grid,
// one yard to a cell, of what the ground is and how high it is, plus every
// tree and bush standing on it. Hole coordinates are the generator's: yards,
// tee at (0, 0), playing up +y, with +x to the golfer's right.

import { surfaceAt, holeBounds, project } from './gen/course-generator.js';
import { heightAt } from './gen/terrain.js';

export const SURF_NAMES = ['trees', 'rough', 'fairway', 'fringe', 'green', 'tee', 'bunker', 'water', 'waste', 'copse', 'sea', 'beach', 'oob'];
const SURF_INDEX = Object.fromEntries(SURF_NAMES.map((n, i) => [n, i]));
export const S_OOB = SURF_INDEX.oob;
// What a drawn surface plays as.
const PLAYS_AS = { copse: 'trees', sea: 'water', beach: 'bunker' };

const MARGIN = 45; // yards of woods kept round the hole
const TREE_STEP = 5; // yards between places a tree may stand

function hash2(i, j, k = 0) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export { hash2 };

function pickWeighted(list, u) {
  const total = list.reduce((t, e) => t + e[1], 0);
  let acc = 0;
  for (const e of list) { acc += e[1] / total; if (u <= acc) return e; }
  return list[list.length - 1];
}

export function buildWorld(hole, look) {
  const b = holeBounds(hole, MARGIN);
  const x0 = b.minX, y0 = b.minY, nx = b.maxX - b.minX, ny = b.maxY - b.minY;
  const surf = new Uint8Array(nx * ny);
  const hgt = new Float32Array(nx * ny);
  const stripe = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const p = { x: x0 + i + 0.5, y: y0 + j + 0.5 };
      const s = SURF_INDEX[surfaceAt(hole, p, true)];
      const k = j * nx + i;
      surf[k] = s;
      hgt[k] = heightAt(hole, p);
      if (s === 2 || s === 4 || s === 3 || s === 5) {
        const pr = project(hole.line, p);
        stripe[k] = s === 2 ? Math.floor(pr.s / 9) & 1 : Math.floor((pr.s + 50) / 3) & 1;
      }
    }
  }

  const world = { hole, look, x0, y0, nx, ny, surf, hgt, stripe, trees: [], bushes: [] };

  // Trees on a jittered lattice through the woods; the odd lone tree and bush
  // in the rough, kept clear of the short grass.
  const seed = hole.seed;
  const sparse = look.sparse ? 0.4 : 0.85;
  const shortGrassNear = (x, y, r) => {
    for (let a = 0; a < 8; a++) {
      const s = surfIdxAt(world, x + Math.cos(a * 0.785) * r, y + Math.sin(a * 0.785) * r);
      if (s === 2 || s === 4 || s === 3 || s === 5 || s === 6 || s === 7) return true;
    }
    return false;
  };
  for (let gy = Math.floor(y0 / TREE_STEP); gy * TREE_STEP < y0 + ny; gy++) {
    for (let gx = Math.floor(x0 / TREE_STEP); gx * TREE_STEP < x0 + nx; gx++) {
      const x = gx * TREE_STEP + (hash2(gx, gy, seed) - 0.5) * TREE_STEP * 0.9;
      const y = gy * TREE_STEP + (hash2(gx, gy, seed + 1) - 0.5) * TREE_STEP * 0.9;
      const s = surfIdxAt(world, x, y);
      const u = hash2(gx, gy, seed + 2);
      let kind = null;
      if (s === 0 || s === 9) { if (u < sparse) kind = 'tree'; }
      else if (s === 1 && u < 0.012 && !shortGrassNear(x, y, 9)) kind = 'tree';
      else if ((s === 1 || s === 8 || s === 11) && u > 0.975 && look.bushes.length && !shortGrassNear(x, y, 4)) kind = 'bush';
      if (!kind) continue;
      const [name, , size] = pickWeighted(kind === 'tree' ? look.trees : look.bushes, hash2(gx, gy, seed + 3));
      const scale = 0.8 + 0.45 * hash2(gx, gy, seed + 4);
      const t = { x, y, h: groundAt(world, x, y), name, height: size * scale, flip: hash2(gx, gy, seed + 5) < 0.5 };
      t.solid = t.height > 4; // bushes only catch the ball if it rolls into them
      (kind === 'tree' ? world.trees : world.bushes).push(t);
    }
  }

  // A coarse lookup of trees by 8-yard cell, for the ball hitting them.
  world.treeCells = new Map();
  for (const t of world.trees) {
    const key = `${Math.floor(t.x / 8)},${Math.floor(t.y / 8)}`;
    if (!world.treeCells.has(key)) world.treeCells.set(key, []);
    world.treeCells.get(key).push(t);
  }
  return world;
}

function cellIndex(w, x, y) {
  const i = Math.floor(x - w.x0), j = Math.floor(y - w.y0);
  if (i < 0 || j < 0 || i >= w.nx || j >= w.ny) return -1;
  return j * w.nx + i;
}

export function surfIdxAt(w, x, y) {
  const k = cellIndex(w, x, y);
  return k < 0 ? S_OOB : w.surf[k];
}

// The surface a ball plays from at (x, y), e.g. 'fairway', 'water' or 'oob'.
export function lieAt(w, x, y) {
  const n = SURF_NAMES[surfIdxAt(w, x, y)];
  return PLAYS_AS[n] ?? n;
}

// Ground height at (x, y), smoothly between cells; clamped to the edge outside the grid.
export function groundAt(w, x, y) {
  let fx = x - w.x0 - 0.5, fy = y - w.y0 - 0.5;
  fx = Math.max(0, Math.min(w.nx - 1.001, fx));
  fy = Math.max(0, Math.min(w.ny - 1.001, fy));
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
  const k = j * w.nx + i, h = w.hgt;
  const i1 = i + 1 < w.nx ? 1 : 0, j1 = j + 1 < w.ny ? w.nx : 0;
  return h[k] * (1 - u) * (1 - v) + h[k + i1] * u * (1 - v) + h[k + j1] * (1 - u) * v + h[k + i1 + j1] * u * v;
}

// Which way the ground rises at (x, y), yards up per yard.
export function groundSlope(w, x, y, d = 0.5) {
  return {
    x: (groundAt(w, x + d, y) - groundAt(w, x - d, y)) / (2 * d),
    y: (groundAt(w, x, y + d) - groundAt(w, x, y - d)) / (2 * d),
  };
}

export function treesNear(w, x, y) {
  const out = [];
  const cx = Math.floor(x / 8), cy = Math.floor(y / 8);
  for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) {
    const l = w.treeCells.get(`${i},${j}`);
    if (l) out.push(...l);
  }
  return out;
}
