// Pin High: the game. Title and setup screens, playing a round from behind the
// golfer, the swing meter, the scoreboard panel and the scorecard.

import { buildCourse } from './gen/course.js';
import { pointAt, project, TEE_SETS } from './gen/course-generator.js';
import { roundWeather, holeWind } from './gen/weather.js';
import { heightAt } from './gen/terrain.js';
import { COURSE_LIST } from './gen/course-list.js';
import { buildWorld, lieAt, groundAt, groundSlope, SURF_NAMES, surfIdxAt, hash2 } from './world.js';
import { lookFor, STYLE_NAMES } from './styles.js';
import { makeView, renderScene, restoreScene, drawSprite, drawBall, fillEllipse, project3, camAxes, pack } from './render.js';
import { CLUBS, PUTTER, MPH, CUP_R, LIE_NAMES, LIE_GRADES, GROUND, playShot, playPutt, dropFromWater, lieGrade, lieMid } from './physics.js';
import { loadArt, SHIRTS } from './sprites.js';
import { bigText, smallText, bigWidth } from './font.js';
import { makeLogo } from './logo.js';
import { sfx, toggleMute, isMuted } from './audio.js';

// ---------- Screen ----------

const SW = 512, SH = 288, PANEL = 144, VW = SW - PANEL, VH = SH;
const canvas = document.getElementById('game');
canvas.width = SW; canvas.height = SH;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const view = makeView(VW, VH);

function fit() {
  const k = Math.min(window.innerWidth / SW, window.innerHeight / SH);
  const s = k >= 2 ? Math.floor(k) : k;
  canvas.style.width = `${Math.floor(SW * s)}px`;
  canvas.style.height = `${Math.floor(SH * s)}px`;
  canvas.style.left = `${Math.floor((window.innerWidth - SW * s) / 2)}px`;
  canvas.style.top = `${Math.floor((window.innerHeight - SH * s) / 2)}px`;
}
window.addEventListener('resize', fit);
fit();

// ---------- Settings ----------

const DIFFICULTY = [
  { name: 'NOVICE', tol: 0.06, wind: 0, rise: 1.35, note: 'NO WIND, FORGIVING SNAP' },
  { name: 'AMATEUR', tol: 0.035, wind: 1, rise: 1.1, note: 'WIND, FAIR SNAP' },
  { name: 'PRO', tol: 0.018, wind: 1.25, rise: 0.92, note: 'STRONG WIND, TIGHT SNAP' },
];
const SNAP_LINE = -0.14, SNAP_BOTTOM = -0.3; // the snap section sits below the power scale
const TEES = [
  { key: 'yellow', name: 'FORWARD' }, { key: 'white', name: 'WHITE' }, { key: 'blue', name: 'BLUE' }, { key: 'black', name: 'CHAMPIONSHIP' },
];
const FORMATS = [
  { key: 'stroke', name: 'STROKE PLAY', note: 'FEWEST STROKES WINS', min: 1, max: 4 },
  { key: 'match', name: 'MATCH PLAY', note: 'WIN HOLES, NOT STROKES. 2 PLAYERS', min: 2, max: 2 },
  { key: 'skins', name: 'SKINS', note: 'BEST SCORE TAKES THE HOLE, TIES CARRY OVER', min: 2, max: 4 },
  { key: 'stableford', name: 'STABLEFORD', note: 'POINTS: PAR 2, BIRDIE 3, BOGEY 1', min: 1, max: 4 },
  { key: 'practice', name: 'PRACTICE HOLE', note: 'ANY HOLE, AS OFTEN AS YOU LIKE. U: MULLIGAN', min: 1, max: 4 },
  { key: 'range', name: 'DRIVING RANGE', note: 'ANY CLUB, CARRY AND TOTAL SHOWN. N: NEXT HOLE', min: 1, max: 1 },
  { key: 'putting', name: 'PUTTING GREEN', note: 'RANDOM PUTTS ON EACH GREEN. N: NEXT GREEN', min: 1, max: 1 },
];
const HOLE_SETS = [{ name: '18 HOLES', from: 0, n: 18 }, { name: 'FRONT 9', from: 0, n: 9 }, { name: 'BACK 9', from: 9, n: 9 }];
const NAMED = Object.values(COURSE_LIST).flat();
const STYLE_KEYS = Object.keys(STYLE_NAMES);
const PUTT_RANGES = [3, 6, 12, 22, 36]; // yards: 9, 18, 36, 66 and 108 feet

const NAME_A = ['BRAMBLE', 'KESTREL', 'ALDER', 'HOLLOWAY', 'MARSHFIELD', 'CRANLEIGH', 'PEBBLEWICK', 'THORNBY', 'ASHCOMBE', 'WILLOWMERE',
  'STAGSHEAD', 'FOXGLOVE', 'HARTWELL', 'LARKSPUR', 'BIRCHAM', 'OTTERBURN', 'REDCLIFFE', 'SILVERDALE', 'MOSSLEY', 'FENWICK',
  'GREYSTONE', 'HAWKRIDGE', 'BLACKWATER', 'SANDHURST', 'WHITLOCK', 'MERRIVALE', 'CORRAN', 'DUNMORE', 'ELMHURST', 'KINGSMEAD'];
const NAME_B = { parkland: 'PARK', links: 'LINKS', desert: 'CANYON', heathland: 'HEATH', alpine: 'PEAKS', tropical: 'BAY', woodland: 'WOODS', stadium: 'NATIONAL' };
const randomCourseName = (style, seed) => `${NAME_A[seed % NAME_A.length]} ${NAME_B[style]}`;

const game = {
  mode: 'loading', art: null, t: 0,
  setup: {
    count: 1, players: [{ name: 'PLAYER 1', shirt: 0 }, { name: 'PLAYER 2', shirt: 1 }, { name: 'PLAYER 3', shirt: 2 }, { name: 'PLAYER 4', shirt: 3 }],
    difficulty: 1, course: 0, style: 0, seed: 1 + Math.floor(Math.random() * 99999), holes: 0, tee: 1, row: 0, editing: -1, format: 0, practiceHole: 0,
  },
  showCard: false, hints: true, track: true,
};

// ---------- Course and holes ----------

function courseDef() {
  const st = game.setup;
  if (st.course === 0) {
    const style = STYLE_KEYS[st.style];
    return { name: randomCourseName(style, st.seed), style, seed: st.seed, par: 72, length: 'standard', tour: 'tour' };
  }
  const c = NAMED[st.course - 1];
  return { name: c.name, style: c.style, seed: c.seed, par: c.par, length: c.length, tour: c.tour };
}

function startRound() {
  const st = game.setup;
  game.mode = 'loadhole';
  game.loadingText = 'BUILDING COURSE';
  setTimeout(() => {
    const def = courseDef();
    game.course = buildCourse(def);
    game.look = lookFor(def.style);
    game.backdrop = game.art.backdrops[def.style] ?? game.art.backdrops.parkland;
    game.weather = roundWeather(game.course, 1);
    game.format = FORMATS[st.format].key;
    const hs = HOLE_SETS[st.holes];
    // The range starts on the course's longest hole, the putting green on the first.
    // For the range, the flattest long hole, so the flags aren't hidden over a brow.
    const lumpiness = (h) => {
      const t0 = h.tees[TEES[st.tee].key], base = heightAt(h, pointAt(h.line, t0));
      let worst = 0;
      for (let d = 20; d <= 280 && t0 + d < h.length; d += 10) worst = Math.max(worst, Math.abs(heightAt(h, pointAt(h.line, t0 + d)) - base));
      return worst + (h.length < 400 ? 100 : 0);
    };
    const longest = game.course.holes.reduce((b, h, i) => (lumpiness(h) < lumpiness(game.course.holes[b]) ? i : b), 0);
    game.stats = { balls: 0, made: 0, longest: 0 };
    game.keep = null; game.nextBall = null;
    game.holeList = game.format === 'practice' ? [st.practiceHole] : game.format === 'range' ? [longest] : game.format === 'putting' ? [0] : Array.from({ length: hs.n }, (_, i) => hs.from + i);
    game.skins = { carry: 0, winners: [] };
    game.match = { results: [], over: false };
    game.lastShot = null;
    game.holeIdx = 0;
    game.diff = DIFFICULTY[st.difficulty];
    game.tee = TEES[st.tee].key;
    game.players = st.players.slice(0, st.count).map((p, i) => ({ name: p.name.trim() || `PLAYER ${i + 1}`, shirt: p.shirt, scores: [] }));
    game.honour = game.players.map((_, i) => i);
    game.rng = mulberry(def.seed * 7 + 13);
    loadHole();
  }, 30);
}

