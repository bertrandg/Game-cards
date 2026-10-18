// Registre des jeux. Chaque jeu n'est téléchargé qu'au moment où on le lance.
// Pour ajouter un jeu : créer js/games/<id>/index.js (voir seasalt) et l'inscrire ici.
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
];

export const gameById = (id) => GAMES.find((g) => g.id === id);
