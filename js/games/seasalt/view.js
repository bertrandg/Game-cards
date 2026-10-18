// Table de jeu de Sea Salt & Paper : rendu, gestes et animations.
// Tout est redessiné à chaque action ; les cartes glissent ensuite de leur ancienne place (anim.js).
import { CARDS, TYPES, COLORS, sortCards, cardLabel } from './cards.js';
import * as R from './rules.js';
import { snapshot, animateCards, bump, confetti } from '../../ui/anim.js';
import { confirmDialog, toast, esc } from '../../ui/dialog.js';

const LIGHTHOUSE = `<svg viewBox="0 0 40 60" class="svg-art" aria-hidden="true">
  <rect x="9" y="53" width="22" height="5" rx="2" fill="#6f5b4b"/>
  <path d="M14.5 53 L16.8 17 H23.2 L25.5 53Z" fill="#fffaf2"/>
  <path d="M15.1 44 H24.9 L25.3 50 H14.7Z M16 30 H24 L24.4 36 H15.6Z" fill="#e06b4f"/>
  <rect x="15" y="9" width="10" height="8" rx="1.5" fill="#ffd66b"/>
  <path d="M13.5 9.5 L20 3 L26.5 9.5Z" fill="#e06b4f"/>
  <path d="M25 11 L38 6 V20 Z M15 11 L2 6 V20Z" fill="#ffe9a8" opacity=".55"/>
</svg>`;

const ART = {
  lighthouse: LIGHTHOUSE,
  colony: '<span class="cluster">🐧<span>🐧</span>🐧</span>',
  shoal: '<span class="cluster">🐠<span>🐟</span>🐠</span>',
};

const DUO_TEXT = {
  crab: 'Poser les crabes · fouiller une défausse',
  boat: 'Poser les bateaux · rejouer',
  fish: 'Poser les poissons · piocher 1 carte',
  steal: 'Poser requin + nageur · voler une carte',
};

function corner(c, t) {
  if (t.kind === 'collection') {
    return `<span class="ci">${t.icon}</span><ol class="scale">${t.scale.map((v) => `<li>${v}</li>`).join('')}</ol>`;
  }
  if (t.kind === 'duo') return `<span class="ci">${t.icon}</span><span class="cv">1</span>`;
  if (t.kind === 'multi') return `<span class="cm">${t.short}</span>`;
  return '<span class="cm">★</span>';
}

// une carte face visible ; `id` false pour une copie sans animation (règles, adversaires)
export function cardHTML(id, cls = '', withId = true) {
  const c = CARDS[id];
  const t = TYPES[c.type];
  const col = COLORS[c.color];
  return `<div class="card ${cls} k-${t.kind} t-${c.type}" ${withId ? `data-cid="${id}"` : ''} data-zoom="${id}" style="--cb:${col.bg};--ci:${col.ink}">
    <div class="face front">
      <div class="corner">${corner(c, t)}</div>
      <div class="art">${ART[c.type] || t.icon}</div>
      <div class="cname">${t.name}</div>
    </div>
    <div class="face back"></div>
  </div>`;
}

const backHTML = (cls = '') => `<div class="card down ${cls}"><div class="face back"></div></div>`;
const avatar = (p) => `<span class="avatar" style="--pc:${p.color || '#c98a4b'}">${esc(p.name.slice(0, 1).toUpperCase())}</span>`;