function mulberry(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadHole() {
  game.mode = 'loadhole';
  const n = game.holeList[game.holeIdx];
  game.loadingText = `HOLE ${n + 1}`;
  setTimeout(() => {
    const hole = game.course.holes[n];
    game.hole = hole;
    game.world = buildWorld(hole, game.look);
    game.minimap = makeMinimap(game.world);
    // This hole's wind, in hole coordinates (yards / s), a little different hole to hole.
    const w = holeWind(game.weather, hole);
    const gust = 0.75 + 0.5 * hash2(n, game.course.seed, 3);
    const k = game.diff.wind * gust;
    game.windMph = Math.round(Math.hypot(w.across, w.along) * k);
    game.wind = { x: w.across * k * MPH, y: w.along * k * MPH };
    const tee = pointAt(hole.line, hole.tees[game.tee]);
    const teeYards = Math.round(hole.length - hole.tees[game.tee]);
    game.holeYards = teeYards;
    for (const p of game.players) {
      p.ball = { x: tee.x, y: tee.y };
      p.strokes = 0; p.holed = false; p.pickedUp = false; p.lie = 'tee';
    }
    game.mode = 'play';
    game.cur = -1;
    game.lastShot = null; game.conceded = null; game.holeNews = null;
    let sub = `PAR ${hole.par}  ${teeYards} YARDS`;
    if (game.format === 'skins') sub += `  ${game.skins.carry + 1} SKIN${game.skins.carry ? 'S' : ''}`;
    if (game.format === 'match' && game.match.results.length) { const m = matchStatus(); sub = matchText(m.up, m.left, false); }
    game.banner = { title: `HOLE ${n + 1}`, sub, t: 2.6 };
    if (game.format === 'range') game.banner = { title: 'DRIVING RANGE', sub: `HOLE ${n + 1}, FLAGS EVERY 50 YARDS`, t: 2.6 };
    if (game.format === 'putting') { game.players[0].ball = randomPutt(); game.banner = { title: 'PUTTING GREEN', sub: `GREEN ${n + 1}`, t: 2.2 }; }
    nextTurn(true);
  }, 30);
}

const pinOf = () => game.hole.pin;
const distTo = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Who plays next: anyone yet to tee off (in honour order), then whoever is farthest from the pin.
const isDrill = () => game.format === 'range' || game.format === 'putting';

// A spot on the green, 4 to 15 yards from the hole.
function randomPutt() {
  const pin = pinOf();
  for (let i = 0; i < 400; i++) {
    const a = game.rng() * Math.PI * 2, d = 4 + game.rng() * 11;
    const x = pin.x + Math.sin(a) * d, y = pin.y + Math.cos(a) * d;
    if (lieAt(game.world, x, y) === 'green' && lieAt(game.world, x + 1, y) === 'green' && lieAt(game.world, x, y + 1) === 'green') return { x, y };
  }
  return { x: pin.x, y: pin.y - 5 };
}

// The range's yardage flags along the hole, every 50 yards from the tee.
function rangeFlags() {
  if (game.format !== 'range') return [];
  if (game.rangeFlags?.hole === game.hole) return game.rangeFlags.list;
  const h = game.hole, t0 = h.tees[game.tee], list = [];
  for (let d = 50; t0 + d < h.length - 20; d += 50) list.push({ d, ...pointAt(h.line, t0 + d) });
  game.rangeFlags = { hole: h, list };
  return list;
}

// Range and putting green: report the shot, then a fresh ball.
function drillShotOver() {
  const p = game.players[game.cur];
  const fl = game.flight, res = fl.res;
  let title, sub = '', color = '#f4f0e0';
  game.stats.balls++;
  if (game.format === 'putting') {
    const pin = pinOf();
    const ft = Math.round(distTo(fl.from, pin) * 3);
    if (res.result === 'holed') { game.stats.made++; title = 'HOLED!'; color = '#ffd84a'; sfx('cup'); }
    else {
      const left = distTo(res.end, pin);
      const past = (res.end.x - fl.from.x) * (pin.x - fl.from.x) + (res.end.y - fl.from.y) * (pin.y - fl.from.y) > distTo(fl.from, pin) ** 2;
      title = 'MISSED'; sub = `${Math.max(1, Math.round(left * 3))} FT ${past ? 'PAST' : 'SHORT'}`; color = '#ff7a6a';
    }
    sub = `${ft} FT PUTT${sub ? `, ${sub}` : ''}`;
    game.nextBall = randomPutt();
  } else {
    const from = fl.from, end = res.end;
    const total = Math.round(distTo(from, end)), carry = Math.round(res.carry ?? total);
    const yaw = fl.yaw ?? game.aimYaw;
    const side = (end.x - from.x) * Math.cos(yaw) - (end.y - from.y) * Math.sin(yaw);
    const off = Math.round(Math.abs(side));
    if (res.result === 'water' || res.result === 'oob') { title = res.result === 'water' ? 'IN THE WATER' : 'OUT OF BOUNDS'; color = '#ff7a6a'; sfx(res.result === 'water' ? 'splash' : 'sad'); }
    else title = res.hitTree ? 'HIT A TREE!' : `${CLUBS[game.keep?.club ?? game.club].name} ${total} YDS`;
    sub = `CARRY ${carry}  TOTAL ${total}  ${off ? `${off} ${side > 0 ? 'RIGHT' : 'LEFT'}` : 'STRAIGHT'}`;
    if (res.result === 'rest') game.stats.longest = Math.max(game.stats.longest, total);
    game.nextBall = { ...from };
  }
  game.banner = { title, sub, t: 2.4, color };
  game.phase = 'result';
  game.resultT = 2.4;
}

// Practice: take the last shot again.
function mulligan() {
  const m = game.lastShot;
  if ((game.format !== 'practice' && game.format !== 'putting') || !m || game.phase !== 'aim') return;
  const p = game.players[m.pi];
  p.ball = { ...m.ball }; p.strokes = m.strokes; p.holed = false; p.pickedUp = false;
  game.lastShot = null;
  game.cur = m.pi;
  setupShot();
  game.cam = { ...game.shotCam }; game.dirty = true;
  game.banner = { title: 'MULLIGAN', sub: 'TAKE IT AGAIN', t: 1.4, color: C.cyan };
  sfx('blip');
}

function nextTurn(first = false) {
  const left = game.players.map((p, i) => i).filter((i) => !game.players[i].holed);
  if (!left.length) return holeFinished();
  let next = game.honour.find((i) => left.includes(i) && game.players[i].strokes === 0);
  if (next === undefined) next = left.reduce((a, b) => (distTo(game.players[b].ball, pinOf()) > distTo(game.players[a].ball, pinOf()) ? b : a));
  const prevCam = game.cam;
  game.cur = next;
  setupShot();
  if (!first && prevCam) startFly(prevCam, game.shotCam);
  else { game.cam = { ...game.shotCam }; game.phase = 'aim'; game.dirty = true; }
}

// Pick a club and aim for the current player's ball.
function setupShot() {
  const p = game.players[game.cur];
  const lie = lieAt(game.world, p.ball.x, p.ball.y);
  p.lie = lie;
  p.grade = lieGrade(game.world, p.ball.x, p.ball.y);
  const pin = pinOf();
  const d = distTo(p.ball, pin);
  game.putting = lie === 'green';
  let club;
  if (game.putting) club = PUTTER;
  else {
    const lf = lieMid(p.grade);
    const need = d / lf;
    club = 0;
    for (let i = 0; i < PUTTER; i++) if (CLUBS[i].carry >= need * 0.93) club = i;
    if (club === 0 && lie !== 'tee') club = 1; // no driver off the deck by default
    if (lie === 'bunker') club = Math.max(club, d < 60 ? 11 : 3);
    if (lie === 'trees') club = Math.max(club, 5);
    if (lie === 'fringe' && d < 14) club = PUTTER;
  }
  game.club = club;
  game.puttRange = PUTT_RANGES.findIndex((r) => r >= d * 1.25);
  if (game.puttRange < 0) game.puttRange = PUTT_RANGES.length - 1;
  game.aimYaw = autoAim(p.ball, club);
  if (game.format === 'range' && game.keep) { game.club = game.keep.club; game.aimYaw = game.keep.yaw; }
  game.swing = null;
  game.shotCam = shotCamera(p.ball, game.aimYaw);
}

// What a full swing with the current club carries from here, on average for the lie.
function clubYards(p) {
  return Math.round(CLUBS[game.club].carry * lieMid(p.grade) * (CLUBS[game.club].key === '1W' && p.lie !== 'tee' ? (p.lie === 'fairway' ? 0.92 : 0.75) : 1));
}

// Straight at the pin when it's in reach, otherwise along the hole's line.
function autoAim(ball, club) {
  const pin = pinOf();
  const d = distTo(ball, pin);
  const reach = club === PUTTER ? 1e9 : CLUBS[club].carry * 1.1;
  let target = pin;
  if (d > reach) {
    const line = game.hole.line;
    const pr = project(line, ball);
    target = pointAt(line, Math.min(line.length, pr.s + CLUBS[club].carry * 0.95), 0);
  }
  return Math.atan2(target.x - ball.x, target.y - ball.y);
}

// The same camera for every shot, putts included, so the golfer and the course
// always share one perspective. It sits far enough back that the golfer, who
// stands level with the ball, draws at the art's own pixel size.
const GOLFER_YARDS = 1.85;
const CAM_F = 230, CAM_EYE = 2.6, CAM_HORIZON = 108;
function shotCamera(ball, yaw) {
  const D = (GOLFER_YARDS * CAM_F) / game.art.golferPx;
  // Stand a little to the right of the line so the golfer doesn't hide the target.
  const SIDE = 0.75;
  const cx = ball.x - Math.sin(yaw) * D + Math.cos(yaw) * SIDE, cy = ball.y - Math.cos(yaw) * D - Math.sin(yaw) * SIDE;
  const gb = groundAt(game.world, ball.x, ball.y), gc = groundAt(game.world, cx, cy);
  return { x: cx, y: cy, eye: Math.max(gb + CAM_EYE, gc + 1.2), yaw, horizon: CAM_HORIZON, f: CAM_F, ball: { ...ball } };
}

// ---------- Camera moves ----------

function startFly(from, to) {
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  game.fly = { from: { ...from }, to: { ...to }, t: 0, dur: Math.min(2.0, 0.5 + d / 260), lift: Math.min(28, 2 + d * 0.09) };
  game.phase = 'fly';
}

function updateFly(dt) {
  const fl = game.fly;
  fl.t += dt;
  let u = Math.min(1, fl.t / fl.dur);
  const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
  let dy = fl.to.yaw - fl.from.yaw;
  while (dy > Math.PI) dy -= 2 * Math.PI;
  while (dy < -Math.PI) dy += 2 * Math.PI;
  const lerp = (a, b) => a + (b - a) * e;
  game.cam = {
    x: lerp(fl.from.x, fl.to.x), y: lerp(fl.from.y, fl.to.y), yaw: fl.from.yaw + dy * e,
    eye: lerp(fl.from.eye, fl.to.eye) + Math.sin(Math.PI * u) * fl.lift,
    horizon: lerp(fl.from.horizon, fl.to.horizon), f: lerp(fl.from.f, fl.to.f),
  };
  const g = groundAt(game.world, game.cam.x, game.cam.y);
  if (game.cam.eye < g + 0.8) game.cam.eye = g + 0.8;
  game.dirty = true;
  if (u >= 1) { game.cam = { ...fl.to }; game.phase = 'aim'; game.fly = null; }
}

// ---------- The swing ----------
// Hold the button and the power climbs; let go to set it. The marker then drops
// down the meter into the snap section: press again as it crosses the snap line.
// Putts are power only: let go and the ball's away.

function swingDown() {
  if (game.mode !== 'play') return;
  if (game.phase === 'aim') {
    game.swing = { stage: 1, level: 0, power: 0, snap: SNAP_LINE, t: 0 };
    game.phase = 'swing';
    game.hints = false;
    return;
  }
  if (game.phase === 'swing' && game.swing.stage === 2) { game.swing.snap = game.swing.level; strike(); }
}

function swingUp() {
  if (game.mode !== 'play' || game.phase !== 'swing') return;
  const s = game.swing;
  if (s.stage !== 1) return;
  s.power = s.level;
  if (game.club === PUTTER) { s.snap = SNAP_LINE; strike(); }
  else s.stage = 2;
}

function updateSwing(dt) {
  const s = game.swing;
  if (!s) return;
  s.t += dt;
  if (s.stage === 1) {
    s.level += dt / game.diff.rise / (game.club === PUTTER ? 1.25 : 1);
    if (s.level >= 1.1) { s.level = 1.1; swingUp(); }
  } else if (s.stage === 2) {
    s.level -= dt * 2.4;
    if (s.level <= SNAP_BOTTOM) { s.level = SNAP_BOTTOM; s.snap = SNAP_BOTTOM; strike(); }
  } else if (s.stage === 3) {
    s.anim += dt;
    if (s.anim >= (game.club === PUTTER ? 0.07 : 0.06) && !s.launched) { s.launched = true; launch(); }
  }
}

// The snap decides the shape: early (above the line) hooks left, late slices right.
function snapEffect(snapLevel, power) {
  const e = snapLevel - SNAP_LINE;
  const tol = game.diff.tol;
  let eff = Math.sign(e) * Math.max(0, Math.abs(e) - tol) / 0.12;
  eff = Math.max(-1.6, Math.min(1.6, eff));
  if (power > 1) eff += (game.rng() - 0.5) * (power - 1) * 10;
  return eff;
}

function strike() {
  const s = game.swing;
  s.stage = 3; s.anim = 0; s.launched = false;
  sfx(game.club === PUTTER ? 'putt' : 'whoosh');
}

function launch() {
  const p = game.players[game.cur];
  const s = game.swing;
  const eff = snapEffect(s.snap, s.power);
  const from = { ...p.ball };
  game.lastShot = { pi: game.cur, ball: from, strokes: p.strokes };
  if (game.format === 'range') game.keep = { club: game.club, yaw: game.aimYaw };
  let res;
  if (game.club === PUTTER) {
    res = playPutt(game.world, from, { yaw: game.aimYaw, distance: PUTT_RANGES[game.puttRange] * Math.min(1.1, s.power), snap: { push: (game.rng() - 0.5) * 0.006 * game.setup.difficulty, tilt: 0 }, rng: game.rng });
    sfx('putt');
  } else {
    res = playShot(game.world, from, {
      club: CLUBS[game.club], power: Math.min(1.1, s.power), yaw: game.aimYaw,
      snap: { push: -eff * 0.035, tilt: eff * 0.42 }, wind: game.wind, rng: game.rng, grade: p.grade,
    });
    sfx('hit');
  }
  game.flight = { res, from, yaw: game.aimYaw, i: 0, t: 0, eff, power: s.power, done: false, sounds: { tree: false, land: false } };
  game.phase = 'flight';
}

function updateFlight(dt) {
  const fl = game.flight;
  fl.t += dt;
  const speed = game.keysDown.has(' ') ? 3 : 1;
  fl.i = Math.min(fl.res.path.length - 1, fl.i + dt * 60 * speed);
  const k = Math.floor(fl.i);
  followBall(dt, k);
  if (!fl.sounds.land && fl.res.landed && k > 2) {
    const p = fl.res.path[k];
    if (distTo(p, fl.res.landed) < 0.5 && p.z - groundAt(game.world, p.x, p.y) < 0.2) { fl.sounds.land = true; if (lieAt(game.world, p.x, p.y) !== 'water') sfx('thud'); }
  }
  if (fl.i >= fl.res.path.length - 1 && !fl.done) {
    fl.done = true;
    shotOver();
  }
}

// The camera chases the ball once the golfer has finished his swing: low and
// close behind a putt, further back and above the ball for a full shot.
function followBall(dt, k) {
  const fl = game.flight;
  const putt = game.club === PUTTER;
  if (!game.track && !putt) return;
  if (fl.t < (putt ? 0.3 : 0.55)) return;
  const path = fl.res.path, w = game.world;
  const b = path[k];
  // Which way the ball is going (keep the last heading once it stops).
  const back = path[Math.max(0, k - 8)];
  const dx = b.x - back.x, dy = b.y - back.y, d = Math.hypot(dx, dy);
  if (d > 0.05) fl.heading = Math.atan2(dx, dy);
  if (fl.heading == null) fl.heading = game.aimYaw;
  const D = putt ? 2.8 : 16;
  const tx = b.x - Math.sin(fl.heading) * D, ty = b.y - Math.cos(fl.heading) * D;
  const cam = game.cam;
  const a = 1 - Math.exp(-dt * (putt ? 5 : 3));
  if (!fl.following) { fl.following = true; game.cam = cam ? { ...cam } : game.cam; }
  const c = game.cam;
  c.x += (tx - c.x) * a; c.y += (ty - c.y) * a;
  const gb = groundAt(w, b.x, b.y);
  const wantEye = Math.max(groundAt(w, c.x, c.y) + (putt ? 0.9 : 2.5), (putt ? gb + 0.9 : b.z + 2));
  c.eye += (wantEye - c.eye) * a;
  if (c.eye < groundAt(w, c.x, c.y) + 0.6) c.eye = groundAt(w, c.x, c.y) + 0.6;
  // Look at the ball, and tilt so it sits a little below the middle of the view.
  c.yaw = Math.atan2(b.x - c.x, b.y - c.y);
  const t = Math.max(0.5, Math.hypot(b.x - c.x, b.y - c.y));
  const want = putt ? 190 : 150;
  c.horizon = Math.max(-120, Math.min(260, want - ((c.eye - b.z) * c.f) / t));
  c.ball = { x: b.x, y: b.y };
  game.dirty = true;
}

const SCORE_NAMES = { '-4': 'CONDOR!', '-3': 'ALBATROSS!', '-2': 'EAGLE!', '-1': 'BIRDIE!', 0: 'PAR', 1: 'BOGEY', 2: 'DOUBLE BOGEY', 3: 'TRIPLE BOGEY' };

function shotOver() {
  if (isDrill()) return drillShotOver();
  const p = game.players[game.cur];
  const fl = game.flight;
  const res = fl.res;
  p.strokes++;
  let title = '', sub = '';
  const yards = Math.round(distTo(fl.from, res.end));
  if (res.result === 'holed') {
    p.holed = true; p.ball = { ...pinOf() };
    const diff = p.strokes - game.hole.par;
    title = p.strokes === 1 ? 'HOLE IN ONE!' : SCORE_NAMES[diff] ?? (diff > 0 ? `+${diff}` : `${diff}`);
    sub = `${p.strokes} ${p.strokes === 1 ? 'STROKE' : 'STROKES'}`;
    sfx('cup');
    if (diff < 0 || p.strokes === 1) setTimeout(() => sfx('clap'), 300);
  } else if (res.result === 'water') {
    p.strokes++;
    p.ball = dropFromWater(game.world, res.path, fl.from);
    title = 'WATER HAZARD'; sub = 'ONE STROKE PENALTY';
    sfx('splash');
  } else if (res.result === 'oob') {
    p.strokes++;
    p.ball = { ...fl.from };
    title = 'OUT OF BOUNDS'; sub = 'STROKE AND DISTANCE';
    sfx('sad');
  } else {
    p.ball = { ...res.end };
    const lie = lieAt(game.world, p.ball.x, p.ball.y);
    const left = distTo(p.ball, pinOf());
    title = LIE_GRADES[lieGrade(game.world, p.ball.x, p.ball.y)]?.name ?? LIE_NAMES[lie] ?? lie.toUpperCase();
    if (lie === 'green') sub = `${Math.round(left * 3)} FEET TO THE HOLE`;
    else sub = `${yards} YARDS  ${Math.round(left)} TO GO`;
    if (res.hitTree) { title = 'HIT A TREE!'; sub = `${LIE_NAMES[lie] ?? lie}, ${Math.round(left)} TO GO`; }
  }
  // Give up after ten.
  if (!p.holed && p.strokes >= 10) { p.holed = true; p.strokes = 10; title = 'PICKED UP'; sub = 'TEN STROKES'; }
  if (!p.holed && game.format === 'stableford' && p.strokes >= game.hole.par + 2) {
    p.holed = true; p.strokes = game.hole.par + 2; p.pickedUp = true; title = 'PICKED UP'; sub = 'NO POINTS ON THIS HOLE';
  }
  if (p.holed) p.scores[game.holeIdx] = p.strokes;
  game.conceded = null;
  concedeLostHoles();
  if (game.conceded) sub = `${game.conceded} PICKS UP, HOLE LOST`;
  game.banner = { title, sub, t: 2.2, color: res.result === 'holed' ? '#ffd84a' : res.result === 'rest' ? '#f4f0e0' : '#ff7a6a' };
  game.phase = 'result';
  game.resultT = res.result === 'holed' ? 2.4 : 1.6;
}

// Match play: once a player can no longer halve the hole, they pick up and lose it.
function concedeLostHoles() {
  if (game.format !== 'match') return;
  const done = game.players.filter((q) => q.holed);
  if (!done.length) return;
  const best = Math.min(...done.map((q) => q.strokes));
  for (const q of game.players) {
    if (!q.holed && q.strokes >= best) {
      q.holed = true; q.pickedUp = true; q.strokes += 1;
      q.scores[game.holeIdx] = q.strokes;
      game.conceded = q.name;
    }
  }
}

// Points and results for the formats, hole by hole.
function stablefordPoints(score, par) { return score == null ? 0 : Math.max(0, 2 - (score - par)); }
function matchStatus() {
  const r = game.match.results;
  const up = r.filter((v) => v === 0).length - r.filter((v) => v === 1).length;
  return { up, left: game.holeList.length - r.length };
}
function matchText(up, left, final) {
  if (up === 0) return final ? 'MATCH HALVED' : 'ALL SQUARE';
  const lead = game.players[up > 0 ? 0 : 1].name;
  const n = Math.abs(up);
  if (n > left) return `${lead} WINS ${left ? `${n} & ${left}` : `${n} UP`}`;
  if (final) return `${lead} WINS ${n} UP`;
  return `${lead} ${n} UP${n === left ? ' (DORMIE)' : ''}`;
}
// The column on the right of the panel and the card for each player.
function standing(p, i) {
  switch (game.format) {
    case 'range': return { text: game.stats.longest ? `${game.stats.longest}Y` : '-', color: C.gold };
    case 'putting': return { text: `${game.stats.made}/${game.stats.balls}`, color: C.gold };
    case 'stableford': return { text: `${p.scores.reduce((t, s, k) => t + stablefordPoints(s, parFor(k)), 0)}PT`, color: C.gold };
    case 'skins': { const n = game.skins.winners.filter((w) => w && w.who === i).reduce((t, w) => t + w.skins, 0); return { text: `${n}SK`, color: n ? C.gold : C.text }; }
    case 'match': { const { up } = matchStatus(); const me = i === 0 ? up : -up; return { text: me === 0 ? 'AS' : me > 0 ? `${me}UP` : `${-me}DN`, color: me > 0 ? C.red : me < 0 ? C.cyan : C.text }; }
    default: { const tp = toPar(p); return { text: parText(tp), color: tp < 0 ? C.red : tp > 0 ? C.cyan : C.text }; }
  }
}
function scoreHole() {
  const h = game.holeIdx;
  const sc = game.players.map((q) => q.scores[h]);
  const best = Math.min(...sc);
  const winners = sc.map((v, i) => i).filter((i) => sc[i] === best);
  if (game.format === 'skins') {
    if (winners.length === 1) {
      const n = 1 + game.skins.carry;
      game.skins.winners[h] = { who: winners[0], skins: n };
      game.skins.carry = 0;
      return { title: `${game.players[winners[0]].name} WINS ${n} SKIN${n > 1 ? 'S' : ''}`, color: C.gold };
    }
    game.skins.carry++;
    return { title: `SKIN CARRIES OVER`, sub: `${game.skins.carry + 1} SKINS ON THE NEXT HOLE`, color: C.cyan };
  }
  if (game.format === 'match') {
    game.match.results[h] = winners.length === 1 ? winners[0] : -1;
    const { up, left } = matchStatus();
    if (Math.abs(up) > left || left === 0) game.match.over = true;
    return { title: winners.length === 1 ? `${game.players[winners[0]].name} WINS THE HOLE` : 'HOLE HALVED', sub: matchText(up, left, left === 0), color: C.gold };
  }
  if (game.format === 'stableford') {
    return { title: game.players.map((q) => `${q.name.slice(0, 8)} ${stablefordPoints(q.scores[h], parFor(h))}`).join('  '), sub: 'STABLEFORD POINTS', color: C.gold };
  }
  return null;
}

function holeFinished() {
  game.phase = 'done';
  game.holeNews = scoreHole();
  // Honour: best score on this hole tees off first next time.
  game.honour = [...game.honour].sort((a, b) => game.players[a].scores[game.holeIdx] - game.players[b].scores[game.holeIdx]);
  game.showCard = true;
  game.cardWait = true;
  sfx('jingle');
}

function continueAfterCard(next = false) {
  game.showCard = false;
  game.cardWait = false;
  if (game.format === 'practice') {
    // Again on the same hole, or N for the next one.
    if (next) game.holeList = [(game.holeList[0] + 1) % game.course.holes.length];
    for (const p of game.players) p.scores = [];
    game.cam = null;
    return loadHole();
  }
  if (game.match.over) { game.mode = 'final'; sfx('clap'); return; }
  if (game.holeIdx + 1 >= game.holeList.length) { game.mode = 'final'; sfx('clap'); return; }
  game.holeIdx++;
  game.cam = null;
  loadHole();
}

// ---------- Scores ----------

function parFor(i) { return game.course.holes[game.holeList[i]].par; }
function toPar(p) {
  let t = 0;
  p.scores.forEach((s, i) => { if (s != null) t += s - parFor(i); });
  return t;
}
const parText = (v) => (v === 0 ? 'E' : v > 0 ? `+${v}` : `${v}`);

// ---------- Minimap ----------

function makeMinimap(w) {
  const MW = 136, MH = 92;
  // Only the ground that matters: the hole's own extent, not all the woods.
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let j = 0; j < w.ny; j += 2) for (let i = 0; i < w.nx; i += 2) {
    const s = w.surf[j * w.nx + i];
    if (s !== 0 && s !== 9 && s !== 12) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
  }
  x0 -= 8; x1 += 8; y0 -= 8; y1 += 8;
  const scale = Math.min(MW / (x1 - x0), MH / (y1 - y0));
  const c = document.createElement('canvas');
  c.width = MW; c.height = MH;
  const g = c.getContext('2d');
  const img = g.createImageData(MW, MH);
  const px = new Uint32Array(img.data.buffer);
  const ox = (MW - (x1 - x0) * scale) / 2, oy = (MH - (y1 - y0) * scale) / 2;
  const colours = SURF_NAMES.map((n) => w.look.ground[n] ?? w.look.ground.rough);
  for (let my = 0; my < MH; my++) for (let mx = 0; mx < MW; mx++) {
    const i = Math.floor(x0 + (mx - ox) / scale), j = Math.floor(y1 - (my - oy) / scale);
    let s = 12;
    if (i >= 0 && j >= 0 && i < w.nx && j < w.ny) s = w.surf[j * w.nx + i];
    const [r, gg, b] = colours[s];
    const dim = s === 0 || s === 9 || s === 12 ? 0.55 : 1;
    px[my * MW + mx] = s === 12 ? 0xff1c1a14 : pack(r * dim, gg * dim, b * dim);
  }
  g.putImageData(img, 0, 0);
  return {
    canvas: c, W: MW, H: MH,
    toMap: (p) => ({ x: ox + (p.x - w.x0 - x0) * scale, y: oy + (y1 - (p.y - w.y0)) * scale }),
  };
}

