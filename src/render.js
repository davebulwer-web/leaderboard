// The view from behind the golfer, drawn a pixel at a time into an ImageData.
// The ground is drawn like an old voxel-landscape engine: each screen column
// marches out from the camera, and wherever the ground at that distance shows
// above what's already drawn, it fills the column up to it. Trees, the flag and
// the ball are then drawn as scaled sprites, tested against a depth buffer so
// hills and trees hide what's behind them.

import { S_OOB, hash2 } from './world.js';
import { SURF_NAMES } from './world.js';

const T_NEAR = 0.6;
export const T_FAR = 720;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);
const QUANT = 9; // colour steps, for a slightly posterised retro look

export const pack = (r, g, b) => (255 << 24) | (Math.max(0, Math.min(255, b | 0)) << 16) | (Math.max(0, Math.min(255, g | 0)) << 8) | Math.max(0, Math.min(255, r | 0));

export function makeView(W, H) {
  const img = new ImageData(W, H);
  return {
    W, H, img, px: new Uint32Array(img.data.buffer), depth: new Float32Array(W * H),
    staticPx: new Uint32Array(W * H), staticDepth: new Float32Array(W * H),
  };
}

// Camera vectors: yaw 0 looks up +y (down the hole from the tee), +x is right.
export function camAxes(cam) {
  const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
  return { fx: s, fy: c, rx: c, ry: -s };
}

// Screen position of a world point, or null if behind the camera.
export function project3(cam, W, x, y, z) {
  const a = camAxes(cam);
  const dx = x - cam.x, dy = y - cam.y;
  const t = dx * a.fx + dy * a.fy;
  if (t < 0.3) return null;
  const s = dx * a.rx + dy * a.ry;
  return { x: W / 2 + (s * cam.f) / t, y: cam.horizon + ((cam.eye - z) * cam.f) / t, t };
}

function drawSky(view, cam, bd) {
  const { W, H, px, depth } = view;
  const period = bd.w * 2;
  const u0 = (cam.yaw / (Math.PI * 2)) * period * 2;
  const bottom = Math.round(cam.horizon + 5);
  const top = bottom - bd.h;
  const [sr, sg, sb] = bd.sky;
  for (let y = 0; y < H; y++) {
    const row = y * W;
    if (y < top) {
      const k = 1 - y / Math.max(1, top);
      const c = pack(sr - 40 * (1 - k) * 0.6, sg - 34 * (1 - k) * 0.6, sb - 10 * (1 - k) * 0.6);
      for (let x = 0; x < W; x++) { px[row + x] = c; depth[row + x] = 1e9; }
    } else {
      const v = Math.min(bd.h - 1, y - top);
      for (let x = 0; x < W; x++) {
        let u = Math.floor(u0 + x - W / 2) % period;
        if (u < 0) u += period;
        if (u >= bd.w) u = period - 1 - u;
        px[row + x] = bd.data[v * bd.w + u] | 0xff000000;
        depth[row + x] = 1e9;
      }
    }
  }
}

