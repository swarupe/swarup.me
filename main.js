// Draws the career map from the page itself: every element with
// [data-station] becomes a station, so the HTML stays the only source of truth.

const LINES = [
  { key: 'infra', name: 'YELLOW', color: '--yellow' },
  { key: 'product', name: 'PURPLE', color: '--purple' },
  { key: 'data', name: 'GREEN', color: '--green' },
  { key: 'ai', name: 'BLUE', color: '--blue' },
];
const FIRST_YEAR = 2019;
const LAST_YEAR = 2027;
const W = 1200;
const LANE_TOP = 135;
const LANE_GAP = 100;
const AXIS_Y = LANE_TOP + LANE_GAP * LINES.length - 20;
const H = AXIS_Y + 30;
const X0 = 120;
const X1 = 1080;
const SVG_NS = 'http://www.w3.org/2000/svg';

const x = (year) => X0 + ((year - FIRST_YEAR) / (LAST_YEAR - FIRST_YEAR)) * (X1 - X0);
const laneY = (key) => LANE_TOP + LINES.findIndex((l) => l.key === key) * LANE_GAP;

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

function readStations() {
  return [...document.querySelectorAll('[data-station]')].map((node) => {
    const lines = node.dataset.lines.split(/\s+/);
    const year = Number(node.dataset.year);
    return {
      id: node.id,
      label: node.dataset.short,
      year,
      lines,
      x: x(year),
      y: lines.reduce((sum, key) => sum + laneY(key), 0) / lines.length,
    };
  });
}

// A line runs along its lane and bends at 45 degrees into interchanges,
// which sit between the lanes of the lines they join.
function linePath(lane, stops) {
  const [first, ...rest] = stops;
  let d = `M${first.x},${first.y}`;
  let prev = first;
  for (const s of rest) {
    d += ` L${prev.x + Math.abs(prev.y - lane)},${lane}`;
    d += ` L${s.x - Math.abs(s.y - lane)},${lane}`;
    d += ` L${s.x},${s.y}`;
    prev = s;
  }
  const last = stops[stops.length - 1];
  const tail = `M${last.x},${last.y} L${last.x + Math.abs(last.y - lane)},${lane} L${x(LAST_YEAR) - 10},${lane}`;
  return { d, tail };
}

function drawMap(host) {
  const stations = readStations();
  const css = getComputedStyle(document.documentElement);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': 'Career map' });

  for (let year = FIRST_YEAR; year < LAST_YEAR; year++) {
    el('line', { class: 'm-tick', x1: x(year), x2: x(year), y1: 20, y2: AXIS_Y - 14 }, svg);
    el('text', { class: 'm-year', x: x(year) + 4, y: AXIS_Y + 6 }, svg).textContent = year;
  }

  for (const line of LINES) {
    const stops = stations.filter((s) => s.lines.includes(line.key)).sort((a, b) => a.year - b.year);
    if (!stops.length) continue;
    const lane = laneY(line.key);
    const color = css.getPropertyValue(line.color).trim();
    const { d, tail } = linePath(lane, stops);
    el('path', { class: 'm-line', d, stroke: color }, svg);
    el('path', { class: 'm-line m-line--future', d: tail, stroke: color }, svg);
    const name = el('text', { class: 'm-name', x: 16, y: lane + 5, fill: color }, svg);
    name.textContent = line.name;
  }

  for (const s of [...stations].sort((a, b) => a.year - b.year)) {
    const a = el('a', { href: `#${s.id}`, class: 'm-station', 'aria-label': `${s.label}, ${Math.floor(s.year)}` }, svg);
    el('circle', { cx: s.x, cy: s.y, r: s.lines.length > 1 ? 12 : 8 }, a);
    const t = el('text', { x: s.x + 10, y: s.y - 16, transform: `rotate(-35 ${s.x + 10} ${s.y - 16})` }, a);
    t.textContent = s.label;
  }

  host.replaceChildren(svg);
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
    drawMap(document.getElementById('map'));
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => drawMap(document.getElementById('map')));
}

drawMap(document.getElementById('map'));
setupTheme();