// ---------- Drawing ----------

function drawScene() {
  const cam = game.cam;
  const w = game.world;
  const p = game.players[game.cur];
  if (game.dirty) {
    let clear;
    if (game.phase === 'fly') clear = { x: game.fly.to.ball.x, y: game.fly.to.ball.y, r: 6.5 };
    else if (game.flight && game.flight.following && cam.ball) {
      const mx = (cam.x + cam.ball.x) / 2, my = (cam.y + cam.ball.y) / 2;
      clear = { x: mx, y: my, r: Math.hypot(cam.x - cam.ball.x, cam.y - cam.ball.y) / 2 + 3 };
    } else clear = { x: p.ball.x, y: p.ball.y, r: 6.5 };
    renderScene(view, w, cam, { backdrop: game.backdrop, sprites: game.art.sprites }, { clear });
    game.dirty = false;
  }
  restoreScene(view);
  const pin = pinOf();
  const gp = groundAt(w, pin.x, pin.y);
  // The cup.
  const cup = project3(cam, VW, pin.x, pin.y, gp);
  if (cup) fillEllipse(view, cup.x, cup.y, Math.max(1, (CUP_R * cam.f) / cup.t), Math.max(0.6, (CUP_R * cam.f) / cup.t * 0.4), 0xff101410, cup.t);
  // The flag (lifted out while a putt is close).
  drawSprite(view, cam, game.art.sprites.flag, pin.x, pin.y, gp, 2.6, false, w.look.haze);
  // Range yardage flags.
  for (const f of rangeFlags()) drawSprite(view, cam, game.art.sprites.flag, f.x, f.y, groundAt(w, f.x, f.y), 3.5, false, w.look.haze);
  // Other balls at rest.
  game.players.forEach((q, i) => {
    if (q.holed) return;
    if (i === game.cur && (game.phase === 'flight' || game.phase === 'aim' || game.phase === 'swing')) return;
    drawBall(view, cam, q.ball.x, q.ball.y, groundAt(w, q.ball.x, q.ball.y), groundAt(w, q.ball.x, q.ball.y), { shadow: false });
  });
  // The aim marker: where a full shot with this club would carry, on calm flat ground.
  if (game.phase === 'aim' || game.phase === 'swing') {
    drawAimMarker();
    if (!(game.phase === 'swing' && game.swing.stage === 3 && game.swing.launched)) {
      drawBall(view, cam, p.ball.x, p.ball.y, groundAt(w, p.ball.x, p.ball.y), groundAt(w, p.ball.x, p.ball.y));
    }
  }
  if (game.phase === 'flight' || game.phase === 'result') {
    const fl = game.flight;
    const path = fl.res.path;
    const k = Math.min(path.length - 1, Math.floor(fl.i));
    // A faint trail.
    for (let j = Math.max(0, k - 90); j < k; j += 3) {
      const q = path[j];
      const sp = project3(cam, VW, q.x, q.y, q.z);
      if (sp && sp.x >= 0 && sp.x < VW && sp.y >= 0 && sp.y < VH) {
        const pi = Math.floor(sp.y) * VW + Math.floor(sp.x);
        if (view.depth[pi] > sp.t) view.px[pi] = pack(255, 255, 255);
      }
    }
    const q = path[k];
    if (!(game.phase === 'result' && fl.res.result !== 'rest')) drawBall(view, cam, q.x, q.y, q.z, groundAt(w, q.x, q.y));
  }
  ctx.putImageData(view.img, 0, 0);
  // Yardages over the range flags, where the flag top can be seen.
  // Nearest first; a farther label is skipped if it would sit on top of a nearer one.
  const placed = [];
  for (const f of rangeFlags()) {
    const sp = project3(cam, VW, f.x, f.y, groundAt(w, f.x, f.y) + 3.4);
    if (!sp || sp.x < 6 || sp.x >= VW - 6 || sp.y < 4 || sp.y >= VH) continue;
    if (view.depth[Math.floor(sp.y) * VW + Math.floor(sp.x)] < sp.t - 0.5) continue;
    const lx = Math.round(sp.x), ly = Math.round(sp.y) - 7;
    if (placed.some((q) => Math.abs(q.x - lx) < 14 && Math.abs(q.y - ly) < 7)) continue;
    placed.push({ x: lx, y: ly });
    smallText(ctx, `${f.d}`, lx, ly, '#ffffff', { align: 'center', shadow: '#10121c' });
  }
  // The golfer.
  if ((game.phase === 'aim' || game.phase === 'swing') && game.cur >= 0) drawGolfer(p, p.ball);
  else if ((game.phase === 'flight' || game.phase === 'result') && game.flight && !game.flight.following) drawGolfer(p, game.flight.from);
}

