// Bataille navale : moteur de règles pur, état sérialisable en JSON.
// Règles classiques (« Touché Coulé ») : grille de 10 × 10, cases numérotées 0…99 (ligne × 10 + colonne),
// 5 navires droits qui peuvent se toucher mais pas se chevaucher. Variante maison : touché = on rejoue.

export const N = 10;
export const COLS = 'ABCDEFGHIJ';

export const FLEET = [
  { name: 'Porte-avions', size: 5 },
  { name: 'Cuirassé', size: 4 },
  { name: 'Croiseur', size: 3 },
  { name: 'Sous-marin', size: 3 },
  { name: 'Torpilleur', size: 2 },
];

// ce que chaque joueur sait de la grille adverse
export const UNKNOWN = 0;
export const MISS = 1;
export const HIT = 2;

export const cellName = (i) => `${COLS[i % N]}${Math.floor(i / N) + 1}`;

// navire : { k (index dans FLEET), r, c, h (horizontal) }
export function shipCells(ship) {
  const size = FLEET[ship.k].size;
  return Array.from({ length: size }, (_, d) => (ship.r + (ship.h ? 0 : d)) * N + ship.c + (ship.h ? d : 0));
}

const inside = (ship) => {
  const size = FLEET[ship.k].size;
  return ship.r >= 0 && ship.c >= 0 && (ship.h ? ship.c + size <= N && ship.r < N : ship.r + size <= N && ship.c < N);
};

// le navire `ship` peut-il être placé parmi les autres navires de `fleet` (sauf celui d'index `skip`) ?
export function fits(fleet, ship, skip = -1) {
  if (!inside(ship)) return false;
  const taken = new Set();
  fleet.forEach((o, j) => {
    if (j === skip || !o) return;
    for (const i of shipCells(o)) taken.add(i);
  });
  return shipCells(ship).every((i) => !taken.has(i));
}

export function validFleet(fleet) {
  return Array.isArray(fleet) && fleet.length === FLEET.length
    && fleet.every((sh, j) => sh && sh.k === j && fits(fleet, sh, j));
}

export function randomFleet(rand = Math.random) {
  for (;;) {
    const fleet = [];
    let ok = true;
    for (let k = 0; k < FLEET.length && ok; k++) {
      ok = false;
      for (let tries = 0; tries < 200; tries++) {
        const ship = { k, h: rand() < 0.5, r: Math.floor(rand() * N), c: Math.floor(rand() * N) };
        if (fits(fleet, ship)) { fleet.push(ship); ok = true; break; }
      }
    }
    if (ok) return fleet;
  }
}

// la position valide la plus proche de `ship` (pour poser un navire là où on le lâche ou le tourne)
export function nearestFit(fleet, ship, skip) {
  let best = null;
  let bestD = Infinity;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const cand = { ...ship, r, c };
      const d = (r - ship.r) ** 2 + (c - ship.c) ** 2;
      if (d < bestD && fits(fleet, cand, skip)) { best = cand; bestD = d; }
    }
  }
  return best;
}

export const shipAt = (fleet, i) => fleet.findIndex((sh) => shipCells(sh).includes(i));

/* ---------- partie ---------- */

export const CPU = { id: 'cpu', name: 'Amiral Robot', cpu: true };

export function newGame(players, rand = Math.random) {
  const humans = players.filter((p) => !p.cpu).slice(0, 2).map(({ id, name, color }) => ({ id, name, color }));
  if (humans.length === 1) humans.push({ ...CPU, color: humans[0].color === '#5b8fd1' ? '#8e7cc3' : '#5b8fd1' });
  const s = {
    v: 1,
    players: humans,
    phase: 'place', // place → battle → end
    placer: 0,
    fleets: humans.map((p) => (p.cpu ? randomFleet(rand) : null)),
    shots: humans.map(() => Array(N * N).fill(UNKNOWN)), // shots[i] : tirs du joueur i sur la grille adverse
    fired: [0, 0],
    hits: [0, 0],
    current: rand() < 0.5 ? 0 : 1,
    first: 0, // premier tireur : un tour est complet quand l'autre a tiré
    turn: 1,
    last: null, // dernier tir : { by, idx, hit, sunk }
    winner: null,
  };
  s.first = s.current;
  s.placer = s.fleets.findIndex((f) => !f);
  return s;
}

export const vsCpu = (s) => s.players.some((p) => p.cpu);
export const opponent = (i) => 1 - i;

export function placeFleet(s, i, fleet) {
  if (s.phase !== 'place' || s.placer !== i) throw new Error('Ce n\'est pas le moment de placer cette flotte');
  if (!validFleet(fleet)) throw new Error('Les navires ne peuvent pas se chevaucher');
  s.fleets[i] = fleet.map(({ k, r, c, h }) => ({ k, r, c, h }));
  s.placer = s.fleets.findIndex((f) => !f);
  if (s.placer < 0) s.phase = 'battle';
}

// navires coulés de la flotte du joueur `i`
export function sunkShips(s, i) {
  const seen = s.shots[opponent(i)];
  return s.fleets[i].map((sh, k) => (shipCells(sh).every((x) => seen[x] === HIT) ? k : -1)).filter((k) => k >= 0);
}

export function fire(s, idx) {
  if (s.phase !== 'battle') throw new Error('La bataille n\'a pas commencé');
  if (!(idx >= 0 && idx < N * N)) throw new Error('Case inconnue');
  const by = s.current;
  const opp = opponent(by);
  const board = s.shots[by];
  if (board[idx] === MISS || board[idx] === HIT) throw new Error('Vous avez déjà tiré ici');
  const k = shipAt(s.fleets[opp], idx);
  const hit = k >= 0;
  board[idx] = hit ? HIT : MISS;
  s.fired[by]++;
  let sunk = null;
  if (hit) {
    s.hits[by]++;
    if (shipCells(s.fleets[opp][k]).every((x) => board[x] === HIT)) sunk = k;
  }
  s.last = { by, idx, hit, sunk };
  // tous les tirs du tour en cours (on rejoue tant qu'on touche), pour les montrer à l'adversaire
  if (s.volley?.by !== by) s.volley = { by, shots: [] };
  s.volley.shots.push({ idx, hit, sunk });
  const win = sunk !== null && sunkShips(s, opp).length === FLEET.length;
  if (win) {
    s.phase = 'end';
    s.winner = by;
  } else if (!hit) {
    s.current = opp;
    if (by !== s.first) s.turn++;
  }
  return { idx, hit, sunk, win, again: hit && !win };
}
