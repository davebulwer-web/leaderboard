// Captures the golfer through one swing (for checking the animation): node tools/swingstrip.cjs out.png
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 512, height: 288 } });
  await pg.goto('file://' + path.resolve('pin-high.html') + '?play=1&level=0');
  await pg.waitForTimeout(4000);
  await pg.evaluate(() => { window.pinHigh.game.banner = null; window.pinHigh.game.hints = false; });
  const shots = [];
  const grab = async () => shots.push(await pg.screenshot({ clip: { x: 90, y: 120, width: 160, height: 150 } }));
  await grab();
  await pg.keyboard.down(' ');
  for (let i = 0; i < 5; i++) { await pg.waitForTimeout(250); await grab(); }
  await pg.keyboard.up(' ');
  await pg.waitForTimeout(250); await grab();
  await pg.keyboard.press(' ');
  for (let i = 0; i < 8; i++) { await pg.waitForTimeout(60); await grab(); }
  const fs = require('fs');
  shots.forEach((s, i) => fs.writeFileSync(`/tmp/claude-0/-home-user-leaderboard/6227426f-73e0-5cde-9a12-ef8086bf85b3/scratchpad/strip-${String(i).padStart(2, '0')}.png`, s));
  await b.close();
})();
