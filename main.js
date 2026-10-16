// Entry point. Content is plain HTML; this file adds timing, the trace view
// behavior, and the 3D layer. If three.js or WebGL fails, the page stays readable.
import { initTiming } from './timing.js';
import { initWaterfall } from './waterfall.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const gsap = window.gsap;
const ST = window.ScrollTrigger;
if (gsap && ST) {
  gsap.registerPlugin(ST);
  ST.config({ ignoreMobileResize: true });
}

initTiming();
initWaterfall({ reduce });

if (gsap && ST && !reduce) {
  // Layer cards rise in as the camera reaches their layer.
  for (const card of document.querySelectorAll('.layer .card')) {
    gsap.from(card, {
      y: 60, opacity: 0, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: card, start: 'top 80%', toggleActions: 'play none none reverse' },
    });
  }
  gsap.from('.hero .line, .hero .phases, .hero .eyebrow', { y: 40, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: 0.08, delay: 0.1 });
}

async function start3D() {
  const canvas = document.getElementById('gl');
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no webgl');
  const { initScene } = await import('./scene.js');
  const scene = await initScene({ canvas, reduce });
  if (reduce || !gsap || !ST) return;

  ST.create({
    trigger: '#dive', start: 'top top', end: 'bottom bottom',
    onUpdate: (s) => scene.setProgress(s.progress),
  });
  // Fade the corridor out as the trace view takes over, then stop drawing it.
  ST.create({
    trigger: '#trace', start: 'top bottom', end: 'top 20%',
    onUpdate: (s) => {
      canvas.style.opacity = String(1 - s.progress);
      scene.setVisible(s.progress < 1);
    },
  });
}

start3D().catch((err) => {
  console.warn('3D layer disabled:', err.message);
  root.classList.add('no-3d');
});
