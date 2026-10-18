// Animations des cartes par la technique FLIP : on note où étaient les cartes avant de redessiner,
// puis on fait glisser chaque carte de son ancienne place vers la nouvelle.
// Une carte qui apparaît vient d'une origine (la pioche par défaut) en se retournant.

const EASE = 'cubic-bezier(.22,.9,.25,1)';

function center(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: el.offsetWidth || r.width };
}

export function snapshot(root) {
  const m = new Map();
  root.querySelectorAll('[data-cid]').forEach((el) => {
    if (el.offsetWidth) m.set(el.dataset.cid, center(el));
  });
  return m;
}

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * before : snapshot pris avant le rendu
 * origins : { [cid]: { sel, flip } } pour les cartes qui arrivent d'un endroit précis
 * fallback : sélecteur de l'élément d'où partent les autres nouvelles cartes (null : apparition en fondu)
 */
export function animateCards(root, before, { origins = {}, fallback = null, stagger = 70 } = {}) {
  if (reduced()) return;
  let k = 0;
  root.querySelectorAll('[data-cid]').forEach((el) => {
    const id = el.dataset.cid;
    let from = before.get(id);
    let flip = false;
    if (!from) {
      const o = origins[id];
      const sel = o ? o.sel : fallback;
      const src = sel && root.querySelector(sel);
      if (!src) {
        el.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'scale(1)' }],
          { duration: 300, easing: EASE, delay: k++ * stagger, fill: 'backwards' });
        return;
      }
      from = center(src);
      flip = o ? o.flip !== false : true;
    }
    const to = center(el);
    const dx = from.x - to.x;
    const dy = from.y - to.y;
    const s = from.w / (to.w || 1);
    if (!flip && Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(s - 1) < 0.02) return;
    const delay = flip ? k++ * stagger : 0;
    const dist = Math.hypot(dx, dy);
    el.classList.add('flying');
    const a = el.animate([
      { transform: `perspective(900px) translate(${dx}px, ${dy}px) scale(${s}) rotateY(${flip ? 180 : 0}deg)` },
      { transform: `perspective(900px) translate(${dx * 0.4}px, ${dy * 0.4 - Math.min(40, dist * 0.12)}px) scale(${(s + 1) / 2 * 1.08}) rotateY(${flip ? 90 : 0}deg)`, offset: 0.5 },
      { transform: 'perspective(900px) translate(0px, 0px) scale(1) rotateY(0deg)' },
    ], { duration: flip ? 650 : 450, easing: EASE, delay, fill: 'backwards' });
    a.onfinish = a.oncancel = () => el.classList.remove('flying');
  });
}

// petit saut d'un élément (pile qu'on vient de toucher, score qui change…)
export function bump(el) {
  if (!el || reduced()) return;
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }],
    { duration: 320, easing: EASE });
}

// confettis en papier
export function confetti(host = document.body, n = 90) {
  if (reduced()) return;
  const colors = ['#e07a5f', '#f2b84b', '#7cc3d8', '#9fd29a', '#f4b1c4', '#a58bd6', '#fff6e8'];
  const layer = document.createElement('div');
  layer.className = 'confetti';
  host.appendChild(layer);
  const W = window.innerWidth;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.style.background = colors[i % colors.length];
    p.style.left = `${Math.random() * W}px`;
    layer.appendChild(p);
    const drift = (Math.random() - 0.5) * 160;
    p.animate([
      { transform: `translate(0, -20px) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${drift}px, ${window.innerHeight + 40}px) rotate(${Math.random() * 900 - 450}deg)`, opacity: 0.9 },
    ], { duration: 2200 + Math.random() * 1800, delay: Math.random() * 600, easing: 'cubic-bezier(.3,.6,.5,1)', fill: 'both' });
  }
  setTimeout(() => layer.remove(), 4800);
}
