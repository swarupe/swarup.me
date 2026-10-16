// Wires the page to the particle scene: the loader, scroll-driven chapters,
// pointer, and the HUD. Without WebGL the page stays a plain dark document.

const canvas = document.getElementById('stage');
const loader = document.querySelector('.loader');
const pct = document.querySelector('.loader__pct');
const hud = document.querySelector('.hud');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wide = () => innerWidth >= 820;

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) {
    return false;
  }
}

// Counts up while the scene loads; never claims 100% before it is ready.
function runLoader(ready) {
  if (reducedMotion) return ready.finally(() => loader.classList.add('is-done'));
  let shown = 0;
  let done = false;
  const tick = () => {
    const goal = done ? 100 : 90;
    shown += Math.max(1, (goal - shown) * 0.08);
    shown = Math.min(shown, goal);
    pct.textContent = `${String(Math.floor(shown)).padStart(3, '0')}%`;
    if (done && shown >= 100) {
      setTimeout(() => loader.classList.add('is-done'), 250);
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return ready.finally(() => { done = true; });
}

function hhmmss(d) {
  return d.toTimeString().slice(0, 8);
}

async function start() {
  if (!webglAvailable()) {
    canvas.remove();
    hud.remove();
    loader.classList.add('is-done');
    return;
  }

  const ready = import('./scene.js').then(({ mount, LATE_SHARE }) => ({
    LATE_SHARE,
    scene: mount(canvas, { count: wide() ? 14000 : 6000, still: reducedMotion }),
  }));
  let loaded;
  try {
    loaded = await runLoader(ready);
  } catch (err) {
    console.warn('Particle scene unavailable.', err);
    canvas.remove();
    hud.remove();
    return;
  }
  const { scene, LATE_SHARE } = loaded;

  // The chapter whose top has passed the middle of the screen drives the scene.
  const stages = [...document.querySelectorAll('[data-state]')];
  const after = document.getElementById('experience');
  let state = 0;
  const onScroll = () => {
    const mid = innerHeight * 0.55;
    let next = 0;
    for (const s of stages) if (s.getBoundingClientRect().top < mid) next = Number(s.dataset.state);
    const past = after.getBoundingClientRect().top < innerHeight * 0.6;
    canvas.style.opacity = past ? '0.22' : '1';
    hud.classList.toggle('is-hidden', past);
    scene.setFocus(wide() && next > 0 ? 1 : 0);
    if (next !== state) {
      state = next;
      scene.setState(state);
    }
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  if (!reducedMotion) {
    addEventListener('pointermove', (e) => {
      scene.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1, true);
    });
    document.addEventListener('pointerleave', () => scene.setPointer(0, 0, false));
  }

  const rate = hud.querySelector('[data-hud="rate"]');
  const wm = hud.querySelector('[data-hud="wm"]');
  const late = hud.querySelector('[data-hud="late"]');
  const updateHud = () => {
    rate.textContent = scene.rate.toLocaleString('en-IN');
    wm.textContent = hhmmss(new Date(Date.now() - 2000));
    late.textContent = state === 2 ? `${(LATE_SHARE * 100).toFixed(1)}%` : '0.0%';
  };
  updateHud();
  setInterval(updateHud, 1000);
}

start();
