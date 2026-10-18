// Bruitages générés (WebAudio) : pas de fichier à télécharger.
// Le son d'une carte est un court souffle de papier filtré, légèrement différent à chaque fois ;
// la bataille navale ajoute un tir, un plouf et une explosion fabriqués de la même façon.
const KEY = 'cartes.sound';

let ctx = null;
let noise = null;
let enabled = true;
try { enabled = localStorage.getItem(KEY) !== 'off'; } catch { /* stockage indisponible */ }

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    // bruit blanc réutilisé par tous les sons
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// les navigateurs mobiles n'autorisent le son qu'après un geste de l'utilisateur
const unlock = () => { if (enabled) audio(); };
window.addEventListener('pointerdown', unlock, { passive: true });

export const soundOn = () => enabled;

export function setSound(on) {
  enabled = on;
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* stockage indisponible */ }
  if (on) cardSound();
}

function swish(at, { dur = 0.09, from = 2600, to = 900, vol = 0.32, type = 'bandpass', q = 1.1, attack = 0.008 } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.9 + Math.random() * 0.25;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, at);
  filter.frequency.exponentialRampToValueAtTime(to, at + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(vol, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(at, Math.random() * Math.max(0.05, 0.95 - dur), dur + 0.02);
}

// une carte qui bouge ; `flip` ajoute le petit claquement du retournement
let last = 0;
export function cardSound({ delay = 0, flip = false } = {}) {
  if (!enabled || !audio() || ctx.state !== 'running') return;
  let at = ctx.currentTime + delay / 1000;
  if (at < last + 0.035) at = last + 0.035; // évite que les sons simultanés s'additionnent trop fort
  last = at;
  const k = 0.85 + Math.random() * 0.3;
  swish(at, { from: 2600 * k, to: 900 * k });
  if (flip) swish(at + 0.05, { dur: 0.035, from: 4200 * k, to: 2400 * k, vol: 0.22 });
}

// note grave qui glisse (coup de canon, explosion)
function tone(at, { from = 120, to = 40, dur = 0.3, vol = 0.4, type = 'sine' } = {}) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(vol, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

const ready = () => enabled && audio() && ctx.state === 'running';

// départ du coup : détonation sourde puis sifflement
export function shotSound() {
  if (!ready()) return;
  const at = ctx.currentTime;
  tone(at, { from: 150, to: 45, dur: 0.22, vol: 0.45 });
  swish(at, { dur: 0.16, from: 700, to: 200, vol: 0.3, type: 'lowpass', q: 0.7 });
  swish(at + 0.08, { dur: 0.35, from: 900, to: 2600, vol: 0.09, q: 2 });
}

// plouf dans l'eau
export function splashSound() {
  if (!ready()) return;
  const at = ctx.currentTime;
  swish(at, { dur: 0.45, from: 2400, to: 300, vol: 0.38, type: 'lowpass', q: 0.8, attack: 0.012 });
  tone(at, { from: 420, to: 160, dur: 0.12, vol: 0.12 });
  tone(at + 0.09, { from: 640, to: 300, dur: 0.08, vol: 0.06 });
}

// navire touché (plus long et plus grave s'il coule)
export function boomSound(big = false) {
  if (!ready()) return;
  const at = ctx.currentTime;
  const dur = big ? 1.1 : 0.6;
  swish(at, { dur, from: 1400, to: 60, vol: 0.55, type: 'lowpass', q: 0.6, attack: 0.005 });
  tone(at, { from: 110, to: 28, dur: dur * 0.8, vol: 0.55 });
  if (big) swish(at + 0.25, { dur: 0.7, from: 600, to: 80, vol: 0.3, type: 'lowpass', q: 0.6 });
}

// petit clic (viser, poser un navire)
export function tickSound({ pitch = 1 } = {}) {
  if (!ready()) return;
  const at = ctx.currentTime;
  tone(at, { from: 900 * pitch, to: 600 * pitch, dur: 0.05, vol: 0.08, type: 'triangle' });
  swish(at, { dur: 0.04, from: 3000, to: 1800, vol: 0.12 });
}
