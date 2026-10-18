// Coque de l'application : accueil, choix des joueurs, gestion des joueurs, lancement des jeux.
// Navigation par l'adresse (#/…) pour que le bouton retour du téléphone ramène au menu.
import { GAMES, gameById } from './games/index.js';
import * as store from './storage.js';
import { confirmDialog, promptDialog, toast, esc } from './ui/dialog.js';
import { fullscreenButton } from './ui/fullscreen.js';

const app = document.getElementById('app');
// version ajoutée au déploiement (?v=…) : on la propage aux feuilles de style chargées à la demande
const VERSION = new URL(import.meta.url).search;

let current = null; // jeu affiché : { destroy() }

function loadCSS(href) {
  if (document.querySelector(`link[data-css="${href}"]`)) return Promise.resolve();
  return new Promise((resolve) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href + VERSION;
    l.dataset.css = href;
    l.onload = l.onerror = resolve;
    document.head.appendChild(l);
  });
}

const go = (hash) => { location.hash = hash; };

function timeAgo(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'à l\'instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'hier' : `il y a ${d} jours`;
}

const avatar = (p, cls = '') => `<span class="avatar ${cls}" style="--pc:${p.color || '#c98a4b'}">${esc((p.name || '?').slice(0, 1).toUpperCase())}</span>`;

/* ---------- accueil ---------- */

function home() {
  const saves = store.getSaves();
  const players = store.getPlayers();
  app.innerHTML = `
  <div class="screen home">
    <div class="home-tools">${fullscreenButton()}</div>
    <header class="hero">
      <div class="hero-cards" aria-hidden="true"><span>🐚</span><span>🦀</span><span>⛵</span></div>
      <h1>Petite Partie</h1>
      <p>Des petits jeux à partager, sur un seul téléphone.</p>
    </header>

    ${saves.length ? `
    <section>
      <h2>Parties en cours</h2>
      <ul class="saves">
        ${saves.map((s) => {
          const g = gameById(s.gameId);
          return `<li class="save">
            <button class="save-main" data-resume="${s.id}">
              <span class="save-emoji" style="--t1:${g?.tint[0]};--t2:${g?.tint[1]}">${g?.emoji || '🃏'}</span>
              <span class="save-text">
                <b>${esc(g?.name || s.gameId)}</b>
                <small>${esc(s.summary || '')}</small>
                <small class="muted">${timeAgo(s.updatedAt)}</small>
              </span>
              <span class="save-go">Reprendre ›</span>
            </button>
            <button class="icon-btn" data-delsave="${s.id}" aria-label="Supprimer la partie">🗑</button>
          </li>`;
        }).join('')}
      </ul>
    </section>` : ''}

    <section>
      <h2>Jeux</h2>
      <div class="games">
        ${GAMES.map((g) => `
          <button class="game-tile" data-new="${g.id}" style="--t1:${g.tint[0]};--t2:${g.tint[1]}">
            <span class="game-emoji">${g.emoji}</span>
            <span class="game-text">
              <b>${esc(g.name)}</b>
              <small>${esc(g.tagline)}</small>
              <small class="chips"><i>👥 ${g.players[0]}–${g.players[1]}</i><i>⏱ ${g.duration}</i></small>
            </span>
          </button>`).join('')}
        <div class="game-tile soon"><span class="game-emoji">✨</span><span class="game-text"><b>Bientôt</b><small>D'autres jeux arrivent…</small></span></div>
      </div>
    </section>

    <section>
      <h2>Joueurs</h2>
      <button class="players-strip" data-go="#/players">
        ${players.length ? players.slice(0, 6).map((p) => avatar(p)).join('') : '<span class="muted">Aucun joueur pour l\'instant</span>'}
        <span class="strip-go">Gérer ›</span>
      </button>
    </section>
  </div>`;

  app.onclick = async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.resume) go(`#/play/${t.dataset.resume}`);
    else if (t.dataset.new) go(`#/new/${t.dataset.new}`);
    else if (t.dataset.go) go(t.dataset.go);
    else if (t.dataset.delsave) {
      if (await confirmDialog('Supprimer cette partie en cours ?', { ok: 'Supprimer', danger: true })) {
        store.removeSave(t.dataset.delsave);
        home();
      }
    }
  };
}

/* ---------- nouvelle partie : choix des joueurs ---------- */

function setup(gameId) {
  const g = gameById(gameId);
  if (!g) return go('#/');
  const [min, max] = g.players;
  let selected = [];

  const draw = () => {
    const players = store.getPlayers();
    selected = selected.filter((id) => players.some((p) => p.id === id));
    const ok = selected.length >= min && selected.length <= max;
    app.innerHTML = `
    <div class="screen setup">
      <header class="bar">
        <button class="icon-btn" data-go="#/" aria-label="Retour">‹</button>
        <h1>${esc(g.name)}</h1>
      </header>
      <p class="lead">Qui joue ? Touchez les joueurs dans l'ordre où ils sont assis autour de la table (${min} à ${max}).${g.solo ? ` ${esc(g.solo)}` : ''}</p>
      <div class="pick">
        ${players.map((p) => {
          const i = selected.indexOf(p.id);
          return `<button class="pick-p ${i >= 0 ? 'on' : ''}" data-pick="${p.id}">
            ${avatar(p)}<span>${esc(p.name)}</span>${i >= 0 ? `<em>${i + 1}</em>` : ''}
          </button>`;
        }).join('')}
      </div>
      <form class="add-p">
        <input class="field" name="n" maxlength="16" placeholder="Nouveau joueur…" autocomplete="off">
        <button class="btn">Ajouter</button>
      </form>
      <div class="setup-foot">
        <button class="btn primary big" data-start ${ok ? '' : 'disabled'}>
          ${ok ? (selected.length === 1 ? 'Jouer contre l\'ordinateur' : 'C\'est parti !') : selected.length < min ? `Encore ${min - selected.length} joueur(s)` : `${max} joueurs maximum`}
        </button>
      </div>
    </div>`;
  };
  draw();

  app.onclick = async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.go) go(t.dataset.go);
    else if (t.dataset.pick) {
      const id = t.dataset.pick;
      if (selected.includes(id)) selected = selected.filter((x) => x !== id);
      else if (selected.length < max) selected.push(id);
      else toast(`${max} joueurs maximum`);
      draw();
    } else if (t.dataset.start !== undefined) {
      const all = store.getPlayers();
      const players = selected.map((id) => all.find((p) => p.id === id));
      await startNew(g, players);
    }
  };
  app.onsubmit = (e) => {
    e.preventDefault();
    const name = e.target.n.value.trim();
    if (!name) return;
    const p = store.addPlayer(name);
    if (selected.length < max) selected.push(p.id);
    draw();
    app.querySelector('.add-p input').focus();
  };
}

