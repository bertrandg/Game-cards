// Jeu de 52 cartes classique, commun à tous les jeux qui l'utilisent.
// Une carte est un nombre 0…51 : couleur = id / 13, valeur = id % 13 (0 = as … 12 = roi).

export const SUITS = [
  { key: 'S', sym: '♠', name: 'Pique', red: false },
  { key: 'H', sym: '♥', name: 'Cœur', red: true },
  { key: 'C', sym: '♣', name: 'Trèfle', red: false },
  { key: 'D', sym: '♦', name: 'Carreau', red: true },
];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R'];
export const RANK_NAMES = ['As', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Valet', 'Dame', 'Roi'];

export const suitOf = (id) => Math.floor(id / 13);
export const rankOf = (id) => id % 13;
export const cardName = (id) => `${RANK_NAMES[rankOf(id)]} de ${SUITS[suitOf(id)].name.toLowerCase()}`;
export const cardShort = (id) => `${RANKS[rankOf(id)]}${SUITS[suitOf(id)].sym}`;

export function shuffle(list, rand = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const newDeck = (rand) => shuffle(Array.from({ length: 52 }, (_, i) => i), rand);

// tri d'une main : par couleur (pique, cœur, trèfle, carreau : noir et rouge alternés), puis par valeur
export const sortHand = (ids) => [...ids].sort((a, b) => suitOf(a) - suitOf(b) || rankOf(a) - rankOf(b));
