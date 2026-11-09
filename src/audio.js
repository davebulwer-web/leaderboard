// Little synthesised sounds: the swing, the strike, the cup, a splash, a tree, applause.

let actx = null;
let muted = false;

function ac() {
  if (!actx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    actx = new C();
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
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

export function sfx(name) {
  if (muted) return;
  const a = ac();
  if (!a) return;
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