// Draw the ground and the static sprites (trees, bushes) for one camera.
// opts: { grid: true to draw the putting grid on the green, clear: {x, y, r} to
// leave out trees round the ball so they don't block the view }.
export function renderScene(view, world, cam, art, opts = {}) {
  const { W, H, px, depth } = view;
  const look = world.look;
  drawSky(view, cam, art.backdrop);
  const { fx, fy, rx, ry } = camAxes(cam);
  const { x0, y0, nx, ny, surf, hgt, stripe } = world;
  const base = SURF_NAMES.map((n) => look.ground[n] ?? look.ground.rough);
  const [hr, hg, hb] = look.haze;
  const f = cam.f, eye = cam.eye, hor = cam.horizon;
  const grid = !!opts.grid;

  for (let x = 0; x < W; x++) {
    const k0 = (x - W / 2 + 0.5) / f;
    const dx = fx + rx * k0, dy = fy + ry * k0;
    let ybuf = H;
    let t = T_NEAR;
    while (t < T_FAR && ybuf > 0) {
      const wx = cam.x + dx * t, wy = cam.y + dy * t;
      let i = Math.floor(wx - x0), j = Math.floor(wy - y0);
      let s, h, k;
      const inside = i >= 0 && j >= 0 && i < nx && j < ny;
      if (!inside) {
        s = S_OOB;
        i = Math.max(0, Math.min(nx - 1, i)); j = Math.max(0, Math.min(ny - 1, j));
        k = j * nx + i;
        h = hgt[k];
      } else {
        k = j * nx + i;
        s = surf[k];
        if (t < 60) {
          // Smooth heights close up, so slopes don't look like steps.
          const fxp = wx - x0 - 0.5, fyp = wy - y0 - 0.5;
          const bi = Math.max(0, Math.min(nx - 2, Math.floor(fxp))), bj = Math.max(0, Math.min(ny - 2, Math.floor(fyp)));
          const u = Math.max(0, Math.min(1, fxp - bi)), v = Math.max(0, Math.min(1, fyp - bj));
          const kk = bj * nx + bi;
          h = hgt[kk] * (1 - u) * (1 - v) + hgt[kk + 1] * u * (1 - v) + hgt[kk + nx] * (1 - u) * v + hgt[kk + nx + 1] * u * v;
        } else h = hgt[k];
      }
      const sy = hor + ((eye - h) * f) / t;
      if (sy < ybuf) {
        // Light from the upper left, from the slope of the ground.
        const kl = i > 0 ? k - 1 : k, kr = i < nx - 1 ? k + 1 : k, kd = j > 0 ? k - nx : k, ku = j < ny - 1 ? k + nx : k;
        let light = 1 + 0.42 * ((hgt[kl] - hgt[kr]) + 0.6 * (hgt[ku] - hgt[kd]));
        const n = hash2(i, j, 7);
        const c = base[s];
        if (s === 2) light *= stripe[k] ? 1.07 : 0.95;
        else if (s === 4 || s === 3) light *= stripe[k] ? 1.04 : 0.97;
        else if (s === 7 || s === 10) light = 1 + (n > 0.97 ? 0.25 : 0) + 0.05 * Math.sin(wy * 0.6 + wx * 0.2);
        if (s !== 7 && s !== 10) light *= s === 6 || s === 11 ? 0.97 + 0.06 * n : s === 1 || s === 0 || s === 9 || s === 12 ? 0.9 + 0.2 * n : 0.97 + 0.06 * n;
        if (grid && s === 4 && t > 1 && t < 30) {
          // A faint one-yard grid on the green so its slopes show.
          const lw = 0.02 + t * 0.004;
          const gx = wx - Math.floor(wx), gy = wy - Math.floor(wy);
          if (gx < lw || gy < lw) light *= 0.9;
        }
        if (light < 0.55) light = 0.55; else if (light > 1.4) light = 1.4;
        let fog = (t - 90) / (T_FAR - 90);
        fog = fog < 0 ? 0 : fog * 0.85;
        const r = c[0] * light * (1 - fog) + hr * fog, g = c[1] * light * (1 - fog) + hg * fog, b = c[2] * light * (1 - fog) + hb * fog;
        let ytop = Math.ceil(sy);
        if (ytop < 0) ytop = 0;
        for (let y = ytop; y < ybuf; y++) {
          const d = BAYER[(x & 3) + ((y & 3) << 2)] * QUANT;
          const p = y * W + x;
          px[p] = (255 << 24) | (Math.min(255, Math.floor((b + d) / QUANT) * QUANT) << 16) | (Math.min(255, Math.floor((g + d) / QUANT) * QUANT) << 8) | Math.min(255, Math.floor((r + d) / QUANT) * QUANT);
          depth[p] = t;
        }
        ybuf = ytop;
      }
      t += t < 12 ? 0.07 : t * 0.0085;
    }
  }

  // Trees and bushes.
  const clear = opts.clear;
  const drawList = (list) => {
    for (const tr of list) {
      if (clear) {
        const ddx = tr.x - clear.x, ddy = tr.y - clear.y;
        if (ddx * ddx + ddy * ddy < clear.r * clear.r) continue;
      }
      drawSprite(view, cam, art.sprites[tr.name], tr.x, tr.y, tr.h, tr.height, tr.flip, look.haze);
    }
  };
  drawList(world.trees);
  drawList(world.bushes);
  view.staticPx.set(px);
  view.staticDepth.set(depth);
}

