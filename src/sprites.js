// Decodes the packed Pixellab art into pixel arrays the renderer can scale, and
// into canvases for the golfer, recoloured for each player's shirt.

import { GOLFER_FRAMES, GOLFER_BALL, GOLFER_PX, SPRITES, BACKDROPS, TITLES } from './assets.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

function toCanvas(im) {
  const c = document.createElement('canvas');
  c.width = im.width; c.height = im.height;
  c.getContext('2d').drawImage(im, 0, 0);
  return c;
}

function pixelsOf(canvas) {
  const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  return new Uint32Array(d.data.buffer);
}

// Shirt colours for up to four players (the art's shirt is white).
export const SHIRTS = [
  { name: 'WHITE', rgb: [236, 236, 230] },
  { name: 'RED', rgb: [214, 64, 58] },
  { name: 'BLUE', rgb: [62, 112, 214] },
  { name: 'YELLOW', rgb: [238, 196, 52] },
  { name: 'GREEN', rgb: [60, 170, 90] },
  { name: 'PINK', rgb: [232, 120, 176] },
];

// Swap the white shirt and cap for a colour, keeping the shading.
function recolour(src, rgb) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  const waist = c.height * 0.52;
  for (let i = 0; i < p.length; i += 4) {
    const y = Math.floor(i / 4 / c.width);
    if (y > waist || p[i + 3] === 0) continue;
    const r = p[i], g = p[i + 1], b = p[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx > 150 && mx - mn < 34) {
      const k = (mx / 240) ** 1.3;
      p[i] = Math.min(255, rgb[0] * k); p[i + 1] = Math.min(255, rgb[1] * k); p[i + 2] = Math.min(255, rgb[2] * k);
    }
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

export async function loadArt() {
  const golfer = {};
  for (const [k, src] of Object.entries(GOLFER_FRAMES)) golfer[k] = toCanvas(await loadImage(src));
  const sprites = {};
  for (const [k, s] of Object.entries(SPRITES)) {
    const c = toCanvas(await loadImage(s.src));
    sprites[k] = { w: c.width, h: c.height, ax: s.ax, ay: s.ay, data: pixelsOf(c), canvas: c };
  }
  const backdrops = {};
  for (const [k, src] of Object.entries(BACKDROPS)) {
    const c = toCanvas(await loadImage(src));
    const data = pixelsOf(c);
    // The colour at the top of the sky, to carry on upwards.
    const top = data[2 * c.width + 3];
    backdrops[k] = { w: c.width, h: c.height, data, sky: [top & 255, (top >> 8) & 255, (top >> 16) & 255] };
  }
  const titles = [];
  for (const src of TITLES) titles.push(await loadImage(src));
  const swing = Object.keys(golfer).filter((k) => k.startsWith('swing')).sort();
  const putt = Object.keys(golfer).filter((k) => k.startsWith('putt')).sort();
  const shirts = new Map();
  return {
    golfer, sprites, backdrops, titles, swing, putt, ball: GOLFER_BALL, golferPx: GOLFER_PX,
    // Golfer frames in a shirt colour, made on first use.
    golferFor(shirt) {
      if (!shirts.has(shirt)) {
        const set = {};
        for (const [k, c] of Object.entries(golfer)) set[k] = shirt === 0 ? c : recolour(c, SHIRTS[shirt].rgb);
        shirts.set(shirt, set);
      }
      return shirts.get(shirt);
    },
  };
}
