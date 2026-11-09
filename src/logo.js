// The PIN HIGH logo: chunky pixel letters with a sunset gradient, a dark outline,
// a drop shadow, and a flagstick in the I of PIN. Built once at 1x, drawn at 3x.

const LOGO_P = ['111111111.', '1111111111', '111....111', '111....111', '111....111', '111....111', '1111111111', '111111111.', '111.......', '111.......', '111.......', '111.......', '111.......', '111.......', '111.......'];
const LOGO_I = ['1111111', '1111111', '..111..', '..111..', '..111..', '..111..', '..111..', '..111..', '..111..', '..111..', '..111..', '..111..', '..111..', '1111111', '1111111'];
const LOGO_H = Array.from({ length: 15 }, (_, r) => (r >= 6 && r <= 8 ? '1111111111' : '111....111'));
const LOGO_G = ['.11111111.', '1111111111', '111....111', '111.......', '111.......', '111.......', '111..11111', '111..11111', '111....111', '111....111', '111....111', '111....111', '111....111', '1111111111', '.11111111.'];
// N: two posts joined by a three-wide diagonal.
const LOGO_N = Array.from({ length: 15 }, (_, r) => {
  const row = Array(10).fill('.');
  for (const c of [0, 1, 2, 7, 8, 9]) row[c] = '1';
  const d = 1 + Math.round((r * 6) / 14);
  for (let c = d; c < d + 3; c++) row[c] = '1';
  return row.join('');
});
const LOGO_GLYPHS = { P: LOGO_P, I: LOGO_I, N: LOGO_N, H: LOGO_H, G: LOGO_G };

export function makeLogo(text = 'PIN HIGH') {
  const PAD = 2, TOP = 12, GAP = 2, SPACE = 6, LH = 15;
  let w = 0;
  for (const ch of text) w += ch === ' ' ? SPACE : LOGO_GLYPHS[ch][0].length + GAP;
  w = w - GAP + PAD * 2 + 2;
  const h = TOP + LH + PAD + 3;
  const mask = new Uint8Array(w * h);
  let x = PAD + 1, flagX = -1;
  for (const ch of text) {
    if (ch === ' ') { x += SPACE; continue; }
    const g = LOGO_GLYPHS[ch];
    g.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] === '1') mask[(TOP + r) * w + x + c] = 1; });
    if (ch === 'I' && flagX < 0) flagX = x + 3;
    x += g[0].length + GAP;
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const put = (px, py, [r, g, b]) => {
    if (px < 0 || py < 0 || px >= w || py >= h) return;
    const i = (py * w + px) * 4;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
  };
  const on = (px, py) => px >= 0 && py >= 0 && px < w && py < h && mask[py * w + px] === 1;
  const DARK = [42, 22, 52], SHADOW = [88, 34, 70];
  // Shadow two pixels down, then the outline, then the gradient face.
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    if (on(px, py - 2) || on(px, py - 3)) put(px, py, SHADOW);
  }
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    if (on(px, py)) continue;
    if (on(px - 1, py) || on(px + 1, py) || on(px, py - 1) || on(px, py + 1) || on(px - 1, py - 1) || on(px + 1, py - 1) || on(px - 1, py + 1) || on(px + 1, py + 1)) put(px, py, DARK);
  }
  const ramp = [[255, 250, 220], [255, 240, 170], [255, 226, 110], [255, 214, 74], [255, 200, 60], [252, 184, 52], [248, 168, 48], [244, 150, 44], [238, 132, 42], [232, 116, 42], [226, 100, 44], [218, 86, 48], [208, 74, 52], [196, 64, 56], [184, 56, 60]];
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    if (!on(px, py)) continue;
    let col = ramp[Math.max(0, Math.min(ramp.length - 1, py - TOP))];
    // A light rim along the top edge of each stroke.
    if (!on(px, py - 1)) col = [255, 255, 236];
    put(px, py, col);
  }
  // Flagstick out of the I in PIN, with a red pennant.
  if (flagX >= 0) {
    for (let py = 1; py < TOP; py++) { put(flagX - 1, py, DARK); put(flagX + 1, py, DARK); put(flagX, py, [250, 250, 240]); }
    put(flagX, 0, DARK);
    // A pennant flying to the right, outlined.
    for (let r = 0; r < 7; r++) {
      const len = 8 - r;
      for (let k = 0; k <= len; k++) put(flagX + 2 + k, 1 + r, k === len ? DARK : r === 0 ? [255, 130, 118] : [222, 52, 52]);
    }
    for (let k = 0; k < 10; k++) put(flagX + 1 + k, 0, DARK);
    put(flagX + 2, 8, DARK);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
