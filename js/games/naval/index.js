// Module de jeu Bataille navale (interface commune à tous les jeux, voir js/games/index.js)
import * as R from './rules.js';
import { mount } from './view.js';

export default {
  id: 'naval',
  name: 'Bataille navale',
  minPlayers: 1,
  maxPlayers: 2,
  newGame: (players) => R.newGame(players),
  summary: (s) => (s.phase === 'place'
    ? `Placement des flottes · ${s.players.map((p) => p.name).join(' contre ')}`
    : `Tour ${s.turn} · ${s.players.map((p, i) => `${p.name} ${R.sunkShips(s, R.opponent(i)).length}/5 coulés`).join(', ')}`),
  mount,
};
