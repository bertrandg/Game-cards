// Moteur de règles de Sea Salt & Paper.
// L'état est un objet JSON simple (sauvegardé tel quel) ; les actions le modifient sur place
// et lèvent une erreur si elles ne sont pas permises.
import { CARDS, TYPES, COLORS, cardLabel } from './cards.js';

export const TARGETS = { 2: 40, 3: 35, 4: 30 };
export const END_ROUND_MIN = 7;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fail(msg) { throw new Error(msg); }
const pname = (s, i) => s.players[i].name;

// journal des événements, montré au joueur suivant quand on lui passe le téléphone.
// `secret` : texte réservé au joueur `for` (ex. la carte qu'on lui a volée)
function log(s, text, extra = {}) {
  s.seq++;
  s.log.push({ seq: s.seq, actor: s.current, round: s.round, text, ...extra });
  if (s.log.length > 80) s.log.splice(0, s.log.length - 80);
}

export function newGame(players) {
  const n = players.length;
  if (!TARGETS[n]) fail('Sea Salt & Paper se joue de 2 à 4 joueurs.');
  const s = {
    v: 1,
    players: players.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    target: TARGETS[n],
    scores: Array(n).fill(0),
    round: 0,
    history: [],
    starter: Math.floor(Math.random() * n),
    log: [],
    seq: 0,
    lastSeen: Array(n).fill(0),
  };
  startRound(s);
  return s;
}

export function startRound(s) {
  const n = s.players.length;
  s.round++;
  s.deck = shuffle([...CARDS.keys()]);
  s.discards = [[s.deck.pop()], [s.deck.pop()]];
  s.hands = Array.from({ length: n }, () => []);
  s.played = Array.from({ length: n }, () => []);
  s.current = s.starter;
  s.phase = 'draw';
  s.pending = null;
  s.extraTurns = 0;
  s.lastChance = null;
  s.result = null;
  log(s, `Manche ${s.round} : ${pname(s, s.current)} commence.`, { sys: true });
}

const hand = (s) => s.hands[s.current];
function need(s, phase) { if (s.phase !== phase) fail('Action impossible maintenant.'); }
function takeFromHand(s, id) {
  const h = hand(s);
  const i = h.indexOf(id);
  if (i < 0) fail('Cette carte n\'est pas dans votre main.');
  h.splice(i, 1);
}

/* ---------- 1. ajouter une carte à sa main ---------- */

export function drawDeck(s) {
  need(s, 'draw');
  if (!s.deck.length) fail('La pioche est vide.');
  if (s.deck.length === 1) {
    const c = s.deck.pop();
    hand(s).push(c);
    log(s, `${pname(s, s.current)} pioche la dernière carte.`);
    s.phase = 'play';
    return { drawn: [c] };
  }
  s.pending = { drawn: [s.deck.pop(), s.deck.pop()] };
  s.phase = 'choose';
  return { drawn: s.pending.drawn };
}

// garde une des deux cartes piochées ; l'autre part sur une défausse
export function keepDrawn(s, id) {
  need(s, 'choose');
  const { drawn } = s.pending;
  if (!drawn.includes(id)) fail('Carte inconnue.');
  const other = drawn.find((c) => c !== id);
  hand(s).push(id);
  const empty = s.discards.findIndex((p) => !p.length);
  if (empty >= 0) {
    s.discards[empty].push(other);
    s.pending = null;
    s.phase = 'play';
    log(s, `${pname(s, s.current)} pioche et défausse ${cardLabel(other)}.`);
    return { pile: empty };
  }
  s.pending = { discard: other };
  s.phase = 'discard';
  return {};
}

export function discardTo(s, pile) {
  need(s, 'discard');
  if (!s.discards[pile]) fail('Défausse inconnue.');
  const c = s.pending.discard;
  s.discards[pile].push(c);
  s.pending = null;
  s.phase = 'play';
  log(s, `${pname(s, s.current)} pioche et défausse ${cardLabel(c)}.`);
  return { pile };
}

export function takeDiscard(s, pile) {
  need(s, 'draw');
  const p = s.discards[pile];
  if (!p || !p.length) fail('Cette défausse est vide.');
  const c = p.pop();
  hand(s).push(c);
  s.phase = 'play';
  log(s, `${pname(s, s.current)} prend ${cardLabel(c)} sur une défausse.`);
  return { card: c };
}

/* ---------- 2. poser des duos ---------- */

export function duoKind(a, b) {
  if (a == null || b == null || a === b) return null;
  const ta = CARDS[a].type;
  const tb = CARDS[b].type;
  if (ta === tb && (ta === 'crab' || ta === 'boat' || ta === 'fish')) return ta;
  if ((ta === 'shark' && tb === 'swimmer') || (ta === 'swimmer' && tb === 'shark')) return 'steal';
  return null;
}

