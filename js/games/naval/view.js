// Bataille navale : placement des flottes, grilles de tir, effets (boulet, plouf, explosion).
// Tout est redessiné à chaque action ; les effets sont joués par-dessus, puis le résultat s'affiche.
import * as R from './rules.js';
import { cpuTarget } from './ai.js';
import { confetti } from '../../ui/anim.js';
import { confirmDialog, toast, esc } from '../../ui/dialog.js';
import { soundOn, setSound, shotSound, splashSound, boomSound, tickSound } from '../../ui/sound.js';
import { fullscreenButton } from '../../ui/fullscreen.js';

const { N, COLS, FLEET, MISS, HIT, WATER } = R;
const avatar = (p) => `<span class="avatar" style="--pc:${p.color || '#c98a4b'}">${p.cpu ? '🤖' : esc(p.name.slice(0, 1).toUpperCase())}</span>`;
// « de Bob », « d'Alice »
const de = (name) => (/^[aeiouyhàâéèêëîïôûü]/i.test(name) ? `d'${name}` : `de ${name}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function mount(root, s, host) {
  root.innerHTML = '<div class="bn"></div>';
  const el = root.firstChild;
  const cpu = R.vsCpu(s);
  const human = s.players.findIndex((p) => !p.cpu);
  const ui = {
    viewer: cpu ? human : null, // joueur dont on voit l'écran (null : écran « passe le téléphone »)
    draft: null, // flotte en cours de placement
    selShip: null,
    drag: null,
    aim: null, // case visée, avant de tirer
    busy: false, // effet en cours ou tour de l'ordinateur
    hide: null, // { board, idx, around } : résultat pas encore montré (l'effet est en route)
    fresh: null, // { board, idx, sunk, around } : résultat qui vient d'apparaître
    overlay: null, // menu | rules
    endClosed: false,
    finished: false,
  };
  let alive = true;

  const P = (i) => s.players[i];
  const opp = R.opponent;

  /* ---------- rendu ---------- */

  function sizes() {
    const W = Math.min(el.clientWidth || window.innerWidth, 560) - 24 - 18;
    const H = window.innerHeight;
    const big = Math.floor(Math.min(W, H * (s.phase === 'place' ? 0.56 : 0.42), 440) / 10) * 10;
    const small = Math.floor(Math.min((W + 18) * 0.46, H * 0.2, 200) / 10) * 10;
    return { big, small };
  }

  function render() {
    if (!alive) return;
    if (s.phase === 'end' && !ui.finished) {
      ui.finished = true;
      const w = s.winner;
      host.finish({ winners: [P(w)], summary: `${P(w).name} a coulé la flotte ${de(P(opp(w)).name)} en ${s.fired[w]} tirs` });
    }
    el.innerHTML = `${top()}${body()}${overlay()}`;
    ui.fresh = null; // les effets d'apparition ne se jouent qu'une fois
  }

  function top() {
    const mid = s.phase === 'place' ? '<b>Placement</b><small>Bataille navale</small>' : `<b>Tour ${s.turn}</b><small>Bataille navale</small>`;
    return `<header class="top">
      <div class="top-side"><button class="icon-btn" data-a="menu" aria-label="Menu">☰</button></div>
      <div class="top-mid">${mid}</div>
      <div class="top-side end">${fullscreenButton()}<button class="icon-btn" data-a="rules" aria-label="Règles">?</button></div>
    </header>`;
  }

  function body() {
    if (s.phase === 'place') return ui.viewer === s.placer ? placement() : '';
    if (ui.viewer === null) return '';
    return battle();
  }

  // grille : kind = enemy (mes tirs chez l'adversaire) | mine (ma flotte et ses tirs) | place
  function board(kind, me, px, { labels = true } = {}) {
    const fleet = kind === 'enemy' ? s.fleets[opp(me)] : kind === 'place' ? ui.draft : s.fleets[me];
    const seen = kind === 'enemy' ? s.shots[me] : kind === 'mine' ? s.shots[opp(me)] : null;
    const owner = kind === 'enemy' ? opp(me) : me;
    const sunk = kind === 'place' ? [] : R.sunkShips(s, owner);
    const hide = ui.hide?.board === kind ? ui.hide : null;
    const fresh = ui.fresh?.board === kind ? ui.fresh : null;
    const freshAround = fresh ? fresh.around || [] : [];
    const live = kind === 'enemy' && canFire();
    let cells = '';
    for (let i = 0; i < N * N; i++) {
      let v = seen ? seen[i] : 0;
      if (hide && (hide.idx === i || hide.around?.includes(i))) v = 0;
      const cls = [`v${v}`];
      if (fresh && (fresh.idx === i)) cls.push('new');
      const d = freshAround.indexOf(i);
      if (d >= 0) cls.push('new');
      if (ui.aim === i && kind === 'enemy') cls.push('aim');
      if (live && !v) cls.push('open');
      cells += `<button class="cell ${cls.join(' ')}" data-cell="${i}" data-k="${kind}" ${d >= 0 ? `style="--d:${200 + d * 35}ms"` : ''} aria-label="${R.cellName(i)}"></button>`;
    }
    const ships = fleet.map((sh, k) => {
      const isSunk = sunk.includes(k) && !(hide && R.shipCells(sh).includes(hide.idx));
      if (kind === 'enemy' && !isSunk && s.phase !== 'end') return '';
      const cls = ['ship', sh.h ? 'h' : 'v'];
      if (isSunk) cls.push('sunk');
      if (kind === 'enemy' && !isSunk) cls.push('ghost');
      if (fresh && fresh.sunk === k) cls.push('sinking');
      if (kind === 'place' && ui.selShip === k) cls.push('sel');
      return `<div class="${cls.join(' ')}" data-ship="${k}" style="--r:${sh.r};--c:${sh.c};--len:${FLEET[k].size}"><i></i></div>`;
    }).join('');
    const lab = labels ? `<div class="cols">${[...COLS].map((l) => `<span>${l}</span>`).join('')}</div>
      <div class="rows">${Array.from({ length: N }, (_, r) => `<span>${r + 1}</span>`).join('')}</div>` : '';
    return `<div class="board b-${kind} ${labels ? '' : 'nolab'}" style="--bs:${px}px">
      ${lab}<div class="grid ${live ? 'live' : ''}" data-grid="${kind}">${ships}${cells}</div>
    </div>`;
  }

  function fleetStatus(i, names) {
    const sunk = R.sunkShips(s, i);
    return `<ul class="fleet ${names ? 'named' : ''}">${FLEET.map((f, k) => `<li class="${sunk.includes(k) ? 'down' : ''}" title="${f.name}">
      <span class="segs">${'<i></i>'.repeat(f.size)}</span>${names ? `<small>${f.name}</small>` : ''}</li>`).join('')}</ul>`;
  }

  /* ---------- placement ---------- */

  function placement() {
    if (!ui.draft) ui.draft = R.randomFleet();
    const { big } = sizes();
    const k = ui.selShip;
    return `<section class="place">
      <h2>${avatar(P(s.placer))} Placez votre flotte</h2>
      <p class="muted">Faites glisser un navire pour le déplacer. Touchez-le puis « Tourner » pour changer son sens. Les navires ne doivent pas se toucher.</p>
      ${board('place', s.placer, big)}
      <ul class="dock">${FLEET.map((f, j) => `<li><button class="${k === j ? 'on' : ''}" data-pick="${j}"><span class="segs">${'<i></i>'.repeat(f.size)}</span>${f.name}</button></li>`).join('')}</ul>
      <div class="bn-actions">
        <button class="btn" data-a="shuffle">🎲 Au hasard</button>
        <button class="btn" data-a="rotate" ${k == null ? 'disabled' : ''}>↻ Tourner</button>
        <button class="btn primary" data-a="ready">Prêt !</button>
      </div>
    </section>`;
  }

  function moveShip(k, ship, { snap = true } = {}) {
    let target = ship;
    if (!R.fits(ui.draft, target, k)) {
      target = snap ? R.nearestFit(ui.draft, ship, k) : null;
      if (!target) { toast('Pas de place ici : les navires ne doivent pas se toucher'); return false; }
    }
    ui.draft[k] = target;
    tickSound({ pitch: 0.8 });
    return true;
  }

  // glisser-déposer des navires sur la grille de placement
  function cellFromPoint(grid, x, y) {
    const r = grid.getBoundingClientRect();
    const cs = r.width / N;
    return { row: Math.floor((y - r.top) / cs), col: Math.floor((x - r.left) / cs), cs };
  }

  function onPointerDown(e) {
    const shipEl = e.target.closest('.b-place .ship');
    if (!shipEl || ui.overlay) return;
    const grid = shipEl.parentElement;
    const k = +shipEl.dataset.ship;
    const sh = ui.draft[k];
    const { row, col } = cellFromPoint(grid, e.clientX, e.clientY);
    ui.drag = { k, el: shipEl, grid, off: sh.h ? col - sh.c : row - sh.r, x: e.clientX, y: e.clientY, moved: false, pos: null };
    grid.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e) {
    const d = ui.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
    d.moved = true;
    const sh = ui.draft[d.k];
    const { row, col } = cellFromPoint(d.grid, e.clientX, e.clientY);
    const pos = { ...sh, r: sh.h ? row : row - d.off, c: sh.h ? col - d.off : col };
    const size = FLEET[d.k].size;
    pos.r = Math.max(0, Math.min(N - (sh.h ? 1 : size), pos.r));
    pos.c = Math.max(0, Math.min(N - (sh.h ? size : 1), pos.c));
    if (d.pos && d.pos.r === pos.r && d.pos.c === pos.c) return;
    d.pos = pos;
    d.el.style.setProperty('--r', pos.r);
    d.el.style.setProperty('--c', pos.c);
    d.el.classList.add('dragging');
    d.el.classList.toggle('bad', !R.fits(ui.draft, pos, d.k));
    tickSound({ pitch: 1.3 });
  }

  function onPointerUp() {
    const d = ui.drag;
    if (!d) return;
    ui.drag = null;
    if (d.moved && d.pos) {
      if (R.fits(ui.draft, d.pos, d.k)) { ui.draft[d.k] = d.pos; tickSound({ pitch: 0.8 }); } else toast('Les navires ne doivent pas se toucher');
    }
    ui.selShip = d.k;
    render();
  }

  /* ---------- bataille ---------- */

  const canFire = () => s.phase === 'battle' && !ui.busy && ui.viewer === s.current && !P(s.current).cpu;

  function battle() {
    const me = ui.viewer;
    const { big, small } = sizes();
    return `<section class="enemy">
        <div class="side-head">${avatar(P(opp(me)))}<b>Flotte ${esc(de(P(opp(me)).name))}</b>${fleetStatus(opp(me), false)}</div>
        ${board('enemy', me, big)}
      </section>
      <div class="bn-status">${status()}</div>
      <section class="mine">
        ${board('mine', me, small, { labels: false })}
        <div class="mine-info">
          <div class="side-head">${avatar(P(me))}<b>${esc(P(me).name)}</b></div>
          ${fleetStatus(me, true)}
          <small class="muted">${s.fired[me]} tir${s.fired[me] > 1 ? 's' : ''} · ${s.hits[me]} touché${s.hits[me] > 1 ? 's' : ''}</small>
        </div>
      </section>
      <div class="bn-actions">${actions()}</div>`;
  }

  function lastText(l, mine) {
    const where = R.cellName(l.idx);
    if (l.sunk !== null) return `💥 ${mine ? 'Coulé' : 'Touché-coulé'} en ${where} : ${mine ? 'le' : 'votre'} ${FLEET[l.sunk].name.toLowerCase()} ${mine ? 'est au fond !' : 'a sombré !'}`;
    return l.hit ? `💥 Touché en ${where} !` : `💦 Dans l'eau en ${where}.`;
  }

  function status() {
    const me = ui.viewer;
    if (s.phase === 'end') return s.winner === me ? '🏆 Toute la flotte ennemie est au fond de l\'eau !' : `🌊 ${esc(P(s.winner).name)} a coulé toute votre flotte.`;
    if (ui.busy && P(s.current).cpu && !ui.hide) return `🎯 ${esc(P(s.current).name)} vise…`;
    if (ui.hide) return ui.hide.board === 'enemy' ? '🚀 Feu !' : `🚀 ${esc(P(opp(me)).name)} tire…`;
    const l = s.last;
    if (s.current !== me && l?.by === me) return `${lastText(l, true)}`;
    if (ui.aim != null) return `Cible <b>${R.cellName(ui.aim)}</b> : touchez à nouveau ou appuyez sur Feu.`;
    const before = l && l.by !== me ? `<span class="recv">${esc(P(l.by).name)} : ${lastText(l, false)}</span>` : '';
    return `${before}<span>À vous ! Touchez une case de la grille adverse.</span>`;
  }

  function actions() {
    const me = ui.viewer;
    if (s.phase === 'end') {
      return ui.endClosed ? '<button class="btn" data-a="result">Résultat</button><button class="btn primary" data-a="again">Rejouer</button>' : '';
    }
    if (!cpu && s.current !== me && !ui.busy) return `<button class="btn primary" data-a="pass">Passer le téléphone à ${esc(P(s.current).name)} ›</button>`;
    if (ui.aim != null && canFire()) return `<button class="btn primary fire" data-a="fire">🔥 Feu sur ${R.cellName(ui.aim)} !</button>`;
    return '';
  }

  /* ---------- fenêtres ---------- */

  function overlay() {
    if (ui.overlay === 'menu') return menu();
    if (ui.overlay === 'rules') return rules();
    if (s.phase === 'end' && !ui.endClosed && !ui.busy) return endSheet();
    if (s.phase === 'place' && ui.viewer !== s.placer) return handoff(s.placer);
    if (s.phase === 'battle' && ui.viewer === null) return handoff(s.current);
    return '';
  }

  function handoff(i) {
    let news = '';
    let btn = 'C\'est moi, à l\'attaque !';
    if (s.phase === 'place') {
      news = '<p>Placez votre flotte en secret : l\'autre joueur ne doit pas regarder !</p>';
      btn = 'C\'est moi, placer ma flotte';
    } else if (s.last && s.last.by !== i) {
      news = `<div class="news"><b>Pendant ce temps…</b><ul><li class="${s.last.hit ? 'secret' : ''}">${esc(P(s.last.by).name)} a tiré : ${esc(lastText(s.last, false))}</li></ul></div>`;
    }
    return `<div class="overlay handoff">
      <div class="sheet">
        <div class="ho-avatar">${avatar(P(i))}</div>
        <p class="kicker">📱 Passez le téléphone à</p>
        <h2>${esc(P(i).name)}</h2>
        ${news}
        <button class="btn primary big" data-a="reveal">${btn}</button>
      </div>
    </div>`;
  }

  function endSheet() {
    const w = s.winner;
    const rows = [w, opp(w)].map((i) => {
      const acc = s.fired[i] ? Math.round((s.hits[i] / s.fired[i]) * 100) : 0;
      return `<li class="${i === w ? 'win' : ''}"><span>${i === w ? '🥇' : '🥈'}</span>${avatar(P(i))}<b>${esc(P(i).name)}</b>
        <em>${R.sunkShips(s, opp(i)).length}/5 coulés<small>${s.fired[i]} tirs · ${acc} %</small></em></li>`;
    }).join('');
    const lost = cpu && P(w).cpu;
    return `<div class="overlay final">
      <div class="sheet">
        <div class="trophy">${lost ? '⚓' : '🏆'}</div>
        <h2>${esc(P(w).name)} gagne !</h2>
        <p class="muted">${lost ? 'Votre flotte a sombré… Revanche ?' : `Toute la flotte ${esc(de(P(opp(w)).name))} est au fond de l'eau.`}</p>
        <ol class="ranking">${rows}</ol>
        <div class="sheet-foot col">
          <button class="btn primary big" data-a="again">Rejouer</button>
          <button class="btn" data-a="look">Voir les grilles</button>
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
        <h2>Bataille navale</h2>
        <p>Chaque joueur cache sa flotte sur une grille de 10 × 10 cases, puis on tire chacun son tour pour couler les navires adverses. Le premier qui coule toute la flotte d'en face gagne.</p>
        <h3>La flotte</h3>
        <ul class="fleet-rules">${FLEET.map((f) => `<li><span class="segs">${'<i></i>'.repeat(f.size)}</span><b>${f.name}</b> · ${f.size} cases</li>`).join('')}</ul>
        <p>Les navires sont droits (horizontaux ou verticaux) et <b>ne se touchent pas</b>, même par un coin.</p>
        <h3>À votre tour</h3>
        <ol>
          <li>Touchez une case de la grille adverse pour viser, puis touchez-la encore (ou « Feu ») pour tirer.</li>
          <li><b>Dans l'eau</b> 💦, <b>touché</b> 💥 ou <b>coulé</b> quand toutes les cases d'un navire sont touchées.</li>
          <li>Autour d'un navire coulé, les cases sont forcément de l'eau : elles sont marquées pour vous.</li>
        </ol>
        <p>Un tir par tour, touché ou non. À deux, on se passe le téléphone ; seul, on affronte l'Amiral Robot.</p>
        <p>En bas, votre propre flotte montre les tirs reçus.</p>
      </div>
    </div>`;
  }

  /* ---------- effets ---------- */

  function cellCenter(kind, idx) {
    const c = el.querySelector(`.cell[data-k="${kind}"][data-cell="${idx}"]`);
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
  }

  function fxNode(cls, p, html = '') {
    const n = document.createElement('div');
    n.className = `fx ${cls}`;
    n.style.left = `${p.x}px`;
    n.style.top = `${p.y}px`;
    n.style.setProperty('--w', `${p.w}px`);
    n.innerHTML = html;
    el.appendChild(n);
    return n;
  }

  // le boulet part de `fromTop` (tir reçu) ou du bas de l'écran (mon tir), puis plouf ou explosion
  async function shotFx(kind, idx, res) {
    const to = cellCenter(kind, idx);
    if (!to) return;
    shotSound();
    if (!reduced()) {
      const from = kind === 'enemy'
        ? { x: window.innerWidth / 2, y: window.innerHeight + 20 }
        : { x: window.innerWidth / 2, y: -20 };
      const ball = fxNode('ball', from);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const lift = Math.min(160, Math.abs(dy) * 0.5);
      const a = ball.animate([
        { transform: 'translate(-50%, -50%) translate(0, 0) scale(1.6)' },
        { transform: `translate(-50%, -50%) translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) scale(1.3)`, offset: 0.5 },
        { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(.55)` },
      ], { duration: 560, easing: 'cubic-bezier(.35,.1,.6,1)', fill: 'forwards' });
      await a.finished.catch(() => {});
      ball.remove();
    }
    if (!alive) return;
    if (res.hit) {
      boomSound(res.sunk !== null);
      navigator.vibrate?.(res.sunk !== null ? [40, 60, 80] : 40);
      const sparks = Array.from({ length: 10 }, (_, k) => `<i style="--a:${k * 36 + Math.random() * 20}deg;--l:${0.9 + Math.random() * 0.9}"></i>`).join('');
      const n = fxNode(`boom ${res.sunk !== null ? 'big' : ''}`, to, sparks);
      const grid = el.querySelector(`[data-grid="${kind}"]`);
      grid?.parentElement.classList.add('shake');
      setTimeout(() => n.remove(), 900);
    } else {
      splashSound();
      const n = fxNode('splash', to, '<i></i><i></i><i></i><b></b><b></b><b></b>');
      setTimeout(() => n.remove(), 900);
    }
    await wait(reduced() ? 50 : 260);
  }

  // un tir complet : état → effet → résultat affiché
  async function shoot(idx) {
    const by = s.current;
    const kind = by === ui.viewer ? 'enemy' : 'mine';
    let res;
    try {
      res = R.fire(s, idx);
    } catch (e) {
      toast(esc(e.message));
      return null;
    }
    host.save(s);
    ui.aim = null;
    ui.busy = true;
    ui.hide = { board: kind, idx, around: res.around };
    render();
    await shotFx(kind, idx, res);
    if (!alive) return res;
    ui.hide = null;
    ui.fresh = { board: kind, idx, sunk: res.sunk, around: res.around };
    render();
    if (res.sunk !== null) {
      const name = FLEET[res.sunk].name.toLowerCase();
      toast(kind === 'enemy' ? `🚢 Coulé : le ${name} ${esc(de(P(opp(by)).name))} !` : `🌊 Votre ${name} a coulé !`, 2400);
      await wait(900);
    }
    if (res.win) {
      await wait(700);
      if (!P(by).cpu) confetti(el);
    }
    ui.busy = false;
    render();
    return res;
  }

  async function cpuTurn() {
    if (!alive || s.phase !== 'battle' || !P(s.current).cpu) return;
    ui.busy = true;
    render();
    await wait(650 + Math.random() * 450);
    if (!alive) return;
    await shoot(cpuTarget(s));
  }

  // à la reprise du tour (à deux), on revoit le tir que l'adversaire vient de faire sur notre flotte
  async function replayLast() {
    const l = s.last;
    if (!l || l.by === ui.viewer) return render();
    ui.busy = true;
    ui.hide = { board: 'mine', idx: l.idx, around: [] };
    render();
    await wait(250);
    await shotFx('mine', l.idx, l);
    ui.hide = null;
    ui.busy = false;
    ui.fresh = { board: 'mine', idx: l.idx, sunk: l.sunk, around: [] };
    render();
  }

  /* ---------- actions ---------- */

  async function onAction(a) {
    switch (a) {
      case 'menu': ui.overlay = 'menu'; return render();
      case 'rules': ui.overlay = 'rules'; return render();
      case 'close': ui.overlay = null; return render();
      case 'sound': setSound(!soundOn()); return render();
      case 'exit': return host.exit();
      case 'abandon':
        if (await confirmDialog('Abandonner cette partie ? Elle sera supprimée.', { ok: 'Abandonner', danger: true })) {
          ui.finished = true;
          host.abandon?.();
          host.exit();
        }
        return;
      case 'reveal':
        if (s.phase === 'place') {
          ui.viewer = s.placer;
          ui.draft = null;
          ui.selShip = null;
          return render();
        }
        ui.viewer = s.current;
        return replayLast();
      case 'shuffle':
        ui.draft = R.randomFleet();
        ui.selShip = null;
        tickSound();
        return render();
      case 'rotate': {
        const k = ui.selShip;
        if (k == null) return;
        const sh = ui.draft[k];
        if (moveShip(k, { ...sh, h: !sh.h })) render();
        return;
      }
      case 'ready':
        try {
          R.placeFleet(s, s.placer, ui.draft);
        } catch (e) {
          return toast(esc(e.message));
        }
        host.save(s);
        ui.draft = null;
        ui.selShip = null;
        if (!cpu) ui.viewer = null;
        tickSound();
        render();
        window.scrollTo(0, 0);
        if (s.phase === 'battle' && cpu) {
          toast(P(s.current).cpu ? `${esc(P(s.current).name)} tire le premier` : 'Vous tirez le premier !');
          cpuTurn();
        }
        return;
      case 'fire':
        if (ui.aim != null && canFire()) await shoot(ui.aim);
        if (cpu) cpuTurn();
        return;
      case 'pass':
        ui.viewer = null;
        return render();
      case 'look': ui.endClosed = true; return render();
      case 'result': ui.endClosed = false; return render();
      case 'again': return host.restart(s.players);
      default:
    }
  }

  async function onCell(t) {
    const i = +t.dataset.cell;
    const kind = t.dataset.k;
    if (kind === 'place') {
      if (ui.selShip == null) return;
      const sh = ui.draft[ui.selShip];
      if (moveShip(ui.selShip, { ...sh, r: Math.min(i / N | 0, N - (sh.h ? 1 : FLEET[ui.selShip].size)), c: Math.min(i % N, N - (sh.h ? FLEET[ui.selShip].size : 1)) })) render();
      return;
    }
    if (kind !== 'enemy' || !canFire()) return;
    const v = s.shots[ui.viewer][i];
    if (v) { toast(v === WATER ? 'Il n\'y a que de l\'eau ici' : 'Déjà tiré ici'); return; }
    if (ui.aim === i) {
      await shoot(i);
      if (cpu) cpuTurn();
      return;
    }
    ui.aim = i;
    tickSound();
    render();
  }

  function onClick(e) {
    const t = e.target.closest('[data-a],[data-cell],[data-pick]');
    if (!t) return;
    if (t.dataset.a) {
      if (t.dataset.a === 'close' && t !== e.target && e.target.closest('.sheet')) return; // clic dans le menu, pas à côté
      return onAction(t.dataset.a);
    }
    if (t.dataset.pick) {
      ui.selShip = +t.dataset.pick === ui.selShip ? null : +t.dataset.pick;
      tickSound();
      return render();
    }
    if (t.dataset.cell) onCell(t);
  }

  el.addEventListener('click', onClick);
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  const onResize = () => { if (!ui.busy && !ui.drag) render(); };
  window.addEventListener('resize', onResize);

  render();
  // reprise d'une partie où c'était au tour de l'ordinateur
  if (s.phase === 'battle' && cpu && P(s.current).cpu) cpuTurn();

  return {
    destroy() {
      alive = false;
      window.removeEventListener('resize', onResize);
    },
  };
}
