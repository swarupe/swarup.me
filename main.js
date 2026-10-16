// Bootstrap. The page is readable HTML first; WebGL and scroll motion are layered on top
// only when the browser supports them and the reader has not asked for reduced motion.
import { SOURCE, lex, deadBytes } from './source.js';

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

boot();
