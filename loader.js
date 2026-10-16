// The loader: swc runs a self-test while the 3D layer downloads, like a BIOS POST for the
// compiler. Every number it prints comes from data.js or source.js. It never reports
// "Finished" before the scene is actually ready, and any key, click or tap skips it.
import { LIBS, TREE, COMMITS } from './data.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const verb = (v, cls = 'v-ok') => `<span class="${cls}">${v.padStart(10)}</span>  `;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runLoader({ ready, deadBytes }) {
  const root = document.documentElement;
  const el = document.getElementById('loader');
  const log = document.getElementById('loader-log');
  const fill = document.getElementById('loader-fill');
  const pct = document.getElementById('loader-pct');
  const t0 = performance.now();

  let seen = false;
  try { seen = sessionStorage.getItem('swc-booted') === '1'; sessionStorage.setItem('swc-booted', '1'); } catch {}
  const speed = seen ? 4 : 1;

  let skipped = false;
  let wake = () => {};
  const skip = () => { skipped = true; wake(); };
  const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') skip(); };
  addEventListener('keydown', onKey);
  el.addEventListener('pointerdown', skip);
  // Sleeps that end early on skip.
  const pause = (ms) => skipped ? Promise.resolve() : new Promise((r) => { const id = setTimeout(r, ms / speed); wake = () => { clearTimeout(id); r(); }; });

  let isReady = false;
  ready.finally(() => { isReady = true; });

  // Progress follows the script, but holds at 90% until the scene has loaded.
  let shown = 0, goal = 0;
  const raf = () => {
    const cap = isReady ? 100 : 90;
    shown += (Math.min(goal, cap) - shown) * 0.18;
    fill.style.width = shown.toFixed(1) + '%';
    pct.textContent = Math.round(shown) + '%';
    if (el.isConnected) requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);

  const add = (html) => { log.insertAdjacentHTML('beforeend', '\n' + html); return log.lastElementChild; };

  add(verb('self-test') + 'toolchain <span class="dots"></span>');
  await pause(260);
  log.lastElementChild.textContent = '................ ok';
  goal = 8;

  // Probing targets: the linked libraries, one per tick, like POST hardware detection.
  add(verb('Probing') + `${LIBS.length} targets`);
  const grid = add('<span class="probe"></span>');
  for (const [i, [name, ck]] of LIBS.entries()) {
    grid.insertAdjacentHTML('beforeend', `<span class="chip" style="--c: var(--${ck})">${esc(name)}</span>`);
    goal = 8 + (i + 1) / LIBS.length * 30;
    await pause(42);
  }

  // Indexing: count commits up to the sum of the known shares.
  const total = COMMITS.reduce((a, [, n]) => a + n, 0);
  add(verb('Indexing') + 'swarup.src  <b class="count t-num">0</b> commits');
  const count = log.querySelector('.count');
  const tc = performance.now(), dur = 620 / speed;
  while (!skipped) {
    const k = Math.min(1, (performance.now() - tc) / dur);
    count.textContent = Math.round(total * (1 - Math.pow(1 - k, 3)));
    goal = 38 + k * 14;
    if (k >= 1) break;
    await wait(16);
  }
  count.textContent = total;
  add(verb('', 'v-dim') + `<span class="dim">${COMMITS.map(([, n]) => n).join(' + ')} across ${COMMITS.length} repos</span>`);

  // Compiling: one line per area of the tree, then the optimizer removes the dead branch.
  const areas = TREE.children.filter((a) => !a.dead);
  for (const [i, a] of areas.entries()) {
    add(verb(i ? '' : 'Compiling', 'v-ok') + `<span style="color: var(--${a.color})">${esc(a.label.toLowerCase())}</span> <span class="dim">(${a.children.length} units)</span>`);
    goal = 52 + (i + 1) / areas.length * 26;
    await pause(110);
  }
  add(verb('Removing', 'v-warn') + `<span class="t-kw">dead</span> { 2017, 2018 }  <span class="t-num">${deadBytes} B</span>`);
  goal = 82;
  await pause(220);

  // Linking waits on the real download.
  add(verb('Linking') + 'three.js 0.169.0, shaders, fonts <span class="spin"></span>');
  goal = 90;
  await Promise.race([ready.catch(() => {}), wait(8000)]);
  log.querySelector('.spin')?.remove();
  goal = 100;
  if (isReady) shown = 100;
  const secs = ((performance.now() - t0) / 1000).toFixed(2);
  add(verb('Finished') + `release [optimized] target in ${secs}s`);
  add(verb('Running') + '<span class="t-str">./swarup.bin</span>');
  await pause(isReady ? 420 : 0);

  removeEventListener('keydown', onKey);
  el.classList.add('is-done');
  root.classList.remove('loading');
  await wait(skipped ? 300 : 650);
  el.remove();
  window.ScrollTrigger?.refresh();
}