export function mount(root, s, host) {
  root.innerHTML = '<div class="ssp"></div>';
  const el = root.firstChild;
  const ui = {
    sel: [], // cartes sélectionnées dans la main
    revealed: null, // joueur dont la main est visible (sinon écran « passe le téléphone »)
    overlay: null, // menu | rules | zoom
    zoom: null,
    crabPile: 0,
    fresh: new Set(), // cartes qui viennent d'arriver (petit halo)
    final: false, // classement final affiché
    finished: false,
  };
  let origins = {};
  let fallback = '[data-anchor="deck"]';

  const P = (i) => s.players[i];
  const me = () => s.current;
  const playing = () => !['roundEnd', 'gameEnd'].includes(s.phase);
  const hidden = () => playing() && ui.revealed !== s.current;

  /* ---------- rendu ---------- */

  function render(opts = {}) {
    const before = opts.noAnim ? new Map() : snapshot(el);
    el.innerHTML = html();
    if (!opts.noAnim) animateCards(el, before, { origins, fallback: 'fallback' in opts ? opts.fallback : fallback, stagger: opts.stagger });
    origins = {};
    if (s.phase === 'gameEnd' && !ui.finished) {
      ui.finished = true;
      const winners = s.winners.map((i) => P(i));
      host.finish({ winners, summary: `${s.players.map((p, i) => `${p.name} ${s.scores[i]}`).join(' · ')}` });
    }
  }

  function html() {
    return `
      ${top()}
      ${opponents()}
      ${table()}
      ${mine()}
      ${overlay()}`;
  }

  function top() {
    return `<header class="top">
      <button class="icon-btn" data-a="menu" aria-label="Menu">☰</button>
      <div class="top-mid"><b>Manche ${s.round}</b><small>Objectif ${s.target} points</small></div>
      <button class="icon-btn" data-a="rules" aria-label="Règles">?</button>
    </header>`;
  }

  function seatsAfter(i) {
    const n = s.players.length;
    return Array.from({ length: n - 1 }, (_, k) => (i + 1 + k) % n);
  }

  function opponents() {
    return `<section class="opps">${seatsAfter(me()).map((i) => {
      const n = s.hands[i].length;
      const safe = s.lastChance?.caller === i;
      return `<div class="opp ${safe ? 'safe' : ''}" data-opp="${i}">
        <div class="opp-head">${avatar(P(i))}<b>${esc(P(i).name)}</b><span class="opp-score">${s.scores[i]}</span></div>
        <div class="opp-hand">${Array.from({ length: Math.min(n, 4) }, () => backHTML('tiny')).join('')}<small>${n} carte${n > 1 ? 's' : ''}</small></div>
        <div class="opp-played">${s.played[i].map((g) => `<span class="grp">${g.map((c) => cardHTML(c, 'tiny', false)).join('')}</span>`).join('')}</div>
        ${safe ? '<span class="badge">🛡️ Dernière chance</span>' : ''}
      </div>`;
    }).join('')}</section>`;
  }

  function table() {
    const canDeck = !hidden() && s.phase === 'draw' && s.deck.length > 0;
    const pileLive = (i) => !hidden() && ((s.phase === 'draw' && s.discards[i].length) || s.phase === 'discard');
    const piles = s.discards.map((p, i) => `
      <button class="pile disc ${pileLive(i) ? 'live' : ''}" data-a="pile" data-pile="${i}">
        <span class="slot">${p.length > 1 ? backHTML('under') : ''}${p.length ? cardHTML(p[p.length - 1]) : '<span class="empty">vide</span>'}</span>
        <small>Défausse · ${p.length}</small>
      </button>`).join('');
    return `<section class="table">
      <button class="pile deck ${canDeck ? 'live' : ''}" data-a="deck">
        <span class="slot" data-anchor="deck">${s.deck.length ? backHTML('stack') : '<span class="empty">vide</span>'}</span>
        <small>Pioche · ${s.deck.length}</small>
      </button>
      ${piles}
    </section>
    <div class="status">${status()}</div>`;
  }

  function status() {
    if (!playing()) return '';
    if (hidden()) return `C'est au tour de <b>${esc(P(me()).name)}</b>`;
    const lc = s.lastChance ? `<span class="lc">⏳ Dernière chance de ${esc(P(s.lastChance.caller).name)} : dernier tour !</span>` : '';
    const msg = {
      draw: 'Piochez 2 cartes ou prenez le dessus d\'une défausse.',
      choose: 'Gardez une des deux cartes.',
      discard: 'Touchez la défausse où poser l\'autre carte.',
      play: s.extraTurns ? 'Posez des duos… puis rejouez grâce aux bateaux !' : 'Posez des duos si vous voulez, puis finissez votre tour.',
      crab: 'Choisissez une carte dans une défausse.',
      steal: 'Choisissez à qui voler une carte.',
    }[s.phase];
    if (s.phase === 'discard') return `<span class="held">${cardHTML(s.pending.discard)}<span>${msg}</span></span>`;
    return `${lc}<span>${msg}</span>`;
  }

  function mine() {
    const i = me();
    const sc = R.score(R.cardsOf(s, i));
    const bonus = sc.bonusColor ? `<i class="dot" style="--cb:${COLORS[sc.bonusColor].bg}"></i>${sc.colorBonus}` : '0';
    const head = hidden() ? '' : `<div class="me-head">
        ${avatar(P(i))}<b>${esc(P(i).name)}</b>
        <span class="pill" title="Points des cartes">🃏 <b data-pts>${sc.points}</b> pts</span>
        <span class="pill" title="Bonus couleur">🎨 ${bonus}</span>
        <span class="pill total" title="Score total">🏆 ${s.scores[i]}</span>
      </div>`;
    const played = hidden() || !s.played[i].length ? '' : `<div class="me-played">${s.played[i].map((g) => `<span class="grp">${g.map((c) => cardHTML(c, 'mini')).join('')}</span>`).join('')}</div>`;
    return `<section class="me">${head}${played}${hidden() ? '' : actions()}${hand()}</section>`;
  }

  function actions() {
    if (s.phase !== 'play') return '<div class="actions"></div>';
    const btns = [];
    const kind = ui.sel.length === 2 ? R.duoKind(ui.sel[0], ui.sel[1]) : null;
    if (kind) btns.push(`<button class="btn primary" data-a="duo">${DUO_TEXT[kind]}</button>`);
    else if (ui.sel.length) btns.push('<span class="hint">Choisissez 2 cartes qui forment un duo</span>');
    if (R.mermaidsInHand(s).length === 4) btns.push('<button class="btn gold" data-a="mermaids">🧜‍♀️ Poser les 4 sirènes !</button>');
    if (R.canEndRound(s)) {
      btns.push('<button class="btn stop" data-a="stop">✋ STOP</button>');
      btns.push('<button class="btn chance" data-a="last">🎲 Dernière chance</button>');
    }
    btns.push(`<button class="btn ${kind ? 'ghost' : 'primary'}" data-a="end">${s.extraTurns ? 'Rejouer ⛵' : 'Fin du tour'}</button>`);
    const warn = s.deck.length ? '' : '<p class="warn">La pioche est vide : la manche s\'arrêtera sans points à la fin du tour.</p>';
    return `<div class="actions">${btns.join('')}</div>${warn}`;
  }

  function hand() {
    // largeur utile : marges de la zone (10 + 12 px de chaque côté) et place pour l'inclinaison
    const W = Math.min(el.clientWidth || window.innerWidth, 640) - 56;
    const cw = Math.round(Math.min(92, Math.max(62, W * 0.21)));
    if (hidden()) return `<div class="hand" style="--cw:${cw}px"></div>`;
    const ids = sortCards(s.hands[me()]);
    const n = ids.length;
    const step = n > 1 ? Math.min(cw * 0.78, (W - cw) / (n - 1)) : 0;
    const width = cw + step * (n - 1);
    const x0 = (W - width) / 2;
    const live = s.phase === 'play';
    const cards = ids.map((id, k) => {
      const mid = (n - 1) / 2;
      const rot = n > 1 ? (k - mid) * Math.min(3.2, 26 / n) : 0;
      const y = Math.abs(k - mid) ** 2 * Math.min(1.6, 16 / (n * n / 4 + 1));
      const cls = `${ui.sel.includes(id) ? 'sel' : ''} ${ui.fresh.has(id) ? 'fresh' : ''} ${live ? 'tap' : ''}`;
      return `<div class="hslot" style="left:${x0 + k * step}px;top:${y}px;rotate:${rot}deg;z-index:${k + 1}">${cardHTML(id, cls)}</div>`;
    }).join('');
    return `<div class="hand" style="--cw:${cw}px">${n ? cards : '<p class="empty-hand">Votre main est vide.</p>'}</div>`;
  }

  /* ---------- fenêtres ---------- */

  function overlay() {
    if (ui.overlay === 'menu') return menu();
    if (ui.overlay === 'rules') return rules();
    if (ui.overlay === 'zoom') return zoom();
    if (s.phase === 'roundEnd' || s.phase === 'gameEnd') return ui.final ? final() : result();
    if (hidden()) return handoff();
    if (s.phase === 'choose') return choose();
    if (s.phase === 'crab') return crab();
    if (s.phase === 'steal') return stealPick();
    return '';
  }

  function handoff() {
    const i = me();
    const seen = s.lastSeen[i];
    const events = s.log.filter((e) => e.seq > seen && (e.sys || e.actor !== i))
      .slice(-8).map((e) => `<li class="${e.for === i ? 'secret' : ''}">${esc(e.for === i ? e.secret : e.text)}</li>`).join('');
    return `<div class="overlay handoff">
      <div class="sheet">
        <div class="ho-avatar">${avatar(P(i))}</div>
        <p class="kicker">📱 Passez le téléphone à</p>
        <h2>${esc(P(i).name)}</h2>
        ${s.lastChance ? `<p class="lc">⏳ ${esc(P(s.lastChance.caller).name)} a annoncé « Dernière chance » : c'est votre dernier tour !</p>` : ''}
        ${events ? `<div class="news"><b>Depuis votre dernier tour</b><ul>${events}</ul></div>` : ''}
        <button class="btn primary big" data-a="reveal">C'est moi, voir mes cartes</button>
      </div>
    </div>`;
  }

  function choose() {
    return `<div class="overlay pick">
      <div class="sheet clear">
        <h3>Gardez une carte</h3>
        <div class="pick-row">${s.pending.drawn.map((id) => `<button class="pick-card" data-keep="${id}">${cardHTML(id, 'big')}</button>`).join('')}</div>
        <p class="muted">L'autre ira sur une défausse.</p>
      </div>
    </div>`;
  }

  function crab() {
    const piles = s.discards.map((p, i) => ({ p, i })).filter(({ p }) => p.length);
    if (!piles.some(({ i }) => i === ui.crabPile)) ui.crabPile = piles[0].i;
    const p = s.discards[ui.crabPile];
    return `<div class="overlay pick">
      <div class="sheet clear wide">
        <h3>🦀 Fouillez une défausse</h3>
        <div class="tabs">${piles.map(({ p: q, i }) => `<button class="tab ${i === ui.crabPile ? 'on' : ''}" data-crabpile="${i}">Défausse ${i + 1} · ${q.length}</button>`).join('')}</div>
        <div class="crab-grid">${[...p].reverse().map((id) => `<button class="pick-card" data-crab="${id}">${cardHTML(id)}</button>`).join('')}</div>
      </div>
    </div>`;
  }

  function stealPick() {
    return `<div class="overlay pick">
      <div class="sheet">
        <h3>🦈 À qui voler une carte ?</h3>
        <div class="victims">${R.stealTargets(s).map((i) => `<button class="victim" data-steal="${i}">
          ${avatar(P(i))}<b>${esc(P(i).name)}</b><span class="vhand">${Array.from({ length: Math.min(s.hands[i].length, 6) }, () => backHTML('tiny')).join('')}</span><small>${s.hands[i].length} carte(s)</small>
        </button>`).join('')}</div>
        <p class="muted">La carte est prise au hasard dans sa main.</p>
      </div>
    </div>`;
  }

  function reasonText(r) {
    const c = P(r.caller).name;
    if (r.type === 'stop') return `✋ <b>${esc(c)}</b> a dit STOP : chacun marque les points de ses cartes.`;
    if (r.type === 'empty') return '🌊 La pioche est vide : personne ne marque de points.';
    if (r.type === 'mermaids') return `🧜‍♀️ <b>${esc(c)}</b> a réuni les 4 sirènes : victoire immédiate !`;
    return r.won
      ? `🎲 Dernière chance de <b>${esc(c)}</b> : pari remporté ! Ses cartes + bonus couleur pour lui, seulement le bonus couleur pour les autres.`
      : `🎲 Dernière chance de <b>${esc(c)}</b> : pari perdu ! Seulement son bonus couleur, les autres marquent leurs cartes.`;
  }

  function result() {
    const r = s.result;
    const gains = r.gains || s.players.map(() => 0);
    const rows = s.players.map((p, i) => {
      const sc = r.rows[i];
      const cards = [...s.played[i].flat(), ...sortCards(s.hands[i])];
      let k = 0;
      const bonus = sc.bonusColor ? `${sc.colorBonus} (${COLORS[sc.bonusColor].name.toLowerCase()})` : '0';
      return `<div class="res-p ${i === r.caller ? 'caller' : ''}">
        <div class="res-head">${avatar(p)}<b>${esc(p.name)}</b>
          <span class="gain" data-count="${gains[i]}">+${gains[i]}</span>
          <span class="tot">${s.scores[i]} pts</span></div>
        <div class="res-cards">${cards.map((id) => `<span class="deal" style="--d:${(i * 4 + k++) * 45}ms">${cardHTML(id, 'mini', false)}</span>`).join('')}</div>
        <ul class="res-items">
          ${sc.items.map((it) => `<li><span>${esc(it.label)}</span><b>${it.pts}</b></li>`).join('') || '<li><span>Aucun point de cartes</span><b>0</b></li>'}
          <li class="sum"><span>Cartes</span><b>${sc.points}</b></li>
          <li class="bonus"><span>Bonus couleur</span><b>${bonus}</b></li>
        </ul>
      </div>`;
    }).join('');
    const btn = s.phase === 'gameEnd'
      ? '<button class="btn primary big" data-a="final">Voir le classement 🏆</button>'
      : '<button class="btn primary big" data-a="next">Manche suivante</button>';
    return `<div class="overlay result">
      <div class="sheet wide scroll">
        <h2>${r.type === 'mermaids' ? 'Victoire !' : `Fin de la manche ${s.round}`}</h2>
        <p class="reason">${reasonText(r)}</p>
        ${rows}
        <div class="sheet-foot">${btn}</div>
      </div>
    </div>`;
  }

  function final() {
    const order = s.players.map((p, i) => i).sort((a, b) => s.scores[b] - s.scores[a]);
    const medals = ['🥇', '🥈', '🥉', '🎖️'];
    const names = s.winners.map((i) => esc(P(i).name)).join(' et ');
    return `<div class="overlay final">
      <div class="sheet">
        <div class="trophy">🏆</div>
        <h2>${names} ${s.winners.length > 1 ? 'gagnent' : 'gagne'} !</h2>
        <ol class="ranking">${order.map((i, k) => `<li class="${s.winners.includes(i) ? 'win' : ''}"><span>${s.winners.includes(i) ? '🥇' : medals[Math.min(k, 3)]}</span>${avatar(P(i))}<b>${esc(P(i).name)}</b><em>${s.scores[i]} pts</em></li>`).join('')}</ol>
        <div class="sheet-foot col">
          <button class="btn primary big" data-a="again">Rejouer avec les mêmes joueurs</button>
          <button class="btn ghost" data-a="exit">Retour au menu</button>
        </div>
      </div>
    </div>`;
  }

  function menu() {
    return `<div class="overlay menu" data-a="close">
      <div class="sheet">
        <h3>Pause</h3>
        <div class="sheet-foot col">
          <button class="btn primary" data-a="close">Reprendre</button>
          <button class="btn" data-a="rules">Règles du jeu</button>
          <button class="btn" data-a="exit">Retour au menu <small>(partie sauvegardée)</small></button>
          <button class="btn danger" data-a="abandon">Abandonner la partie</button>
        </div>
      </div>
    </div>`;
  }

  function zoom() {
    const c = CARDS[ui.zoom];
    const t = TYPES[c.type];
    let desc = t.effect || '';
    if (t.kind === 'duo') desc = `1 point par paire. ${t.effect}.`;
    if (t.kind === 'collection') desc = `Points selon le nombre de ${t.plural.toLowerCase()} : ${t.scale.map((v, i) => `${i + 1} → ${v}`).join(', ')}.`;
    return `<div class="overlay zoom" data-a="close">
      <div class="zoom-box">
        ${cardHTML(ui.zoom, 'huge', false)}
        <h3>${t.name} <small>· ${COLORS[c.color].name}</small></h3>
        <p>${esc(desc)}</p>
      </div>
    </div>`;
  }

  function rules() {
    const sample = (type) => cardHTML(CARDS.findIndex((c) => c.type === type), 'mini', false);
    const types = Object.keys(TYPES);
    return `<div class="overlay rules">
      <div class="sheet wide scroll">
        <button class="icon-btn close" data-a="close" aria-label="Fermer">✕</button>
        <h2>Sea Salt & Paper</h2>
        <p>On joue plusieurs manches jusqu'à ce qu'un joueur atteigne <b>${s.target} points</b> (40 / 35 / 30 à 2 / 3 / 4 joueurs).</p>
        <h3>À votre tour</h3>
        <ol>
          <li><b>Prenez une carte</b> : piochez-en 2, gardez-en une et posez l'autre sur une défausse ; ou prenez la carte du dessus d'une défausse.</li>
          <li><b>Posez des duos</b> devant vous pour déclencher leur effet (facultatif).</li>
          <li><b>Avec 7 points ou plus</b>, vous pouvez terminer la manche :
            <ul>
              <li><b>STOP</b> : tout le monde marque les points de ses cartes.</li>
              <li><b>Dernière chance</b> : les autres jouent un dernier tour (ils ne peuvent plus vous voler). Si vous avez au moins autant de points que chacun d'eux, vous marquez vos cartes + votre bonus couleur et eux seulement leur bonus couleur. Sinon, c'est l'inverse.</li>
            </ul></li>
        </ol>
        <p>Si la pioche est vide à la fin d'un tour, la manche s'arrête sans points. Les 4 sirènes posées : victoire immédiate !</p>
        <p><b>Bonus couleur</b> : le nombre de cartes de votre couleur la plus présente (les sirènes sont blanches).</p>
        <h3>Les cartes</h3>
        <ul class="rule-cards">${types.map((type) => {
          const t = TYPES[type];
          const txt = t.kind === 'collection' ? `Collection : ${t.scale.join(' / ')} points` : t.kind === 'duo' ? `Duo · ${t.effect}` : t.effect;
          return `<li>${sample(type)}<div><b>${t.name}</b><small>${esc(txt)}</small></div></li>`;
        }).join('')}</ul>
        <p class="muted">Astuce : un appui long sur une carte l'affiche en grand.</p>
      </div>
    </div>`;
  }

  /* ---------- actions ---------- */

  function act(fn, after) {
    let res;
    try {
      res = fn();
    } catch (e) {
      toast(esc(e.message));
      return null;
    }
    ui.sel = [];
    host.save(s);
    after?.(res);
    // la fin de manche s'affiche avec sa propre distribution des cartes (voir .deal)
    render({ noAnim: s.phase === 'roundEnd' || s.phase === 'gameEnd' });
    if (s.phase === 'roundEnd' || s.phase === 'gameEnd') el.querySelectorAll('.gain').forEach((g, k) => setTimeout(() => bump(g), 500 + k * 150));
    return res;
  }

  const markFresh = (...ids) => { ui.fresh = new Set(ids.filter((x) => x != null)); };

  async function onAction(a, t) {
    switch (a) {
      case 'menu': ui.overlay = 'menu'; return render({ noAnim: true });
      case 'rules': ui.overlay = 'rules'; return render({ noAnim: true });
      case 'close': ui.overlay = null; return render({ noAnim: true });
      case 'exit': return host.exit();
      case 'abandon':
        if (await confirmDialog('Abandonner cette partie ? Elle sera supprimée.', { ok: 'Abandonner', danger: true })) {
          ui.finished = true;
          host.abandon?.();
          host.exit();
        }
        return;
      case 'reveal':
        ui.revealed = s.current;
        s.lastSeen[s.current] = s.seq;
        ui.fresh = new Set();
        host.save(s);
        return render({ fallback: null, stagger: 25 });
      case 'deck':
        if (s.phase !== 'draw' || hidden()) return;
        return act(() => R.drawDeck(s), (r) => markFresh(...r.drawn));
      case 'pile': {
        const i = +t.dataset.pile;
        if (hidden()) return;
        if (s.phase === 'draw') return act(() => R.takeDiscard(s, i), (r) => markFresh(r.card));
        if (s.phase === 'discard') return act(() => R.discardTo(s, i));
        const p = s.discards[i];
        if (p.length) { ui.zoom = p[p.length - 1]; ui.overlay = 'zoom'; render({ noAnim: true }); }
        return;
      }
      case 'duo': {
        const [x, y] = ui.sel;
        return act(() => R.playDuo(s, x, y), (r) => {
          markFresh(r.drawn);
          if (r.kind === 'boat') toast('⛵ Vous rejouerez à la fin de ce tour !');
          if (r.none) toast('Pas d\'effet : il n\'y a rien à prendre.');
        });
      }
      case 'mermaids':
        act(() => R.playMermaids(s));
        confetti(el);
        return;
      case 'end':
        return act(() => R.endTurn(s), (r) => {
          if (r?.again) toast('⛵ Vous rejouez !');
          markFresh();
        });
      case 'stop':
        if (!await confirmDialog('Dire STOP et terminer la manche ?', { ok: 'STOP !' })) return;
        return act(() => R.callStop(s));
      case 'last':
        if (!await confirmDialog('Annoncer « Dernière chance » ? Les autres jouent un dernier tour, et vous devez rester devant.', { ok: 'Je tente !' })) return;
        return act(() => R.callLastChance(s), () => toast('🎲 Dernière chance ! Passez le téléphone.'));
      case 'next':
        ui.revealed = null;
        return act(() => R.nextRound(s));
      case 'final':
        ui.final = true;
        render({ noAnim: true });
        confetti(el);
        return;
      case 'again':
        return host.restart(s.players);
      default:
    }
  }

  function onClick(e) {
    if (longPressed) { longPressed = false; return; }
    const t = e.target.closest('[data-a],[data-keep],[data-crab],[data-crabpile],[data-steal],.hand .card,.me-played .card,.opp-played .card');
    if (!t) return;
    if (t.dataset.a) {
      if (t.dataset.a === 'close' && t !== e.target && e.target.closest('.sheet')) return; // clic dans le menu, pas à côté
      return onAction(t.dataset.a, t);
    }
    if (t.dataset.keep) {
      const id = +t.dataset.keep;
      return act(() => R.keepDrawn(s, id), () => markFresh(id));
    }
    if (t.dataset.crabpile) { ui.crabPile = +t.dataset.crabpile; return render({ noAnim: true }); }
    if (t.dataset.crab) return act(() => R.crabTake(s, ui.crabPile, +t.dataset.crab), (r) => markFresh(r.card));
    if (t.dataset.steal) {
      const victim = +t.dataset.steal;
      return act(() => R.steal(s, victim), (r) => {
        markFresh(r.card);
        origins[r.card] = { sel: `[data-opp="${victim}"]`, flip: true };
        toast(`🦈 Vous avez volé : <b>${esc(cardLabel(r.card))}</b>`, 2600);
      });
    }
    if (t.classList.contains('card')) {
      const id = +t.dataset.zoom;
      const inHand = t.closest('.hand');
      if (inHand && s.phase === 'play') {
        if (ui.sel.includes(id)) ui.sel = ui.sel.filter((x) => x !== id);
        else ui.sel = [...ui.sel, id].slice(-2);
        return render();
      }
      ui.zoom = id;
      ui.overlay = 'zoom';
      render({ noAnim: true });
    }
  }

  // appui long : afficher la carte en grand
  let pressTimer = null;
  let longPressed = false;
  function onDown(e) {
    const c = e.target.closest('.card[data-zoom]');
    if (!c || ui.overlay) return;
    longPressed = false;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      longPressed = true;
      ui.zoom = +c.dataset.zoom;
      ui.overlay = 'zoom';
      render({ noAnim: true });
      navigator.vibrate?.(15);
    }, 480);
  }
  const cancelPress = () => clearTimeout(pressTimer);

  el.addEventListener('click', onClick);
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointerup', cancelPress);
  el.addEventListener('pointercancel', cancelPress);
  el.addEventListener('pointermove', (e) => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) cancelPress(); });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  const onResize = () => render({ noAnim: true });
  window.addEventListener('resize', onResize);

  // à la reprise d'une partie terminée de manche, on affiche le résultat ; sinon l'écran de passage
  render({ noAnim: true });

  return {
    destroy() {
      window.removeEventListener('resize', onResize);
      clearTimeout(pressTimer);
    },
  };
}