function drawAimMarker() {
  const cam = game.cam, w = game.world;
  const p = game.players[game.cur];
  const putt = game.club === PUTTER;
  let d;
  if (putt) d = Math.max(0.5, Math.min(distTo(p.ball, pinOf()), PUTT_RANGES[game.puttRange]));
  else d = clubYards(p);
  const ax = p.ball.x + Math.sin(game.aimYaw) * d, ay = p.ball.y + Math.cos(game.aimYaw) * d;
  const az = groundAt(w, ax, ay);
  if (putt) {
    // A little post; its shadow falls the way the green runs, longer where it's steeper.
    const sl = groundSlope(w, ax, ay, 0.7);
    const k = 45; // yards of shadow per unit of slope
    const sx = ax - sl.x * k, sy = ay - sl.y * k;
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const q = project3(cam, VW, ax + (sx - ax) * u, ay + (sy - ay) * u, groundAt(w, ax + (sx - ax) * u, ay + (sy - ay) * u));
      if (q) fillEllipse(view, q.x, q.y, Math.max(1, (0.05 * cam.f) / q.t), Math.max(0.8, (0.03 * cam.f) / q.t), 0xff000000, q.t, 0.5);
    }
    const base = project3(cam, VW, ax, ay, az), tip = project3(cam, VW, ax, ay, az + 0.35);
    if (base && tip) {
      const r = Math.max(1, (0.025 * cam.f) / base.t);
      for (let y = Math.floor(tip.y); y <= base.y; y++) fillEllipse(view, base.x, y, r, 0.6, 0xff40e8ff, base.t - 0.05);
      fillEllipse(view, tip.x, tip.y, r * 1.8, r * 1.8, 0xff3a3aff, base.t - 0.06);
    }
    return;
  }
  const sp = project3(cam, VW, ax, ay, az);
  if (!sp) return;
  const r = Math.max(2, Math.min(10, (1.6 * cam.f) / sp.t));
  const col = 0xff40e8ff;
  for (let a = 0; a < 16; a++) {
    const th = (a / 16) * Math.PI * 2;
    const x = Math.round(sp.x + Math.cos(th) * r), y = Math.round(sp.y + Math.sin(th) * r * 0.45);
    if (x >= 0 && x < VW && y >= 0 && y < VH && (a & 1) === 0) view.px[y * VW + x] = col;
  }
  for (let k = -2; k <= 2; k++) {
    const x = Math.round(sp.x + k), y = Math.round(sp.y);
    if (x >= 0 && x < VW && y >= 0 && y < VH) view.px[y * VW + x] = col;
    const y2 = Math.round(sp.y + k), x2 = Math.round(sp.x);
    if (x2 >= 0 && x2 < VW && y2 >= 0 && y2 < VH) view.px[y2 * VW + x2] = col;
  }
}

