// Les robots du Huit américain : ils jouent simplement, comme un joueur attentif mais pas rusé.
import { suitOf, rankOf } from '../../cards/deck.js';
import { playableCards, cardPoints } from './rules.js';

const EIGHT = 7;

// carte à poser (ou null pour piocher)
export function cpuPlay(s) {
  const options = playableCards(s);
  if (!options.length) return null;
  const hand = s.hands[s.current];
  const count = (suit) => hand.filter((id) => suitOf(id) === suit && rankOf(id) !== EIGHT).length;
  // garder les 8 pour la fin ; sinon la carte qui rapporte le plus de points, dans la couleur la plus fournie
  const plain = options.filter((id) => rankOf(id) !== EIGHT);
  const pool = plain.length ? plain : options;
  return pool.sort((a, b) => count(suitOf(b)) - count(suitOf(a)) || cardPoints(b) - cardPoints(a))[0];
}

// couleur demandée avec un 8 : celle qu'il a le plus en main
export function cpuSuit(s) {
  const hand = s.hands[s.current];
  const counts = [0, 1, 2, 3].map((suit) => hand.filter((id) => suitOf(id) === suit && rankOf(id) !== EIGHT).length);
  return counts.indexOf(Math.max(...counts));
}
