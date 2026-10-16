import { initDesktop, revealDesktop } from './desktop.js';

const root = document.documentElement;
initDesktop();

function showDesktopNow() {
  clearTimeout(window.__bootWatchdog);
  root.classList.remove('booting', 'handoff');
  revealDesktop();
}

if (!root.classList.contains('booting')) {
  revealDesktop();
} else {
  import('./boot.js')
    .then(({ startBoot }) => startBoot({
      container: document.getElementById('stage'),
      phaseEl: document.getElementById('boot-phase'),
      skipEl: document.getElementById('skip'),
      onStarted: () => clearTimeout(window.__bootWatchdog),
      onHandoff: () => { root.classList.add('handoff'); revealDesktop(); },
      onDone: showDesktopNow,
    }))
    .catch((err) => {
      console.warn('3D boot unavailable, showing desktop', err);
      showDesktopNow();
    });
}

// The watchdog in index.html may drop .booting on its own; make sure content still streams in.
new MutationObserver(() => {
  if (!root.classList.contains('booting')) revealDesktop();
}).observe(root, { attributes: true, attributeFilter: ['class'] });
