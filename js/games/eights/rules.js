// Huit américain : moteur de règles pur, état sérialisable en JSON.
// On pose une carte de la même couleur ou de la même valeur que celle du dessus de la défausse.
// 8 : change la couleur (se pose sur n'importe quoi) · 2 : le suivant pioche 2 (cumulable avec un autre 2)
// Valet : le suivant passe son tour · As : changement de sens (à deux, on rejoue).
// Celui qui n'a plus de cartes gagne la manche ; les autres prennent les points de leur main.
// La partie s'arrête quand quelqu'un atteint 100 points : le plus petit score gagne.
import { newDeck, shuffle, suitOf, rankOf, cardShort, SUITS } from '../../cards/deck.js';

export const TARGET = 100;
const EIGHT = 7;
const TWO = 1;
const JACK = 10;
const ACE = 0;

export const ROBOTS = [
  { id: 'cpu1', name: 'Robot Rosa', color: '#d9779b', cpu: true },
  { id: 'cpu2', name: 'Robot Léon', color: '#7aa95c', cpu: true },
];

// petite étiquette rappelant l'effet des cartes spéciales
export function special(id) {
  return { [EIGHT]: 'couleur', [TWO]: '+2', [JACK]: 'passe', [ACE]: 'sens' }[rankOf(id)] || '';
}

// points de pénalité d'une carte restée en main
export function cardPoints(id) {
  const r = rankOf(id);
  if (r === EIGHT) return 50;
  if (r >= JACK) return 10;
  return r + 1;
}

export function newGame(players, rand = Math.random) {
  let list = players.filter((p) => !p.cpu).slice(0, 5).map(({ id, name, color }) => ({ id, name, color }));
  if (list.length === 1) list = [...list, ...ROBOTS.map((r) => ({ ...r }))];
  const s = {
    v: 1,
    players: list,
    round: 0,
    scores: list.map(() => 0),
    target: TARGET,
    starter: Math.floor(rand() * list.length),
    seq: 0,
    log: [],
    lastSeen: list.map(() => 0),
  };
  startRound(s, rand);
  return s;
}

function log(s, actor, text) {
  s.log.push({ seq: ++s.seq, actor, text });
  if (s.log.length > 40) s.log.splice(0, s.log.length - 40);
}

export function startRound(s, rand = Math.random) {
  const n = s.players.length;
  s.round++;
  s.deck = newDeck(rand);
  const size = n === 2 ? 7 : 5;
  s.hands = s.players.map(() => s.deck.splice(0, size));
  // la première carte retournée n'est jamais un 8
  let first = s.deck.findIndex((id) => rankOf(id) !== EIGHT);
  s.discard = s.deck.splice(first, 1);
  s.suit = suitOf(s.discard[0]);
  s.current = s.starter;
  s.dir = 1;
  s.pending = 0; // cartes à piocher à cause des 2
  s.drawn = null; // carte piochée ce tour-ci (la seule qu'on peut encore poser)
  s.phase = 'play'; // play → choose (couleur du 8) → roundEnd / gameEnd
  s.result = null;
  log(s, null, `Manche ${s.round} : ${s.players[s.current].name} commence.`);
}

export const top = (s) => s.discard[s.discard.length - 1];

export function playable(s, id) {
  if (s.phase !== 'play') return false;
  if (s.drawn != null && id !== s.drawn) return false;
  if (s.pending) return rankOf(id) === TWO;
  return rankOf(id) === EIGHT || suitOf(id) === s.suit || rankOf(id) === rankOf(top(s));
}

export const playableCards = (s, i = s.current) => s.hands[i].filter((id) => playable(s, id));

function refill(s, rand) {
  if (s.deck.length || s.discard.length < 2) return;
  const t = s.discard.pop();
  s.deck = shuffle(s.discard, rand);
  s.discard = [t];
  log(s, null, 'La défausse est mélangée pour refaire la pioche.');
}

function take(s, i, count, rand) {
  const got = [];
  for (let k = 0; k < count; k++) {
    refill(s, rand);
    if (!s.deck.length) break;
    got.push(s.deck.pop());
  }
  s.hands[i].push(...got);
  return got;
}

