// More screenshots: approach, putting. node tools/shots2.cjs [outdir] [query]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'screenshots';
const q = process.argv[3] || 'play=1';
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1024, height: 576 } });
  const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e)));
  pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto('file://' + path.resolve('pin-high.html') + '?' + q);
  await pg.waitForTimeout(4500);
  await pg.screenshot({ path: `${out}/a-tee.png` });
  // Move the ball to the fairway 150 out and set up.
  const place = async (dx, dy, name) => {
    await pg.evaluate(([dx, dy]) => {
      const { game, setupShot } = window.pinHigh;
      const p = game.players[game.cur];
      const pin = game.hole.pin;
      p.ball = { x: pin.x + dx, y: pin.y + dy };
      p.strokes = 1;
      setupShot();
      game.cam = { ...game.shotCam }; game.phase = 'aim'; game.dirty = true; game.banner = null; game.hints = false;
    }, [dx, dy]);
    await pg.waitForTimeout(400);
    await pg.screenshot({ path: `${out}/${name}.png` });
  };
  const hole = await pg.evaluate(() => { const h = window.pinHigh.game.hole; return { pin: h.pin, g: h.green, line: h.line.points }; });
  const pts = hole.line; const a = pts[pts.length - 2], z = pts[pts.length - 1];
  const L = Math.hypot(z.x - a.x, z.y - a.y), ux = (z.x - a.x) / L, uy = (z.y - a.y) / L;
  await place(-ux * 150, -uy * 150, 'b-approach');
  await place(-ux * 7 + uy * 2, -uy * 7 - ux * 2, 'c-putt');
  // Putt it.
  await pg.keyboard.press('Space'); await pg.waitForTimeout(500);
  await pg.keyboard.press('Space'); await pg.waitForTimeout(200);
  await pg.keyboard.press('Space'); await pg.waitForTimeout(1200);
  await pg.screenshot({ path: `${out}/d-putting.png` });
  await pg.waitForTimeout(5000);
  await pg.screenshot({ path: `${out}/e-after.png` });
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
