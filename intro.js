// 3D intro: a dark workstation. The keyboard types `swc swarup.src --release`, the monitor
// runs the build, then the camera pushes into the glass. The last frame on the screen is a
// pixel-mapped copy of the hero, so the hand-off lands on the real page.
// Every number on the screen comes from data.js or source.js.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { PALETTE, LIBS, TREE, COMMITS } from './data.js';

const COMMAND = 'swc swarup.src --release';

/* ---------- story timeline (seconds). The clock holds at LINK until the site is ready. ---------- */
const T = {
  power: 0.45,
  type: 1.0, typeStep: 0.055,
  enter: 1.0 + COMMAND.length * 0.055 + 0.18,
};
T.self = T.enter + 0.15;
T.probe = T.self + 0.22; T.probeStep = 0.035;
T.index = T.probe + LIBS.length * T.probeStep + 0.12; T.indexEnd = T.index + 0.6;
T.compile = T.indexEnd + 0.12; T.compileStep = 0.09;
T.dead = T.compile + 6 * T.compileStep + 0.08;
T.link = T.dead + 0.22;
T.hold = T.link + 0.25;
T.finish = T.hold + 0.12;
T.run = T.finish + 0.18;
T.hero = T.run + 0.4;
T.pushStart = T.run + 0.05;
T.pushEnd = T.pushStart + 2.5;

const SW = 1.6, SH = 1.0, CW = 1280, CH = 800;
const SCREEN_Y = 1.12, SCREEN_Z = 0.05;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = {
  io3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  io5: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  out3: (t) => 1 - Math.pow(1 - t, 3),
};
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const C = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, hex(v)]));
const INK = '#dfe3ee', INK2 = '#a3abc0', INK3 = '#6b7490';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

