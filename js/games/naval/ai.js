// L'Amiral Robot : il compte, pour chaque case, combien de positions des navires restants la recouvrent
// (en tenant compte des tirs déjà connus) et tire là où c'est le plus probable.
// Quand il a touché un navire pas encore coulé, il ne garde que les positions qui passent par ce coup.
import { N, FLEET, MISS, HIT, shipCells, sunkShips, opponent } from './rules.js';

export function cpuTarget(s, rand = Math.random) {
  const me = s.current;
  const opp = opponent(me);
  const board = s.shots[me];
  const sunk = sunkShips(s, opp);
  const sunkCells = new Set(sunk.flatMap((k) => shipCells(s.fleets[opp][k])));
  const open = new Set(); // coups au but sur des navires encore à flot
  board.forEach((v, i) => { if (v === HIT && !sunkCells.has(i)) open.add(i); });
  const blocked = (i) => board[i] === MISS || sunkCells.has(i);

  const weight = Array(N * N).fill(0);
  const sizes = FLEET.map((f, k) => (sunk.includes(k) ? 0 : f.size)).filter(Boolean);
  for (const size of sizes) {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        for (const h of [true, false]) {
          if (h ? c + size > N : r + size > N) continue;
          const cells = Array.from({ length: size }, (_, d) => (r + (h ? 0 : d)) * N + c + (h ? d : 0));
          if (cells.some(blocked)) continue;
          const covered = cells.filter((i) => open.has(i)).length;
          if (open.size && !covered) continue;
          const w = open.size ? covered ** 3 : 1;
          for (const i of cells) if (board[i] !== HIT) weight[i] += w;
        }
      }
    }
  }
  // en recherche, il tire parfois un peu au hasard comme un humain : il reste battable
  if (!open.size && rand() < 0.45) {
    const cand = weight.map((w, i) => (w ? i : -1)).filter((i) => i >= 0);
    if (cand.length) return cand[Math.floor(rand() * cand.length)];
  }
  // un peu de hasard pour ne pas jouer toujours les mêmes cases
  let best = -1;
  let bestW = -1;
  weight.forEach((w, i) => {
    if (!w) return;
    const v = w * (0.8 + rand() * 0.4);
    if (v > bestW) { bestW = v; best = i; }
  });
  if (best < 0) best = board.findIndex((v) => v === 0); // ne devrait pas arriver
  return best;
}
