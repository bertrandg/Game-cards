// Les 58 cartes de Sea Salt & Paper : un type et une couleur par carte.
// L'identifiant d'une carte est son indice dans CARDS (un simple entier, facile à sauvegarder).

export const COLORS = {
  darkblue: { name: 'Bleu foncé', bg: '#2f5d8a', ink: '#fff' },
  lightblue: { name: 'Bleu clair', bg: '#7cc3d8', ink: '#173f4d' },
  black: { name: 'Noir', bg: '#3a3633', ink: '#fff' },
  yellow: { name: 'Jaune', bg: '#f3c54e', ink: '#5a3d06' },
  green: { name: 'Vert clair', bg: '#9fd29a', ink: '#23502a' },
  white: { name: 'Blanc', bg: '#f1ece6', ink: '#5b4a5e' },
  purple: { name: 'Violet', bg: '#a58bd6', ink: '#fff' },
  grey: { name: 'Gris clair', bg: '#b8b2ab', ink: '#3b3530' },
  lightorange: { name: 'Orange clair', bg: '#f7c79a', ink: '#6a3a12' },
  pink: { name: 'Rose clair', bg: '#f4b1c4', ink: '#6b2440' },
  orange: { name: 'Orange', bg: '#ea7d3c', ink: '#fff' },
};

// kind : duo (paire avec effet), collection, multi (multiplicateur), mermaid
export const TYPES = {
  crab: { name: 'Crabe', plural: 'Crabes', icon: '🦀', kind: 'duo', effect: 'Paire : prenez une carte dans une défausse', short: '🔍 défausse' },
  boat: { name: 'Bateau', plural: 'Bateaux', icon: '⛵', kind: 'duo', effect: 'Paire : rejouez un tour', short: '🔁 rejouer' },
  fish: { name: 'Poisson', plural: 'Poissons', icon: '🐟', kind: 'duo', effect: 'Paire : piochez une carte', short: '＋1 carte' },
  shark: { name: 'Requin', plural: 'Requins', icon: '🦈', kind: 'duo', effect: 'Avec un nageur : volez une carte au hasard', short: '+ 🏊 vol' },
  swimmer: { name: 'Nageur', plural: 'Nageurs', icon: '🏊', kind: 'duo', effect: 'Avec un requin : volez une carte au hasard', short: '+ 🦈 vol' },
  shell: { name: 'Coquillage', plural: 'Coquillages', icon: '🐚', kind: 'collection', scale: [0, 2, 4, 6, 8, 10] },
  octopus: { name: 'Poulpe', plural: 'Poulpes', icon: '🐙', kind: 'collection', scale: [0, 3, 6, 9, 12] },
  penguin: { name: 'Manchot', plural: 'Manchots', icon: '🐧', kind: 'collection', scale: [1, 3, 5] },
  sailor: { name: 'Moussaillon', plural: 'Moussaillons', icon: '⚓', kind: 'collection', scale: [0, 5] },
  lighthouse: { name: 'Phare', plural: 'Phares', icon: '🗼', kind: 'multi', effect: '1 point par bateau (ne compte pas comme un bateau)', short: '1 × ⛵' },
  shoal: { name: 'Banc de poissons', plural: 'Bancs', icon: '🐠', kind: 'multi', effect: '1 point par poisson (ne compte pas comme un poisson)', short: '1 × 🐟' },
  colony: { name: 'Colonie de manchots', plural: 'Colonies', icon: '🐧', kind: 'multi', effect: '2 points par manchot (ne compte pas comme un manchot)', short: '2 × 🐧' },
  captain: { name: 'Capitaine', plural: 'Capitaines', icon: '🧑‍✈️', kind: 'multi', effect: '3 points par moussaillon (ne compte pas comme un moussaillon)', short: '3 × ⚓' },
  mermaid: { name: 'Sirène', plural: 'Sirènes', icon: '🧜‍♀️', kind: 'mermaid', effect: '1 point par carte de votre couleur la plus nombreuse (puis la suivante pour chaque autre sirène). 4 sirènes posées : victoire immédiate !', short: '★ couleur' },
};

// répartition des couleurs par type (58 cartes)
const DISTRIBUTION = {
  crab: { darkblue: 2, lightblue: 2, black: 1, yellow: 2, green: 1, grey: 1 },
  boat: { darkblue: 2, lightblue: 2, black: 2, yellow: 2 },
  fish: { darkblue: 2, lightblue: 1, black: 2, yellow: 1, green: 1 },
  shark: { darkblue: 1, lightblue: 1, black: 1, green: 1, purple: 1 },
  swimmer: { darkblue: 1, lightblue: 1, black: 1, yellow: 1, lightorange: 1 },
  shell: { darkblue: 1, lightblue: 1, black: 1, yellow: 1, green: 1, grey: 1 },
  octopus: { lightblue: 1, yellow: 1, green: 1, grey: 1, purple: 1 },
  penguin: { purple: 1, lightorange: 1, pink: 1 },
  sailor: { pink: 1, orange: 1 },
  lighthouse: { purple: 1 },
  shoal: { grey: 1 },
  colony: { green: 1 },
  captain: { lightorange: 1 },
  mermaid: { white: 4 },
};

export const CARDS = [];
for (const [type, colors] of Object.entries(DISTRIBUTION)) {
  for (const [color, n] of Object.entries(colors)) {
    for (let i = 0; i < n; i++) CARDS.push({ type, color });
  }
}

// ordre d'affichage dans la main : les paires possibles restent côte à côte
export const TYPE_ORDER = Object.keys(TYPES);
const COLOR_ORDER = Object.keys(COLORS);
export function sortCards(ids) {
  return [...ids].sort((a, b) => {
    const A = CARDS[a];
    const B = CARDS[b];
    return TYPE_ORDER.indexOf(A.type) - TYPE_ORDER.indexOf(B.type)
      || COLOR_ORDER.indexOf(A.color) - COLOR_ORDER.indexOf(B.color) || a - b;
  });
}

export function cardLabel(id) {
  const c = CARDS[id];
  return `${TYPES[c.type].name} ${COLORS[c.color].name.toLowerCase()}`;
}
