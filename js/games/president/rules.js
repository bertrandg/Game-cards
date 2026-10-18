// Président : moteur de règles pur, état sérialisable en JSON.
// Toutes les cartes sont distribuées. Ordre des valeurs : 3 < 4 < … < Roi < As < 2.
// On pose 1 à 4 cartes de même valeur ; les suivants posent le même nombre de cartes, de valeur égale
// ou supérieure, ou passent. Après une valeur égale, le joueur suivant doit la poser lui aussi « ou rien ».
// Un 2 ferme le pli. Quand tout le monde a passé, le dernier à avoir posé ouvre le pli suivant.
// Ordre de sortie : Président, Vice-président, Citoyens, Vice-pauvre, Pauvre. À la manche suivante,
// le Pauvre donne ses 2 meilleures cartes au Président qui lui en rend 2 de son choix (1 carte entre vices).
import { newDeck, rankOf, suitOf, RANK_NAMES } from '../../cards/deck.js';

export const ROUNDS = 5;
export const ROBOTS = [
  { id: 'cpu1', name: 'Robot Rosa', color: '#d9779b', cpu: true },
  { id: 'cpu2', name: 'Robot Léon', color: '#7aa95c', cpu: true },
  { id: 'cpu3', name: 'Robot Gaston', color: '#8e7cc3', cpu: true },
];
const QUEEN_OF_HEARTS = 13 + 11;

// force d'une carte : 3 → 0 … roi → 10, as → 11, 2 → 12
export const power = (id) => {
  const r = rankOf(id);
  return r === 0 ? 11 : r === 1 ? 12 : r - 2;
};
export const TOP = 12; // le 2 : ferme le pli
export const sortHand = (ids) => [...ids].sort((a, b) => power(a) - power(b) || suitOf(a) - suitOf(b));
export const valueName = (id) => RANK_NAMES[rankOf(id)];

export function playLabel(cards) {
  const v = valueName(cards[0]);
  const plural = { As: 'As', Valet: 'Valets', Dame: 'Dames', Roi: 'Rois' }[v] || v;
  return ['', `un ${v}`, `une paire de ${plural}`, `un brelan de ${plural}`, `un carré de ${plural}`][cards.length];
}

export function roleOf(n, k) {
  if (k === 0) return 'president';
  if (k === n - 1) return 'poor';
  if (n >= 4 && k === 1) return 'vice';
  if (n >= 4 && k === n - 2) return 'vicepoor';
  return 'citizen';
}
export const ROLES = {
  president: { name: 'Président', icon: '👑' },
  vice: { name: 'Vice-président', icon: '🎩' },
  citizen: { name: 'Citoyen', icon: '🙂' },
  vicepoor: { name: 'Vice-pauvre', icon: '🥺' },
  poor: { name: 'Pauvre', icon: '🪣' },
};

export function newGame(players, rand = Math.random) {
  let list = players.filter((p) => !p.cpu).slice(0, 6).map(({ id, name, color }) => ({ id, name, color }));
  if (list.length < 3) list = [...list, ...ROBOTS.slice(0, 4 - list.length).map((r) => ({ ...r }))];
  const s = {
    v: 1,
    players: list,
    round: 0,
    rounds: ROUNDS,
    scores: list.map(() => 0),
    roles: list.map(() => null),
    seq: 0,
    log: [],
    lastSeen: list.map(() => 0),
  };
  startRound(s, rand);
  return s;
}

function log(s, actor, text) {
  s.log.push({ seq: ++s.seq, actor, text });
  if (s.log.length > 50) s.log.splice(0, s.log.length - 50);
}

const name = (s, i) => s.players[i].name;
export const active = (s, i) => s.hands[i].length > 0;

function nextActive(s, from) {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (active(s, i)) return i;
  }
  return -1;
}

export function startRound(s, rand = Math.random) {
  const n = s.players.length;
  s.round++;
  const deck = newDeck(rand);
  s.hands = s.players.map(() => []);
  deck.forEach((id, k) => s.hands[k % n].push(id));
  s.finished = [];
  s.trick = { plays: [], passed: [], lastBy: null, match: null };
  s.result = null;
  s.exchange = [];
  log(s, null, `Manche ${s.round} sur ${s.rounds}.`);
  const who = (role) => s.roles.indexOf(role);
  if (who('president') >= 0) {
    // les plus pauvres donnent d'office leurs meilleures cartes
    const give = (from, to, count) => {
      const best = sortHand(s.hands[from]).slice(-count);
      s.hands[from] = s.hands[from].filter((x) => !best.includes(x));
      s.hands[to].push(...best);
      log(s, from, `${name(s, from)} (${ROLES[s.roles[from]].name}) donne ses ${count > 1 ? `${count} meilleures cartes` : 'meilleure carte'} à ${name(s, to)}.`);
      s.exchange.push({ from: to, to: from, count, got: best });
    };
    give(who('poor'), who('president'), 2);
    if (who('vice') >= 0) give(who('vicepoor'), who('vice'), 1);
    s.phase = 'exchange';
    s.current = s.exchange[0].from;
  } else {
    s.phase = 'play';
    s.current = s.hands.findIndex((h) => h.includes(QUEEN_OF_HEARTS));
    log(s, null, `${name(s, s.current)} a la dame de cœur : à lui de commencer.`);
  }
}

