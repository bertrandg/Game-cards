// Table du Président : rendu, gestes, robots et animations.
// Tout est redessiné à chaque action ; les cartes glissent ensuite de leur ancienne place (anim.js).
import * as R from './rules.js';
import { cpuPlay, cpuGive } from './ai.js';
import { pcHTML, pcBackHTML } from '../../cards/render.js';
import { snapshot, animateCards, bump, confetti } from '../../ui/anim.js';
import { confirmDialog, toast, esc } from '../../ui/dialog.js';
import { cardSound, soundOn, setSound } from '../../ui/sound.js';
import { fullscreenButton } from '../../ui/fullscreen.js';

const avatar = (p) => `<span class="avatar" style="--pc:${p.color || '#c98a4b'}">${p.cpu ? '🤖' : esc(p.name.slice(0, 1).toUpperCase())}</span>`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pts = (n) => `${n} pt${Math.abs(n) > 1 ? 's' : ''}`;
const roleBadge = (role) => (role ? `<span class="pr-role r-${role}" title="${R.ROLES[role].name}">${R.ROLES[role].icon} ${R.ROLES[role].name}</span>` : '');

export function mount(root, s, host) {
  root.innerHTML = '<div class="pr"></div>';
  const el = root.firstChild;
  const humans = s.players.map((p, i) => (p.cpu ? -1 : i)).filter((i) => i >= 0);
  const solo = humans.length === 1;
  const ui = {
    viewer: solo ? humans[0] : null, // joueur dont on voit la main (null : écran « passe le téléphone »)
    sel: [],
    overlay: null, // menu | rules
    busy: false,
    final: false,
    finished: false,
    fresh: new Set(),
  };
  let alive = true;
  let origins = {};

  const P = (i) => s.players[i];
  const me = () => ui.viewer;
  const playing = () => s.phase === 'play' || s.phase === 'exchange';
  const myTurn = () => playing() && me() === s.current && !ui.busy;

  /* ---------- rendu ---------- */

  function render(opts = {}) {
    if (!alive) return;
    const before = opts.noAnim ? new Map() : snapshot(el);
    el.innerHTML = html();
    if (!opts.noAnim) animateCards(el, before, { origins, fallback: opts.fallback ?? null, stagger: opts.stagger ?? 60 });
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
      <div class="top-mid"><b>Manche ${s.round} / ${s.rounds}</b><small>Président</small></div>
      <div class="top-side end">${fullscreenButton()}<button class="icon-btn" data-a="rules" aria-label="Règles">?</button></div>
    </header>`;
  }

  function seats() {
    const n = s.players.length;
    return Array.from({ length: n - 1 }, (_, k) => (me() + 1 + k) % n);
  }

  function opponents() {
    const done = (i) => s.finished.indexOf(i);
    return `<section class="pr-opps n${s.players.length}">${seats().map((i) => {
      const n = s.hands[i].length;
      const turn = playing() && s.current === i;
      const passed = s.phase === 'play' && s.trick.passed.includes(i);
      const out = done(i) >= 0 ? R.ROLES[R.roleOf(s.players.length, done(i))] : null;
      return `<div class="pr-opp ${turn ? 'turn' : ''} ${out ? 'out' : ''}" data-opp="${i}">
        <div class="pr-opp-head">${avatar(P(i))}<b>${esc(P(i).name)}</b></div>
        <div class="pr-opp-hand">${out ? `<span class="pr-out">${out.icon}</span>` : `${pcBackHTML('tiny')}<small>${n}</small>`}</div>
        <div class="pr-opp-foot">${roleBadge(s.roles[i])}<span class="pr-opp-score">${pts(s.scores[i])}</span></div>
        ${passed ? '<span class="pr-bubble">Passe</span>' : ''}
      </div>`;
    }).join('')}</section>`;
  }

  function table() {
    const plays = s.phase === 'play' ? s.trick.plays : [];
    const t = plays[plays.length - 1];
    const prev = plays[plays.length - 2];
    const group = (play, cls) => `<div class="pr-play ${cls}">${play.cards.map((id, k) => `<span class="pr-c" style="--k:${k};--n:${play.cards.length}">${pcHTML(id, '', { anim: cls === 'last' })}</span>`).join('')}</div>`;
    let info = '';
    if (s.phase === 'exchange') info = '🔁 Échange des cartes';
    else if (!t) info = 'Nouveau pli : posez ce que vous voulez';
    else {
      const who = esc(P(t.by).name);
      info = `<b>${who}</b> : ${R.playLabel(t.cards)}`;
      if (s.trick.match != null) info += ` <span class="pr-match">${R.valueName(t.cards[0])} ou rien !</span>`;
    }
    return `<section class="pr-table" data-anchor="table">
      ${prev ? group(prev, 'prev') : ''}
      ${t ? group(t, 'last') : '<div class="pr-empty">♠ ♥ ♣ ♦</div>'}
    </section>
    <div class="pr-info">${info}</div>
    <div class="pr-status">${status()}</div>`;
  }

  function status() {
    if (!playing()) return '';
    const cur = esc(P(s.current).name);
    if (s.current !== me()) return ui.busy && P(s.current).cpu ? `🤖 ${cur} réfléchit…` : `Au tour de <b>${cur}</b>`;
    if (s.phase === 'exchange') {
      const ex = s.exchange[0];
      return `Choisissez ${ex.count > 1 ? `${ex.count} cartes` : '1 carte'} à donner à <b>${esc(P(ex.to).name)}</b>.`;
    }
    const t = R.topPlay(s);
    if (!R.playablePowers(s).length) return '<span class="warn">Rien à poser : passez.</span>';
    if (!t) return 'À vous d\'ouvrir : choisissez une ou plusieurs cartes de même valeur.';
    return s.trick.match != null
      ? `Posez ${t.cards.length > 1 ? `${t.cards.length} ` : 'un '}${R.valueName(t.cards[0])} ou passez.`
      : `Posez ${t.cards.length} carte${t.cards.length > 1 ? 's' : ''} de valeur égale ou supérieure, ou passez.`;
  }

  function mine() {
    const i = me();
    const done = s.finished.indexOf(i);
    const head = `<div class="pr-me-head">${avatar(P(i))}<b>${esc(P(i).name)}</b>${roleBadge(s.roles[i])}
      <span class="pill">🏆 ${pts(s.scores[i])}</span></div>`;
    const out = done >= 0 && playing() ? `<p class="pr-done">${R.ROLES[R.roleOf(s.players.length, done)].icon} Vous avez fini : ${R.ROLES[R.roleOf(s.players.length, done)].name} !</p>` : '';
    return `<section class="pr-me">${head}<div class="pr-actions">${actions()}</div>${out}${hand()}</section>`;
  }

  function actions() {
    if (!myTurn()) return '';
    if (s.phase === 'exchange') {
      const n = s.exchange[0].count;
      return `<button class="btn primary" data-a="give" ${ui.sel.length === n ? '' : 'disabled'}>Donner ${ui.sel.length}/${n}</button>`;
    }
    const t = R.topPlay(s);
    const ok = R.canPlay(s, ui.sel);
    const label = ui.sel.length ? `Poser ${R.playLabel(ui.sel)}` : 'Poser';
    return `<button class="btn primary" data-a="play" ${ok ? '' : 'disabled'}>${label}</button>
      ${t ? '<button class="btn" data-a="pass">Passer</button>' : ''}`;
  }

  function hand() {
    const W = Math.min(el.clientWidth || window.innerWidth, 640) - 48;
    const ids = R.sortHand(s.hands[me()]);
    const n = ids.length;
    const cw = Math.round(Math.min(80, Math.max(54, W * 0.19)));
    const step = n > 1 ? Math.min(cw * 0.62, (W - cw) / (n - 1)) : 0;
    const width = cw + step * (n - 1);
    const x0 = (W - width) / 2;
    const playTurn = myTurn() && s.phase === 'play';
    const okPowers = playTurn ? R.playablePowers(s) : [];
    const cards = ids.map((id, k) => {
      const mid = (n - 1) / 2;
      const rot = n > 1 ? (k - mid) * Math.min(2.4, 22 / n) : 0;
      const y = Math.abs(k - mid) ** 2 * Math.min(1.2, 14 / (n * n / 4 + 1));
      const cls = [
        ui.sel.includes(id) ? 'sel' : '',
        playTurn && !okPowers.includes(R.power(id)) ? 'no' : '',
        ui.fresh.has(id) ? 'fresh' : '',
      ].join(' ');
      return `<div class="pr-hslot" style="left:${x0 + k * step}px;top:${y}px;rotate:${rot}deg;z-index:${k + 1}">${pcHTML(id, cls, { attrs: `data-card="${id}"` })}</div>`;
    }).join('');
    return `<div class="pr-hand" style="--cw:${cw}px">${cards}</div>`;
  }

  /* ---------- fenêtres ---------- */

  function overlay() {
    if (ui.overlay === 'menu') return menu();
    if (ui.overlay === 'rules') return rules();
    if (s.phase === 'roundEnd' || s.phase === 'gameEnd') return ui.final ? final() : result();
    if (ui.viewer === null) {
      // à plusieurs, les robots jouent pendant que le téléphone attend le prochain joueur
      if (P(s.current).cpu) return '<div class="overlay handoff"><div class="sheet"><p class="kicker">🤖 Les robots jouent…</p></div></div>';
      return handoff();
    }
    return '';
  }

  function handoff() {
    const i = s.current;
    const seen = s.lastSeen[i];
    const events = s.log.filter((e) => e.seq > seen && e.actor !== i).slice(-8).map((e) => `<li>${esc(e.text)}</li>`).join('');
    const ex = s.phase === 'exchange' ? s.exchange[0] : null;
    return `<div class="overlay handoff">
      <div class="sheet">
        <div class="ho-avatar">${avatar(P(i))}</div>
        <p class="kicker">📱 Passez le téléphone à</p>
        <h2>${esc(P(i).name)}</h2>
        ${ex ? `<p class="pr-hint">🔁 Vous avez reçu ${ex.count > 1 ? `les ${ex.count} meilleures cartes` : 'la meilleure carte'} de ${esc(P(ex.to).name)} : rendez-lui ${ex.count > 1 ? `${ex.count} cartes` : 'une carte'} de votre choix.</p>` : ''}
        ${events ? `<div class="news"><b>Depuis votre dernier tour</b><ul>${events}</ul></div>` : ''}
        <button class="btn primary big" data-a="reveal">C'est moi, voir mes cartes</button>
      </div>
    </div>`;
  }

  function result() {
    const r = s.result;
    const n = s.players.length;
    const rows = r.order.map((i, k) => {
      const role = R.roleOf(n, k);
      const left = R.sortHand(s.hands[i]);
      return `<li class="${k === 0 ? 'win' : ''}"><span>${R.ROLES[role].icon}</span>${avatar(P(i))}
        <b>${esc(P(i).name)}<small>${R.ROLES[role].name}${left.length ? ` · restait ${left.length} carte${left.length > 1 ? 's' : ''}` : ''}</small></b>
        <em><span class="pr-gain">+${r.gains[i]}</span><small>${pts(s.scores[i])}</small></em></li>`;
    }).join('');
    const btn = s.phase === 'gameEnd'
      ? '<button class="btn primary big" data-a="final">Voir le classement 🏆</button>'
      : '<button class="btn primary big" data-a="next">Manche suivante</button>';
    return `<div class="overlay pr-result">
      <div class="sheet wide scroll">
        <h2>Fin de la manche ${s.round}</h2>
        <p class="muted">Points : ${n - 1} pour le Président, puis un de moins à chaque place.</p>
        <ol class="ranking pr-rank">${rows}</ol>
        ${s.phase === 'roundEnd' ? `<p class="pr-hint">🔁 Manche suivante : ${esc(P(r.order[n - 1]).name)} donne ses 2 meilleures cartes à ${esc(P(r.order[0]).name)}${n >= 4 ? `, et ${esc(P(r.order[n - 2]).name)} sa meilleure carte à ${esc(P(r.order[1]).name)}` : ''}.</p>` : ''}
        <div class="sheet-foot">${btn}</div>
      </div>
    </div>`;
  }

  function final() {
    const order = s.players.map((p, i) => i).sort((a, b) => s.scores[b] - s.scores[a]);
    const medals = ['🥇', '🥈', '🥉', '🎖️', '🎖️', '🎖️'];
    const names = s.winners.map((i) => esc(P(i).name)).join(' et ');
    return `<div class="overlay final">
      <div class="sheet">
        <div class="trophy">👑</div>
        <h2>${names} ${s.winners.length > 1 ? 'gagnent' : 'gagne'} !</h2>
        <p class="muted">Après ${s.rounds} manches.</p>
        <ol class="ranking">${order.map((i, k) => `<li class="${s.winners.includes(i) ? 'win' : ''}"><span>${s.winners.includes(i) ? '🥇' : medals[k]}</span>${avatar(P(i))}<b>${esc(P(i).name)}</b><em>${pts(s.scores[i])}</em></li>`).join('')}</ol>
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
    return `<div class="overlay rules">
      <div class="sheet wide scroll">
        <button class="icon-btn close" data-a="close" aria-label="Fermer">✕</button>
        <h2>Président</h2>
        <p>Toutes les cartes sont distribuées. Le but : se débarrasser de ses cartes le plus vite possible.</p>
        <p><b>Ordre des valeurs</b> : 3 &lt; 4 &lt; 5 … &lt; Valet &lt; Dame &lt; Roi &lt; As &lt; <b>2</b> (le plus fort).</p>
        <h3>Un pli</h3>
        <ol>
          <li>Celui qui ouvre pose 1, 2, 3 ou 4 cartes de même valeur.</li>
          <li>Chacun à son tour pose <b>le même nombre de cartes</b>, d'une valeur <b>égale ou supérieure</b>, ou passe (on peut rejouer au tour suivant).</li>
          <li>Après une valeur égale, le joueur suivant doit poser cette valeur <b>« ou rien »</b>.</li>
          <li>Un <b>2</b> ferme le pli aussitôt. Sinon, quand tout le monde passe, le dernier à avoir posé ouvre le pli suivant.</li>
        </ol>
        <h3>Les rôles</h3>
        <p>Le premier sans cartes devient ${R.ROLES.president.icon} <b>Président</b>, puis ${R.ROLES.vice.icon} Vice-président, les ${R.ROLES.citizen.icon} Citoyens, ${R.ROLES.vicepoor.icon} Vice-trouduc et le dernier ${R.ROLES.poor.icon} <b>Trouduc</b> (les vices à partir de 4 joueurs).</p>
        <p>À la manche suivante, le Trouduc donne ses <b>2 meilleures cartes</b> au Président, qui lui rend 2 cartes de son choix ; le Vice-trouduc donne sa meilleure carte au Vice-président, qui lui en rend une. Le Trouduc ouvre la manche. À la première manche, c'est la dame de cœur qui commence.</p>
        <h3>Points</h3>
        <p>À chaque manche, le Président marque autant de points qu'il y a d'autres joueurs, puis un de moins à chaque place (0 pour le Trouduc). Après ${s.rounds} manches, le plus gros score gagne.</p>
        <p class="muted">Avec moins de 3 joueurs, des robots complètent la table.</p>
      </div>
    </div>`;
  }

  /* ---------- déroulement ---------- */

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
    const over = s.phase === 'roundEnd' || s.phase === 'gameEnd';
    render({ noAnim: over });
    if (over) roundOver();
    else flow();
    return res;
  }

  function roundOver() {
    el.querySelectorAll('.pr-gain').forEach((g, k) => setTimeout(() => bump(g), 400 + k * 150));
  }

  // après chaque coup : tour des robots, ou passage du téléphone au joueur suivant
  async function flow() {
    if (!alive || !playing() || ui.busy) return;
    if (P(s.current).cpu) return robots();
    if (s.current !== ui.viewer) {
      ui.busy = true;
      await wait(900); // laisser voir le coup avant de cacher la main
      ui.busy = false;
      if (!alive) return;
      ui.viewer = null;
      render({ noAnim: true });
    }
  }

  async function robots() {
    ui.busy = true;
    render({ noAnim: true });
    while (alive && playing() && P(s.current).cpu) {
      const i = s.current;
      await wait(650 + Math.random() * 450);
      if (!alive) return;
      if (s.phase === 'exchange') {
        R.giveBack(s, cpuGive(s, s.exchange[0].count));
        cardSound();
      } else {
        const ids = cpuPlay(s);
        if (ids) {
          ids.forEach((id) => { origins[id] = { sel: `[data-opp="${i}"]`, flip: true }; });
          const res = R.play(s, ids);
          if (res.closed) toast(`${esc(P(i).name)} ferme le pli avec un 2 !`, 1600);
        } else {
          const res = R.pass(s);
          if (res.closed) { host.save(s); render(); await wait(700); }
        }
      }
      host.save(s);
      const over = s.phase === 'roundEnd' || s.phase === 'gameEnd';
      render({ noAnim: over });
      if (over) { ui.busy = false; roundOver(); return; }
    }
    ui.busy = false;
    render({ noAnim: true });
    flow();
  }

  /* ---------- gestes ---------- */

  function toggle(id) {
    if (!myTurn()) return;
    if (ui.sel.includes(id)) ui.sel = ui.sel.filter((x) => x !== id);
    else if (s.phase === 'exchange') ui.sel = [...ui.sel, id].slice(-s.exchange[0].count);
    else {
      // une sélection ne contient que des cartes de même valeur ; on complète au nombre demandé
      const same = ui.sel.length && R.power(ui.sel[0]) === R.power(id);
      ui.sel = same ? [...ui.sel, id] : [id];
      const t = R.topPlay(s);
      if (t && !same) {
        const mates = s.hands[me()].filter((x) => x !== id && R.power(x) === R.power(id));
        ui.sel.push(...mates.slice(0, t.cards.length - 1));
      }
      ui.sel = ui.sel.slice(0, 4);
    }
    cardSound();
    render();
  }

  async function onAction(a) {
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
      case 'reveal': {
        ui.viewer = s.current;
        s.lastSeen[s.current] = s.seq;
        const ex = s.phase === 'exchange' ? s.exchange[0] : null;
        ui.fresh = new Set(ex ? ex.got : []);
        host.save(s);
        return render({ fallback: '[data-anchor="table"]', stagger: 25 });
      }
      case 'play': {
        if (!myTurn() || !R.canPlay(s, ui.sel)) return;
        const ids = [...ui.sel];
        ui.fresh = new Set();
        return act(() => R.play(s, ids), (r) => { if (r.closed) toast('Vous fermez le pli avec un 2 : rejouez !', 1600); });
      }
      case 'pass':
        if (!myTurn()) return;
        return act(() => R.pass(s), (r) => { if (r.closed) toast('Pli terminé', 1200); });
      case 'give': {
        if (!myTurn()) return;
        const ids = [...ui.sel];
        return act(() => R.giveBack(s, ids));
      }
      case 'next':
        ui.final = false;
        if (!solo) ui.viewer = null;
        act(() => R.nextRound(s), () => {
          if (solo) {
            const ex = s.exchange.find((e) => e.from === me());
            ui.fresh = new Set(ex ? ex.got : []);
          }
        });
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
    const t = e.target.closest('[data-a],[data-card]');
    if (!t) return;
    if (t.dataset.a) {
      if (t.dataset.a === 'close' && t !== e.target && e.target.closest('.sheet')) return; // clic dans le menu, pas à côté
      return onAction(t.dataset.a);
    }
    if (t.dataset.card && t.closest('.pr-hand')) toggle(+t.dataset.card);
  }

  el.addEventListener('click', onClick);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  const onResize = () => render({ noAnim: true });
  window.addEventListener('resize', onResize);

  // la distribution : les cartes arrivent du centre de la table
  render(ui.viewer === null || !playing() ? { noAnim: true } : { fallback: '[data-anchor="table"]', stagger: 25 });
  flow();

  return {
    destroy() {
      alive = false;
      window.removeEventListener('resize', onResize);
    },
  };
}
