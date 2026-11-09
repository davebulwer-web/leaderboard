// Sounds: recorded effects for the shots, the cup, water, trees and applause
// (src/sounds.js), and little synthesised ones for the swing and the menus.

import { SOUNDS } from './sounds.js';

let actx = null;
let muted = false;

function ac() {
  if (!actx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    actx = new C();
    loadSamples(actx);
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

// Recorded sounds, decoded once the audio context exists.
const samples = {};
const lastPick = {};
function loadSamples(a) {
  for (const [name, list] of Object.entries(SOUNDS)) {
    samples[name] = [];
    for (const uri of list) {
      const bytes = Uint8Array.from(atob(uri.split(',')[1]), (c) => c.charCodeAt(0));
      a.decodeAudioData(bytes.buffer).then((buf) => samples[name].push(buf)).catch(() => {});
    }
  }
}
// How loud each recorded sound plays.
const LEVEL = { driver: 0.9, iron: 0.85, chip: 0.7, bunker: 0.8, putt: 0.8, cup: 0.9, splash: 0.75, tree: 0.7, bounce: 0.45, clap: 0.6, bag: 0.4, rattle: 0.35 };
function playSample(a, name, gain = 1) {
  const list = samples[name];
  if (!list || !list.length) return false;
  // A different take from last time.
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === lastPick[name]) i = (i + 1) % list.length;
  lastPick[name] = i;
  const src = a.createBufferSource();
  src.buffer = list[i];
  src.playbackRate.value = 0.96 + Math.random() * 0.08;
  const g = a.createGain();
  g.gain.value = (LEVEL[name] ?? 0.8) * gain;
  src.connect(g).connect(a.destination);
  src.start();
  return true;
}

export const toggleMute = () => (muted = !muted);
export const isMuted = () => muted;

function noiseBurst(a, dur, { freq = 1200, q = 0.8, gain = 0.3, type = 'bandpass', attack = 0.005, sweep = null } = {}) {
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, a.currentTime + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, a.currentTime + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

function tone(a, freq, dur, { type = 'square', gain = 0.08, delay = 0, slide = null } = {}) {
  const o = a.createOscillator();
  o.type = type;
  const t0 = a.currentTime + delay;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export function sfx(name, gain = 1) {
  if (muted) return;
  const a = ac();
  if (!a) return;
  if (playSample(a, name, gain)) return;
  // Synthesised stand-ins until the recordings are decoded.
  if (name === 'driver' || name === 'iron' || name === 'chip' || name === 'bunker') name = 'hit';
  if (name === 'bounce') name = 'thud';
  switch (name) {
    case 'whoosh': noiseBurst(a, 0.28, { freq: 600, sweep: 2600, q: 1.2, gain: 0.25, attack: 0.15 }); break;
    case 'hit': noiseBurst(a, 0.08, { freq: 2400, q: 2, gain: 0.6 }); tone(a, 1500, 0.05, { type: 'triangle', gain: 0.2 }); break;
    case 'putt': tone(a, 900, 0.05, { type: 'triangle', gain: 0.15 }); break;
    case 'cup': tone(a, 700, 0.06, { type: 'triangle', gain: 0.2 }); tone(a, 520, 0.08, { type: 'triangle', gain: 0.2, delay: 0.07 }); tone(a, 440, 0.1, { type: 'triangle', gain: 0.18, delay: 0.16 }); break;
    case 'splash': noiseBurst(a, 0.6, { freq: 800, sweep: 200, q: 0.6, gain: 0.4, type: 'lowpass', attack: 0.01 }); break;
    case 'tree': noiseBurst(a, 0.25, { freq: 3000, q: 0.5, gain: 0.25 }); tone(a, 180, 0.08, { type: 'square', gain: 0.06 }); break;
    case 'thud': noiseBurst(a, 0.08, { freq: 300, q: 1, gain: 0.3, type: 'lowpass' }); break;
    case 'blip': tone(a, 880, 0.05, { gain: 0.05 }); break;
    case 'clap': for (let i = 0; i < 14; i++) setTimeout(() => !muted && noiseBurst(a, 0.05, { freq: 1800 + Math.random() * 1500, q: 1.5, gain: 0.12 + Math.random() * 0.1 }), i * 45 + Math.random() * 40); break;
    case 'jingle': [523, 659, 784, 1047].forEach((f, i) => tone(a, f, 0.14, { delay: i * 0.1, gain: 0.07 })); break;
    case 'sad': [392, 330, 262].forEach((f, i) => tone(a, f, 0.18, { delay: i * 0.14, gain: 0.06 })); break;
  }
}
