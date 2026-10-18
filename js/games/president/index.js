// Module de jeu Président (interface commune à tous les jeux, voir js/games/index.js)
import * as R from './rules.js';
import { mount } from './view.js';

export default {
  id: 'president',
  name: 'Président',
  minPlayers: 1,
  maxPlayers: 6,
  newGame: (players) => R.newGame(players),
  summary: (s) => `Manche ${s.round}/${s.rounds} · ${s.players.map((p, i) => `${p.name} ${s.scores[i]}`).join(', ')}`,
  mount,
};