export function stealTargets(s) {
  return s.players.map((_, i) => i).filter((i) => i !== s.current
    && s.hands[i].length > 0
    && !(s.lastChance && s.lastChance.caller === i));
}

export function playDuo(s, a, b) {
  need(s, 'play');
  const kind = duoKind(a, b);
  if (!kind) fail('Ces deux cartes ne forment pas un duo.');
  if (!hand(s).includes(a) || !hand(s).includes(b)) fail('Ces cartes ne sont pas dans votre main.');
  takeFromHand(s, a);
  takeFromHand(s, b);
  s.played[s.current].push([a, b]);
  const who = pname(s, s.current);
  const fx = { kind };
  switch (kind) {
    case 'crab':
      log(s, `${who} pose deux crabes et fouille une défausse.`);
      if (s.discards.some((p) => p.length)) s.phase = 'crab';
      else fx.none = true;
      break;
    case 'boat':
      s.extraTurns++;
      log(s, `${who} pose deux bateaux et rejoue.`);
      break;
    case 'fish':
      log(s, `${who} pose deux poissons et pioche une carte.`);
      if (s.deck.length) {
        fx.drawn = s.deck.pop();
        hand(s).push(fx.drawn);
      } else fx.none = true;
      break;
    case 'steal':
      log(s, `${who} pose un requin et un nageur.`);
      if (stealTargets(s).length) s.phase = 'steal';
      else fx.none = true;
      break;
  }
  return fx;
}

// effet des crabes : choisir une carte dans une défausse (l'ordre de la pile ne change pas)
export function crabTake(s, pile, id) {
  need(s, 'crab');
  const p = s.discards[pile];
  const i = p ? p.indexOf(id) : -1;
  if (i < 0) fail('Carte introuvable dans cette défausse.');
  p.splice(i, 1);
  hand(s).push(id);
  s.phase = 'play';
  log(s, `${pname(s, s.current)} récupère ${cardLabel(id)} dans une défausse.`);
  return { card: id };
}

// effet requin + nageur : voler une carte au hasard
export function steal(s, target) {
  need(s, 'steal');
  if (!stealTargets(s).includes(target)) fail('Impossible de voler ce joueur.');
  const h = s.hands[target];
  const id = h.splice(Math.floor(Math.random() * h.length), 1)[0];
  hand(s).push(id);
  s.phase = 'play';
  log(s, `${pname(s, s.current)} vole une carte à ${pname(s, target)}.`, {
    for: target, secret: `${pname(s, s.current)} t'a volé : ${cardLabel(id)}.`,
  });
  return { card: id, from: target };
}

export function mermaidsInHand(s) {
  return hand(s).filter((c) => CARDS[c].type === 'mermaid');
}

export function playMermaids(s) {
  need(s, 'play');
  const m = mermaidsInHand(s);
  if (m.length < 4) fail('Il faut les 4 sirènes.');
  m.forEach((c) => takeFromHand(s, c));
  s.played[s.current].push(m);
  log(s, `${pname(s, s.current)} pose les 4 sirènes et gagne la partie !`);
  s.result = { type: 'mermaids', caller: s.current, rows: scoreRows(s) };
  s.winners = [s.current];
  s.phase = 'gameEnd';
  return {};
}

/* ---------- 3. fin de tour / fin de manche ---------- */

export function cardsOf(s, i) {
  return [...s.played[i].flat(), ...s.hands[i]];
}

export function canEndRound(s) {
  return s.phase === 'play' && !s.lastChance && score(cardsOf(s, s.current)).points >= END_ROUND_MIN;
}

export function endTurn(s) {
  need(s, 'play');
  const n = s.players.length;
  if (!s.deck.length) {
    log(s, 'La pioche est vide : la manche s\'arrête sans points.');
    return finishRound(s, { type: 'empty', caller: s.current }, Array(n).fill(0));
  }
  if (s.extraTurns > 0) {
    s.extraTurns--;
    s.phase = 'draw';
    return { again: true };
  }
  if (s.lastChance) {
    s.lastChance.remaining = s.lastChance.remaining.filter((i) => i !== s.current);
    if (!s.lastChance.remaining.length) return scoreLastChance(s);
    s.current = s.lastChance.remaining[0];
  } else {
    s.current = (s.current + 1) % n;
  }
  s.phase = 'draw';
  return {};
}

export function callStop(s) {
  if (!canEndRound(s)) fail('Il faut au moins 7 points pour terminer la manche.');
  log(s, `${pname(s, s.current)} dit STOP !`);
  const rows = scoreRows(s);
  const gains = rows.map((r) => r.points);
  return finishRound(s, { type: 'stop', caller: s.current, rows }, gains);
}