// Frames: swing00 address, 01-05 back to the top, 06 the top, 07 coming down,
// 08 impact, 09-10 through, 11 turning to the target, 12 the finish (from behind).
// Putts: 00 address, 01-04 back, 05-08 through.
function golferFrame() {
  const s = game.swing;
  const t = s && s.stage === 3 ? s.anim + (game.flight ? game.flight.t : 0) : 0;
  if (game.club === PUTTER) {
    const seq = game.art.putt;
    if (!s || game.phase === 'aim') return seq[0];
    if (s.stage === 1) return seq[Math.min(4, Math.round(s.level * 4))];
    return seq[Math.min(seq.length - 1, Math.max(5, 4 + Math.floor(t / 0.07)))];
  }
  const seq = game.art.swing;
  if (!s || game.phase === 'aim') return seq[0];
  if (s.stage === 1) return seq[Math.min(5, Math.round(s.level * 5))];
  if (s.stage === 2) return seq[6];
  // Down, through the ball on frame 8, and hold the finish.
  return seq[Math.min(seq.length - 1, 7 + Math.floor(t / (t < 0.12 ? 0.06 : 0.09)))];
}

// The golfer stands side on, level with the ball, scaled to the world like everything else.
function drawGolfer(p, at) {
  const cam = game.cam;
  const w = game.world;
  const b = project3(cam, VW, at.x, at.y, groundAt(w, at.x, at.y));
  const im = game.art.golferFor(p.shirt)[golferFrame()];
  if (!b || !im) return;
  const scale = (GOLFER_YARDS * cam.f) / b.t / game.art.golferPx;
  const [bx, by] = game.art.ball;
  ctx.drawImage(im, Math.round(b.x - bx * scale), Math.round(b.y - by * scale), Math.round(im.width * scale), Math.round(im.height * scale));
}

// ---------- HUD panel ----------

const C = { panel: '#1a1d2e', edge: '#2c3150', dim: '#7c82a8', text: '#f4f0e0', gold: '#ffd84a', red: '#ff6a5a', green: '#7ee07a', cyan: '#5ce8ff' };

function drawPanel() {
  const X = VW;
  ctx.fillStyle = C.panel;
  ctx.fillRect(X, 0, PANEL, SH);
  ctx.fillStyle = C.edge;
  ctx.fillRect(X, 0, 2, SH);
  // Title strip.
  ctx.fillStyle = '#242944';
  ctx.fillRect(X + 2, 0, PANEL - 2, 13);
  bigText(ctx, 'PIN HIGH', X + 8, 3, C.gold);
  smallText(ctx, isMuted() ? 'SOUND OFF' : '', X + PANEL - 4, 5, C.dim, { align: 'right' });
  if (!game.hole) return;
  const n = game.holeList[game.holeIdx];
  let y = 17;
  bigText(ctx, `HOLE ${n + 1}`, X + 8, y, C.text);
  bigText(ctx, `PAR ${game.hole.par}`, X + PANEL - 6, y, C.text, { align: 'right' });
  y += 10;
  smallText(ctx, `${game.holeYards} YDS`, X + 8, y, C.dim);
  smallText(ctx, game.course.name.slice(0, 22), X + PANEL - 6, y, C.dim, { align: 'right' });
  y += 9;
  // Players.
  game.players.forEach((q, i) => {
    const cur = i === game.cur && !q.holed && game.phase !== 'done';
    if (cur) { ctx.fillStyle = '#2e3558'; ctx.fillRect(X + 4, y - 2, PANEL - 8, 10); }
    const [r, g, b] = SHIRTS[q.shirt].rgb;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(X + 7, y, 4, 5);
    smallText(ctx, q.name.slice(0, 12), X + 14, y, cur ? C.gold : C.text);
    smallText(ctx, q.holed ? `${q.strokes}` : q.strokes ? `${q.strokes}` : '-', X + 96, y, C.dim, { align: 'right' });
    const sd = standing(q, i);
    smallText(ctx, sd.text, X + PANEL - 8, y, sd.color, { align: 'right' });
    y += 10;
  });
  y += 1;
  // Minimap.
  const mm = game.minimap;
  const my = y;
  ctx.drawImage(mm.canvas, X + 4, my);
  ctx.strokeStyle = C.edge;
  ctx.strokeRect(X + 3.5, my - 0.5, mm.W + 1, mm.H + 1);
  const pinm = mm.toMap(pinOf());
  ctx.fillStyle = '#ff3a3a';
  ctx.fillRect(X + 4 + Math.round(pinm.x), my + Math.round(pinm.y) - 3, 1, 4);
  ctx.fillRect(X + 4 + Math.round(pinm.x) + 1, my + Math.round(pinm.y) - 3, 2, 2);
  const pc = game.players[game.cur];
  if (pc && (game.phase === 'aim' || game.phase === 'swing')) {
    const a = mm.toMap(pc.ball);
    const d = game.club === PUTTER ? 0 : CLUBS[game.club].carry;
    const t = mm.toMap({ x: pc.ball.x + Math.sin(game.aimYaw) * d, y: pc.ball.y + Math.cos(game.aimYaw) * d });
    ctx.strokeStyle = 'rgba(92,232,255,0.8)';
    ctx.beginPath(); ctx.moveTo(X + 4 + a.x, my + a.y); ctx.lineTo(X + 4 + t.x, my + t.y); ctx.stroke();
  }
  game.players.forEach((q, i) => {
    if (q.holed) return;
    let bp = q.ball;
    if (i === game.cur && game.phase === 'flight') {
      const pt = game.flight.res.path[Math.floor(game.flight.i)];
      bp = pt;
    }
    const a = mm.toMap(bp);
    const [r, g, b] = SHIRTS[q.shirt].rgb;
    ctx.fillStyle = '#000';
    ctx.fillRect(X + 3 + Math.round(a.x), my - 1 + Math.round(a.y), 3, 3);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(X + 4 + Math.round(a.x), my + Math.round(a.y), 1, 1);
  });
  y = my + mm.H + 5;
  // Club, distance, lie.
  if (pc) {
    const clubName = game.club === PUTTER ? `PUTTER ${Math.round(PUTT_RANGES[game.puttRange] * 3)}FT` : CLUBS[game.club].name;
    bigText(ctx, clubName, X + 8, y, C.gold);
    if (game.club !== PUTTER) bigText(ctx, `${clubYards(pc)}Y`, X + PANEL - 6, y, C.text, { align: 'right' });
    y += 10;
    const d = distTo(pc.ball, pinOf());
    if (game.putting || d < 20) smallText(ctx, `TO HOLE ${Math.round(d * 3)} FEET`, X + 8, y, C.text);
    else smallText(ctx, `TO PIN ${Math.round(d)} YDS`, X + 8, y, C.text);
    const rise = groundAt(game.world, pinOf().x, pinOf().y) - groundAt(game.world, pc.ball.x, pc.ball.y);
    if (Math.abs(rise) >= (game.putting ? 0.05 : 1)) {
      const txt = game.putting ? `${rise > 0 ? 'UP' : 'DOWN'} ${Math.round(Math.abs(rise) * 36)}IN` : `${rise > 0 ? 'UP' : 'DOWN'} ${Math.round(Math.abs(rise))}`;
      smallText(ctx, txt, X + PANEL - 6, y, rise > 0 ? C.red : C.green, { align: 'right' });
    }
    y += 8;
    const g = LIE_GRADES[pc.grade];
    const [ra, rb] = g ? g.range : [1, 1];
    smallText(ctx, `LIE ${g ? g.name : ''}`, X + 8, y, ra < 1 ? C.red : C.dim);
    if (ra < 1 && game.club !== PUTTER) smallText(ctx, ra === rb ? `${Math.round(ra * 100)}%` : `${Math.round(ra * 100)}-${Math.round(rb * 100)}%`, X + PANEL - 6, y, C.red, { align: 'right' });
    y += 9;
  }
  drawWind(X + 26, y + 15);
  drawMeter(X + 58, SH - 76);
}

function drawWind(cx, cy) {
  smallText(ctx, 'WIND', cx - 18, cy - 15, C.dim);
  ctx.strokeStyle = '#3a4068';
  ctx.beginPath(); ctx.arc(cx + 0.5, cy + 0.5, 11, 0, Math.PI * 2); ctx.stroke();
  const mph = game.windMph;
  smallText(ctx, mph ? `${mph} MPH` : 'CALM', cx, cy + 15, C.text, { align: 'center' });
  if (!mph || !game.cam) return;
  const a = camAxes(game.cam);
  const wf = game.wind.x * a.fx + game.wind.y * a.fy, wr = game.wind.x * a.rx + game.wind.y * a.ry;
  const m = Math.hypot(wf, wr) || 1;
  const ux = wr / m, uy = -wf / m;
  ctx.strokeStyle = C.cyan; ctx.fillStyle = C.cyan;
  ctx.beginPath(); ctx.moveTo(cx + 0.5 - ux * 8, cy + 0.5 - uy * 8); ctx.lineTo(cx + 0.5 + ux * 8, cy + 0.5 + uy * 8); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 0.5 + ux * 10, cy + 0.5 + uy * 10);
  ctx.lineTo(cx + 0.5 + ux * 5 - uy * 4, cy + 0.5 + uy * 5 + ux * 4);
  ctx.lineTo(cx + 0.5 + ux * 5 + uy * 4, cy + 0.5 + uy * 5 - ux * 4);
  ctx.fill();
}

