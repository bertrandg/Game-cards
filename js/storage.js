// Tout ce qui est gardé sur le téléphone (localStorage) : joueurs, parties en cours, historique.
const KEYS = { players: 'cartes.players', saves: 'cartes.saves', history: 'cartes.history' };

function read(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // stockage plein ou indisponible (navigation privée)
  }
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// couleurs douces attribuées aux joueurs, dans l'ordre
export const PLAYER_COLORS = ['#e07a5f', '#3d9a8b', '#f2b84b', '#8e7cc3', '#5b8fd1', '#d9779b', '#7aa95c', '#c98a4b'];

/* ---------- joueurs ---------- */

export function getPlayers() {
  const list = read(KEYS.players, []);
  return Array.isArray(list) ? list : [];
}

function savePlayers(list) { write(KEYS.players, list); }

export function addPlayer(name) {
  const list = getPlayers();
  const used = new Set(list.map((p) => p.color));
  const color = PLAYER_COLORS.find((c) => !used.has(c)) || PLAYER_COLORS[list.length % PLAYER_COLORS.length];
  const p = { id: uid(), name: name.trim().slice(0, 16), color, createdAt: Date.now(), stats: {} };
  list.push(p);
  savePlayers(list);
  return p;
}

export function renamePlayer(id, name) {
  const list = getPlayers();
  const p = list.find((x) => x.id === id);
  if (p) { p.name = name.trim().slice(0, 16); savePlayers(list); }
}

export function removePlayer(id) {
  savePlayers(getPlayers().filter((p) => p.id !== id));
}

export function recordResult(gameId, playerIds, winnerIds) {
  const list = getPlayers();
  for (const p of list) {
    if (!playerIds.includes(p.id)) continue;
    const st = (p.stats[gameId] ||= { played: 0, won: 0 });
    st.played++;
    if (winnerIds.includes(p.id)) st.won++;
  }
  savePlayers(list);
}

/* ---------- parties en cours ---------- */

export function getSaves() {
  const list = read(KEYS.saves, []);
  return (Array.isArray(list) ? list : []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getSave(id) {
  return getSaves().find((s) => s.id === id) || null;
}

export function putSave(save) {
  const list = getSaves().filter((s) => s.id !== save.id);
  list.push({ ...save, updatedAt: Date.now() });
  return write(KEYS.saves, list);
}

export function removeSave(id) {
  write(KEYS.saves, getSaves().filter((s) => s.id !== id));
}

/* ---------- historique des parties terminées ---------- */

export function getHistory() {
  const list = read(KEYS.history, []);
  return Array.isArray(list) ? list : [];
}

export function addHistory(entry) {
  const list = getHistory();
  list.unshift({ ...entry, date: Date.now() });
  write(KEYS.history, list.slice(0, 30));
}
