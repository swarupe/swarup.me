// 3D boot: a retro-futuristic monitor in a dark room powers on, runs POST and a boot log,
// then the camera pushes into the glass and hands off to the HTML desktop.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { post, bootLog, person } from './data.js';

/* ---------- timeline (seconds, wall clock) ---------- */
const T = {
  power: 0.55,     // CRT line snaps open
  post: 1.15,      // BIOS header
  count: 1.5,      // commit counter runs
  countEnd: 2.5,
  skills: 2.65,    // one skill line every `skillStep`
  skillStep: 0.12,
  log: 4.6,        // boot log lines
  logStep: 0.15,
  wm: 6.75,        // desktop frame drawn on the tube
  pushStart: 5.9,
  pushEnd: 8.6,
  handoff: 8.6,
};

const SW = 1.6, SH = 1.0;         // screen size (16:10)
const CW = 1280, CH = 800;        // canvas texture size
const SCREEN_Y = 1.08;            // screen centre height above the desk
const SCREEN_Z = 0.135;           // screen plane z in monitor space

const ease = {
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
};
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- screen content (2D canvas) ---------- */
function makeScreen() {
  const canvas = document.createElement('canvas');
  canvas.width = CW; canvas.height = CH;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.minFilter = THREE.LinearMipmapLinearFilter;

  const AMBER = '#ffb054', HI = '#ffe2b8', DIM = '#8a6a45', OK = '#a6f08a', TEAL = '#5fd6c4';
  const M = 'JetBrains Mono', D = 'Chakra Petch';
  const commitTotal = 178 + 70 + 85;
  const year = new Date().getFullYear();

  // Every printable row of the POST + boot log, with the time it appears.
  const rows = [];
  rows.push({ at: T.post, draw: (y) => { txt(`SWARUP BIOS rev ${person.since}.02`, 64, y, HI, 27, 700); } });
  rows.push({ at: T.post + 0.08, draw: (y) => txt(`(C) ${person.since}-${year} ${person.name}. ${person.title}, CDPG, ${person.city}.`, 64, y, DIM, 21) });
  rows.push({ at: T.post + 0.1, draw: () => {} });
  rows.push({ at: T.count, draw: (y, t) => {
    const k = ease.outCubic(seg(t, T.count, T.countEnd));
    const n = Math.round(commitTotal * k);
    txt('Commit memory test :', 64, y, AMBER, 23);
    txt(String(n).padStart(4, ' ') + ' commits', 380, y, HI, 23, 700);
    if (k >= 1) txt('OK', 620, y, OK, 23, 700);
  } });
  rows.push({ at: T.count + 0.05, draw: (y, t) => { if (t >= T.countEnd) txt('178 adaptor + 70 sandbox + 85 file service', 380, y, DIM, 19); } });
  rows.push({ at: T.countEnd + 0.05, draw: () => {} });
  rows.push({ at: T.skills - 0.08, draw: (y) => { txt('Detecting installed hardware', 64, y, AMBER, 23); txt('AREA', 650, y, DIM, 19); txt('STATUS', 860, y, DIM, 19); } });
  post.forEach(([name, area], i) => {
    rows.push({ at: T.skills + i * T.skillStep, draw: (y, t) => {
      const local = t - (T.skills + i * T.skillStep);
      txt(name, 92, y, HI, 23, 500);
      g.font = `400 23px "${M}"`;
      const w = g.measureText(name).width;
      const dots = '.'.repeat(Math.max(3, Math.floor((620 - 92 - w - 22) / 13.85)));
      txt(dots, 92 + w + 11, y, DIM, 23);
      txt(area, 650, y, AREA_COL[area], 21);
      if (local > 0.07) txt('[  OK  ]', 860, y, OK, 23, 700);
      else txt('[ .... ]', 860, y, DIM, 23);
    } });
  });
  rows.push({ at: T.log - 0.12, draw: () => {} });
  rows.push({ at: T.log - 0.1, draw: (y) => txt(`Booting swarup-wm from /dev/cdpg ...`, 64, y, AMBER, 23) });
  bootLog.forEach((line, i) => {
    rows.push({ at: T.log + i * T.logStep, draw: (y) => {
      txt('[', 64, y, HI, 22); txt('  OK  ', 76, y, OK, 22, 700); txt(']', 152, y, HI, 22);
      txt(line, 180, y, HI, 22);
    } });
  });

  const AREA_COL = { backend: '#7cbcff', devops: TEAL, data: AMBER, frontend: '#bda8ff', ml: '#a6f08a' };
  const LH = 31, TOP = 74, BOTTOM = 720;

  function txt(s, x, y, color, size = 22, weight = 400, font = M) {
    g.font = `${weight} ${size}px "${font}"`;
    g.fillStyle = color;
    g.fillText(s, x, y);
  }

  let scroll = 0;
  function drawLog(t) {
    g.fillStyle = '#0b0705';
    g.fillRect(0, 0, CW, CH);
    const visible = rows.filter((r) => t >= r.at);
    const need = Math.max(0, TOP + visible.length * LH - BOTTOM);
    scroll += (need - scroll) * 0.25;
    if (Math.abs(need - scroll) < 0.5) scroll = need;
    g.textBaseline = 'alphabetic';
    // logo badge, scrolls with the text
    const by = 40 - scroll;
    g.strokeStyle = AMBER; g.lineWidth = 2;
    roundRect(1000, by, 216, 118, 10); g.stroke();
    txt('SE', 1024, by + 78, AMBER, 70, 700, D);
    txt('since', 1128, by + 50, DIM, 18);
    txt(String(person.since), 1128, by + 78, HI, 26, 700);
    txt('BLR', 1128, by + 102, DIM, 18);

    visible.forEach((r, i) => r.draw(TOP + i * LH - scroll + 10, t));
    // blinking block cursor under the last row
    if (Math.floor(t * 2.4) % 2 === 0) {
      g.fillStyle = AMBER;
      g.fillRect(64, TOP + visible.length * LH - scroll + 10 - 20, 13, 24);
    }
    // footer
    g.fillStyle = '#0b0705'; g.fillRect(0, CH - 64, CW, 64);
    g.fillStyle = '#2a1d10'; g.fillRect(64, CH - 64, CW - 128, 1);
    txt('ESC  skip boot', 64, CH - 26, DIM, 19);
    txt(`swarup@blr  /  ${post.length} devices  /  ${commitTotal} commits`, 520, CH - 26, DIM, 19);
    return need !== scroll;
  }

  function roundRect(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  // Miniature of the HTML desktop so the hand-off lands on the same layout.
  function drawWm(t) {
    const k = seg(t, T.wm, T.wm + 0.45);
    g.globalAlpha = k;
    const grd = g.createRadialGradient(CW * 0.8, CH * 1.1, 0, CW * 0.8, CH * 1.1, CW * 0.75);
    grd.addColorStop(0, '#2a1a0c'); grd.addColorStop(1, '#08090b');
    g.fillStyle = grd; g.fillRect(0, 0, CW, CH);
    g.lineWidth = 1.5;
    const aspect = innerWidth / innerHeight;
    // Portrait: only a centre column of the tube is on screen at the end of the push, so draw the phone layout there.
    const colW = aspect < 1 ? Math.min(CW, (CW * aspect) / 1.6 * 0.97) : CW;
    const ox = (CW - colW) / 2;
    const u = colW / (aspect < 1 ? innerWidth : CW);
    const gap = (aspect < 1 ? 8 : 12) * u;
    const barH = (aspect < 1 ? 40 : 38) * u;
    // status bar
    g.fillStyle = '#0a0b0d'; g.strokeStyle = '#2a2f37';
    roundRect(ox + gap, gap, colW - gap * 2, barH, 9 * u); g.fill(); g.stroke();
    g.fillStyle = AMBER; roundRect(ox + gap + 6 * u, gap + 7 * u, (aspect < 1 ? 26 : 70) * u, barH - 14 * u, 5 * u); g.fill();
    const fs = 14 * u, by = gap + barH / 2 + fs * 0.36;
    txt(aspect < 1 ? '1' : '1 MAIN', ox + gap + 14 * u, by, '#160e03', fs, 700, D);
    ['2', '3', '4'].forEach((n, i) => txt(n, ox + gap + (aspect < 1 ? 48 : 98) * u + i * 34 * u, by, '#7c838d', fs, 700, D));
    txt('swarup@blr', ox + colW - (aspect < 1 ? 230 : 250) * u, by, TEAL, fs, 600, D);
    if (aspect >= 1) txt('htop', CW / 2 - 16, by, '#d9dce1', 15, 600, D);
    const top = gap + barH + gap, h = CH - top - gap, w = colW - gap * 3;
    const c1 = (w * 1.08) / 2.08, r1 = ((h - gap) * 1.12) / 2.12;
    const panes = aspect < 1 ? [
      [ox + gap, top, colW - gap * 2, CH * 1.2, '$ nvim ~/bio.md'],
    ] : [
      [gap, top, c1, r1, '$ htop'],
      [gap * 2 + c1, top, w - c1, r1, '$ nvim ~/bio.md'],
      [gap, top + r1 + gap, c1, h - r1 - gap, '$ tail -f ~/career.log'],
      [gap * 2 + c1, top + r1 + gap, w - c1, h - r1 - gap, '$ ls -l ~/projects ~/side'],
    ];
    panes.forEach(([x, y, pw, ph, title], i) => {
      const a = ease.outCubic(seg(t, T.wm + 0.15 + i * 0.12, T.wm + 0.55 + i * 0.12));
      if (a <= 0) return;
      g.globalAlpha = k * a;
      g.fillStyle = 'rgba(14,16,20,0.92)';
      g.strokeStyle = i === 0 ? AMBER : '#2a2f37';
      roundRect(x, y, pw, ph, 9 * u); g.fill(); g.stroke();
      txt(title, x + 14 * u, y + 22 * u, i === 0 ? HI : '#d9dce1', 13 * u, 500);
      g.fillStyle = '#22262d'; g.fillRect(x, y + 32 * u, pw, 1);
      // text-like rows
      for (let r = 0; r < Math.floor((Math.min(ph, CH - y) - 50 * u) / (17 * u)); r++) {
        const rw = (0.35 + 0.55 * Math.abs(Math.sin(r * 12.9898 + i * 78.233))) * (pw - 40);
        g.fillStyle = i === 0 && r < 3 ? ['#6fb4ff', '#5fd6c4', '#ffb054'][r] : r % 5 === 0 ? '#3d4450' : '#2a2f37';
        g.globalAlpha = k * a * (i === 0 && r < 3 ? 0.8 : 1);
        g.fillRect(x + 14 * u, y + 46 * u + r * 17 * u, rw * (i === 0 && r < 3 ? 0.6 : 1), 6 * u);
      }
    });
    g.globalAlpha = 1;
  }

  let lastKey = '';
  function update(t) {
    let key;
    if (t < T.post) key = 'blank';
    else if (t < T.wm + 1.2) key = 'live';
    else key = 'wm-final';
    if (key === lastKey && key !== 'live') return;
    lastKey = key;
    if (key === 'blank') { g.fillStyle = '#0b0705'; g.fillRect(0, 0, CW, CH); }
    else {
      if (t < T.wm + 0.45) drawLog(t);
      if (t >= T.wm) drawWm(t);
    }
    tex.needsUpdate = true;
  }

  return { tex, update };
}

/* ---------- CRT shader ---------- */
const screenVert = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const screenFrag = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D map;
  uniform float uTime, uPower, uCurve, uScan, uBright, uGlass;
  vec2 barrel(vec2 uv, float k) {
    vec2 c = uv * 2.0 - 1.0;
    c *= 1.0 + k * vec2(c.y * c.y, c.x * c.x) * 0.16;
    return c * 0.5 + 0.5;
  }
  void main() {
    vec2 uv = barrel(vUv, uCurve);
    vec2 edge = smoothstep(vec2(0.0), vec2(0.006), uv) * smoothstep(vec2(0.0), vec2(0.006), 1.0 - uv);
    float inside = edge.x * edge.y;

    // power-on: a horizontal line that opens vertically
    float px = smoothstep(0.0, 0.28, uPower);
    float py = smoothstep(0.22, 1.0, uPower);
    float cx = abs(uv.x - 0.5) * 2.0, cy = abs(uv.y - 0.5) * 2.0;
    float hy = max(py, 0.006);
    float open = (1.0 - smoothstep(px - 0.02, px, cx)) * (1.0 - smoothstep(hy - 0.01, hy, cy));
    vec2 suv = vec2(uv.x, 0.5 + (uv.y - 0.5) / hy);

    float ab = 0.0011 * uCurve;
    vec3 col;
    col.r = texture2D(map, suv + vec2(ab, 0.0)).r;
    col.g = texture2D(map, suv).g;
    col.b = texture2D(map, suv - vec2(ab, 0.0)).b;

    // scanlines and aperture mask
    float s = 0.5 + 0.5 * sin(uv.y * 800.0 * 3.14159265);
    col *= mix(1.0, 0.68 + 0.32 * s, uScan);
    float m = mod(gl_FragCoord.x, 3.0);
    vec3 mask = vec3(m < 1.0 ? 1.0 : 0.72, (m >= 1.0 && m < 2.0) ? 1.0 : 0.72, m >= 2.0 ? 1.0 : 0.72);
    col *= mix(vec3(1.0), mask, uScan * 0.55);

    // phosphor floor, rolling refresh band, flicker
    col += vec3(0.018, 0.010, 0.004) * uPower;
    col *= 1.0 + 0.035 * uScan * sin(uv.y * 6.0 - uTime * 3.0);
    col *= 1.0 - 0.012 * uScan * sin(uTime * 120.0);

    // the flash of the line as the tube opens
    float flash = exp(-cy * cy / (hy * hy * 0.25 + 1e-4)) * (1.0 - py) * 1.6 * px;

    // vignette
    float v = 1.0 - 0.45 * uCurve * pow(clamp(length(vec2(cx, cy)) / 1.41, 0.0, 1.0), 2.6);

    vec3 c = (col * uBright * v + vec3(1.0, 0.82, 0.62) * flash) * open * inside;

    // glass: soft reflection band and edge sheen, present even when the tube is off
    float band = smoothstep(0.55, 0.0, length((vUv - vec2(0.22, 0.86)) * vec2(1.0, 2.2)));
    float sheen = pow(1.0 - min(edge.x, edge.y), 6.0) * 0.0;
    c += vec3(0.10, 0.11, 0.13) * band * uGlass + sheen;
    gl_FragColor = vec4(c, 1.0);
  }
`;

/* ---------- scene ---------- */
export async function startBoot({ container, phaseEl, skipEl, onStarted, onHandoff, onDone }) {
  const root = document.documentElement;
  if (!root.classList.contains('booting')) { onDone(); return; }
  onStarted();

  await Promise.race([
    Promise.all([
      document.fonts.load('400 22px "JetBrains Mono"'),
      document.fonts.load('700 22px "JetBrains Mono"'),
      document.fonts.load('700 22px "Chakra Petch"'),
    ]),
    new Promise((r) => setTimeout(r, 2500)),
  ]).catch(() => {});

  const phone = Math.min(innerWidth, innerHeight) < 600;
  const dpr = Math.min(devicePixelRatio || 1, phone ? 1.5 : 2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  RectAreaLightUniformsLib.init();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030304);
  scene.fog = new THREE.FogExp2(0x030304, 0.085);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.12;

  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.02, 60);

  /* materials */
  const shell = new THREE.MeshPhysicalMaterial({ color: 0xd6cfc0, roughness: 0.48, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.3, sheenColor: new THREE.Color(0xfff2dd) });
  const shellDark = new THREE.MeshPhysicalMaterial({ color: 0x17181b, roughness: 0.35, metalness: 0.2, clearcoat: 0.6 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.85 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8c8f96, roughness: 0.25, metalness: 1 });

  /* monitor */
  const monitor = new THREE.Group();
  scene.add(monitor);
  const HW = SW + 0.36, HH = SH + 0.5;
  const housing = new THREE.Mesh(new RoundedBoxGeometry(HW, HH, 0.24, 8, 0.09), shell);
  housing.position.set(0, SCREEN_Y - 0.06, 0);
  monitor.add(housing);
  // tapered tube housing behind the face
  const rearGeo = new RoundedBoxGeometry(HW * 0.94, HH * 0.92, 0.9, 8, 0.16);
  const p = rearGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    const k = 1 - 0.42 * clamp01((0.45 - z) / 0.9);
    p.setX(i, p.getX(i) * k);
    p.setY(i, p.getY(i) * k + (1 - k) * 0.12);
  }
  rearGeo.computeVertexNormals();
  const rear = new THREE.Mesh(rearGeo, shell);
  rear.position.set(0, SCREEN_Y - 0.06, -0.5);
  monitor.add(rear);
  // vents on the rear top
  for (let i = 0; i < 9; i++) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.012, 0.03), rubber);
    v.position.set(0, SCREEN_Y + HH * 0.36, -0.42 - i * 0.055);
    v.rotation.x = -0.12;
    monitor.add(v);
  }
  // inner dark bezel around the glass
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(SW + 0.1, SH + 0.1, 0.04, 4, 0.03), shellDark);
  bezel.position.set(0, SCREEN_Y, 0.11);
  monitor.add(bezel);
  // chin details: a power LED, two knobs, an engraved label
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x1a0e04 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), ledMat);
  led.position.set(HW / 2 - 0.2, SCREEN_Y - SH / 2 - 0.15, 0.122);
  monitor.add(led);
  [0, 1].forEach((i) => {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.038, 0.035, 32), metal);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(HW / 2 - 0.34 - i * 0.11, SCREEN_Y - SH / 2 - 0.15, 0.13);
    monitor.add(knob);
  });
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 512; labelCanvas.height = 64;
  const lg = labelCanvas.getContext('2d');
  lg.fillStyle = '#5d574c';
  lg.font = '700 34px "Chakra Petch", sans-serif';
  lg.fillText('SWARUP  SE-2019', 4, 44);
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.0625), new THREE.MeshStandardMaterial({ map: labelTex, transparent: true, roughness: 0.6 }));
  label.position.set(-HW / 2 + 0.38, SCREEN_Y - SH / 2 - 0.15, 0.121);
  monitor.add(label);
  // stand
  const neck = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.36, 0.3, 4, 0.05), shell);
  neck.position.set(0, 0.2, -0.25);
  monitor.add(neck);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.07, 72), shell);
  base.scale.z = 0.62;
  base.position.set(0, 0.035, -0.22);
  monitor.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.645, 0.008, 8, 96), shellDark);
  ring.rotation.x = Math.PI / 2; ring.scale.y = 0.62; ring.position.set(0, 0.04, -0.22);
  monitor.add(ring);

  /* screen */
  const screen = makeScreen();
  const sGeo = new THREE.PlaneGeometry(SW, SH, 48, 30);
  const sp = sGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i) / (SW / 2), y = sp.getY(i) / (SH / 2);
    sp.setZ(i, 0.035 * (1 - x * x * 0.85) * (1 - y * y * 0.85));
  }
  sGeo.computeVertexNormals();
  const uniforms = {
    map: { value: screen.tex }, uTime: { value: 0 }, uPower: { value: 0 }, uCurve: { value: 1 },
    uScan: { value: 1 }, uBright: { value: 1.55 }, uGlass: { value: 1 },
  };
  const sMat = new THREE.ShaderMaterial({ uniforms, vertexShader: screenVert, fragmentShader: screenFrag, toneMapped: true });
  const glass = new THREE.Mesh(sGeo, sMat);
  glass.position.set(0, SCREEN_Y, SCREEN_Z);
  monitor.add(glass);

  /* keyboard */
  const kb = new THREE.Group();
  kb.position.set(0, 0, 1.05);
  kb.rotation.x = 0.05;
  scene.add(kb);
  const kbBase = new THREE.Mesh(new RoundedBoxGeometry(1.46, 0.06, 0.5, 4, 0.025), shell);
  kbBase.position.y = 0.03;
  kb.add(kbBase);
  const keyGeo = new RoundedBoxGeometry(0.078, 0.034, 0.078, 2, 0.012);
  const keyMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.55, clearcoat: 0.2 });
  const cols = 15, rowsN = 4;
  const keys = new THREE.InstancedMesh(keyGeo, keyMat, cols * rowsN + 1);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  let ki = 0;
  for (let r = 0; r < rowsN; r++) for (let c = 0; c < cols; c++) {
    m4.makeTranslation(-0.62 + c * 0.0885 + (r % 2) * 0.02, 0.075, -0.16 + r * 0.088);
    keys.setMatrixAt(ki, m4);
    const accent = (r === 0 && c === 0) || (r === 2 && c === cols - 1);
    keys.setColorAt(ki, col.set(accent ? 0xff9a3c : (c > 11 || r === 0) ? 0x9c968a : 0xd8d1c3));
    ki++;
  }
  m4.compose(new THREE.Vector3(0, 0.075, 0.195), new THREE.Quaternion(), new THREE.Vector3(6.2, 1, 1));
  keys.setMatrixAt(ki, m4); keys.setColorAt(ki, col.set(0xd8d1c3));
  kb.add(keys);

  /* room: desk with reflection, back wall */
  if (!phone) {
    const refl = new Reflector(new THREE.PlaneGeometry(14, 10), {
      clipBias: 0.003, textureWidth: Math.floor(innerWidth * dpr * 0.5), textureHeight: Math.floor(innerHeight * dpr * 0.5), color: 0x5a5a5a,
    });
    refl.rotation.x = -Math.PI / 2;
    refl.position.y = -0.001;
    scene.add(refl);
  }
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshPhysicalMaterial({
    color: 0x0b0c0f, roughness: 0.3, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.25,
    transparent: !phone, opacity: phone ? 1 : 0.8,
  }));
  desk.rotation.x = -Math.PI / 2;
  desk.position.y = 0.001;
  scene.add(desk);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.92 }));
  wall.position.set(0, 4, -3.2);
  scene.add(wall);

  /* lights */
  const screenLight = new THREE.RectAreaLight(0xffb36a, 0, SW, SH);
  screenLight.position.set(0, SCREEN_Y, SCREEN_Z + 0.05);
  screenLight.lookAt(0, SCREEN_Y, 5);
  scene.add(screenLight);
  const rim = new THREE.SpotLight(0x5fd6c4, 70, 6.4, 0.4, 0.9, 1.6);
  rim.position.set(3.2, 3.4, -2.6);
  rim.target.position.set(0, 1.5, -0.5);
  scene.add(rim, rim.target);
  const key = new THREE.SpotLight(0xffe9d2, 14, 16, 0.5, 1, 1.6);
  key.position.set(-3.4, 4.2, 3.4);
  key.target.position.set(0, 0.7, 0);
  scene.add(key, key.target);
  const wallWash = new THREE.SpotLight(0xff9a4a, 18, 10, 0.7, 1, 1.4);
  wallWash.position.set(-1.8, 0.3, -1.2);
  wallWash.target.position.set(-1.0, 2.2, -3.2);
  scene.add(wallWash, wallWash.target);
  scene.add(new THREE.HemisphereLight(0x1d2a33, 0x050404, 0.35));

  /* dust in the light */
  const dustN = phone ? 140 : 380;
  const dustPos = new Float32Array(dustN * 3);
  const dustSeed = new Float32Array(dustN);
  for (let i = 0; i < dustN; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 3.2;
    dustPos[i * 3 + 1] = Math.random() * 2.4;
    dustPos[i * 3 + 2] = Math.random() * 2.6 - 0.2;
    dustSeed[i] = Math.random() * 100;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('seed', new THREE.BufferAttribute(dustSeed, 1));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uGlow: { value: 0 }, uScale: { value: innerHeight * dpr * 0.5 } },
    vertexShader: /* glsl */`
      attribute float seed; uniform float uTime, uScale; varying float vA;
      void main() {
        vec3 p = position;
        p.y = mod(p.y + uTime * 0.03, 2.4);
        p.x += sin(uTime * 0.2 + seed) * 0.08;
        p.z += cos(uTime * 0.17 + seed * 1.3) * 0.08;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.9 + fract(seed) * 1.6) * uScale * 0.006 / -mv.z;
        float nearScreen = exp(-abs(p.x) * 0.8) * exp(-abs(p.y - 1.08) * 0.9);
        vA = nearScreen * (0.35 + 0.65 * fract(seed * 7.13));
      }`,
    fragmentShader: /* glsl */`
      uniform float uGlow; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA * uGlow;
        gl_FragColor = vec4(vec3(1.0, 0.78, 0.5) * a, a);
      }`,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  /* post */
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(dpr);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.75, 0.55, 0.62);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* camera path */
  const target = new THREE.Vector3(0, SCREEN_Y, SCREEN_Z);
  const startLook = new THREE.Vector3(0.05, 0.82, 0);
  const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3();
  function framing() {
    const aspect = innerWidth / innerHeight;
    const portrait = aspect < 1;
    const startA = portrait ? new THREE.Vector3(-1.5, 2.1, 8.6) : new THREE.Vector3(-2.6, 1.75, 5.2);
    const startB = portrait ? new THREE.Vector3(-0.9, 1.85, 7.8) : new THREE.Vector3(-1.75, 1.5, 4.6);
    const vt = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dH = (SH / 2) / vt;
    const dW = (SW / 2) / (vt * aspect);
    const d = Math.min(dH, dW) * (portrait ? 0.97 : 0.995);
    return { startA, startB, end: new THREE.Vector3(0, SCREEN_Y, SCREEN_Z + 0.035 + d) };
  }
  let frame = framing();

  function placeCamera(t) {
    const drift = ease.inOutCubic(seg(t, 0, T.pushStart + 1));
    tmpPos.lerpVectors(frame.startA, frame.startB, drift);
    tmpPos.x += Math.sin(t * 0.35) * 0.04;
    tmpPos.y += Math.sin(t * 0.27) * 0.025;
    const k = ease.inOutQuint(seg(t, T.pushStart, T.pushEnd));
    camera.position.lerpVectors(tmpPos, frame.end, k);
    tmpLook.lerpVectors(startLook, target, ease.inOutCubic(seg(t, T.pushStart - 0.4, T.pushEnd - 0.2)));
    camera.lookAt(tmpLook);
  }

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    dustMat.uniforms.uScale.value = innerHeight * dpr * 0.5;
    frame = framing();
  }
  addEventListener('resize', onResize);

  /* state + loop */
  let t0 = null, frozen = null, ended = false, raf = 0, lastPhase = '';
  const phases = [[0, 'power'], [T.post, 'post'], [T.log, 'boot log'], [T.wm, 'swarup-wm']];

  function apply(t) {
    // power and tube
    const pw = seg(t, T.power, T.power + 0.6);
    uniforms.uPower.value = pw;
    uniforms.uTime.value = t;
    const flat = ease.inOutCubic(seg(t, T.pushEnd - 1.2, T.pushEnd));
    uniforms.uCurve.value = 1 - flat;
    uniforms.uScan.value = 1 - flat * 0.85;
    uniforms.uGlass.value = 1 - flat;
    uniforms.uBright.value = lerp(1.55, 1.0, flat);
    ledMat.color.set(pw > 0 ? 0x7dff6a : 0x1a0e04);
    screenLight.intensity = 9 * pw * (0.96 + 0.04 * Math.sin(t * 40));
    dustMat.uniforms.uGlow.value = pw * (1 - flat);
    dustMat.uniforms.uTime.value = t;
    bloom.strength = lerp(0.75, 0.25, flat);
    screen.update(t);
    placeCamera(t);
    const ph = phases.filter(([a]) => t >= a).pop()[1];
    if (ph !== lastPhase) { lastPhase = ph; if (phaseEl) phaseEl.textContent = ph; }
  }

  function render(now) {
    raf = requestAnimationFrame(render);
    if (t0 === null) t0 = now;
    const t = frozen !== null ? frozen : (now - t0) / 1000;
    apply(t);
    composer.render();
    window.__frames = (window.__frames || 0) + 1;
    if (frozen === null && t >= T.handoff) finish(false);
  }

  function finish(skipped) {
    if (ended) return;
    ended = true;
    removeEventListener('keydown', onKey);
    onHandoff();
    setTimeout(() => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      renderer.dispose();
      renderer.domElement.remove();
      onDone();
    }, skipped ? 520 : 620);
  }
  function onKey(e) { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); finish(true); } }
  addEventListener('keydown', onKey);
  skipEl.addEventListener('click', () => finish(true));

  // Test hooks: freeze the sequence at a given second, or resume wall-clock playback.
  window.__boot = {
    pause(t) { frozen = t; },
    resume() { if (frozen !== null) { t0 = performance.now() - frozen * 1000; frozen = null; } },
    skip: () => finish(true),
    T,
  };

  apply(0);
  raf = requestAnimationFrame(render);
}
