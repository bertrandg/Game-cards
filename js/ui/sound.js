// Bruitages générés (WebAudio) : pas de fichier à télécharger.
// Le son d'une carte est un court souffle de papier filtré, légèrement différent à chaque fois.
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
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
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

function swish(at, { dur = 0.09, from = 2600, to = 900, vol = 0.32 } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.9 + Math.random() * 0.25;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.1;
  filter.frequency.setValueAtTime(from, at);
  filter.frequency.exponentialRampToValueAtTime(to, at + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(vol, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(at, Math.random() * 0.1, dur + 0.02);
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