async function startNew(g, players) {
  const mod = (await g.load()).default;
  const state = mod.newGame(players);
  const id = store.uid();
  store.putSave({ id, gameId: g.id, playerIds: players.map((p) => p.id), summary: mod.summary(state), state, createdAt: Date.now() });
  location.replace(`#/play/${id}`);
}

/* ---------- joueurs ---------- */

function playersScreen() {
  const players = store.getPlayers();
  const history = store.getHistory();
  app.innerHTML = `
  <div class="screen players">
    <header class="bar">
      <button class="icon-btn" data-go="#/" aria-label="Retour">‹</button>
      <h1>Joueurs</h1>
    </header>
    <ul class="plist">
      ${players.map((p) => {
        const stats = Object.entries(p.stats || {}).map(([gid, st]) => `${esc(gameById(gid)?.name || gid)} : ${st.won} victoire(s) / ${st.played} partie(s)`);
        return `<li>
          ${avatar(p, 'big')}
          <div class="pinfo"><b>${esc(p.name)}</b><small>${stats.join('<br>') || 'Pas encore de partie terminée'}</small></div>
          <button class="icon-btn" data-rename="${p.id}" aria-label="Renommer">✏️</button>
          <button class="icon-btn" data-del="${p.id}" aria-label="Supprimer">🗑</button>
        </li>`;
      }).join('') || '<li class="muted">Ajoutez les joueurs de la maison ici.</li>'}
    </ul>
    <form class="add-p">
      <input class="field" name="n" maxlength="16" placeholder="Nouveau joueur…" autocomplete="off">
      <button class="btn">Ajouter</button>
    </form>
    ${history.length ? `
    <h2>Dernières parties</h2>
    <ul class="hist">
      ${history.slice(0, 10).map((h) => `<li><span>${esc(gameById(h.gameId)?.emoji || '🃏')}</span>
        <div><b>🏆 ${esc(h.winners.join(', '))}</b><small>${esc(h.summary)} · ${timeAgo(h.date)}</small></div></li>`).join('')}
    </ul>` : ''}
  </div>`;

  app.onclick = async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.go) go(t.dataset.go);
    else if (t.dataset.rename) {
      const p = players.find((x) => x.id === t.dataset.rename);
      const name = await promptDialog('Nouveau nom', p.name);
      if (name) { store.renamePlayer(p.id, name); playersScreen(); }
    } else if (t.dataset.del) {
      const p = players.find((x) => x.id === t.dataset.del);
      if (await confirmDialog(`Supprimer ${p.name} ?`, { ok: 'Supprimer', danger: true })) {
        store.removePlayer(p.id);
        playersScreen();
      }
    }
  };
  app.onsubmit = (e) => {
    e.preventDefault();
    const name = e.target.n.value.trim();
    if (!name) return;
    store.addPlayer(name);
    playersScreen();
    app.querySelector('.add-p input').focus();
  };
}

/* ---------- partie ---------- */

async function play(saveId) {
  const save = store.getSave(saveId);
  if (!save) { toast('Partie introuvable'); return go('#/'); }
  const g = gameById(save.gameId);
  app.onclick = app.onsubmit = null;
  app.innerHTML = `<div class="loading">${esc(g.loading || 'Mélange des cartes…')}</div>`;
  const [mod] = await Promise.all([g.load().then((m) => m.default), ...[].concat(g.css).map(loadCSS)]);
  if (location.hash !== `#/play/${saveId}`) return; // on a quitté pendant le chargement
  let finished = false;
  const host = {
    save(state) {
      if (finished) return;
      store.putSave({ ...save, summary: mod.summary(state), state });
    },
    finish({ winners, summary }) {
      if (finished) return;
      finished = true;
      store.removeSave(saveId);
      store.recordResult(g.id, save.playerIds, winners.map((p) => p.id));
      store.addHistory({ gameId: g.id, winners: winners.map((p) => p.name), summary });
    },
    abandon() {
      finished = true;
      store.removeSave(saveId);
    },
    exit() { go('#/'); },
    async restart(players) {
      const all = store.getPlayers();
      await startNew(g, players.map((p) => all.find((x) => x.id === p.id) || p));
    },
  };
  app.innerHTML = '';
  current = mod.mount(app, save.state, host);
}

/* ---------- routeur ---------- */

function route() {
  current?.destroy?.();
  current = null;
  app.onclick = app.onsubmit = null;
  window.scrollTo(0, 0);
  const [, page, arg] = location.hash.split('/');
  if (page === 'new') setup(arg);
  else if (page === 'players') playersScreen();
  else if (page === 'play') play(arg);
  else home();
}

window.addEventListener('hashchange', route);
route();