export function callLastChance(s) {
  if (!canEndRound(s)) fail('Il faut au moins 7 points pour terminer la manche.');
  const n = s.players.length;
  if (!s.deck.length) {
    log(s, 'La pioche est vide : la manche s\'arrête sans points.');
    return finishRound(s, { type: 'empty', caller: s.current }, Array(n).fill(0));
  }
  const remaining = [];
  for (let k = 1; k < n; k++) remaining.push((s.current + k) % n);
  s.lastChance = { caller: s.current, remaining };
  s.extraTurns = 0;
  log(s, `${pname(s, s.current)} annonce DERNIÈRE CHANCE ! Chacun joue un dernier tour.`);
  s.current = remaining[0];
  s.phase = 'draw';
  return {};
}

function scoreLastChance(s) {
  const rows = scoreRows(s);
  const caller = s.lastChance.caller;
  const best = Math.max(...rows.filter((_, i) => i !== caller).map((r) => r.points));
  const won = rows[caller].points >= best;
  const gains = rows.map((r, i) => {
    if (i === caller) return won ? r.points + r.colorBonus : r.colorBonus;
    return won ? r.colorBonus : r.points;
  });
  log(s, won ? `Pari remporté pour ${pname(s, caller)} !` : `Pari perdu pour ${pname(s, caller)} !`);
  return finishRound(s, { type: 'lastChance', caller, won, rows }, gains);
}

function scoreRows(s) {
  return s.players.map((_, i) => score(cardsOf(s, i)));
}

function finishRound(s, result, gains) {
  const n = s.players.length;
  result.gains = gains;
  result.rows = result.rows || scoreRows(s);
  s.scores = s.scores.map((v, i) => v + gains[i]);
  s.history.push({ round: s.round, gains, type: result.type });
  s.result = result;
  s.lastChance = null;
  s.extraTurns = 0;
  s.starter = (result.caller + 1) % n;
  const top = Math.max(...s.scores);
  if (top >= s.target) {
    // égalité : celui qui a marqué le plus de points lors de la dernière manche l'emporte
    const tied = s.scores.map((v, i) => i).filter((i) => s.scores[i] === top);
    const bestGain = Math.max(...tied.map((i) => gains[i]));
    s.winners = tied.filter((i) => gains[i] === bestGain);
    s.phase = 'gameEnd';
  } else {
    s.phase = 'roundEnd';
  }
  return { result };
}

export function nextRound(s) {
  need(s, 'roundEnd');
  startRound(s);
}

/* ---------- décompte ---------- */

const tbl = (scale, k) => (k ? scale[Math.min(k, scale.length) - 1] : 0);

// points d'un ensemble de cartes (main + cartes posées), avec le détail
export function score(ids) {
  const t = {};
  const col = {};
  for (const id of ids) {
    const { type, color } = CARDS[id];
    t[type] = (t[type] || 0) + 1;
    col[color] = (col[color] || 0) + 1;
  }
  const n = (k) => t[k] || 0;
  const items = [];
  const add = (label, pts) => { if (pts) items.push({ label, pts }); };

  add(`${Math.floor(n('crab') / 2)} paire(s) de crabes`, Math.floor(n('crab') / 2));
  add(`${Math.floor(n('boat') / 2)} paire(s) de bateaux`, Math.floor(n('boat') / 2));
  add(`${Math.floor(n('fish') / 2)} paire(s) de poissons`, Math.floor(n('fish') / 2));
  add('Requin + nageur', Math.min(n('shark'), n('swimmer')));
  add(`${n('shell')} coquillage(s)`, tbl(TYPES.shell.scale, n('shell')));
  add(`${n('octopus')} poulpe(s)`, tbl(TYPES.octopus.scale, n('octopus')));
  add(`${n('penguin')} manchot(s)`, tbl(TYPES.penguin.scale, n('penguin')));
  add(`${n('sailor')} moussaillon(s)`, tbl(TYPES.sailor.scale, n('sailor')));
  if (n('lighthouse')) add('Phare × bateaux', n('boat'));
  if (n('shoal')) add('Banc × poissons', n('fish'));
  if (n('colony')) add('Colonie × manchots', 2 * n('penguin'));
  if (n('captain')) add('Capitaine × moussaillons', 3 * n('sailor'));

  // couleurs les plus nombreuses (les sirènes comptent comme des cartes blanches)
  const ranked = Object.entries(col).sort((a, b) => b[1] - a[1]);
  const m = n('mermaid');
  if (m) {
    const used = ranked.slice(0, m);
    add(`Sirène(s) : ${used.map(([c, k]) => `${k} ${COLORS[c].name.toLowerCase()}`).join(' + ')}`,
      used.reduce((acc, [, k]) => acc + k, 0));
  }
  const points = items.reduce((acc, it) => acc + it.pts, 0);
  const [bonusColor, colorBonus] = ranked[0] || [null, 0];
  return { points, items, colorBonus, bonusColor, colors: col };
}