// The meter, Leaderboard fashion: a tall bar with a POWER section and, below
// it, a SNAP section. The power climbs while the button is held; once let go,
// the marker drops down into the snap section towards the snap line.
function drawMeter(x, y) {
  const putt = game.club === PUTTER;
  const lo = putt ? 0 : SNAP_BOTTOM, hi = 1.1;
  const H = 70, W = 10, top = y, bottom = y + H;
  const lv = (v) => Math.round(bottom - ((v - lo) / (hi - lo)) * H);
  ctx.fillStyle = '#0c0e18'; ctx.fillRect(x - 2, top - 2, W + 4, H + 4);
  ctx.fillStyle = '#9aa0b8'; ctx.fillRect(x, top, W, H);
  ctx.fillStyle = '#6a7090'; ctx.fillRect(x + W - 3, top, 3, H);
  // Ticks every 10%, a longer one at full power.
  for (let k = 0; k <= 11; k++) { ctx.fillStyle = k === 10 ? '#ffffff' : '#3a4060'; ctx.fillRect(x - 4, lv(k / 10), k % 5 ? 4 : 6, 1); }
  ctx.fillStyle = '#c84a40'; ctx.fillRect(x, top, W, lv(1) - top);
  const bracket = (v0, v1, label, col) => {
    const a = lv(v1), b = lv(v0);
    ctx.fillStyle = col;
    ctx.fillRect(x + W + 4, a, 1, b - a); ctx.fillRect(x + W + 4, a, 3, 1); ctx.fillRect(x + W + 4, b - 1, 3, 1);
    smallText(ctx, label, x + W + 9, Math.round((a + b) / 2) - 2, col);
  };
  bracket(0, hi, putt ? 'PUTT' : 'POWER', C.gold);
  if (!putt) {
    ctx.fillStyle = '#5a6080'; ctx.fillRect(x, lv(0), W, 1);
    const tol = game.diff ? game.diff.tol : 0.035;
    ctx.fillStyle = '#4caf5a';
    ctx.fillRect(x, lv(SNAP_LINE + tol), W, Math.max(1, lv(SNAP_LINE - tol) - lv(SNAP_LINE + tol)));
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, lv(SNAP_LINE), W + 4, 1);
    bracket(SNAP_BOTTOM, 0, 'SNAP', C.green);
  }
  const s = game.swing;
  if (s) {
    const pw = Math.min(hi, s.stage === 1 ? s.level : s.power);
    ctx.fillStyle = s.stage === 1 ? (pw > 1 ? '#ff6a5a' : '#ffd84a') : '#b89a3a';
    ctx.fillRect(x + 1, lv(pw), W - 2, lv(0) - lv(pw));
    if (s.stage >= 2 && !putt) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 3, lv(s.stage === 2 ? s.level : s.snap) - 1, W + 6, 2);
    }
  }
  // Novices get a tick for the hole's distance on a flat green.
  if (putt && game.cur >= 0 && game.setup.difficulty === 0) {
    const d = distTo(game.players[game.cur].ball, pinOf()) / PUTT_RANGES[game.puttRange];
    if (d <= 1.1) { ctx.fillStyle = '#ff3a3a'; ctx.fillRect(x - 5, lv(d) - 1, 4, 3); }
  }
  const tx = x - 54;
  if (s && s.stage >= 1) {
    const pw = Math.round((s.stage === 1 ? s.level : s.power) * 100);
    smallText(ctx, putt ? `${Math.round(PUTT_RANGES[game.puttRange] * 3 * (pw / 100))} FT` : `${pw}%`, tx, top + 2, pw > 100 ? C.red : C.gold);
    if (!putt) smallText(ctx, `${Math.round((clubYards(game.players[game.cur]) * pw) / 100)} YDS`, tx, top + 10, C.text);
  }
  if (s && s.stage === 3 && !putt) {
    const e = snapEffect(s.snap, 1);
    const txt = Math.abs(e) < 0.01 ? 'PURE' : e > 0 ? (e > 0.6 ? 'HOOK' : 'DRAW') : (e < -0.6 ? 'SLICE' : 'FADE');
    smallText(ctx, txt, tx, top + 18, C.cyan);
  }
  const help = putt ? ['HOLD SPACE', 'OR MOUSE,', 'LET GO TO', 'PUTT'] : ['HOLD FOR', 'POWER, LET', 'GO, PRESS', 'ON SNAP'];
  help.forEach((l, i) => smallText(ctx, l, tx, top + 30 + i * 8, C.dim));
}

// ---------- Overlays ----------

function drawBanner(dt) {
  const b = game.banner;
  if (!b) return;
  b.t -= dt;
  if (b.t <= 0) { game.banner = null; return; }
  const w = Math.max(bigWidth(b.title, 2), b.sub ? b.sub.length * 4 : 0) + 24;
  const x = Math.round(VW / 2 - w / 2), y = 22;
  ctx.fillStyle = 'rgba(14,16,28,0.78)';
  ctx.fillRect(x, y, w, b.sub ? 34 : 24);
  ctx.fillStyle = b.color ?? C.gold;
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + (b.sub ? 33 : 23), w, 1);
  bigText(ctx, b.title, VW / 2, y + 6, b.color ?? C.gold, { scale: 2, align: 'center' });
  if (b.sub) smallText(ctx, b.sub, VW / 2, y + 24, C.text, { align: 'center' });
}

function drawHints() {
  if (!game.hints || game.phase !== 'aim') return;
  const lines = ['LEFT/RIGHT OR DRAG: AIM', 'UP/DOWN OR WHEEL: CLUB', 'HOLD SPACE OR MOUSE FOR POWER,', 'LET GO, THEN PRESS ON THE SNAP', 'TAB: CARD  M: SOUND  C: BALL CAM'];
  if (game.format === 'practice') lines.push('U: MULLIGAN');
  if (game.format === 'range') lines.push('N: NEXT HOLE');
  if (game.format === 'putting') lines.push('U: SAME PUTT AGAIN  N: NEXT GREEN');
  ctx.fillStyle = 'rgba(14,16,28,0.7)';
  ctx.fillRect(4, VH - 8 - lines.length * 8, 128, lines.length * 8 + 4);
  lines.forEach((l, i) => smallText(ctx, l, 8, VH - 6 - (lines.length - i) * 8 + 2, C.text));
}

function drawScorecard() {
  const players = game.players;
  const holes = game.holeList;
  const nine = holes.length > 9 ? [holes.slice(0, 9), holes.slice(9)] : [holes];
  const rowH = 9;
  const h = 26 + nine.length * (rowH * (players.length + 2) + 6) + 23;
  const w = VW - 16;
  const x0 = 8, y0 = Math.max(4, Math.round((VH - h) / 2));
  ctx.fillStyle = 'rgba(12,14,26,0.92)';
  ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = C.gold;
  ctx.fillRect(x0, y0, w, 1); ctx.fillRect(x0, y0 + h - 1, w, 1);
  bigText(ctx, 'SCORECARD', x0 + w / 2, y0 + 6, C.gold, { align: 'center' });
  smallText(ctx, game.course.name, x0 + w / 2, y0 + 16, C.dim, { align: 'center' });
  let y = y0 + 26;
  const colW = 24, nameW = 52;
  nine.forEach((set) => {
    smallText(ctx, 'HOLE', x0 + 6, y, C.dim);
    set.forEach((hn, k) => smallText(ctx, `${hn + 1}`, x0 + nameW + k * colW + 8, y, C.dim, { align: 'center' }));
    smallText(ctx, 'TOT', x0 + nameW + 9 * colW + 10, y, C.dim, { align: 'center' });
    y += rowH;
    smallText(ctx, 'PAR', x0 + 6, y, C.dim);
    let pt = 0;
    set.forEach((hn, k) => { const par = game.course.holes[hn].par; pt += par; smallText(ctx, `${par}`, x0 + nameW + k * colW + 8, y, C.text, { align: 'center' }); });
    smallText(ctx, `${pt}`, x0 + nameW + 9 * colW + 10, y, C.text, { align: 'center' });
    y += rowH;
    players.forEach((p, pi) => {
      const [r, g, b] = SHIRTS[p.shirt].rgb;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x0 + 4, y, 3, 5);
      smallText(ctx, p.name.slice(0, 10), x0 + 10, y, C.text);
      let tot = 0, any = false;
      set.forEach((hn, k) => {
        const idx = holes.indexOf(hn);
        const s = p.scores[idx];
        if (s == null) return;
        any = true; tot += s;
        const par = game.course.holes[hn].par;
        const cx = x0 + nameW + k * colW + 8;
        if (s < par) { ctx.strokeStyle = C.red; ctx.beginPath(); ctx.arc(cx + 0.5, y + 2.5, 5, 0, Math.PI * 2); ctx.stroke(); }
        if (s > par) { ctx.strokeStyle = C.cyan; ctx.strokeRect(cx - 4.5, y - 2.5, 10, 10); }
        smallText(ctx, `${s}`, cx, y, s < par ? C.red : C.text, { align: 'center' });
        // The hole's winner in skins and match play, and Stableford points.
        const won = game.format === 'skins' ? game.skins.winners[idx]?.who === pi : game.format === 'match' ? game.match.results[idx] === pi : false;
        if (won) { ctx.fillStyle = C.gold; ctx.fillRect(cx + 5, y - 1, 2, 2); }
        if (game.format === 'stableford') smallText(ctx, `${stablefordPoints(s, parFor(idx))}`, cx + 9, y + 3, C.dim);
      });
      if (any) smallText(ctx, `${tot}`, x0 + nameW + 9 * colW + 10, y, C.gold, { align: 'center' });
      y += rowH;
    });
    y += 6;
  });
  // Totals to par.
  let parts = players.map((p, i) => `${p.name.slice(0, 10)} ${standing(p, i).text}`).join('   ');
  if (game.format === 'match') { const m = matchStatus(); parts = matchText(m.up, m.left, m.left === 0); }
  if (game.format === 'skins' && game.skins.carry) parts += `   (${game.skins.carry} CARRIED)`;
  smallText(ctx, parts, x0 + w / 2, y, C.gold, { align: 'center' });
  const news = game.cardWait && game.holeNews;
  if (news) smallText(ctx, news.sub ? `${news.title}  ${news.sub}` : news.title, x0 + w / 2, y + 9, news.color, { align: 'center' });
  if (game.cardWait) smallText(ctx, game.format === 'practice' ? 'SPACE: PLAY IT AGAIN   N: NEXT HOLE' : game.match.over ? 'SPACE OR CLICK: MATCH OVER' : 'SPACE OR CLICK TO CONTINUE', x0 + w / 2, y0 + h - 9 + 12 > VH ? y0 + h - 9 : y0 + h + 3, C.text, { align: 'center' });
}

