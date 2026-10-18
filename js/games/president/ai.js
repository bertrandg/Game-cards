// Les robots du Président : ils se débarrassent d'abord des petites cartes et gardent les 2 pour la fin.
import { power, sortHand, playablePowers, topPlay, TOP } from './rules.js';

function groups(hand) {
  const g = new Map();
  for (const id of sortHand(hand)) g.set(power(id), [...(g.get(power(id)) || []), id]);
  return g;
}

// cartes à poser, ou null pour passer
export function cpuPlay(s) {
  const hand = s.hands[s.current];
  const g = groups(hand);
  const t = topPlay(s);
  if (!t) {
    // ouvrir avec le plus petit groupe ; les 2 seulement s'il ne reste qu'eux
    const order = [...g.entries()].sort((a, b) => a[0] - b[0]);
    const pick = order.find(([p]) => p !== TOP) || order[0];
    return pick[1];
  }
  const need = t.cards.length;
  const ok = playablePowers(s).sort((a, b) => a - b);
  if (!ok.length) return null;
  // éviter de casser un groupe plus grand et de gaspiller un 2 tant que la main est grosse
  const exact = ok.filter((p) => g.get(p).length === need && (p !== TOP || hand.length <= 4));
  const any = ok.filter((p) => p !== TOP || hand.length <= 4);
  const p = exact[0] ?? (hand.length <= 6 ? any[0] : undefined);
  if (p === undefined) return null;
  return g.get(p).slice(0, need);
}

// cartes rendues lors de l'échange : les plus faibles
export const cpuGive = (s, count) => sortHand(s.hands[s.current]).slice(0, count);
