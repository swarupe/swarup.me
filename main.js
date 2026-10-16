// Bootstrap. The page is readable HTML first; WebGL and scroll motion are layered on top
// only when the browser supports them and the reader has not asked for reduced motion.
import { SOURCE, lex, deadBytes } from './source.js';
import { runLoader } from './loader.js';
import { mountRuntime } from './runtime.js';
import { mountCursor } from './cursor.js';
import { mountTheme } from './theme.js';

window.__frames = 0;
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Real counts from the source text.
const counts = {};
for (const t of lex(SOURCE)) counts[t.type] = (counts[t.type] || 0) + 1;
for (const dd of document.querySelectorAll('[data-count]')) dd.textContent = counts[dd.dataset.count] || 0;
const dead = deadBytes(SOURCE);
document.getElementById('bytes-saved').textContent = dead.bytes;

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

async function boot() {
  if (!webglOK()) { root.classList.add('no-webgl'); return; }
  let scene;
  try {
    scene = await import('./scene.js');
  } catch (err) {
    console.warn('3D layer unavailable, showing the HTML version.', err);
    root.classList.add('no-webgl');
    return;
  }
  const gsap = window.gsap;
  const ST = window.ScrollTrigger;
  const motion = !reduced && gsap && ST;
  await scene.start({ motion, deadBytes: dead.bytes, gsap, ScrollTrigger: ST });
}

// Stage 06 sits after the 3D stages. The scene reads this flag for the HUD and the build log.
function watchRun() {
  const run = document.getElementById('run');
  new IntersectionObserver(([e]) => root.classList.toggle('in-run', e.isIntersecting),
    { rootMargin: '0px 0px -55% 0px' }).observe(run);
  // The runtime is a full-screen desktop: once scrolling stops near it, ease it flush with the viewport.
  let settle = 0;
  addEventListener('scroll', () => {
    clearTimeout(settle);
    settle = setTimeout(() => {
      if (root.classList.contains('loading')) return;
      const top = run.getBoundingClientRect().top;
      if (Math.abs(top) > 1 && Math.abs(top) < innerHeight * 0.3) {
        scrollTo({ top: scrollY + top, behavior: reduced ? 'auto' : 'smooth' });
      }
    }, 160);
  }, { passive: true });
}

mountRuntime({ still: reduced });
mountCursor();
mountTheme();
watchRun();

// The scene starts when the intro presses Enter, or right away without the intro.
let startScene;
const ready = new Promise((r) => { startScene = r; }).then(boot);

function handOff() {
  root.classList.remove('loading');
  document.getElementById('loader')?.remove();
  window.ScrollTrigger?.refresh();
}

if (root.classList.contains('loading')) {
  window.__loaderStarted = true;
  let seen = false;
  try { seen = sessionStorage.getItem('swc-booted') === '1'; } catch {}
  const htmlLoader = () => { startScene(); return runLoader({ ready, deadBytes: dead.bytes }); };
  // ?intro replays the 3D intro even after the first visit
  if ((!seen || location.search.includes('intro')) && webglOK()) {
    // First visit: the 3D workstation. Later visits in the session get the quick terminal.
    try { sessionStorage.setItem('swc-booted', '1'); } catch {}
    document.getElementById('loader').classList.add('intro-wait');
    history.scrollRestoration = 'manual';
    scrollTo(0, 0);
    import('./intro.js')
      .then(({ runIntro }) => runIntro({ ready, startScene, deadBytes: dead.bytes, onHandoff: handOff }))
      .catch((err) => {
        console.warn('3D intro unavailable, using the terminal loader.', err);
        document.querySelector('.intro')?.remove();
        document.getElementById('loader')?.classList.remove('intro-wait');
        htmlLoader();
      });
  } else {
    htmlLoader();
  }
} else {
  document.getElementById('loader').remove();
  startScene();
}
