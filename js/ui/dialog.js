// Petites fenêtres : confirmation, saisie de texte et messages éphémères.

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function modal(inner) {
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="modal-box">${inner}</div>`;
  document.body.appendChild(wrap);
  return wrap;
}

export function confirmDialog(text, { ok = 'Oui', cancel = 'Annuler', danger = false } = {}) {
  return new Promise((resolve) => {
    const m = modal(`<p>${esc(text)}</p>
      <div class="modal-actions">
        <button class="btn ghost" data-r="0">${esc(cancel)}</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${esc(ok)}</button>
      </div>`);
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (!b && e.target !== m) return;
      m.remove();
      resolve(b?.dataset.r === '1');
    });
  });
}

export function promptDialog(text, value = '') {
  return new Promise((resolve) => {
    const m = modal(`<p>${esc(text)}</p>
      <form><input class="field" maxlength="16" value="${esc(value)}" autocomplete="off">
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-r="0">Annuler</button>
        <button class="btn primary">OK</button>
      </div></form>`);
    const input = m.querySelector('input');
    input.focus();
    input.select();
    m.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      m.remove();
      resolve(input.value.trim() || null);
    });
    m.querySelector('[data-r="0"]').addEventListener('click', () => { m.remove(); resolve(null); });
  });
}

export function toast(html, ms = 2200) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = html;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}
