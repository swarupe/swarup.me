// Career map layout, shared by the SVG map and the 3D scene.
// Stations come from the page: every element with [data-station].

export const LINES = [
  { key: 'infra', name: 'YELLOW', color: '--yellow' },
  { key: 'product', name: 'PURPLE', color: '--purple' },
  { key: 'data', name: 'GREEN', color: '--green' },
  { key: 'ai', name: 'BLUE', color: '--blue' },
];
export const FIRST_YEAR = 2019;
export const LAST_YEAR = 2027;
export const W = 1200;
export const LANE_TOP = 135;
export const LANE_GAP = 100;
export const AXIS_Y = LANE_TOP + LANE_GAP * LINES.length - 20;
export const H = AXIS_Y + 30;
const X0 = 120;
const X1 = 1080;

export const x = (year) => X0 + ((year - FIRST_YEAR) / (LAST_YEAR - FIRST_YEAR)) * (X1 - X0);
export const laneY = (key) => LANE_TOP + LINES.findIndex((l) => l.key === key) * LANE_GAP;

export function readStations(root = document) {
  return [...root.querySelectorAll('[data-station]')]
    .map((node) => {
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
    })
    .sort((a, b) => a.year - b.year);
}

// A line runs along its lane and bends at 45 degrees into interchanges,
// which sit between the lanes of the lines they join. Returns the built
// route and the dotted "still running" tail, both as [x, y] points.
export function lineRoute(line, stations) {
  const stops = stations.filter((s) => s.lines.includes(line.key));
  if (!stops.length) return null;
  const lane = laneY(line.key);
  const route = [[stops[0].x, stops[0].y]];
  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const s = stops[i];
    route.push([prev.x + Math.abs(prev.y - lane), lane], [s.x - Math.abs(s.y - lane), lane], [s.x, s.y]);
  }
  const last = stops[stops.length - 1];
  const tail = [[last.x, last.y], [last.x + Math.abs(last.y - lane), lane], [x(LAST_YEAR) - 10, lane]];
  return { line, lane, stops, route, tail };
}
