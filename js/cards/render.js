// Dessin des cartes classiques (styles dans css/deck.css).
// Chaque carte a une face et un dos pour pouvoir se retourner pendant les animations (js/ui/anim.js).
import { SUITS, RANKS, suitOf, rankOf } from './deck.js';

// emplacement des symboles au centre des cartes 2 à 10 (colonne 1-3, ligne 1-7)
const PIPS = {
  2: [[2, 1], [2, 7]],
  3: [[2, 1], [2, 4], [2, 7]],
  4: [[1, 1], [3, 1], [1, 7], [3, 7]],
  5: [[1, 1], [3, 1], [2, 4], [1, 7], [3, 7]],
  6: [[1, 1], [3, 1], [1, 4], [3, 4], [1, 7], [3, 7]],
  7: [[1, 1], [3, 1], [2, 2], [1, 4], [3, 4], [1, 7], [3, 7]],
  8: [[1, 1], [3, 1], [2, 2], [1, 4], [3, 4], [2, 6], [1, 7], [3, 7]],
  9: [[1, 1], [3, 1], [1, 3], [3, 3], [2, 4], [1, 5], [3, 5], [1, 7], [3, 7]],
  10: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3], [1, 5], [3, 5], [2, 6], [1, 7], [3, 7]],
};
const FACES = { 10: '💂', 11: '👸', 12: '🤴' };

function middle(r, sym) {
  if (r === 0) return `<span class="pc-ace">${sym}</span>`;
  if (FACES[r]) return `<span class="pc-face">${FACES[r]}<b>${sym}</b></span>`;
  return `<span class="pc-pips">${PIPS[r + 1].map(([c, l]) => `<i style="grid-area:${l}/${c}" class="${l > 4 ? 'down' : ''}">${sym}</i>`).join('')}</span>`;
}

/**
 * id : numéro de la carte ; cls : classes en plus ; opts.anim : porte data-cid (animée) ; opts.tag : petite étiquette (règle spéciale)
 */
export function pcHTML(id, cls = '', { anim = true, tag = '', attrs = '' } = {}) {
  const s = SUITS[suitOf(id)];
  const r = rankOf(id);
  const corner = `<span class="pc-corner">${RANKS[r]}<small>${s.sym}</small></span>`;
  return `<div class="pc ${s.red ? 'red' : 'black'} ${cls}" ${anim ? `data-cid="${id}"` : ''} ${attrs}>
    <div class="face front">${corner}${middle(r, s.sym)}${corner.replace('pc-corner', 'pc-corner bottom')}${tag ? `<span class="pc-tag">${tag}</span>` : ''}</div>
    <div class="face back"></div>
  </div>`;
}

export const pcBackHTML = (cls = '') => `<div class="pc down ${cls}"><div class="face back"></div></div>`;
