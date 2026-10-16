import { LINES, FIRST_YEAR, LAST_YEAR, W, H, AXIS_Y, x, readStations, lineRoute } from './map-data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const host = document.getElementById('map');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let scene3d = null;

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

const toPath = (points) => points.map(([px, py], i) => `${i ? 'L' : 'M'}${px},${py}`).join(' ');

function drawSvgMap() {
  const stations = readStations();
  const css = getComputedStyle(document.documentElement);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': 'Career map' });

  for (let year = FIRST_YEAR; year < LAST_YEAR; year++) {
    el('line', { class: 'm-tick', x1: x(year), x2: x(year), y1: 20, y2: AXIS_Y - 14 }, svg);
    el('text', { class: 'm-year', x: x(year) + 4, y: AXIS_Y + 6 }, svg).textContent = year;
  }

  for (const line of LINES) {
    const r = lineRoute(line, stations);
    if (!r) continue;
    const color = css.getPropertyValue(line.color).trim();
    el('path', { class: 'm-line', d: toPath(r.route), stroke: color }, svg);
    el('path', { class: 'm-line m-line--future', d: toPath(r.tail), stroke: color }, svg);
    el('text', { class: 'm-name', x: 16, y: r.lane + 5, fill: color }, svg).textContent = line.name;
  }

  for (const s of stations) {
    const a = el('a', { href: `#${s.id}`, class: 'm-station', 'aria-label': `${s.label}, ${Math.floor(s.year)}` }, svg);
    el('circle', { cx: s.x, cy: s.y, r: s.lines.length > 1 ? 12 : 8 }, a);
    const t = el('text', { x: s.x + 10, y: s.y - 16, transform: `rotate(-35 ${s.x + 10} ${s.y - 16})` }, a);
    t.textContent = s.label;
  }

  host.classList.remove('is-3d');
  host.replaceChildren(svg);
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) {
    return false;
  }
}

// The 3D scene is an enhancement. Any failure leaves the SVG map in place.
async function drawMap() {
  if (scene3d) return scene3d.refreshTheme();
  drawSvgMap();
  if (reducedMotion.matches || !webglAvailable()) return;
  try {
    const { mount } = await import('./scene3d.js');
    scene3d = mount(host, readStations());
  } catch (err) {
    console.warn('3D map unavailable, keeping the flat map.', err);
    scene3d = null;
    drawSvgMap();
  }
}

function setupTheme() {
  const button = document.querySelector('.theme-toggle');
  button.addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
    drawMap();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawMap);
}

setupTheme();
drawMap();
if (!reducedMotion.matches) import('./fx.js').then((m) => m.start());