// ---------- Title, setup, final ----------

// A slowly turning view of a showpiece hole behind the menus.
function setupShowcase() {
  const course = buildCourse({ name: 'SHOWCASE', style: 'parkland', par: 72, length: 'standard', seed: 1986 });
  const hole = course.holes[1];
  const look = lookFor('parkland');
  game.show = { world: buildWorld(hole, look), hole, yaw: 0, backdrop: game.art.backdrops.parkland };
}

const showView = makeView(SW, SH);
function drawShowcase(dt) {
  const s = game.show;
  // Glide down the fairway towards the green, over and over.
  s.u = ((s.u ?? 0) + dt / 40) % 1;
  const line = s.hole.line;
  const at = pointAt(line, 40 + s.u * (line.length - 170), 0);
  const pin = s.hole.pin;
  const yaw = Math.atan2(pin.x - at.x, pin.y - at.y) + Math.sin(game.t * 0.15) * 0.25;
  const cam = { x: at.x, y: at.y, yaw, eye: groundAt(s.world, at.x, at.y) + 7, horizon: 110, f: 280 };
  renderScene(showView, s.world, cam, { backdrop: s.backdrop, sprites: game.art.sprites }, {});
  drawSprite(showView, cam, game.art.sprites.flag, pin.x, pin.y, groundAt(s.world, pin.x, pin.y), 2.6, false, s.world.look.haze);
  ctx.putImageData(showView.img, 0, 0);
}

// The title: Pixellab illustrations at twice their size, slowly crossfading.
const TITLE_HOLD = 9, TITLE_FADE = 1.5;
function drawTitle(dt) {
  const ims = game.art.titles;
  const t = game.t % (ims.length * TITLE_HOLD);
  const i = Math.floor(t / TITLE_HOLD), u = t - i * TITLE_HOLD;
  ctx.globalAlpha = 1;
  ctx.drawImage(ims[i], 0, 0, SW, SH);
  if (u > TITLE_HOLD - TITLE_FADE) {
    ctx.globalAlpha = (u - (TITLE_HOLD - TITLE_FADE)) / TITLE_FADE;
    ctx.drawImage(ims[(i + 1) % ims.length], 0, 0, SW, SH);
    ctx.globalAlpha = 1;
  }
  // A soft band behind the logo and the prompt so they read over any picture.
  const band = (y, h, a) => {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(10,12,24,0)'); g.addColorStop(0.5, `rgba(10,12,24,${a})`); g.addColorStop(1, 'rgba(10,12,24,0)');
    ctx.fillStyle = g; ctx.fillRect(0, y, SW, h);
  };
  band(SH - 56, 56, 0.6);
  game.logo ??= makeLogo();
  const L = game.logo, k = 3;
  ctx.drawImage(L, 22, 4, L.width * k, L.height * k); // top left, clear of the golfers in the pictures
  if (Math.floor(game.t * 2) % 2 === 0) bigText(ctx, 'PRESS SPACE OR CLICK TO PLAY', SW / 2, SH - 34, '#ffffff', { align: 'center', shadow: '#10121c' });
  smallText(ctx, 'ART MADE WITH PIXELLAB', SW - 6, SH - 9, C.dim, { align: 'right', shadow: '#10121c' });
}

function setupRows() {
  const st = game.setup;
  const rows = [{ key: 'count', label: 'PLAYERS', value: `${st.count}` }];
  for (let i = 0; i < st.count; i++) rows.push({ key: 'player', i, label: `PLAYER ${i + 1}`, value: st.editing === i ? `${st.players[i].name}_` : st.players[i].name, shirt: st.players[i].shirt });
  rows.push({ key: 'format', label: 'GAME', value: FORMATS[st.format].name, note: FORMATS[st.format].note });
  rows.push({ key: 'difficulty', label: 'LEVEL', value: DIFFICULTY[st.difficulty].name, note: DIFFICULTY[st.difficulty].note });
  const named = st.course > 0 ? NAMED[st.course - 1] : null;
  rows.push({ key: 'course', label: 'COURSE', value: named ? named.name : 'RANDOM COURSE', note: named ? `${STYLE_NAMES[named.style]}, ${named.tour.toUpperCase()} LEVEL` : 'A NEW COURSE FROM A SEED' });
  if (!named) {
    rows.push({ key: 'style', label: 'STYLE', value: STYLE_NAMES[STYLE_KEYS[st.style]] });
    rows.push({ key: 'seed', label: 'SEED', value: `${st.seed}`, note: `${randomCourseName(STYLE_KEYS[st.style], st.seed)}  (R: NEW SEED)` });
  }
  if (FORMATS[st.format].key === 'practice') rows.push({ key: 'practiceHole', label: 'HOLE', value: `${st.practiceHole + 1}` });
  else if (!['range', 'putting'].includes(FORMATS[st.format].key)) rows.push({ key: 'holes', label: 'ROUND', value: HOLE_SETS[st.holes].name });
  rows.push({ key: 'tee', label: 'TEES', value: TEES[st.tee].name });
  rows.push({ key: 'start', label: '', value: 'TEE OFF!' });
  return rows;
}

function changeSetup(row, dir) {
  const st = game.setup;
  const wrap = (v, n) => (v + n) % n;
  switch (row.key) {
    case 'count': st.count = Math.max(FORMATS[st.format].min, Math.min(FORMATS[st.format].max, st.count + dir)); break;
    case 'format': st.format = wrap(st.format + dir, FORMATS.length); st.count = Math.max(FORMATS[st.format].min, Math.min(FORMATS[st.format].max, st.count)); break;
    case 'practiceHole': st.practiceHole = wrap(st.practiceHole + dir, 18); break;
    case 'player': st.players[row.i].shirt = wrap(st.players[row.i].shirt + dir, SHIRTS.length); break;
    case 'difficulty': st.difficulty = wrap(st.difficulty + dir, DIFFICULTY.length); break;
    case 'course': st.course = wrap(st.course + dir, NAMED.length + 1); break;
    case 'style': st.style = wrap(st.style + dir, STYLE_KEYS.length); break;
    case 'seed': st.seed = Math.max(1, st.seed + dir); break;
    case 'holes': st.holes = wrap(st.holes + dir, HOLE_SETS.length); break;
    case 'tee': st.tee = wrap(st.tee + dir, TEES.length); break;
  }
  sfx('blip');
}

function activateSetup(row) {
  const st = game.setup;
  if (row.key === 'start') { sfx('jingle'); startRound(); }
  else if (row.key === 'player') { st.editing = st.editing === row.i ? -1 : row.i; }
  else if (row.key === 'seed') { st.seed = 1 + Math.floor(Math.random() * 99999); sfx('blip'); }
  else changeSetup(row, 1);
}

const SETUP_Y0 = 46, SETUP_ROW = 17;
function drawSetup(dt) {
  drawShowcase(dt);
  ctx.fillStyle = 'rgba(10,12,24,0.72)';
  ctx.fillRect(0, 0, SW, SH);
  bigText(ctx, 'PIN HIGH', SW / 2, 12, C.gold, { scale: 2, align: 'center' });
  smallText(ctx, 'UP/DOWN: CHOOSE   LEFT/RIGHT OR CLICK: CHANGE   ENTER: SELECT', SW / 2, 32, C.dim, { align: 'center' });
  const rows = setupRows();
  const st = game.setup;
  st.row = Math.min(st.row, rows.length - 1);
  rows.forEach((r, i) => {
    const y = SETUP_Y0 + i * SETUP_ROW;
    const sel = i === st.row;
    if (sel) { ctx.fillStyle = 'rgba(255,216,74,0.12)'; ctx.fillRect(60, y - 4, SW - 120, SETUP_ROW - 1); }
    if (r.key === 'start') {
      bigText(ctx, r.value, SW / 2, y, sel ? C.gold : C.text, { align: 'center' });
      return;
    }
    bigText(ctx, r.label, 72, y, sel ? C.gold : C.dim);
    if (r.shirt != null) {
      const [cr, cg, cb] = SHIRTS[r.shirt].rgb;
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.fillRect(SW - 92, y - 1, 9, 9);
      smallText(ctx, SHIRTS[r.shirt].name, SW - 80, y + 1, C.dim);
    }
    if (sel) { bigText(ctx, '<', 160, y, C.gold); }
    bigText(ctx, r.value, 172, y, C.text);
    if (r.note) smallText(ctx, r.note, 172, y + 9, C.dim);
  });
  const sel = rows[st.row];
  if (sel.key === 'player') smallText(ctx, st.editing === sel.i ? 'TYPE A NAME, ENTER WHEN DONE' : 'ENTER: CHANGE NAME   LEFT/RIGHT: SHIRT COLOUR', SW / 2, SH - 12, C.text, { align: 'center' });
}

function drawFinal(dt) {
  drawShowcase(dt);
  ctx.fillStyle = 'rgba(10,12,24,0.75)';
  ctx.fillRect(0, 0, SW, SH);
  bigText(ctx, game.format === 'match' ? 'MATCH OVER' : 'ROUND OVER', SW / 2, 30, C.gold, { scale: 3, align: 'center' });
  smallText(ctx, game.course.name, SW / 2, 58, C.dim, { align: 'center' });
  if (game.format === 'match') {
    const m = matchStatus();
    bigText(ctx, matchText(m.up, m.left, true), SW / 2, 74, C.text, { scale: 2, align: 'center' });
  }
  const pts = (p) => p.scores.reduce((t, s, k) => t + stablefordPoints(s, parFor(k)), 0);
  const skins = (i) => game.skins.winners.filter((w) => w && w.who === i).reduce((t, w) => t + w.skins, 0);
  const order = game.players.map((p, i) => i);
  if (game.format === 'stableford') order.sort((a, b) => pts(game.players[b]) - pts(game.players[a]));
  else if (game.format === 'skins') order.sort((a, b) => skins(b) - skins(a));
  else if (game.format !== 'match') order.sort((a, b) => toPar(game.players[a]) - toPar(game.players[b]));
  const top = game.format === 'match' ? 100 : 80;
  order.forEach((pi, i) => {
    const p = game.players[pi];
    const y = top + i * 22;
    const tot = p.scores.reduce((t, s) => t + (s ?? 0), 0);
    bigText(ctx, `${i + 1}`, 140, y, C.gold, { scale: 2 });
    const [r, g, b] = SHIRTS[p.shirt].rgb;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(164, y + 2, 8, 10);
    bigText(ctx, p.name, 180, y + 3, C.text);
    bigText(ctx, `${tot}`, 330, y + 3, C.text, { align: 'right' });
    const sd = standing(p, pi);
    bigText(ctx, sd.text, 390, y + 3, sd.color, { align: 'right' });
  });
  if (Math.floor(game.t * 2) % 2 === 0) bigText(ctx, 'SPACE OR CLICK FOR THE CLUBHOUSE', SW / 2, SH - 30, '#ffffff', { align: 'center' });
}

