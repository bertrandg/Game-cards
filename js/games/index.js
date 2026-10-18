// Registre des jeux. Chaque jeu n'est téléchargé qu'au moment où on le lance.
// Pour ajouter un jeu : créer js/games/<id>/index.js (voir seasalt) et l'inscrire ici.
// `solo` (facultatif) : texte affiché quand le jeu se joue aussi seul contre l'ordinateur.
// `css` : une feuille de style, ou une liste (par exemple le jeu de 52 cartes commun + celle du jeu).
export const GAMES = [
  {
    id: 'seasalt',
    name: 'Sea Salt & Paper',
    tagline: 'Collectionnez, formez des duos et pariez sur la fin de manche.',
    players: [2, 4],
    duration: '30 min',
    emoji: '🐚',
    tint: ['#7cc3d8', '#f3c54e'],
    css: 'css/seasalt.css',
    load: () => import('./seasalt/index.js'),
  },
  {
    id: 'naval',
    name: 'Bataille navale',
    tagline: 'Cachez votre flotte et coulez celle d\'en face. À deux, ou seul contre l\'ordinateur.',
    players: [1, 2],
    solo: 'Seul, vous affrontez l\'Amiral Robot.',
    duration: '15 min',
    emoji: '⚓',
    tint: ['#8fcfd6', '#e07a5f'],
    css: 'css/naval.css',
    loading: 'Les navires prennent la mer…',
    load: () => import('./naval/index.js'),
  },
  {
    id: 'eights',
    name: 'Huit américain',
    tagline: 'Même couleur ou même valeur… et le 8 change tout ! À plusieurs, ou seul contre deux robots.',
    players: [1, 5],
    solo: 'Seul, vous affrontez deux robots.',
    duration: '20 min',
    emoji: '🃏',
    tint: ['#f4b1c4', '#3d9a8b'],
    css: ['css/deck.css', 'css/eights.css'],
    load: () => import('./eights/index.js'),
  },
  {
    id: 'president',
    name: 'Président',
    tagline: 'Débarrassez-vous de vos cartes pour devenir Président… et faire payer le Pauvre !',
    players: [1, 6],
    solo: 'Avec moins de 3 joueurs, des robots complètent la table.',
    minTable: 3, // en dessous, des robots complètent
    duration: '30 min',
    emoji: '👑',
    tint: ['#f2b84b', '#8e7cc3'],
    css: ['css/deck.css', 'css/president.css'],
    load: () => import('./president/index.js'),
  },
];

export const gameById = (id) => GAMES.find((g) => g.id === id);