// le Président (ou le vice) rend des cartes de son choix
export function giveBack(s, ids) {
  if (s.phase !== 'exchange') throw new Error('Pas d\'échange en cours');
  const ex = s.exchange[0];
  const i = s.current;
  if (ids.length !== ex.count || new Set(ids).size !== ids.length) throw new Error(`Choisissez ${ex.count} carte${ex.count > 1 ? 's' : ''}`);
  if (!ids.every((id) => s.hands[i].includes(id))) throw new Error('Ces cartes ne sont pas dans votre main');
  s.hands[i] = s.hands[i].filter((x) => !ids.includes(x));
  s.hands[ex.to].push(...ids);
  log(s, i, `${name(s, i)} rend ${ex.count > 1 ? `${ex.count} cartes` : 'une carte'} à ${name(s, ex.to)}.`);
  s.exchange.shift();
  if (s.exchange.length) {
    s.current = s.exchange[0].from;
  } else {
    s.phase = 'play';
    s.current = s.roles.indexOf('poor');
    log(s, null, `${name(s, s.current)} (Pauvre) ouvre la manche.`);
  }
}

export const topPlay = (s) => s.trick.plays[s.trick.plays.length - 1] || null;

// les cartes peuvent-elles être posées maintenant ?
export function canPlay(s, ids) {
  if (s.phase !== 'play' || !ids.length || ids.length > 4) return false;
  const p = power(ids[0]);
  if (!ids.every((id) => power(id) === p && s.hands[s.current].includes(id))) return false;
  const t = topPlay(s);
  if (!t) return true;
  if (ids.length !== t.cards.length) return false;
  if (s.trick.match != null) return p === s.trick.match;
  return p >= power(t.cards[0]);
}

// valeurs jouables dans la main (pour guider le joueur)
export function playablePowers(s, i = s.current) {
  const groups = new Map();
  for (const id of s.hands[i]) groups.set(power(id), [...(groups.get(power(id)) || []), id]);
  const t = topPlay(s);
  const need = t ? t.cards.length : 1;
  return [...groups.entries()].filter(([p, ids]) => ids.length >= need && canPlay(s, ids.slice(0, need))).map(([p]) => p);
}

function finish(s, i) {
  s.finished.push(i);
  const k = s.finished.length - 1;
  log(s, i, `${name(s, i)} n'a plus de cartes : ${ROLES[roleOf(s.players.length, k)].name} !`);
}

function newTrick(s, leader) {
  s.trick = { plays: [], passed: [], lastBy: null, match: null };
  s.current = active(s, leader) ? leader : nextActive(s, leader);
}

export function play(s, ids) {
  if (!canPlay(s, ids)) throw new Error('Ces cartes ne peuvent pas être posées');
  const i = s.current;
  const t = topPlay(s);
  const p = power(ids[0]);
  s.hands[i] = s.hands[i].filter((x) => !ids.includes(x));
  s.trick.plays.push({ by: i, cards: [...ids] });
  s.trick.lastBy = i;
  s.trick.passed = [];
  const equal = t && power(t.cards[0]) === p;
  s.trick.match = equal && p !== TOP ? p : null;
  log(s, i, `${name(s, i)} pose ${playLabel(ids)}${equal && p !== TOP ? ` : ${valueName(ids[0])} ou rien !` : ''}${p === TOP ? ' et ferme le pli' : ''}.`);
  if (!active(s, i)) finish(s, i);
  if (s.players.filter((_, j) => active(s, j)).length <= 1) return endRound(s);
  if (p === TOP) {
    newTrick(s, i);
    return { closed: true };
  }
  s.current = nextActive(s, i);
  return {};
}

export function pass(s) {
  if (s.phase !== 'play') throw new Error('Ce n\'est pas le moment');
  if (!topPlay(s)) throw new Error('Vous ouvrez le pli : posez des cartes');
  const i = s.current;
  s.trick.passed.push(i);
  s.trick.match = null; // « ou rien » ne vaut que pour le joueur suivant
  const others = s.players.map((_, j) => j).filter((j) => active(s, j) && j !== s.trick.lastBy);
  if (others.every((j) => s.trick.passed.includes(j))) {
    const w = s.trick.lastBy;
    log(s, w, `Tout le monde passe : ${name(s, w)} remporte le pli.`);
    newTrick(s, w);
    return { closed: true };
  }
  s.current = nextActive(s, i);
  return {};
}

function endRound(s) {
  const n = s.players.length;
  const last = s.players.map((_, j) => j).find((j) => !s.finished.includes(j));
  s.finished.push(last);
  s.roles = s.players.map((_, j) => roleOf(n, s.finished.indexOf(j)));
  const gains = s.players.map((_, j) => n - 1 - s.finished.indexOf(j));
  s.scores = s.scores.map((v, j) => v + gains[j]);
  s.result = { order: [...s.finished], gains };
  log(s, null, `Fin de la manche : ${name(s, s.finished[0])} est Président, ${name(s, last)} est Pauvre.`);
  if (s.round >= s.rounds) {
    s.phase = 'gameEnd';
    const best = Math.max(...s.scores);
    s.winners = s.scores.map((v, j) => (v === best ? j : -1)).filter((j) => j >= 0);
  } else {
    s.phase = 'roundEnd';
  }
  return { roundEnd: true };
}

export function nextRound(s, rand) {
  if (s.phase !== 'roundEnd') throw new Error('La manche n\'est pas finie');
  startRound(s, rand);
}