// Start a frame from the cached static scene.
export function restoreScene(view) {
  view.px.set(view.staticPx);
  view.depth.set(view.staticDepth);
}

// A sprite standing on the ground at (x, y) whose foot is at height gh, `height` yards tall.
export function drawSprite(view, cam, spr, x, y, gh, height, flip, haze, bias = 0) {
  if (!spr) return;
  const { W, H, px, depth } = view;
  const { fx, fy, rx, ry } = camAxes(cam);
  const dx = x - cam.x, dy = y - cam.y;
  const t = dx * fx + dy * fy;
  if (t < 0.8 || t > T_FAR) return;
  const s = dx * rx + dy * ry;
  const scale = (height * cam.f) / t / spr.h;
  const sx = W / 2 + (s * cam.f) / t;
  const left = sx - spr.ax * scale, top = cam.horizon + ((cam.eye - gh) * cam.f) / t - spr.ay * scale;
  const right = left + spr.w * scale, bottom = top + spr.h * scale;
  if (right < 0 || left >= W || bottom < 0 || top >= H) return;
  let fog = (t - 90) / (T_FAR - 90);
  fog = fog < 0 ? 0 : fog * 0.85;
  const [hr, hg, hb] = haze;
  const x0 = Math.max(0, Math.ceil(left)), x1 = Math.min(W, Math.ceil(right));
  const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(H, Math.ceil(bottom));
  const data = spr.data, w = spr.w;
  const td = t - bias;
  for (let yy = y0; yy < y1; yy++) {
    const sv = Math.min(spr.h - 1, Math.floor((yy - top) / scale));
    const row = sv * w;
    for (let xx = x0; xx < x1; xx++) {
      let su = Math.min(w - 1, Math.floor((xx - left) / scale));
      if (flip) su = w - 1 - su;
      const c = data[row + su];
      if ((c >>> 24) < 128) continue;
      const p = yy * W + xx;
      if (depth[p] <= td) continue;
      if (fog > 0) {
        const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
        px[p] = pack(r * (1 - fog) + hr * fog, g * (1 - fog) + hg * fog, b * (1 - fog) + hb * fog);
      } else px[p] = c | 0xff000000;
      depth[p] = td;
    }
  }
}

// Fill a screen ellipse, with a depth test at depth t.
export function fillEllipse(view, cx, cy, rxp, ryp, color, t, alpha = 1) {
  const { W, H, px, depth } = view;
  const x0 = Math.max(0, Math.floor(cx - rxp)), x1 = Math.min(W - 1, Math.ceil(cx + rxp));
  const y0 = Math.max(0, Math.floor(cy - ryp)), y1 = Math.min(H - 1, Math.ceil(cy + ryp));
  const r = color & 255, g = (color >> 8) & 255, b = (color >> 16) & 255;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const u = (x + 0.5 - cx) / rxp, v = (y + 0.5 - cy) / ryp;
    if (u * u + v * v > 1) continue;
    const p = y * W + x;
    if (depth[p] < t) continue;
    if (alpha >= 1) px[p] = color;
    else {
      const c = px[p];
      px[p] = pack((c & 255) * (1 - alpha) + r * alpha, ((c >> 8) & 255) * (1 - alpha) + g * alpha, ((c >> 16) & 255) * (1 - alpha) + b * alpha);
    }
  }
}

// The ball (and its shadow on the ground below it).
export function drawBall(view, cam, x, y, z, gz, { shadow = true, color = 0xfff8f8f8 } = {}) {
  const sh = project3(cam, view.W, x, y, gz);
  if (shadow && sh && z - gz > 0.05) {
    const rr = Math.max(1, (0.06 * cam.f) / sh.t);
    fillEllipse(view, sh.x, sh.y, rr, rr * 0.45, 0xff000000, sh.t + 0.3, 0.35);
  }
  const p = project3(cam, view.W, x, y, z + 0.024);
  if (!p) return null;
  const r = Math.max(0.9, (0.024 * cam.f) / p.t);
  if (r > 1.6) fillEllipse(view, p.x, p.y, r + 0.7, r + 0.7, 0xff303030, p.t - 0.05);
  fillEllipse(view, p.x, p.y, r, r, color, p.t - 0.06);
  return p;
}
