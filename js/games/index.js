// Registre des jeux. Chaque jeu n'est téléchargé qu'au moment où on le lance.
// Pour ajouter un jeu : créer js/games/<id>/index.js (voir seasalt) et l'inscrire ici.
// `solo` (facultatif) : texte affiché quand le jeu se joue aussi seul contre l'ordinateur.
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
];

export const gameById = (id) => GAMES.find((g) => g.id === id);
