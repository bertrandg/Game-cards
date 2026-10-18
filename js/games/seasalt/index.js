// Module de jeu Sea Salt & Paper (interface commune à tous les jeux, voir js/games/index.js)
import * as R from './rules.js';
import { mount } from './view.js';

export default {
  id: 'seasalt',
  name: 'Sea Salt & Paper',
  minPlayers: 2,
  maxPlayers: 4,
  newGame: (players) => R.newGame(players),
  summary: (s) => `Manche ${s.round} · ${s.players.map((p, i) => `${p.name} ${s.scores[i]}`).join(', ')}`,
  mount,
};
