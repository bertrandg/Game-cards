// Module de jeu Huit américain (interface commune à tous les jeux, voir js/games/index.js)
import * as R from './rules.js';
import { mount } from './view.js';

export default {
  id: 'eights',
  name: 'Huit américain',
  minPlayers: 1,
  maxPlayers: 5,
  newGame: (players) => R.newGame(players),
  summary: (s) => `Manche ${s.round} · ${s.players.map((p, i) => `${p.name} ${s.scores[i]}`).join(', ')}`,
  mount,
};