// ---------- Input ----------

game.keysDown = new Set();

function aimBy(d) {
  if (game.mode !== 'play' || game.phase !== 'aim') return;
  game.aimYaw += d;
  game.shotCam = shotCamera(game.players[game.cur].ball, game.aimYaw);
  game.cam = { ...game.shotCam };
  game.dirty = true;
}

function clubBy(d) {
  if (game.mode !== 'play' || game.phase !== 'aim') return;
  if (game.club === PUTTER && game.putting) {
    game.puttRange = Math.max(0, Math.min(PUTT_RANGES.length - 1, game.puttRange - d));
  } else {
    const lie = game.players[game.cur].lie;
    game.club = Math.max(0, Math.min(PUTTER, game.club + d));
    if (game.club === 0 && lie !== 'tee' && lie !== 'fairway' && d < 0) game.club = 1;
  }
  sfx('blip');
}

window.addEventListener('keydown', (e) => {
  const k = e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(k)) e.preventDefault();
  if (game.keysDown.has(k)) return;
  game.keysDown.add(k);
  if (game.mode === 'title') { if (k === ' ' || k === 'Enter') { game.mode = 'setup'; sfx('blip'); } return; }
  if (game.mode === 'setup') return setupKey(e);
  if (game.mode === 'final') { if (k === ' ' || k === 'Enter') game.mode = 'title'; return; }
  if (game.mode !== 'play') return;
  if (k === 'm' || k === 'M') toggleMute();
  if (k === 'c' || k === 'C') { game.track = !game.track; game.banner = { title: game.track ? 'BALL CAM ON' : 'BALL CAM OFF', sub: 'C TO CHANGE (PUTTS ALWAYS FOLLOW)', t: 1.4 }; }
  if (k === 'Escape') { game.mode = 'title'; return; }
  if (game.cardWait) { if (k === ' ' || k === 'Enter') continueAfterCard(); if ((k === 'n' || k === 'N') && game.format === 'practice') continueAfterCard(true); return; }
  if (k === 'u' || k === 'U') mulligan();
  if (isDrill() && (k === 'n' || k === 'N') && game.phase === 'aim') {
    game.holeList = [(game.holeList[0] + 1) % game.course.holes.length];
    game.keep = null; game.cam = null; sfx('blip');
    return loadHole();
  }
  if (k === 'Tab') { if (!isDrill()) game.showCard = !game.showCard; return; }
  if (k === ' ' || k === 'Enter') swingDown();
  if (k === 'ArrowUp' || k === 'w' || k === 'W') clubBy(-1);
  if (k === 'ArrowDown' || k === 's' || k === 'S') clubBy(1);
});
window.addEventListener('keyup', (e) => {
  game.keysDown.delete(e.key);
  if ((e.key === ' ' || e.key === 'Enter') && game.mode === 'play') swingUp();
});
window.addEventListener('blur', () => game.keysDown.clear());

function setupKey(e) {
  const st = game.setup;
  const rows = setupRows();
  const row = rows[st.row];
  const k = e.key;
  if (st.editing >= 0) {
    const p = st.players[st.editing];
    if (k === 'Enter' || k === 'Escape') st.editing = -1;
    else if (k === 'Backspace') p.name = p.name.slice(0, -1);
    else if (k.length === 1 && /[a-z0-9 .'&-]/i.test(k) && p.name.length < 12) p.name += k.toUpperCase();
    return;
  }
  if (k === 'ArrowUp') st.row = (st.row + rows.length - 1) % rows.length;
  else if (k === 'ArrowDown') st.row = (st.row + 1) % rows.length;
  else if (k === 'ArrowLeft') changeSetup(row, -1);
  else if (k === 'ArrowRight') changeSetup(row, 1);
  else if (k === 'Enter' || k === ' ') activateSetup(row);
  else if (k === 'r' || k === 'R') { st.seed = 1 + Math.floor(Math.random() * 99999); }
  else if (k === 'Escape') game.mode = 'title';
}

// Pointer: drag sideways on the view to aim, click to swing, wheel for clubs.
const ptr = { down: false, x: 0, y: 0, moved: 0, swingPress: false };
function toScreen(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * SW, y: ((e.clientY - r.top) / r.height) * SH };
}
canvas.addEventListener('pointerdown', (e) => {
  const p = toScreen(e);
  ptr.down = true; ptr.x = p.x; ptr.y = p.y; ptr.moved = 0; ptr.swingPress = false;
  canvas.setPointerCapture(e.pointerId);
  // On the view: press and hold to swing (a drag instead turns the aim).
  if (game.mode === 'play' && !game.cardWait && p.x < VW && (game.phase === 'aim' || game.phase === 'swing')) {
    ptr.swingPress = true;
    swingDown();
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!ptr.down) return;
  const p = toScreen(e);
  const dx = p.x - ptr.x;
  ptr.moved += Math.abs(dx) + Math.abs(p.y - ptr.y);
  ptr.x = p.x; ptr.y = p.y;
  if (game.mode !== 'play') return;
  // A drag right at the start of a swing is really aiming.
  if (game.phase === 'swing' && game.swing.stage === 1 && game.swing.level < 0.2 && ptr.moved > 4) { game.phase = 'aim'; game.swing = null; ptr.swingPress = false; }
  if (game.phase === 'aim' && ptr.moved > 4 && ptr.x < VW) aimBy(dx * 0.004);
});
canvas.addEventListener('pointerup', (e) => {
  if (!ptr.down) return;
  ptr.down = false;
  const p = toScreen(e);
  if (ptr.swingPress) { swingUp(); return; }
  if (ptr.moved > 4) return;
  if (game.mode === 'title') { game.mode = 'setup'; sfx('blip'); return; }
  if (game.mode === 'final') { game.mode = 'title'; return; }
  if (game.mode === 'setup') return setupClick(p);
  if (game.mode !== 'play') return;
  if (game.cardWait) return continueAfterCard();
  if (p.x >= VW) {
    // Panel: the club name steps through clubs.
    if (p.y > 150 && p.y < 200 && game.phase === 'aim') clubBy(1);
    return;
  }
});
canvas.addEventListener('wheel', (e) => { e.preventDefault(); clubBy(e.deltaY > 0 ? 1 : -1); }, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function setupClick(p) {
  const st = game.setup;
  if (st.editing >= 0) { st.editing = -1; return; }
  const rows = setupRows();
  const i = Math.floor((p.y - SETUP_Y0 + 4) / SETUP_ROW);
  if (i < 0 || i >= rows.length) return;
  st.row = i;
  const row = rows[i];
  if (row.key === 'start' || (row.key === 'player' && p.x < SW - 96) || (row.key === 'seed' && p.x > SW / 2)) return activateSetup(row);
  changeSetup(row, p.x < 172 ? -1 : 1);
}

// ---------- Main loop ----------

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.t += dt;
  try { step(dt); } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}

function step(dt) {
  if (game.mode === 'loading') {
    ctx.fillStyle = '#10121c'; ctx.fillRect(0, 0, SW, SH);
    bigText(ctx, 'LOADING', SW / 2, SH / 2, C.gold, { align: 'center' });
    return;
  }
  if (game.mode === 'title') return drawTitle(dt);
  if (game.mode === 'setup') return drawSetup(dt);
  if (game.mode === 'final') return drawFinal(dt);
  if (game.mode === 'loadhole') {
    ctx.fillStyle = '#10121c'; ctx.fillRect(0, 0, VW, VH);
    bigText(ctx, game.loadingText, VW / 2, VH / 2 - 8, C.gold, { scale: 2, align: 'center' });
    smallText(ctx, 'WALKING TO THE TEE...', VW / 2, VH / 2 + 12, C.dim, { align: 'center' });
    drawPanel();
    return;
  }
  // Playing.
  if (game.phase === 'aim') {
    const turn = (game.keysDown.has('Shift') ? 0.12 : 0.5) * dt * (game.putting ? 0.5 : 1);
    if (game.keysDown.has('ArrowLeft') || game.keysDown.has('a') || game.keysDown.has('A')) aimBy(-turn);
    if (game.keysDown.has('ArrowRight') || game.keysDown.has('d') || game.keysDown.has('D')) aimBy(turn);
  }
  if (game.phase === 'swing') updateSwing(dt);
  if (game.phase === 'flight') updateFlight(dt);
  if (game.phase === 'result') {
    if (game.flight && !game.flight.done) updateFlight(dt);
    game.resultT -= dt;
    if (game.resultT <= 0) {
      game.flight = null;
      if (game.nextBall) { game.players[game.cur].ball = game.nextBall; game.nextBall = null; }
      nextTurn();
    }
  }
  if (game.phase === 'fly') updateFly(dt);
  if (game.phase === 'flight' && game.flight.done) {}
  drawScene();
  drawBanner(dt);
  drawHints();
  drawPanel();
  if (game.showCard) drawScorecard();
}

loadArt().then((art) => {
  game.art = art;
  window.pinHigh = { game, setupShot, shotCamera, nextTurn, startRound, holeFinished, continueAfterCard, mulligan };
  setupShowcase();
  game.mode = 'title';
  const q = new URLSearchParams(location.search);
  // ?play=1 jumps straight into a round (handy for testing); ?style= and ?seed= pick a course.
  if (q.has('style')) game.setup.style = Math.max(0, STYLE_KEYS.indexOf(q.get('style')));
  if (q.has('seed')) game.setup.seed = Number(q.get('seed')) || 1;
  if (q.has('level')) game.setup.difficulty = Number(q.get('level'));
  if (q.has('format')) { game.setup.format = Math.max(0, FORMATS.findIndex((f) => f.key === q.get('format'))); game.setup.count = Math.max(FORMATS[game.setup.format].min, game.setup.count); }
  if (q.has('players')) game.setup.count = Number(q.get('players'));
  if (q.has('play')) startRound();
});
requestAnimationFrame(frame);