const nextIndex = (s, steps = 1) => {
  const n = s.players.length;
  return (((s.current + s.dir * steps) % n) + n) % n;
};

function advance(s, steps = 1) {
  s.current = nextIndex(s, steps);
  s.drawn = null;
}

export function play(s, id) {
  const i = s.current;
  if (!s.hands[i].includes(id)) throw new Error('Cette carte n\'est pas dans votre main');
  if (!playable(s, id)) throw new Error('Cette carte ne peut pas être posée');
  s.hands[i] = s.hands[i].filter((x) => x !== id);
  s.discard.push(id);
  const name = s.players[i].name;
  const r = rankOf(id);
  if (!s.hands[i].length) {
    log(s, i, `${name} pose ${cardShort(id)} et n'a plus de cartes !`);
    endRound(s, i);
    return { id, out: true };
  }
  if (r === EIGHT) {
    s.phase = 'choose';
    return { id, choose: true };
  }
  s.suit = suitOf(id);
  const n = s.players.length;
  let effect = '';
  let steps = 1;
  if (r === TWO) {
    s.pending += 2;
    effect = ` : ${s.players[nextIndex(s)].name} doit piocher ${s.pending} cartes`;
  } else if (r === JACK) {
    effect = ` : ${s.players[nextIndex(s)].name} passe son tour`;
    steps = 2;
  } else if (r === ACE) {
    if (n === 2) { steps = 2; effect = ' : il rejoue'; } else { s.dir *= -1; effect = ' : changement de sens'; }
  }
  log(s, i, `${name} pose ${cardShort(id)}${effect}.`);
  advance(s, steps);
  return { id };
}

export function chooseSuit(s, suit) {
  if (s.phase !== 'choose') throw new Error('Pas de couleur à choisir');
  s.suit = suit;
  s.phase = 'play';
  log(s, s.current, `${s.players[s.current].name} pose un 8 et demande ${SUITS[suit].sym} ${SUITS[suit].name.toLowerCase()}.`);
  advance(s);
}

// piocher : la pénalité des 2 s'il y en a une (et on passe son tour), sinon une carte
export function draw(s, rand = Math.random) {
  if (s.phase !== 'play') throw new Error('Ce n\'est pas le moment de piocher');
  const i = s.current;
  const name = s.players[i].name;
  if (s.pending) {
    const got = take(s, i, s.pending, rand);
    log(s, i, `${name} pioche ${got.length} carte${got.length > 1 ? 's' : ''} et passe son tour.`);
    s.pending = 0;
    advance(s);
    return { cards: got, penalty: true };
  }
  if (s.drawn != null) throw new Error('Vous avez déjà pioché');
  const got = take(s, i, 1, rand);
  if (!got.length) {
    log(s, i, `${name} ne peut pas piocher et passe.`);
    advance(s);
    return { cards: [], passed: true };
  }
  s.drawn = got[0];
  if (!playable(s, got[0])) {
    log(s, i, `${name} pioche et passe.`);
    advance(s);
    return { cards: got, passed: true };
  }
  return { cards: got, canPlay: true };
}

// garder la carte qu'on vient de piocher au lieu de la poser
export function pass(s) {
  if (s.phase !== 'play' || s.drawn == null) throw new Error('Il faut d\'abord piocher');
  log(s, s.current, `${s.players[s.current].name} pioche et passe.`);
  advance(s);
}

function endRound(s, winner) {
  const gains = s.hands.map((h) => h.reduce((t, id) => t + cardPoints(id), 0));
  s.scores = s.scores.map((v, i) => v + gains[i]);
  s.result = { winner, gains };
  s.starter = (s.starter + 1) % s.players.length;
  if (Math.max(...s.scores) >= s.target) {
    s.phase = 'gameEnd';
    const best = Math.min(...s.scores);
    s.winners = s.scores.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
  } else {
    s.phase = 'roundEnd';
  }
}

export function nextRound(s, rand) {
  if (s.phase !== 'roundEnd') throw new Error('La manche n\'est pas finie');
  startRound(s, rand);
}
