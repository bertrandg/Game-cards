// Plein écran. Indisponible sur iPhone (Safari ne le permet pas pour une page) : le bouton est alors masqué.
const doc = document;
const root = doc.documentElement;

export const fullscreenSupported = () => !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
const isFull = () => !!(doc.fullscreenElement || doc.webkitFullscreenElement);

export function toggleFullscreen() {
  if (isFull()) (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
  else (root.requestFullscreen || root.webkitRequestFullscreen).call(root, { navigationUI: 'hide' })?.catch?.(() => {});
}

export function fullscreenButton(cls = 'icon-btn') {
  if (!fullscreenSupported()) return '';
  return `<button class="${cls} fs-btn" data-fullscreen aria-label="Plein écran">${isFull() ? ICON_EXIT : ICON_ENTER}</button>`;
}

const ICON_ENTER = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const ICON_EXIT = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';

// un seul écouteur pour tous les boutons, où qu'ils soient dessinés
doc.addEventListener('click', (e) => {
  if (e.target.closest('[data-fullscreen]')) toggleFullscreen();
});
const refresh = () => doc.querySelectorAll('[data-fullscreen]').forEach((b) => { b.innerHTML = isFull() ? ICON_EXIT : ICON_ENTER; });
doc.addEventListener('fullscreenchange', refresh);
doc.addEventListener('webkitfullscreenchange', refresh);
