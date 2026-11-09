// Screenshots of the game for checking: node tools/shots.cjs [outdir]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'screenshots';
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1024, height: 576 } });
  const errs = [];
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto('file://' + path.resolve('pin-high.html'));
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${out}/01-title.png` });
  await pg.keyboard.press('Space');
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: `${out}/02-setup.png` });
  await pg.keyboard.press('ArrowUp');
  await pg.keyboard.press('Enter');
  await pg.waitForTimeout(4000);
  await pg.screenshot({ path: `${out}/03-tee.png` });
  // Swing: hold for power, let go, press on the snap.
  await pg.keyboard.down(' ');
  await pg.waitForTimeout(700);
  await pg.screenshot({ path: `${out}/04-backswing.png` });
  await pg.waitForTimeout(300);
  await pg.keyboard.up(' ');
  await pg.waitForTimeout(150);
  await pg.screenshot({ path: `${out}/04b-snap.png` });
  await pg.waitForTimeout(260);
  await pg.keyboard.press(' ');
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${out}/05-flight.png` });
  await pg.waitForTimeout(6000);
  await pg.screenshot({ path: `${out}/06-next.png` });
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
