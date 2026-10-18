// Table du Huit américain : rendu, gestes, robots et animations.
// Tout est redessiné à chaque action ; les cartes glissent ensuite de leur ancienne place (anim.js).
import * as R from './rules.js';
import { cpuPlay, cpuSuit } from './ai.js';
import { SUITS, sortHand, cardShort } from '../../cards/deck.js';
import { pcHTML, pcBackHTML } from '../../cards/render.js';
import { snapshot, animateCards, bump, confetti } from '../../ui/anim.js';
import { confirmDialog, toast, esc } from '../../ui/dialog.js';
import { cardSound, soundOn, setSound } from '../../ui/sound.js';
import { fullscreenButton } from '../../ui/fullscreen.js';

const avatar = (p) => `<span class="avatar" style="--pc:${p.color || '#c98a4b'}">${p.cpu ? '🤖' : esc(p.name.slice(0, 1).toUpperCase())}</span>`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const card = (id, cls = '', opts = {}) => pcHTML(id, cls, { tag: R.special(id), ...opts });
// petite inclinaison fixe de chaque carte de la défausse, pour un tas naturel
const tilt = (id) => ((id * 37) % 15) - 7;

export function mount(root, s, host) {
  root.innerHTML = '<div class="ea"></div>';
  const el = root.firstChild;
  const humans = s.players.map((p, i) => (p.cpu ? -1 : i)).filter((i) => i >= 0);
  const solo = humans.length === 1;
  const ui = {
    viewer: solo ? humans[0] : null, // joueur dont on voit la main (null : écran « passe le téléphone »)
    overlay: null, // menu | rules
    busy: false, // un robot joue
    final: false,
    finished: false,
    fresh: new Set(),
  };
  let alive = true;
  let origins = {};

  const P = (i) => s.players[i];
  const me = () => ui.viewer;
  const playing = () => s.phase === 'play' || s.phase === 'choose';
  const myTurn = () => playing() && me() === s.current && !ui.busy;

  /* ---------- rendu ---------- */

  function render(opts = {}) {
    if (!alive) return;
    const before = opts.noAnim ? new Map() : snapshot(el);
    el.innerHTML = html();
    if (!opts.noAnim) animateCards(el, before, { origins, fallback: '[data-anchor="deck"]', stagger: opts.stagger ?? 70 });
    origins = {};
    if (s.phase === 'gameEnd' && !ui.finished) {
      ui.finished = true;
      host.finish({ winners: s.winners.map((i) => P(i)), summary: s.players.map((p, i) => `${p.name} ${s.scores[i]}`).join(' · ') });
    }
  }

  function html() {
    const hidden = ui.viewer === null;
    return `${top()}${hidden ? '' : `${opponents()}${table()}${mine()}`}${overlay()}`;
  }

  function top() {
    return `<header class="top">
      <div class="top-side"><button class="icon-btn" data-a="menu" aria-label="Menu">☰</button></div>
      <div class="top-mid"><b>Manche ${s.round}</b><small>Huit américain · ${s.target} points</small></div>
      <div class="top-side end">${fullscreenButton()}<button class="icon-btn" data-a="rules" aria-label="Règles">?</button></div>
    </header>`;
  }

  // les adversaires, dans l'ordre où ils jouent après moi
  function seats() {
    const n = s.players.length;
    return Array.from({ length: n - 1 }, (_, k) => (me() + 1 + k) % n);
  }

  function opponents() {
    return `<section class="ea-opps">${seats().map((i) => {
      const n = s.hands[i].length;
      const turn = playing() && s.current === i;
      return `<div class="ea-opp ${turn ? 'turn' : ''}" data-opp="${i}">
        <div class="ea-opp-head">${avatar(P(i))}<b>${esc(P(i).name)}</b></div>
        <div class="ea-opp-hand">${Array.from({ length: Math.min(n, 5) }, () => pcBackHTML('tiny')).join('')}<small>${n}</small></div>
        <span class="ea-opp-score">${s.scores[i]} pts</span>
        ${n === 1 && playing() ? '<span class="ea-last">Dernière carte !</span>' : ''}
      </div>`;
    }).join('')}</section>`;
  }

  function table() {
    const canDraw = myTurn() && s.phase === 'play' && s.drawn == null;
    const pile = s.discard.slice(-3);
    const suit = SUITS[s.suit];
    const arrow = s.players.length > 2 ? `<span class="ea-dir" title="Sens du jeu">${s.dir > 0 ? '↻' : '↺'}</span>` : '';
    return `<section class="ea-table">
      <button class="ea-pile deck ${canDraw ? 'live' : ''}" data-a="draw" aria-label="Piocher">
        <span class="ea-slot" data-anchor="deck">${s.deck.length ? pcBackHTML('stack') : '<span class="empty">vide</span>'}</span>
        <small>Pioche · ${s.deck.length}</small>
      </button>
      <div class="ea-pile disc">
        <span class="ea-slot" data-anchor="discard">${pile.map((id, k) => `<span class="ea-tilt" style="rotate:${tilt(id)}deg;z-index:${k}">${card(id)}</span>`).join('')}</span>
        <small class="ea-suit ${suit.red ? 'red' : ''}">Couleur : <b>${suit.sym}</b> ${suit.name}</small>
      </div>
      <div class="ea-info">${arrow}${s.pending ? `<span class="ea-pending">+${s.pending}</span>` : ''}</div>
    </section>
    <div class="ea-status">${status()}</div>`;
  }

  function status() {
    if (!playing()) return '';
    const cur = esc(P(s.current).name);
    if (s.current !== me()) return ui.busy ? `<span>🤖 ${cur} réfléchit…</span>` : `<span>Au tour de <b>${cur}</b></span>`;
    if (s.phase === 'choose') return '<span>Choisissez la couleur demandée.</span>';
    if (s.pending) {
      return R.playableCards(s).length
        ? `<span class="warn">Posez un 2 pour renvoyer la pénalité, ou piochez ${s.pending} cartes.</span>`
        : `<span class="warn">Pas de 2 : piochez ${s.pending} cartes.</span>`;
    }
    if (s.drawn != null) return '<span>Vous pouvez poser la carte piochée, ou la garder.</span>';
    return R.playableCards(s).length
      ? '<span>Touchez une carte en surbrillance pour la poser.</span>'
      : '<span>Aucune carte possible : piochez.</span>';
  }

  function mine() {
    const i = me();
    const head = `<div class="ea-me-head">${avatar(P(i))}<b>${esc(P(i).name)}</b>
      <span class="pill">🃏 ${s.hands[i].length}</span><span class="pill total">🏆 ${s.scores[i]} pts</span></div>`;
    return `<section class="ea-me">${head}<div class="ea-actions">${actions()}</div>${hand()}</section>`;
  }

  function actions() {
    if (!myTurn() || s.phase !== 'play') return '';
    if (s.pending) return `<button class="btn primary" data-a="draw">Piocher ${s.pending} cartes</button>`;
    if (s.drawn != null) return '<button class="btn" data-a="pass">Garder et passer</button>';
    if (!R.playableCards(s).length) return '<button class="btn primary" data-a="draw">Piocher</button>';
    return '';
  }

  function hand() {
    const W = Math.min(el.clientWidth || window.innerWidth, 640) - 48;
    const cw = Math.round(Math.min(86, Math.max(58, W * 0.2)));
    const ids = sortHand(s.hands[me()]);
    const n = ids.length;
    const step = n > 1 ? Math.min(cw * 0.72, (W - cw) / (n - 1)) : 0;
    const width = cw + step * (n - 1);
    const x0 = (W - width) / 2;
    const mineTurn = myTurn() && s.phase === 'play';
    const cards = ids.map((id, k) => {
      const mid = (n - 1) / 2;
      const rot = n > 1 ? (k - mid) * Math.min(3, 24 / n) : 0;
      const y = Math.abs(k - mid) ** 2 * Math.min(1.5, 16 / (n * n / 4 + 1));
      const ok = mineTurn && R.playable(s, id);
      const cls = `${ok ? 'ok' : mineTurn ? 'no' : ''} ${ui.fresh.has(id) ? 'fresh' : ''} ${s.drawn === id && mineTurn ? 'drawn' : ''}`;
      return `<div class="ea-hslot" style="left:${x0 + k * step}px;top:${y}px;rotate:${rot}deg;z-index:${k + 1}">${card(id, cls, { attrs: `data-play="${id}"` })}</div>`;
    }).join('');
    return `<div class="ea-hand" style="--cw:${cw}px">${n ? cards : ''}</div>`;
  }

  /* ---------- fenêtres ---------- */

  function overlay() {
    if (ui.overlay === 'menu') return menu();
    if (ui.overlay === 'rules') return rules();
    if (s.phase === 'roundEnd' || s.phase === 'gameEnd') return ui.final ? final() : result();
    if (ui.viewer === null) return handoff();
    if (s.phase === 'choose' && s.current === me() && !ui.busy) return suitPicker();
    return '';
  }

  function handoff() {
    const i = s.current;
    const seen = s.lastSeen[i];
    const events = s.log.filter((e) => e.seq > seen && e.actor !== i).slice(-8).map((e) => `<li>${esc(e.text)}</li>`).join('');
    return `<div class="overlay handoff">
      <div class="sheet">
        <div class="ho-avatar">${avatar(P(i))}</div>
        <p class="kicker">📱 Passez le téléphone à</p>
        <h2>${esc(P(i).name)}</h2>
        ${s.pending ? `<p class="ea-warn">⚠️ Vous devez piocher ${s.pending} cartes… sauf si vous avez un 2 !</p>` : ''}
        ${events ? `<div class="news"><b>Depuis votre dernier tour</b><ul>${events}</ul></div>` : ''}
        <button class="btn primary big" data-a="reveal">C'est moi, voir mes cartes</button>
      </div>
    </div>`;
  }

  function suitPicker() {
    return `<div class="overlay ea-pick">
      <div class="sheet">
        <h3>Quelle couleur demandez-vous ?</h3>
        <div class="ea-suits">${SUITS.map((x, k) => `<button class="ea-suit-btn ${x.red ? 'red' : ''}" data-suit="${k}"><b>${x.sym}</b>${x.name}</button>`).join('')}</div>
      </div>
    </div>`;
  }

  function result() {
    const r = s.result;
    const rows = s.players.map((p, i) => {
      const cards = sortHand(s.hands[i]);
      return `<div class="ea-res ${i === r.winner ? 'win' : ''}">
        <div class="ea-res-head">${avatar(p)}<b>${esc(p.name)}</b>
          <span class="ea-gain">${i === r.winner ? '🏆 0' : `+${r.gains[i]}`}</span>
          <span class="tot">${s.scores[i]} pts</span></div>
        ${cards.length ? `<div class="ea-res-cards">${cards.map((id, k) => `<span class="ea-deal" style="--d:${(i * 3 + k) * 50}ms">${card(id, 'mini', { anim: false })}</span>`).join('')}</div>` : ''}
      </div>`;
    }).join('');
    const btn = s.phase === 'gameEnd'
      ? '<button class="btn primary big" data-a="final">Voir le classement 🏆</button>'
      : '<button class="btn primary big" data-a="next">Manche suivante</button>';
    return `<div class="overlay ea-result">
      <div class="sheet wide scroll">
        <h2>Fin de la manche ${s.round}</h2>
        <p class="ea-reason">🎉 <b>${esc(P(r.winner).name)}</b> n'a plus de cartes ! Les autres marquent les points de leur main.</p>
        ${rows}
        <p class="muted ea-small">8 = 50 pts · figures = 10 · as = 1 · autres = leur valeur. À ${s.target} points, la partie s'arrête.</p>
        <div class="sheet-foot">${btn}</div>
      </div>
    </div>`;
  }

  function final() {
    const order = s.players.map((p, i) => i).sort((a, b) => s.scores[a] - s.scores[b]);
    const medals = ['🥇', '🥈', '🥉', '🎖️', '🎖️'];
    const names = s.winners.map((i) => esc(P(i).name)).join(' et ');
    return `<div class="overlay final">
      <div class="sheet">
        <div class="trophy">🏆</div>
        <h2>${names} ${s.winners.length > 1 ? 'gagnent' : 'gagne'} !</h2>
        <p class="muted">Le plus petit score l'emporte.</p>
        <ol class="ranking">${order.map((i, k) => `<li class="${s.winners.includes(i) ? 'win' : ''}"><span>${s.winners.includes(i) ? '🥇' : medals[k]}</span>${avatar(P(i))}<b>${esc(P(i).name)}</b><em>${s.scores[i]} pts</em></li>`).join('')}</ol>
        <div class="sheet-foot col">
          <button class="btn primary big" data-a="again">Rejouer</button>
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
          <button class="btn" data-a="sound">${soundOn() ? '🔊 Son activé' : '🔇 Son coupé'}</button>
          <button class="btn" data-a="exit">Retour au menu <small>(partie sauvegardée)</small></button>
          <button class="btn danger" data-a="abandon">Abandonner la partie</button>
        </div>
      </div>
    </div>`;
  }

  function rules() {
    const ex = (id) => card(id, 'mini', { anim: false });
    return `<div class="overlay rules">
      <div class="sheet wide scroll">
        <button class="icon-btn close" data-a="close" aria-label="Fermer">✕</button>
        <h2>Huit américain</h2>
        <p>Chacun reçoit 7 cartes à deux joueurs, 5 cartes à partir de trois. Le but : se débarrasser de toutes ses cartes.</p>
        <h3>À votre tour</h3>
        <ol>
          <li>Posez une carte de la <b>même couleur</b> (♠ ♥ ♣ ♦) ou de la <b>même valeur</b> que celle du dessus de la défausse.</li>
          <li>Sinon, <b>piochez</b> une carte : si elle peut être posée, vous pouvez la jouer tout de suite ; sinon votre tour s'arrête.</li>
        </ol>
        <h3>Les cartes spéciales</h3>
        <ul class="ea-rule-cards">
          <li>${ex(7)}<div><b>8 : changement de couleur</b><small>Se pose sur n'importe quelle carte ; vous choisissez la couleur suivante.</small></div></li>
          <li>${ex(14)}<div><b>2 : +2</b><small>Le joueur suivant pioche 2 cartes et passe son tour… sauf s'il pose lui aussi un 2 : la pénalité s'ajoute et passe au suivant.</small></div></li>
          <li>${ex(36)}<div><b>Valet : passe ton tour</b><small>Le joueur suivant ne joue pas.</small></div></li>
          <li>${ex(39)}<div><b>As : changement de sens</b><small>Le jeu repart dans l'autre sens. À deux joueurs, on rejoue.</small></div></li>
        </ul>
        <h3>Points</h3>
        <p>Quand un joueur n'a plus de cartes, les autres marquent les points de leur main : <b>8 = 50</b>, figures = 10, as = 1, les autres leur valeur. Dès qu'un joueur atteint <b>${s.target} points</b>, la partie s'arrête et <b>le plus petit score gagne</b>.</p>
        <p class="muted">Seul, vous jouez contre deux robots. À plusieurs, on se passe le téléphone à chaque tour.</p>
      </div>
    </div>`;
  }

  /* ---------- effets ---------- */

  // un dos de carte qui file de la pioche vers un adversaire (ou d'un adversaire vers la défausse)
  function flyBack(fromSel, toSel, delay = 0) {
    const a = el.querySelector(fromSel);
    const b = el.querySelector(toSel);
    cardSound({ delay });
    if (!a || !b || reduced()) return;
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const ghost = document.createElement('div');
    ghost.className = 'ea-ghost';
    ghost.innerHTML = pcBackHTML();
    ghost.style.left = `${ra.left + ra.width / 2}px`;
    ghost.style.top = `${ra.top + ra.height / 2}px`;
    el.appendChild(ghost);
    const dx = rb.left + rb.width / 2 - (ra.left + ra.width / 2);
    const dy = rb.top + rb.height / 2 - (ra.top + ra.height / 2);
    const anim = ghost.animate([
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.4)`, opacity: 0.6 },
    ], { duration: 480, delay, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'backwards' });
    anim.onfinish = anim.oncancel = () => ghost.remove();
  }

  // les cartes d'un adversaire qui pioche
  function showOppDraw(i, count) {
    for (let k = 0; k < Math.min(count, 6); k++) flyBack('[data-anchor="deck"]', `[data-opp="${i}"] .ea-opp-hand`, k * 110);
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
    host.save(s);
    after?.(res);
    render({ noAnim: s.phase === 'roundEnd' || s.phase === 'gameEnd' });
    if (s.phase === 'roundEnd' || s.phase === 'gameEnd') roundOver();
    else afterMove();
    return res;
  }

  function roundOver() {
    const n = Math.min(el.querySelectorAll('.ea-deal').length, 8);
    for (let k = 0; k < n; k++) cardSound({ delay: k * 90, flip: true });
    el.querySelectorAll('.ea-gain').forEach((g, k) => setTimeout(() => bump(g), 500 + k * 150));
  }

  // après un coup : passage du téléphone, ou tour des robots
  function afterMove() {
    if (!playing()) return;
    if (!solo && s.current !== ui.viewer && s.phase === 'play') {
      // laisser voir l'effet du coup avant de cacher la main
      ui.busy = true;
      setTimeout(() => { if (!alive) return; ui.busy = false; ui.viewer = null; render({ noAnim: true }); }, 900);
      return;
    }
    if (solo && P(s.current).cpu) robotTurn();
  }

  async function robotTurn() {
    if (ui.busy || !alive) return;
    ui.busy = true;
    render({ noAnim: true });
    while (alive && playing() && P(s.current).cpu) {
      const i = s.current;
      await wait(700 + Math.random() * 500);
      if (!alive) return;
      let id = cpuPlay(s);
      if (id == null) {
        const r = R.draw(s);
        host.save(s);
        render();
        showOppDraw(i, r.cards.length);
        if (r.penalty) toast(`${esc(P(i).name)} pioche ${r.cards.length} cartes`);
        if (!r.canPlay) continue;
        await wait(600);
        id = r.cards[0];
      }
      origins[id] = { sel: `[data-opp="${i}"]`, flip: true };
      R.play(s, id);
      if (s.phase === 'choose') {
        R.chooseSuit(s, cpuSuit(s));
        toast(`${esc(P(i).name)} demande ${SUITS[s.suit].sym} ${SUITS[s.suit].name.toLowerCase()}`);
      }
      host.save(s);
      render();
      if (s.phase === 'roundEnd' || s.phase === 'gameEnd') { ui.busy = false; render({ noAnim: true }); roundOver(); return; }
    }
    ui.busy = false;
    render({ noAnim: true });
  }

  function playCard(id) {
    if (!myTurn() || s.phase !== 'play') return;
    if (!R.playable(s, id)) {
      const c = el.querySelector(`.ea-hand [data-cid="${id}"]`);
      c?.animate([{ translate: '0 0' }, { translate: '-5px 0' }, { translate: '5px 0' }, { translate: '0 0' }], { duration: 250 });
      toast(s.pending ? 'Seul un 2 peut être posé' : `Il faut un ${SUITS[s.suit].sym}, la même valeur, ou un 8`);
      return;
    }
    ui.fresh = new Set();
    act(() => R.play(s, id));
  }

  async function onAction(a, t) {
    switch (a) {
      case 'menu': ui.overlay = 'menu'; return render({ noAnim: true });
      case 'rules': ui.overlay = 'rules'; return render({ noAnim: true });
      case 'close': ui.overlay = null; return render({ noAnim: true });
      case 'sound': setSound(!soundOn()); return render({ noAnim: true });
      case 'exit': return host.exit();
      case 'abandon':
        if (await confirmDialog('Abandonner cette partie ? Elle sera supprimée.', { ok: 'Abandonner', danger: true })) {
          ui.finished = true;
          host.abandon?.();
          host.exit();
        }
        return;
      case 'reveal':
        ui.viewer = s.current;
        s.lastSeen[s.current] = s.seq;
        ui.fresh = new Set();
        host.save(s);
        return render({ stagger: 30 });
      case 'draw': {
        if (!myTurn() || s.phase !== 'play' || (s.drawn != null && !s.pending)) return;
        const pen = s.pending;
        return act(() => R.draw(s), (r) => {
          ui.fresh = new Set(r.cards);
          if (pen) toast(`Vous piochez ${r.cards.length} cartes`);
          else if (r.passed && r.cards.length) toast(`Vous piochez ${esc(cardShort(r.cards[0]))} : pas jouable, tour suivant`);
        });
      }
      case 'pass':
        return act(() => R.pass(s));
      case 'next':
        ui.final = false;
        if (!solo) ui.viewer = null;
        act(() => R.nextRound(s));
        return;
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
    const t = e.target.closest('[data-a],[data-play],[data-suit]');
    if (!t) return;
    if (t.dataset.a) {
      if (t.dataset.a === 'close' && t !== e.target && e.target.closest('.sheet')) return; // clic dans le menu, pas à côté
      return onAction(t.dataset.a, t);
    }
    if (t.dataset.suit) {
      const suit = +t.dataset.suit;
      return act(() => R.chooseSuit(s, suit), () => toast(`Vous demandez ${SUITS[suit].sym} ${SUITS[suit].name.toLowerCase()}`));
    }
    if (t.dataset.play && t.closest('.ea-hand')) playCard(+t.dataset.play);
  }

  el.addEventListener('click', onClick);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  const onResize = () => render({ noAnim: true });
  window.addEventListener('resize', onResize);

  // les cartes arrivent de la pioche (distribution)
  render(ui.viewer === null || !playing() ? { noAnim: true } : { stagger: 50 });
  // reprise d'une partie où c'était au tour d'un robot
  if (solo && playing() && P(s.current).cpu) robotTurn();

  return {
    destroy() {
      alive = false;
      window.removeEventListener('resize', onResize);
    },
  };
}