/* ---------- the monitor's screen: a 2D canvas ---------- */
function makeScreen({ deadBytes, finishedIn }) {
  const canvas = document.createElement('canvas');
  canvas.width = CW; canvas.height = CH;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const total = COMMITS.reduce((a, [, n]) => a + n, 0);
  const areas = TREE.children.filter((a) => !a.dead);
  const FS = 22, LH = 33, X0 = 64, VX = 236, TX = 262, TOP = 112;

  const txt = (s, x, y, color, size = FS, weight = 400, align = 'left', font = MONO) => {
    g.font = `${weight} ${size}px ${font}`;
    g.fillStyle = color; g.textAlign = align;
    g.fillText(s, x, y);
    return g.measureText(s).width;
  };
  const rr = (x, y, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  };
  const verb = (v, y, color = C.str) => txt(v, VX, y, color, FS, 700, 'right');

  // Lay the library chips out once, wrapped to the terminal width.
  g.font = `500 17px ${MONO}`;
  const chips = [];
  let cx = TX, row = 0;
  for (const [name, ck] of LIBS) {
    const w = g.measureText(name).width + 22;
    if (cx + w > CW - 64) { cx = TX; row++; }
    chips.push({ name, color: C[ck], x: cx, row, w });
    cx += w + 9;
  }
  const chipRows = row + 1;

  function drawLog(t) {
    const bg = g.createLinearGradient(0, 0, 0, CH);
    bg.addColorStop(0, '#0a0c13'); bg.addColorStop(1, '#06070b');
    g.fillStyle = bg; g.fillRect(0, 0, CW, CH);
    const glow = g.createRadialGradient(CW * 0.85, 0, 0, CW * 0.85, 0, CW * 0.7);
    glow.addColorStop(0, 'rgba(127,212,255,0.10)'); glow.addColorStop(1, 'rgba(127,212,255,0)');
    g.fillStyle = glow; g.fillRect(0, 0, CW, CH);

    // window bar
    g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(0, 0, CW, 58);
    g.fillStyle = 'rgba(160,175,215,0.14)'; g.fillRect(0, 58, CW, 1.5);
    [C.kw, C.num, C.str].forEach((c, i) => { g.fillStyle = c; g.globalAlpha = 0.85; g.beginPath(); g.arc(40 + i * 24, 29, 7, 0, 7); g.fill(); });
    g.globalAlpha = 1;
    txt('swc', 132, 37, INK, 19, 700);
    txt('self-test', 178, 37, INK3, 19);
    txt('swarup@cdpg  ~/swarup.src', CW - 40, 37, C.teal, 18, 500, 'right');

    let y = TOP;
    const line = () => { const v = y; y += LH; return v; };
    // the typed command
    const typed = Math.floor(seg(t, T.type, T.type + COMMAND.length * T.typeStep) * COMMAND.length);
    let ly = line();
    let w = txt('$ ', X0, ly, C.str, FS, 700);
    const shown = COMMAND.slice(0, typed);
    txt(shown, X0 + w, ly, INK, FS);
    g.font = `400 ${FS}px ${MONO}`;
    const caretX = X0 + w + g.measureText(shown).width + 2;
    if (t < T.enter && Math.floor(t * 2.6) % 2 === 0) { g.fillStyle = C.str; g.fillRect(caretX, ly - 19, 12, 24); }
    if (t < T.self) return;

    ly = line(); verb('self-test', ly); txt('toolchain ................ ok', TX, ly, INK);
    if (t < T.probe) return;
    ly = line(); verb('Probing', ly); txt(`${LIBS.length} targets`, TX, ly, INK);
    const chipTop = y - 8;
    chips.forEach((c, i) => {
      const k = ease.out3(seg(t, T.probe + i * T.probeStep, T.probe + i * T.probeStep + 0.2));
      if (k <= 0) return;
      const cy = chipTop + c.row * 38 + (1 - k) * 6;
      g.globalAlpha = k;
      rr(c.x, cy, c.w, 28, 6);
      g.fillStyle = c.color + '18'; g.fill();
      g.strokeStyle = c.color + '88'; g.lineWidth = 1.5; g.stroke();
      txt(c.name, c.x + 11, cy + 20, c.color, 17, 500);
      g.globalAlpha = 1;
    });
    y += chipRows * 38 + 12;
    if (t < T.index) return;

    const n = Math.round(total * ease.out3(seg(t, T.index, T.indexEnd)));
    ly = line(); verb('Indexing', ly);
    w = txt('swarup.src  ', TX, ly, INK);
    const nw = txt(String(n), TX + w, ly, C.num, FS, 700);
    txt(' commits', TX + w + nw, ly, INK);
    if (t >= T.indexEnd) { ly = line(); txt(`${COMMITS.map(([, c]) => c).join(' + ')} across ${COMMITS.length} repos`, TX, ly, INK3); }
    if (t < T.compile) return;

    areas.forEach((a, i) => {
      if (t < T.compile + i * T.compileStep) return;
      ly = line();
      if (i === 0) verb('Compiling', ly);
      const aw = txt(a.label.toLowerCase(), TX, ly, C[a.color]);
      txt(` (${a.children.length} units)`, TX + aw, ly, INK3);
    });
    if (t < T.dead) return;
    ly = line(); verb('Removing', ly, C.kw);
    w = txt('dead', TX, ly, C.kw);
    w += txt(' { 2017, 2018 }  ', TX + w, ly, INK);
    txt(`${deadBytes} B`, TX + w, ly, C.num);
    if (t < T.link) return;
    ly = line(); verb('Linking', ly);
    w = txt('three.js 0.169.0, shaders, fonts ', TX, ly, INK);
    if (t < T.finish) txt('|/-\\'[Math.floor(performance.now() / 110) % 4], TX + w + 4, ly, C.num);
    if (t < T.finish) return;
    ly = line(); verb('Finished', ly);
    txt(`release [optimized] target in ${finishedIn()}s`, TX, ly, INK);
    if (t < T.run) return;
    ly = line(); verb('Running', ly);
    txt('./swarup.bin', TX, ly, C.str);
  }

  // The hero, drawn from the live DOM so the final frame matches the page under it.
  // At the end of the push, the visible part of the screen is the centre crop with the
  // viewport's aspect ratio, so viewport pixels map into that crop.
  let heroCanvas = null;
  function buildHero() {
    const hc = document.createElement('canvas');
    hc.width = CW; hc.height = CH;
    const h = hc.getContext('2d');
    const vw = innerWidth, vh = innerHeight, aspect = vw / vh;
    const cropW = aspect < CW / CH ? CH * aspect : CW;
    const cropH = cropW / aspect;
    const ox = (CW - cropW) / 2, oy = (CH - cropH) / 2, u = cropW / vw;
    h.fillStyle = C.bg; h.fillRect(0, 0, CW, CH);
    const glow = h.createRadialGradient(ox + cropW * 0.78, oy + cropH * 0.18, 0, ox + cropW * 0.78, oy + cropH * 0.18, cropW * 0.8);
    glow.addColorStop(0, 'rgba(127,212,255,0.06)'); glow.addColorStop(1, 'rgba(127,212,255,0)');
    h.fillStyle = glow; h.fillRect(0, 0, CW, CH);
    h.textBaseline = 'middle';
    const X = (x) => ox + x * u, Y = (y) => oy + y * u;
    const style = (el) => getComputedStyle(el);
    // Draw each text node of an element at its own client rects, in its own font and colour.
    const drawText = (el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!node.textContent.trim()) continue;
        const cs = style(parent);
        if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
        h.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * u}px ${cs.fontFamily}`;
        h.fillStyle = cs.color;
        h.letterSpacing = `${(parseFloat(cs.letterSpacing) || 0) * u}px`;
        const transform = cs.textTransform === 'uppercase' ? (s) => s.toUpperCase() : (s) => s;
        // one rect per wrapped line: measure word by word so each line lands where the browser put it
        const words = node.textContent.split(/(\s+)/);
        const range = document.createRange();
        let offset = 0;
        for (const word of words) {
          if (word.trim()) {
            range.setStart(node, offset); range.setEnd(node, offset + word.length);
            const r = range.getBoundingClientRect();
            if (r.width) h.fillText(transform(word), X(r.left), Y(r.top + r.height / 2));
          }
          offset += word.length;
        }
      }
    };
    const box = (el, fill, stroke, radius) => {
      const r = el.getBoundingClientRect();
      h.beginPath(); h.roundRect(X(r.left), Y(r.top), r.width * u, r.height * u, radius * u);
      if (fill) { h.fillStyle = fill; h.fill(); }
      if (stroke) { h.strokeStyle = stroke; h.lineWidth = Math.max(1, u); h.stroke(); }
    };
    const editor = document.querySelector('.editor');
    if (editor) {
      box(editor, 'rgba(13,15,23,0.9)', 'rgba(160,175,215,0.16)', 14);
      const bar = editor.querySelector('.editor-bar').getBoundingClientRect();
      h.fillStyle = 'rgba(160,175,215,0.14)'; h.fillRect(X(bar.left), Y(bar.bottom), bar.width * u, Math.max(1, u));
      editor.querySelectorAll('.lights i').forEach((i) => box(i, '#262b3a', null, 5));
      box(editor.querySelector('.editor-tab'), 'rgba(255,255,255,0.05)', null, 5);
      // line numbers are CSS counters, so draw them from the line boxes
      h.font = `400 ${12.4 * u}px ${MONO}`; h.fillStyle = '#3a4258'; h.textAlign = 'right';
      editor.querySelectorAll('.code .ln').forEach((ln, i) => {
        const r = ln.getBoundingClientRect();
        const pad = parseFloat(style(ln).paddingLeft);
        h.fillText(String(i + 1), X(r.left + pad - 18), Y(r.top + r.height / 2));
      });
      h.textAlign = 'left';
      drawText(editor);
    }
    const line = document.querySelector('.scroll-line');
    if (line) { const r = line.getBoundingClientRect(); const lg = h.createLinearGradient(X(r.left), 0, X(r.right), 0); lg.addColorStop(0, C.str); lg.addColorStop(1, 'rgba(0,0,0,0)'); h.fillStyle = lg; h.fillRect(X(r.left), Y(r.top), r.width * u, Math.max(1, u)); }
    document.querySelectorAll('.hero-copy, .hud').forEach(drawText);
    const dot = document.querySelector('.hud-dot');
    if (dot) box(dot, C.str, null, 8);
    h.letterSpacing = '0px';
    heroCanvas = hc;
  }

  let last = -1;
  function update(t) {
    const key = t < T.power ? 'off' : t >= T.hero + 0.45 ? 'hero' : 'live';
    if (key !== 'live' && key === last) return;
    last = key;
    if (key === 'off') { g.fillStyle = '#05060a'; g.fillRect(0, 0, CW, CH); }
    else {
      if (t < T.hero + 0.45) drawLog(t);
      if (t >= T.hero) {
        if (!heroCanvas) buildHero();
        g.globalAlpha = ease.io3(seg(t, T.hero, T.hero + 0.45));
        g.drawImage(heroCanvas, 0, 0);
        g.globalAlpha = 1;
      }
    }
    tex.needsUpdate = true;
  }
  return { tex, update, rebuildHero: () => { heroCanvas = null; last = -1; } };
}

/* ---------- panel shader: power-on line, subpixel mask, glass ---------- */
const screenVert = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const screenFrag = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D map;
  uniform float uTime, uPower, uMask, uBright, uGlass;
  void main() {
    vec2 uv = vUv;
    float px = smoothstep(0.0, 0.3, uPower);
    float py = smoothstep(0.25, 1.0, uPower);
    float cx = abs(uv.x - 0.5) * 2.0, cy = abs(uv.y - 0.5) * 2.0;
    float hy = max(py, 0.006);
    float open = (1.0 - smoothstep(px - 0.02, px, cx)) * (1.0 - smoothstep(hy - 0.01, hy, cy));
    vec2 suv = vec2(uv.x, 0.5 + (uv.y - 0.5) / hy);
    vec3 col = texture2D(map, suv).rgb;
    // subpixel stripes, only visible up close
    float m = mod(gl_FragCoord.x, 3.0);
    vec3 mask = vec3(m < 1.0 ? 1.0 : 0.8, (m >= 1.0 && m < 2.0) ? 1.0 : 0.8, m >= 2.0 ? 1.0 : 0.8);
    col *= mix(vec3(1.0), mask, uMask * 0.5);
    col *= 1.0 + 0.02 * uMask * sin(uv.y * 5.0 - uTime * 2.0);
    float flash = exp(-cy * cy / (hy * hy * 0.25 + 1e-4)) * (1.0 - py) * 1.8 * px;
    vec3 c = (col * uBright + vec3(0.62, 0.86, 1.0) * flash) * open;
    // a soft diagonal reflection on the glass
    float band = smoothstep(0.5, 0.0, abs((vUv.x - vUv.y * 0.6) - 0.05)) * smoothstep(1.0, 0.4, vUv.y);
    c += vec3(0.05, 0.06, 0.08) * band * uGlass;
    gl_FragColor = vec4(c, 1.0);
  }
`;

/* ---------- keyboard layout: a 60% board, [label, width in units] ---------- */
const ROWS = [
  [['esc', 1], ...'1234567890-='.split('').map((k) => [k, 1]), ['bksp', 2]],
  [['tab', 1.5], ...'qwertyuiop[]'.split('').map((k) => [k, 1]), ['\\', 1.5]],
  [['caps', 1.75], ...'asdfghjkl;\''.split('').map((k) => [k, 1]), ['enter', 2.25]],
  [['shift', 2.25], ...'zxcvbnm,./'.split('').map((k) => [k, 1]), ['rshift', 2.75]],
  [['ctrl', 1.25], ['super', 1.25], ['alt', 1.25], ['space', 6.25], ['ralt', 1.25], ['fn', 1.25], ['menu', 1.25], ['rctrl', 1.25]],
];

export async function runIntro({ ready, startScene, onHandoff, deadBytes }) {
  const root = document.documentElement;
  const phone = Math.min(innerWidth, innerHeight) < 600;
  const dpr = Math.min(devicePixelRatio || 1, phone ? 1.5 : 2);
  const t0 = performance.now();
  let isReady = false, finishedAt = 0;
  ready.finally(() => { isReady = true; });

  await Promise.race([
    Promise.all(['400 22px "JetBrains Mono"', '700 22px "JetBrains Mono"', '400 80px "Instrument Serif"', 'italic 400 80px "Instrument Serif"'].map((f) => document.fonts.load(f))),
    new Promise((r) => setTimeout(r, 2500)),
  ]).catch(() => {});

  /* overlay */
  const wrap = document.createElement('div');
  wrap.className = 'intro';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = '<p class="intro-phase"><span class="hud-dot"></span>swc <span id="intro-phase">power</span></p><button class="intro-skip" type="button">skip <kbd>esc</kbd></button>';
  document.body.appendChild(wrap);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  wrap.prepend(renderer.domElement);

  RectAreaLightUniformsLib.init();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030305);
  scene.fog = new THREE.FogExp2(0x030305, 0.08);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.16;
  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.02, 60);

  /* materials */
  const graphite = new THREE.MeshPhysicalMaterial({ color: 0x14161c, roughness: 0.38, metalness: 0.55, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const alu = new THREE.MeshStandardMaterial({ color: 0x8d93a0, roughness: 0.28, metalness: 1 });
  const black = new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.6 });

  /* monitor: slim panel on an aluminium stand */
  const monitor = new THREE.Group();
  scene.add(monitor);
  const HW = SW + 0.07, HH = SH + 0.1;
  const panel = new THREE.Mesh(new RoundedBoxGeometry(HW, HH + 0.06, 0.07, 6, 0.025), graphite);
  panel.position.set(0, SCREEN_Y - 0.03, 0);
  monitor.add(panel);
  const back = new THREE.Mesh(new RoundedBoxGeometry(HW * 0.8, HH * 0.7, 0.12, 6, 0.05), graphite);
  back.position.set(0, SCREEN_Y - 0.02, -0.08);
  monitor.add(back);
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(SW + 0.03, SH + 0.03), black);
  bezel.position.set(0, SCREEN_Y, 0.0365);
  monitor.add(bezel);
  // light strip on the back: washes the wall in the syntax colours
  const stripCanvas = document.createElement('canvas');
  stripCanvas.width = 256; stripCanvas.height = 4;
  const sg = stripCanvas.getContext('2d');
  const sgr = sg.createLinearGradient(0, 0, 256, 0);
  ['id', 'op', 'kw', 'num', 'str', 'teal'].forEach((k, i, a) => sgr.addColorStop(i / (a.length - 1), C[k]));
  sg.fillStyle = sgr; sg.fillRect(0, 0, 256, 4);
  const stripTex = new THREE.CanvasTexture(stripCanvas);
  stripTex.colorSpace = THREE.SRGBColorSpace;
  stripTex.wrapS = THREE.RepeatWrapping;
  const glowMat = new THREE.MeshBasicMaterial({ map: stripTex, color: new THREE.Color(1, 1, 1).multiplyScalar(0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(HW * 0.78, 0.018), glowMat);
  strip.position.set(0, SCREEN_Y + HH * 0.34, -0.145);
  strip.rotation.y = Math.PI;
  monitor.add(strip);
  // chin mark
  const markCanvas = document.createElement('canvas');
  markCanvas.width = 256; markCanvas.height = 48;
  const mg = markCanvas.getContext('2d');
  mg.font = `600 30px ${MONO}`; mg.fillStyle = '#4a5166'; mg.textAlign = 'center';
  mg.fillText('swc', 128, 34);
  const markTex = new THREE.CanvasTexture(markCanvas);
  markTex.colorSpace = THREE.SRGBColorSpace;
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.03), new THREE.MeshBasicMaterial({ map: markTex, transparent: true }));
  mark.position.set(0, SCREEN_Y - SH / 2 - 0.045, 0.0362);
  monitor.add(mark);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x0a0d0a });
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.006, 16), ledMat);
  led.position.set(HW / 2 - 0.08, SCREEN_Y - SH / 2 - 0.045, 0.0363);
  monitor.add(led);
  // stand: a flat neck and a thin plate
  const neck = new THREE.Mesh(new RoundedBoxGeometry(0.2, SCREEN_Y - 0.2, 0.05, 4, 0.02), alu);
  neck.position.set(0, (SCREEN_Y - 0.2) / 2 + 0.02, -0.2);
  neck.rotation.x = -0.08;
  monitor.add(neck);
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.02, 0.42, 4, 0.01), alu);
  plate.position.set(0, 0.01, -0.18);
  monitor.add(plate);

  /* screen */
  const screen = makeScreen({ deadBytes, finishedIn: () => (finishedAt / 1000).toFixed(2) });
  const uniforms = {
    map: { value: screen.tex }, uTime: { value: 0 }, uPower: { value: 0 },
    uMask: { value: 1 }, uBright: { value: 1.35 }, uGlass: { value: 1 },
  };
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.ShaderMaterial({ uniforms, vertexShader: screenVert, fragmentShader: screenFrag }));
  glass.position.set(0, SCREEN_Y, SCREEN_Z - 0.013);
  monitor.add(glass);

  /* keyboard */
  const kb = new THREE.Group();
  kb.position.set(0, 0, 1.0);
  kb.rotation.x = 0.06;
  scene.add(kb);
  const U = 0.083, KW = 15 * U;
  const kbCase = new THREE.Mesh(new RoundedBoxGeometry(KW + 0.07, 0.05, 5 * U + 0.07, 4, 0.02), graphite);
  kbCase.position.y = 0.025;
  kb.add(kbCase);
  // underglow: an additive card on the desk that takes the palette gradient
  const under = new THREE.Mesh(new THREE.PlaneGeometry(KW + 0.5, 5 * U + 0.42), new THREE.MeshBasicMaterial({ map: stripTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  under.rotation.x = -Math.PI / 2;
  under.position.y = 0.003;
  kb.add(under);
  const underAlpha = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); const r = x.createRadialGradient(32, 32, 4, 32, 32, 32);
    r.addColorStop(0, '#fff'); r.addColorStop(1, '#000'); x.fillStyle = r; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  under.material.alphaMap = underAlpha;

  const keyList = [];
  ROWS.forEach((row, r) => {
    let x = -KW / 2;
    row.forEach(([label, w]) => {
      keyList.push({ label, x: x + (w * U) / 2, z: -2 * U + r * U, w, press: -10, times: [] });
      x += w * U;
    });
  });
  const keyIndex = new Map(keyList.map((k, i) => [k.label, i]));
  const keyGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.16);
  const keyMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.5, clearcoat: 0.25 });
  const keys = new THREE.InstancedMesh(keyGeo, keyMat, keyList.length);
  const base = keyList.map(({ label }) =>
    new THREE.Color(label === 'esc' ? PALETTE.kw : label === 'enter' ? PALETTE.str : label === 'space' ? 0x262a36 : label.length > 1 ? 0x2a2e3a : 0x1b1e27));
  const pressCol = new THREE.Color(PALETTE.id).multiplyScalar(3.2);
  const enterCol = new THREE.Color(PALETTE.str).multiplyScalar(3.4);
  kb.add(keys);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), col = new THREE.Color();
  function layoutKeys(t) {
    keyList.forEach((k, i) => {
      const age = t - k.press;
      const down = age >= 0 && age < 0.16 ? 1 - age / 0.16 : 0;
      const lit = age >= 0 ? Math.exp(-age * 5) : 0;
      v3.set(k.x, 0.07 - down * 0.012, k.z);
      s3.set(k.w * U - 0.012, 0.03, U - 0.012);
      m4.compose(v3, q, s3);
      keys.setMatrixAt(i, m4);
      col.copy(base[i]).lerp(k.label === 'enter' ? enterCol : pressCol, lit);
      keys.setColorAt(i, col);
    });
    keys.instanceMatrix.needsUpdate = true;
    keys.instanceColor.needsUpdate = true;
  }
  // schedule the key presses for the typed command, then Enter
  keyList.forEach((k) => { k.times = []; });
  [...COMMAND].forEach((ch, i) => keyList[keyIndex.get(ch === ' ' ? 'space' : ch)].times.push(T.type + i * T.typeStep));
  keyList[keyIndex.get('enter')].times.push(T.enter);
  const pressAt = (k, t) => { let last = -10; for (const at of k.times) if (at <= t) last = at; return last; };

  /* desk, wall */
  if (!phone) {
    const refl = new Reflector(new THREE.PlaneGeometry(14, 10), {
      clipBias: 0.003, textureWidth: Math.floor(innerWidth * dpr * 0.5), textureHeight: Math.floor(innerHeight * dpr * 0.5), color: 0x4a4d55,
    });
    refl.rotation.x = -Math.PI / 2;
    refl.position.y = -0.001;
    scene.add(refl);
  }
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshPhysicalMaterial({
    color: 0x090a0e, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2, transparent: !phone, opacity: phone ? 1 : 0.82,
  }));
  desk.rotation.x = -Math.PI / 2;
  scene.add(desk);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), new THREE.MeshStandardMaterial({ color: 0x111319, roughness: 0.95 }));
  wall.position.set(0, 4, -2.4);
  scene.add(wall);

  /* lights */
  const screenLight = new THREE.RectAreaLight(0x9fd6ff, 0, SW, SH);
  screenLight.position.set(0, SCREEN_Y, SCREEN_Z + 0.03);
  screenLight.lookAt(0, SCREEN_Y, 5);
  scene.add(screenLight);
  const wallPink = new THREE.SpotLight(PALETTE.kw, 0, 7, 0.6, 1, 1.3);
  wallPink.position.set(-0.4, SCREEN_Y + 0.4, -0.3);
  wallPink.target.position.set(-1.6, 2.4, -2.4);
  const wallTeal = new THREE.SpotLight(PALETTE.teal, 0, 7, 0.6, 1, 1.3);
  wallTeal.position.set(0.4, SCREEN_Y + 0.4, -0.3);
  wallTeal.target.position.set(1.6, 2.4, -2.4);
  scene.add(wallPink, wallPink.target, wallTeal, wallTeal.target);
  const key = new THREE.SpotLight(0xdfe8ff, 12, 16, 0.5, 1, 1.6);
  key.position.set(-3.2, 4.2, 3.4);
  key.target.position.set(0, 0.7, 0);
  scene.add(key, key.target);
  const rim = new THREE.SpotLight(PALETTE.op, 40, 7, 0.45, 0.9, 1.6);
  rim.position.set(3.2, 3.2, -1.8);
  rim.target.position.set(0, 1.2, 0);
  scene.add(rim, rim.target);
  scene.add(new THREE.HemisphereLight(0x1b2233, 0x040405, 0.35));

  /* dust in the screen light */
  const dustN = phone ? 140 : 360;
  const dustPos = new Float32Array(dustN * 3), dustSeed = new Float32Array(dustN);
  for (let i = 0; i < dustN; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 3.2;
    dustPos[i * 3 + 1] = Math.random() * 2.4;
    dustPos[i * 3 + 2] = Math.random() * 2.4 - 0.1;
    dustSeed[i] = Math.random() * 100;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('seed', new THREE.BufferAttribute(dustSeed, 1));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uGlow: { value: 0 }, uScale: { value: innerHeight * dpr * 0.5 } },
    vertexShader: /* glsl */`
      attribute float seed; uniform float uTime, uScale; varying float vA; varying float vS;
      void main() {
        vec3 p = position;
        p.y = mod(p.y + uTime * 0.03, 2.4);
        p.x += sin(uTime * 0.2 + seed) * 0.08;
        p.z += cos(uTime * 0.17 + seed * 1.3) * 0.08;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.9 + fract(seed) * 1.6) * uScale * 0.006 / -mv.z;
        vA = exp(-abs(p.x) * 0.8) * exp(-abs(p.y - 1.1) * 0.9) * (0.35 + 0.65 * fract(seed * 7.13));
        vS = fract(seed * 3.7);
      }`,
    fragmentShader: /* glsl */`
      uniform float uGlow; varying float vA; varying float vS;
      void main() {
        float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)) * vA * uGlow;
        vec3 c = mix(vec3(0.62, 0.86, 1.0), vec3(1.0, 0.55, 0.75), step(0.8, vS));
        gl_FragColor = vec4(c * a, a);
      }`,
  });
  scene.add(new THREE.Points(dustGeo, dustMat));

  /* post */
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(dpr);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.55, 0.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* camera: a slow orbit over the desk, then a push into the glass */
  const look = new THREE.Vector3(0, SCREEN_Y, SCREEN_Z);
  const startLook = new THREE.Vector3(0.05, 0.78, 0.3);
  const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3();
  function framing() {
    const aspect = innerWidth / innerHeight;
    const portrait = aspect < 1;
    const vt = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = Math.min((SH / 2) / vt, (SW / 2) / (vt * aspect));
    return {
      a: portrait ? new THREE.Vector3(1.6, 2.3, 8.4) : new THREE.Vector3(2.5, 1.85, 5.0),
      b: portrait ? new THREE.Vector3(0.7, 1.95, 7.4) : new THREE.Vector3(1.25, 1.5, 3.7),
      end: new THREE.Vector3(0, SCREEN_Y, glass.position.z + d),
    };
  }
  let frame = framing();
  function placeCamera(story, wt) {
    tmpPos.lerpVectors(frame.a, frame.b, ease.io3(clamp01(wt / (T.pushStart + 1.5))));
    tmpPos.x += Math.sin(wt * 0.35) * 0.04;
    tmpPos.y += Math.sin(wt * 0.27) * 0.025;
    const k = ease.io5(seg(story, T.pushStart, T.pushEnd));
    camera.position.lerpVectors(tmpPos, frame.end, k);
    tmpLook.lerpVectors(startLook, look, ease.io3(seg(story, T.pushStart - 0.5, T.pushEnd - 0.3)));
    camera.lookAt(tmpLook);
  }
  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    dustMat.uniforms.uScale.value = innerHeight * dpr * 0.5;
    frame = framing();
    screen.rebuildHero();
  }
  addEventListener('resize', onResize);

  /* story clock */
  const phaseEl = wrap.querySelector('#intro-phase');
  const phases = [[0, 'power'], [T.type, 'typing'], [T.enter, 'self-test'], [T.compile, 'compile'], [T.link, 'link'], [T.run, 'run']];
  let story = 0, clock = 0, last = performance.now(), frozen = null, ended = false, raf = 0, phase = '', started = false;
  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });

  function apply(st, wt) {
    const pw = seg(st, T.power, T.power + 0.55);
    uniforms.uPower.value = pw;
    uniforms.uTime.value = wt;
    const flat = ease.io3(seg(st, T.pushEnd - 1.0, T.pushEnd));
    uniforms.uMask.value = 1 - flat;
    uniforms.uGlass.value = 1 - flat;
    uniforms.uBright.value = lerp(1.35, 1.0, seg(st, T.hero, T.hero + 0.6));
    ledMat.color.set(pw > 0 ? PALETTE.str : 0x0a0d0a);
    screenLight.intensity = 7 * pw;
    glowMat.color.setScalar(2.2 * pw);
    wallPink.intensity = wallTeal.intensity = 22 * pw;
    under.material.opacity = 0.55 * seg(st, T.type - 0.4, T.type + 0.2) * (0.85 + 0.15 * Math.sin(wt * 2));
    stripTex.offset.x = (wt * 0.05) % 1;
    dustMat.uniforms.uGlow.value = pw * (1 - flat);
    dustMat.uniforms.uTime.value = wt;
    bloom.strength = lerp(0.8, 0.1, ease.io3(seg(st, T.pushStart, T.pushEnd - 0.8)));
    wrap.classList.toggle('is-pushing', st > T.pushStart + 0.6);
    keyList.forEach((k) => { k.press = pressAt(k, st); });
    layoutKeys(st);
    screen.update(st);
    placeCamera(st, wt);
    const ph = phases.filter(([a]) => st >= a).pop()[1];
    if (ph !== phase) { phase = ph; phaseEl.textContent = ph; }
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    // rAF timestamps can trail performance.now(), so never step backwards
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = Math.max(last, now);
    clock += dt;
    if (frozen !== null) story = frozen;
    else {
      story += dt;
      // the build really starts when Enter is pressed
      if (!started && story >= T.enter) { started = true; startScene(); }
      // hold on "Linking" until the site has actually loaded
      if (story > T.hold && !isReady) story = T.hold;
      if (!finishedAt && story >= T.finish) finishedAt = performance.now() - t0;
    }
    apply(story, clock);
    composer.render();
    window.__frames = (window.__frames || 0) + 1;
    if (frozen === null && story >= T.pushEnd) finish(false);
  }

  function finish(skipped) {
    if (ended) return;
    ended = true;
    if (!started) { started = true; startScene(); }
    removeEventListener('keydown', onKey);
    onHandoff();
    wrap.classList.add('is-done');
    setTimeout(() => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      renderer.dispose();
      wrap.remove();
      resolveDone();
    }, skipped ? 450 : 700);
  }
  const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); finish(true); } };
  addEventListener('keydown', onKey);
  wrap.querySelector('.intro-skip').addEventListener('click', () => finish(true));
  // never let the intro hold the page hostage
  setTimeout(() => { if (frozen === null) finish(true); }, 25000);

  // Test hooks: freeze the story at a given second, or resume.
  window.__intro = {
    pause(t) { frozen = t; if (t >= T.enter && !started) { started = true; startScene(); } },
    resume() { if (frozen !== null) { story = frozen; frozen = null; } },
    skip: () => finish(true),
    T,
  };

  apply(0, 0);
  raf = requestAnimationFrame(tick);
  return done;
}
