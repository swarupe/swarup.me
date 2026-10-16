// The 3D layer. One global progress value p in [0, 5] drives every stage:
// 0 hero, 1 lexer, 2 parser, 3 optimizer, 4 linker, 5 output.
// Every visual is a pure function of (p, time), so scrubbing backwards just works.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PALETTE, TREE, LIBS } from './data.js';

/* ---------- math helpers ---------- */
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeIO = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const easeBack = (x) => { x = clamp01(x); const c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (() => { let s = 1337; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const col = (k) => new THREE.Color(PALETTE[k]);
const cssVar = (k) => `var(--${k})`;

/* ---------- shaders ---------- */
const BLOCK_VS = /* glsl */`
attribute vec3 aColor;
attribute vec2 aFx;           // x alpha, y glow
varying vec3 vColor; varying vec2 vFx; varying vec3 vLocal; varying vec3 vScale;
varying vec3 vN; varying vec3 vView; varying float vDepth;
void main() {
  vColor = aColor; vFx = aFx; vLocal = position;
  vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const BLOCK_FS = /* glsl */`
uniform vec3 uFog; uniform float uFogDensity; uniform float uEdge;
varying vec3 vColor; varying vec2 vFx; varying vec3 vLocal; varying vec3 vScale;
varying vec3 vN; varying vec3 vView; varying float vDepth;
void main() {
  vec3 d = (0.5 - abs(vLocal)) * vScale;
  float mn = min(d.x, min(d.y, d.z)); float mx = max(d.x, max(d.y, d.z));
  float edge = max(d.x + d.y + d.z - mn - mx, 0.0);
  float ew = uEdge * (0.6 + 0.4 * min(vScale.x, vScale.y));
  float eg = exp(-edge / ew);
  vec3 n = normalize(vN);
  float fres = pow(1.0 - clamp(dot(n, vView), 0.0, 1.0), 2.5);
  float key = 0.55 + 0.45 * dot(n, normalize(vec3(0.35, 0.8, 0.5)));
  vec3 base = vColor * 0.07 + vec3(0.010, 0.012, 0.020);
  vec3 c = base * (0.5 + key) + vColor * (fres * 0.55 + eg * 2.2) * vFx.y;
  float fog = 1.0 - exp(-uFogDensity * uFogDensity * vDepth * vDepth);
  c = mix(c, uFog, fog);
  gl_FragColor = vec4(clamp(c, 0.0, 6.0), clamp(vFx.x, 0.0, 1.0));
}`;
const TEXT_VS = /* glsl */`
attribute vec4 aUv; attribute vec3 aColor; attribute float aAlpha;
varying vec2 vUv; varying vec3 vColor; varying float vAlpha; varying float vDepth;
void main() {
  vUv = aUv.xy + uv * aUv.zw; vColor = aColor; vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const TEXT_FS = /* glsl */`
uniform sampler2D uAtlas; uniform float uFogDensity;
varying vec2 vUv; varying vec3 vColor; varying float vAlpha; varying float vDepth;
void main() {
  float a = texture2D(uAtlas, vUv).a;
  float fog = exp(-uFogDensity * uFogDensity * vDepth * vDepth);
  gl_FragColor = vec4(vColor * 1.15, a * vAlpha * fog);
}`;
const BEAM_VS = /* glsl */`
attribute vec3 aColor; attribute vec2 aFx;   // x alpha, y pulse phase
varying vec3 vColor; varying vec2 vFx; varying float vY; varying float vDepth;
void main() {
  vColor = aColor; vFx = aFx; vY = uv.y;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const BEAM_FS = /* glsl */`
uniform float uTime; uniform float uFogDensity;
varying vec3 vColor; varying vec2 vFx; varying float vY; varying float vDepth;
void main() {
  float ph = fract(vY * 1.0 - uTime * 0.45 + vFx.y);
  float pulse = smoothstep(0.0, 0.06, ph) * (1.0 - smoothstep(0.06, 0.22, ph));
  float fog = exp(-uFogDensity * uFogDensity * vDepth * vDepth);
  vec3 c = vColor * (0.55 + pulse * 2.6);
  gl_FragColor = vec4(c * vFx.x * fog, 1.0);
}`;
const DUST_VS = /* glsl */`
attribute float aSize; attribute vec3 aColor; attribute float aSeed;
uniform float uTime; uniform float uPx; uniform float uFade;
varying vec3 vColor; varying float vA;
void main() {
  vec3 p = position;
  p.y += sin(uTime * 0.2 + aSeed * 6.28) * 0.4;
  p.x += cos(uTime * 0.15 + aSeed * 9.0) * 0.3;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = min(aSize * uPx * (30.0 / max(-mv.z, 0.1)), 24.0);
  vColor = aColor;
  vA = uFade * (0.45 + 0.55 * sin(uTime * 1.3 + aSeed * 40.0)) * smoothstep(90.0, 20.0, -mv.z) * smoothstep(3.0, 9.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const DUST_FS = /* glsl */`
varying vec3 vColor; varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor * a * a * vA, 1.0);
}`;
const FINISH = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
  uniform sampler2D tDiffuse; uniform float uTime; uniform float uAspect; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    vec2 q = vUv - 0.5;
    float r = length(q * vec2(uAspect, 1.0));
    vec2 off = q * 0.0035 * r;
    vec3 c;
    c.r = texture2D(tDiffuse, vUv + off).r;
    c.g = texture2D(tDiffuse, vUv).g;
    c.b = texture2D(tDiffuse, vUv - off).b;
    c *= mix(1.0, 0.55, smoothstep(0.35, 1.05, r));
    c += (h(vUv * 900.0 + fract(uTime) * 61.0) - 0.5) * 0.028;
    gl_FragColor = vec4(c, 1.0);
  }`,
};
const DISSOLVE_NOISE = /* glsl */`
float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

/* ---------- instanced building blocks ---------- */
class BlockSet {
  constructor(n, { atlas = null, edge = 0.03, fog } = {}) {
    this.n = n;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.aColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.aFx = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2);
    this.aColor.setUsage(THREE.DynamicDrawUsage); this.aFx.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aColor', this.aColor); geo.setAttribute('aFx', this.aFx);
    const mat = new THREE.ShaderMaterial({
      vertexShader: BLOCK_VS, fragmentShader: BLOCK_FS, transparent: true,
      uniforms: { uFog: { value: new THREE.Color(PALETTE.bg) }, uFogDensity: fog, uEdge: { value: edge } },
    });
    this.box = new THREE.InstancedMesh(geo, mat, n);
    this.box.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.box.frustumCulled = false;
    if (atlas) {
      const pg = new THREE.PlaneGeometry(1, 1);
      this.aUv = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
      this.tColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      this.tAlpha = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
      this.tAlpha.setUsage(THREE.DynamicDrawUsage);
      pg.setAttribute('aUv', this.aUv); pg.setAttribute('aColor', this.tColor); pg.setAttribute('aAlpha', this.tAlpha);
      const tm = new THREE.ShaderMaterial({
        vertexShader: TEXT_VS, fragmentShader: TEXT_FS, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, uniforms: { uAtlas: { value: atlas }, uFogDensity: fog },
      });
      this.text = new THREE.InstancedMesh(pg, tm, n);
      this.text.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.text.frustumCulled = false;
      this.text.renderOrder = 2;
    }
    this._m = new THREE.Matrix4(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3(); this._o = new THREE.Vector3();
  }
  addTo(parent) { parent.add(this.box); if (this.text) parent.add(this.text); return this; }
  setText(i, uv, color) {
    this.aUv.setXYZW(i, uv[0], uv[1], uv[2], uv[3]);
    this.tColor.setXYZ(i, color.r, color.g, color.b);
  }
  // w,h are the text face size; pad grows the block around it.
  set(i, pos, quat, w, h, depth, pad, color, boxAlpha, glow, textAlpha = 0) {
    const vis = boxAlpha > 0.002;
    this._s.set(vis ? w + pad : 0, vis ? h + pad : 0, vis ? Math.max(depth, 0.001) : 0);
    this._m.compose(pos, quat, this._s);
    this.box.setMatrixAt(i, this._m);
    this.aColor.setXYZ(i, color.r, color.g, color.b);
    this.aFx.setXY(i, boxAlpha, glow);
    if (this.text) {
      const tv = textAlpha > 0.002;
      this._o.set(0, 0, depth / 2 + 0.004).applyQuaternion(quat);
      this._p.copy(pos).add(this._o);
      this._s.set(tv ? w : 0, tv ? h : 0, 1);
      this._m.compose(this._p, quat, this._s);
      this.text.setMatrixAt(i, this._m);
      this.tAlpha.setX(i, textAlpha);
    }
  }
  commit() {
    this.box.instanceMatrix.needsUpdate = true; this.aColor.needsUpdate = true; this.aFx.needsUpdate = true;
    if (this.text) { this.text.instanceMatrix.needsUpdate = true; this.tAlpha.needsUpdate = true; this.aUv.needsUpdate = true; this.tColor.needsUpdate = true; }
  }
}

class BeamSet {
  constructor(n, fog, time) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    this.aColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.aFx = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2);
    geo.setAttribute('aColor', this.aColor); geo.setAttribute('aFx', this.aFx);
    const mat = new THREE.ShaderMaterial({
      vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, uniforms: { uTime: time, uFogDensity: fog },
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._d = new THREE.Vector3();
    this._mid = new THREE.Vector3(); this._s = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
  }
  set(i, a, b, r, color, alpha, phase) {
    this._d.subVectors(b, a);
    const len = this._d.length();
    const vis = alpha > 0.002 && len > 1e-4;
    if (vis) this._q.setFromUnitVectors(this._up, this._d.multiplyScalar(1 / len));
    this._mid.addVectors(a, b).multiplyScalar(0.5);
    this._s.set(vis ? r : 0, vis ? len : 0, vis ? r : 0);
    this._m.compose(this._mid, this._q, this._s);
    this.mesh.setMatrixAt(i, this._m);
    this.aColor.setXYZ(i, color.r, color.g, color.b);
    this.aFx.setXY(i, alpha, phase);
  }
  commit() { this.mesh.instanceMatrix.needsUpdate = true; this.aColor.needsUpdate = true; this.aFx.needsUpdate = true; }
}

/* ---------- text atlas ---------- */
function buildAtlas(strings) {
  const FS = 56, CH = Math.round(FS * 1.32), PADX = 2, W = 2048;
  const font = `500 ${FS}px "JetBrains Mono", ui-monospace, monospace`;
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = font;
  const cells = new Map();
  let x = 0, y = 0;
  for (const s of strings) {
    if (cells.has(s)) continue;
    const w = Math.ceil(meas.measureText(s).width) + PADX * 2;
    if (x + w > W) { x = 0; y += CH + 4; }
    cells.set(s, { x, y, w, h: CH });
    x += w + 4;
  }
  const H = y + CH + 4;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.font = font; g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
  for (const [s, c] of cells) g.fillText(s, c.x + PADX, c.y + FS * 1.02);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const uv = (s) => { const c = cells.get(s); return [c.x / W, 1 - (c.y + c.h) / H, c.w / W, c.h / H]; };
  const aspect = (s) => { const c = cells.get(s); return c.w / c.h; };
  return { tex, uv, aspect };
}

/* ---------- main ---------- */
export async function start({ motion, deadBytes, gsap, ScrollTrigger }) {
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
  await document.fonts.load('500 56px "JetBrains Mono"').catch(() => {});

  const html = document.documentElement;
  const phone = innerWidth < 860;
  let W = innerWidth, H = innerHeight;
  const dpr = Math.min(devicePixelRatio || 1, phone ? 1.5 : 2);

  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(dpr);
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.bg);
  scene.fog = new THREE.FogExp2(PALETTE.bg, 0.016);
  const fogU = { value: scene.fog.density };
  const timeU = { value: 0 };
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const FOV = 38;
  const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 200);
  camera.position.set(0, 0, 20);
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

  scene.add(new THREE.AmbientLight(0x4a5577, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(6, 10, 12); scene.add(key);
  const pinkL = new THREE.PointLight(PALETTE.kw, 260, 0, 2); scene.add(pinkL);
  const cyanL = new THREE.PointLight(PALETTE.id, 260, 0, 2); scene.add(cyanL);
  const coreL = new THREE.PointLight(0xffffff, 0, 0, 2); scene.add(coreL);

  /* post */
  const rt = new THREE.WebGLRenderTarget(W * dpr, H * dpr, { type: THREE.HalfFloatType, samples: phone ? 2 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(dpr);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.95, 0.55, 0.55);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const finish = new ShaderPass(FINISH);
  composer.addPass(finish);

  /* screen <-> world */
  const _v = new THREE.Vector3(), _dir = new THREE.Vector3(), _fwd = new THREE.Vector3();
  function screenToWorld(x, y, D, out) {
    _v.set((x / W) * 2 - 1, -((y / H) * 2 - 1), 0.5).unproject(camera);
    _dir.copy(_v).sub(camera.position).normalize();
    camera.getWorldDirection(_fwd);
    return out.copy(camera.position).addScaledVector(_dir, D / _dir.dot(_fwd));
  }
  const wpp = (D) => (2 * D * tanHalf) / H;

  /* ---------- dust ---------- */
  const DN = phone ? 700 : 1800;
  {
    const pos = new Float32Array(DN * 3), size = new Float32Array(DN), c = new Float32Array(DN * 3), seed = new Float32Array(DN);
    const keys = ['id', 'kw', 'op', 'num', 'str', 'pun', 'pun', 'pun'];
    for (let i = 0; i < DN; i++) {
      pos[i * 3] = (rand() - 0.5) * 120; pos[i * 3 + 1] = (rand() - 0.5) * 70; pos[i * 3 + 2] = -70 + rand() * 72;
      size[i] = 0.6 + rand() * rand() * 3.2;
      const cc = col(keys[(rand() * keys.length) | 0]).multiplyScalar(0.55);
      c.set([cc.r, cc.g, cc.b], i * 3); seed[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(c, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    var dustMat = new THREE.ShaderMaterial({
      vertexShader: DUST_VS, fragmentShader: DUST_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: timeU, uPx: { value: dpr * (H / 900) }, uFade: { value: 1 } },
    });
    const dust = new THREE.Points(g, dustMat);
    dust.frustumCulled = false;
    scene.add(dust);
  }

  /* ---------- tokens ---------- */
  const tokenEls = [...document.querySelectorAll('#code .tk')];
  const tokens = tokenEls.map((el) => ({ el, text: el.textContent, type: [...el.classList].find((c) => c.startsWith('t-')).slice(2) }));
  const atlas = buildAtlas([...tokens.map((t) => t.text), ...LIBS.map((l) => l[0])]);
  const TN = tokens.length;
  const tokenSet = new BlockSet(TN, { atlas: atlas.tex, edge: 0.03, fog: fogU }).addTo(scene);
  const lineOf = (el) => [...el.parentElement.parentElement.children].indexOf(el.parentElement);
  const nLines = document.querySelectorAll('#code .ln').length;
  // stream lanes, packed by width so blocks never overlap
  const LANES = 4, SH = phone ? 0.62 : 0.56;
  const laneLen = new Array(LANES).fill(0);
  tokens.forEach((t, i) => {
    t.color = col(t.type);
    t.aspect = atlas.aspect(t.text);
    t.line = lineOf(t.el);
    t.delay = (t.line / nLines) * 0.65 + rand() * 0.25;
    t.lane = i % LANES;
    t.sw = SH * t.aspect;
    t.off = laneLen[t.lane] + t.sw / 2;
    laneLen[t.lane] += t.sw + 0.5 + SH * 0.4;
    t.arc = 0.8 + rand() * 1.6;
    t.pop = 0.8 + rand() * 1.6;
    t.axis = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
    t.spin = (rand() - 0.5) * 5;
    t.anchor = new THREE.Vector3(); t.aw = 0.1; t.ah = 0.1;
    tokenSet.setText(i, atlas.uv(t.text), t.color);
  });

  /* ---------- hero gyroscope ---------- */
  const RINGS = 3, RN = phone ? 40 : 64;
  const gyro = new BlockSet(RINGS * RN, { edge: 0.02, fog: fogU }).addTo(scene);
  const gyroCols = ['id', 'kw', 'op', 'num', 'str', 'teal'].map(col);
  const gyroSeed = Array.from({ length: RINGS * RN }, () => ({ c: gyroCols[(rand() * gyroCols.length) | 0], w: 0.4 + rand() * 1.4, z: rand() }));
  const ringQ = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];

  /* ---------- tree ---------- */
  const treeGroup = new THREE.Group();
  scene.add(treeGroup);
  const L = phone
    ? { row: 0.98, leafX: 0.2, areaX: -2.6, rootX: -5.4, libX: 8.4 }
    : { row: 0.74, leafX: 1.2, areaX: -4.0, rootX: -8.6, libX: 10.4 };
  const nodes = [];
  const edges = [];
  let row = 0;
  const areaRows = [];
  TREE.children.forEach((a, ai) => {
    const start = row;
    a.children.forEach(() => row++);
    areaRows.push([start, row - 1]);
    row += 0.65;
  });
  const totalRows = row - 0.65;
  const yOf = (r) => ((totalRows - 1) / 2 - r) * L.row;
  const labelsEl = document.getElementById('labels');

  const geoRoot = new THREE.IcosahedronGeometry(0.8, 0);
  const geoArea = new THREE.OctahedronGeometry(0.42, 0);
  const geoLeaf = new THREE.IcosahedronGeometry(0.2, 1);

  function nodeMaterial(c, intensity) {
    const m = new THREE.MeshPhysicalMaterial({
      color: c.clone().multiplyScalar(0.35), emissive: c, emissiveIntensity: intensity,
      metalness: 0.35, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15, transparent: true, flatShading: true,
    });
    const u = { uDissolve: { value: 0 }, uEdgeColor: { value: col('err').multiplyScalar(4) } };
    m.userData.u = u;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vObj; uniform float uDissolve; uniform vec3 uEdgeColor;\n${DISSOLVE_NOISE}`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float dn = vnoise(vObj * 9.0);
          if (dn < uDissolve) discard;
          totalEmissiveRadiance += uEdgeColor * (1.0 - smoothstep(0.0, 0.14, dn - uDissolve)) * step(0.001, uDissolve);`);
    };
    return m;
  }

  function addNode(kind, label, colorKey, pos, parent, extra = {}) {
    const c = col(colorKey);
    const geo = kind === 'root' ? geoRoot : kind === 'area' ? geoArea : geoLeaf;
    const mesh = new THREE.Mesh(geo, nodeMaterial(c, kind === 'leaf' ? 1.6 : 1.1));
    mesh.position.copy(pos);
    treeGroup.add(mesh);
    let shell = null;
    if (kind !== 'leaf') {
      shell = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: c.clone().multiplyScalar(2), transparent: true }));
      shell.scale.setScalar(1.45);
      mesh.add(shell);
    }
    const el = document.createElement('div');
    el.className = `lbl ${kind}${extra.dead ? ' dead' : ''}`;
    el.style.setProperty('--c', extra.dead ? 'var(--com)' : cssVar(colorKey));
    el.textContent = label;
    labelsEl.appendChild(el);
    const n = {
      kind, label, color: c, base: pos.clone(), mesh, shell, el, parent, dead: !!extra.dead,
      depth: kind === 'root' ? 0 : kind === 'area' ? 1 : 2, seed: rand() * 6.28, row: extra.row ?? 0,
      world: new THREE.Vector3(), appear: 0, alive: 1,
    };
    nodes.push(n);
    if (parent) edges.push({ a: parent, b: n });
    return n;
  }

  const bend = (x, y) => -0.03 * y * y - 0.012 * x * x;
  const rootY = 0;
  const rootN = addNode('root', TREE.label, 'pun', new THREE.Vector3(L.rootX, rootY, 1.2), null);
  rootN.color = col('id').lerp(col('kw'), 0.5);
  TREE.children.forEach((a, ai) => {
    const [r0, r1] = areaRows[ai];
    const ay = (yOf(r0) + yOf(r1)) / 2;
    const an = addNode('area', a.label, a.color, new THREE.Vector3(L.areaX, ay, 0.6 + bend(L.areaX, ay) * 0.5), rootN, { dead: a.dead, row: r0 });
    a.children.forEach((leaf, li) => {
      const ly = yOf(r0 + li);
      addNode(a.dead ? 'leaf' : 'leaf', leaf, a.color, new THREE.Vector3(L.leafX + Math.sin(ly * 0.7) * 0.25, ly, bend(L.leafX, ly) + (rand() - 0.5) * 0.4), an, { dead: a.dead, row: r0 + li });
    });
  });
  const byLabel = new Map(nodes.map((n) => [n.label, n]));
  const deadNodes = nodes.filter((n) => n.dead);
  const liveNodes = nodes.filter((n) => !n.dead);
  const deadDrop = (yOf(areaRows[areaRows.length - 2][1]) - yOf(areaRows[areaRows.length - 1][1])) / 2;
  // appearance order
  nodes.forEach((n) => { n.delay = n.depth === 0 ? 0 : n.depth === 1 ? 0.08 + nodes.indexOf(n) * 0.004 : 0.2 + n.row * 0.011; });
  // tokens assigned to nodes: dead block tokens feed the dead nodes
  const deadLineIdx = tokens.filter((t) => tokenEls.length && /dead|student_projects|2017|2018/.test(t.text)).map((t) => t.line);
  const deadLines = new Set(deadLineIdx);
  let rr = 0;
  tokens.forEach((t) => {
    if (deadLines.has(t.line)) t.node = deadNodes[(t.line + t.text.length) % deadNodes.length];
    else t.node = liveNodes[rr++ % liveNodes.length];
  });

  /* ---------- beams ---------- */
  const libLinks = [];
  LIBS.forEach(([, , targets], li) => targets.forEach((tl) => libLinks.push({ li, target: byLabel.get(tl) })));
  const beams = new BeamSet(edges.length + libLinks.length, fogU, timeU);
  treeGroup.add(beams.mesh);

  /* ---------- libs ---------- */
  const LN = LIBS.length;
  const libSet = new BlockSet(LN, { atlas: atlas.tex, edge: 0.03, fog: fogU }).addTo(treeGroup);
  const liveTop = yOf(0), liveBot = yOf(areaRows[areaRows.length - 2][1]);
  const libs = LIBS.map(([name, ck, targets], i) => {
    const c = col(ck);
    libSet.setText(i, atlas.uv(name), c);
    const tgtY = targets.map((tl) => byLabel.get(tl).base.y).reduce((a, b) => a + b, 0) / targets.length;
    return {
      name, c, aspect: atlas.aspect(name), targets,
      dockBase: new THREE.Vector3(L.libX + (i % 2) * (phone ? 0.6 : 1.4), 0, -1.4 + (i % 3) * 0.4),
      tgtY, theta: (i / LN) * Math.PI * 2, tilt: (rand() - 0.5) * 0.8, delay: i * 0.022,
    };
  });
  // spread docks evenly over the live height, ordered by target height
  [...libs].sort((a, b) => b.tgtY - a.tgtY).forEach((l, k) => {
    l.dockBase.y = lerp(liveTop + 0.3, liveBot - 0.3, k / (LN - 1)) + deadDrop;
  });

  /* ---------- dead-code particles ---------- */
  const PN = phone ? 160 : 360;
  const pPos = new Float32Array(PN * 3);
  const pSeed = Array.from({ length: PN }, (_, i) => ({ n: deadNodes[i % deadNodes.length], v: new THREE.Vector3(rand() * 2.5 + 0.5, (rand() - 0.3) * 2.5, (rand() - 0.5) * 3) }));
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color: new THREE.Color(PALETTE.err).multiplyScalar(2.2), size: phone ? 0.09 : 0.07, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const burst = new THREE.Points(pGeo, pMat);
  burst.frustumCulled = false;
  treeGroup.add(burst);

  /* ---------- output: core tiles ---------- */
  const card = document.getElementById('card');
  const COLS = phone ? 6 : 10, ROWS = phone ? 11 : 8, TL = COLS * ROWS;
  const tiles = new BlockSet(TL, { edge: 0.025, fog: fogU }).addTo(scene);
  const tileCols = ['id', 'kw', 'op', 'num', 'str', 'teal'].map(col);
  const plateCol = col('str').lerp(col('id'), 0.5);
  const tileData = Array.from({ length: TL }, (_, i) => {
    const c = i % COLS, r = (i / COLS) | 0;
    const k = (i + 0.5) / TL, phi = Math.acos(1 - 2 * k), th = Math.PI * (1 + Math.sqrt(5)) * i;
    const nrm = new THREE.Vector3(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);
    const dc = (c - (COLS - 1) / 2) / COLS, dr = (r - (ROWS - 1) / 2) / ROWS;
    return { c, r, nrm, q, color: tileCols[(rand() * tileCols.length) | 0], delay: Math.hypot(dc, dr) * 1.4 + rand() * 0.12, seed: rand() * 100 };
  });

  /* ---------- camera choreography ---------- */
  const KEYS = phone
    ? [[[0, 0, 20], [0, 0, 0]], [[1.5, 2.5, 21], [0, 0.2, -2]], [[-0.5, 1, 50], [1.1, -0.3, 0]], [[-2, -4, 34], [1.0, -5.2, 0]], [[3, 2, 50], [5.8, -0.4, 0]], [[0, 0, 18], [0, 0, 0]]]
    : [[[0, 0, 20], [0, 0, 0]], [[2.5, 2.4, 16.5], [0, 0, -2]], [[-3, 1.2, 30], [0.4, -0.3, 0]], [[-5, -3.5, 20], [-0.6, -4.6, 0]], [[5, 3, 37.5], [1.6, -0.4, 0]], [[0, 0, 18], [0, 0, 0]]];
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  if (!phone) addEventListener('pointermove', (e) => { mouse.x = e.clientX / W - 0.5; mouse.y = e.clientY / H - 0.5; }, { passive: true });
  function placeCamera(p) {
    const i = Math.min(4, Math.floor(p));
    const f = easeIO(p - i);
    const [pa, ta] = KEYS[i], [pb, tb] = KEYS[Math.min(5, i + 1)];
    camPos.set(lerp(pa[0], pb[0], f), lerp(pa[1], pb[1], f), lerp(pa[2], pb[2], f));
    camTgt.set(lerp(ta[0], tb[0], f), lerp(ta[1], tb[1], f), lerp(ta[2], tb[2], f));
    camPos.y += Math.sin(f * Math.PI) * 1.2; // a small lift between stages
    mouse.sx += (mouse.x - mouse.sx) * 0.05; mouse.sy += (mouse.y - mouse.sy) * 0.05;
    const par = p < 0.5 ? 1 : 0.5;
    camPos.x += mouse.sx * 1.6 * par; camPos.y -= mouse.sy * 1.1 * par;
    camera.position.copy(camPos);
    camera.lookAt(camTgt);
    // desktop: push the subject right of the reading column
    const shift = phone ? 0 : W * 0.19 * smooth(0.35, 0.95, p) * (1 - smooth(4.2, 4.85, p));
    camera.setViewOffset(W, H, -shift, 0, W, H);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  /* ---------- HTML hooks ---------- */
  const editor = document.querySelector('.editor');
  const bytesEl = document.getElementById('bytes-saved');
  const logEl = document.getElementById('buildlog-text');
  const steps = [...document.querySelectorAll('.hud-steps li')];
  const LOG = [
    'swc swarup.src --release',
    `lex      ${TN} tokens`,
    `parse    ${nodes.length} nodes, ${TREE.children.length} branches`,
    `opt      1 dead branch removed, ${deadBytes} B saved`,
    `link     ${LN} libraries resolved`,
    'ok       swarup.bin ready',
    'run      ./swarup.bin',
  ];
  let lastStage = -1;

  /* ---------- per-frame update ---------- */
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
  const _up = new THREE.Vector3(), _toward = new THREE.Vector3(), _tq = new THREE.Quaternion();
  const tmpCol = new THREE.Color();
  let flow = 0;

  function update(p, t, dt) {
    timeU.value = t;
    finish.uniforms.uTime.value = t;
    placeCamera(p);
    pinkL.position.set(-12 + Math.sin(t * 0.3) * 4, 6, 8);
    cyanL.position.set(12, -5 + Math.cos(t * 0.25) * 3, 7);

    /* stage weights */
    const optK = smooth(2.25, 2.8, p);          // dissolve
    const collapse = easeIO((p - 4.02) / 0.36);  // tree collapses
    const labelFade = 1 - smooth(4.0, 4.14, p);

    /* tree transform */
    const rot = lerp(-0.42, 0.18, smooth(1.3, 4.0, p)) + Math.sin(t * 0.22) * 0.05 + collapse * Math.PI * 1.5;
    treeGroup.rotation.set(Math.sin(t * 0.17) * 0.03, rot, 0);
    treeGroup.scale.setScalar(Math.max(0.0001, 1 - collapse));
    treeGroup.visible = collapse < 0.985;
    treeGroup.position.set(0, 0, 0);
    treeGroup.updateMatrixWorld();
    const lift = deadDrop * smooth(2.55, 2.95, p);

    /* nodes */
    for (const n of nodes) {
      const ap = easeBack((p - 1.32 - n.delay) / 0.32);
      n.appear = ap;
      const kill = n.dead ? optK : 0;
      n.mesh.position.set(n.base.x, n.base.y + lift + Math.sin(t * 0.8 + n.seed) * 0.06, n.base.z);
      n.mesh.rotation.set(t * 0.3 + n.seed, t * 0.45 + n.seed, 0);
      const s = Math.max(0.0001, ap * (n.kind === 'root' ? 1 + Math.sin(t * 2) * 0.04 : 1));
      n.mesh.scale.setScalar(s);
      n.mesh.visible = ap > 0.01 && kill < 0.999;
      n.mesh.material.userData.u.uDissolve.value = kill;
      if (n.dead) {
        const warn = smooth(2.05, 2.2, p) * (1 - kill);
        n.mesh.material.emissive.copy(n.color).lerp(tmpCol.setHex(PALETTE.err), warn);
      }
      if (n.shell) n.shell.material.opacity = 0.55 * (1 - kill);
      n.mesh.getWorldPosition(n.world);
    }

    /* tree edges */
    edges.forEach((e, i) => {
      const g = easeIO((p - 1.3 - e.b.delay) / 0.3);
      _a.copy(e.a.mesh.position); _b.copy(e.b.mesh.position);
      _b.lerpVectors(_a, _b, g);
      const kill = e.b.dead ? optK : 0;
      const c = e.b.dead ? tmpCol.copy(e.b.color).lerp(_errC, smooth(2.05, 2.2, p)) : e.b.color;
      beams.set(i, _a, _b, e.b.kind === 'area' ? 0.035 : 0.022, c, g * (1 - kill) * (e.b.dead ? 0.8 : 1), e.b.seed);
    });

    /* dead-code particles */
    const pk = smooth(2.28, 2.95, p);
    const pa = Math.sin(pk * Math.PI);
    pMat.opacity = pa;
    burst.visible = pa > 0.01;
    if (burst.visible) {
      pSeed.forEach((s, i) => {
        pPos[i * 3] = s.n.mesh.position.x + s.v.x * pk * 2;
        pPos[i * 3 + 1] = s.n.mesh.position.y + s.v.y * pk * 2 + pk * pk * 1.5;
        pPos[i * 3 + 2] = s.n.mesh.position.z + s.v.z * pk * 2;
      });
      pGeo.attributes.position.needsUpdate = true;
    }

    /* tokens */
    const heroIn = smooth(0.02, 0.1, p);
    flow += dt * 1.15 * smooth(0.3, 0.9, p) * (1 - smooth(1.08, 1.35, p));
    const D0 = 12, k0 = wpp(D0);
    camera.getWorldDirection(_fwd);
    _up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    for (let i = 0; i < TN; i++) {
      const tk = tokens[i];
      const e1 = easeIO((p - 0.05 - tk.delay * 0.42) / 0.5);
      const e2 = easeIO((p - 1.08 - tk.node.delay * 0.9) / 0.34);
      if (p > 2.6 || (heroIn <= 0 && p < 0.05)) { tokenSet.set(i, _a.set(0, 0, 0), camera.quaternion, 0, 0, 0, 0, tk.color, 0, 0, 0); continue; }
      // DOM anchor
      if (e1 < 1) {
        const r = tk.el.getBoundingClientRect();
        screenToWorld(r.left + r.width / 2, r.top + r.height / 2, D0, tk.anchor);
        tk.aw = r.width * k0; tk.ah = r.height * k0;
      }
      // stream
      const len = laneLen[tk.lane];
      const sx = ((tk.off + flow * (0.8 + tk.lane * 0.12)) % len) - len / 2;
      const sy = (tk.lane - (LANES - 1) / 2) * (SH * 1.9) + Math.sin(sx * 0.28 + t * 0.7 + tk.lane) * 0.35;
      const sz = -2 - tk.lane * 0.9 - 0.022 * sx * sx;
      const edgeA = 1 - smooth(phone ? 6 : 10.5, phone ? 9 : 14, Math.abs(sx));
      _b.set(sx, sy, sz);
      // lexer flight
      _c.lerpVectors(tk.anchor, _b, e1);
      const arc = Math.sin(e1 * Math.PI);
      _c.addScaledVector(_up, arc * tk.arc).addScaledVector(_fwd, -arc * tk.pop);
      let w = lerp(tk.aw, tk.sw, e1), h = lerp(tk.ah, SH, e1);
      let alpha = lerp(1, edgeA, e1);
      // parser: fly into the owning node
      if (e2 > 0) {
        _c.lerp(tk.node.world, e2);
        const sh = 1 - smooth(0.6, 1, e2);
        w *= sh; h *= sh;
        alpha = lerp(alpha, 1, e2) * sh;
      }
      _tq.setFromAxisAngle(tk.axis, arc * tk.spin + Math.sin(e2 * Math.PI) * tk.spin * 0.6);
      _q.copy(camera.quaternion).multiply(_tq);
      const depth = 0.24 * e1 * (h / SH), pad = 0.16 * e1 * (h / SH);
      tokenSet.set(i, _c, _q, w, h, depth, pad, tk.color, alpha * smooth(0.0, 0.25, e1), 0.9 + arc * 0.8 + Math.sin(e2 * Math.PI) * 1.5, alpha * heroIn);
    }
    tokenSet.commit();
    if (editor && html.classList.contains('fx')) editor.style.opacity = String(1 - smooth(0.03, 0.14, p) * 0.92);

    /* hero gyroscope, anchored behind the editor */
    const gyroK = 1 - smooth(0.03, 0.4, p);
    if (gyroK > 0.001 && editor) {
      const r = editor.getBoundingClientRect();
      const D = 30;
      screenToWorld(r.left + r.width / 2, r.top + r.height / 2, D, _c);
      const R = Math.max(r.height, r.width) * 0.56 * wpp(D) * (0.6 + 0.4 * gyroK);
      for (let k = 0; k < RINGS; k++) {
        _q2.setFromEuler(new THREE.Euler(t * (0.11 + k * 0.05) + k * 1.1, t * (0.08 - k * 0.03) + k * 2.1, k * 0.7));
        ringQ[k].copy(_q2);
      }
      for (let i = 0; i < RINGS * RN; i++) {
        const k = (i / RN) | 0, j = i % RN, sd = gyroSeed[i];
        const ang = (j / RN) * Math.PI * 2 + t * (0.15 + k * 0.06) * (k % 2 ? -1 : 1);
        const rk = R * (1 - k * 0.16);
        _a.set(Math.cos(ang) * rk, Math.sin(ang) * rk, (sd.z - 0.5) * 0.6).applyQuaternion(ringQ[k]).add(_c);
        _tq.setFromAxisAngle(_b.set(0, 0, 1), ang + Math.PI / 2);
        _q.copy(ringQ[k]).multiply(_tq);
        const flick = 0.6 + 0.9 * (Math.sin(t * 2 + sd.z * 40) > 0.6 ? 1 : 0);
        gyro.set(i, _a, _q, 0.55 * sd.w, 0.22, 0.22, 0, sd.c, gyroK, flick * gyroK);
      }
    } else {
      for (let i = 0; i < RINGS * RN; i++) gyro.set(i, _a, _q, 0, 0, 0, 0, gyroSeed[i].c, 0, 0);
    }
    gyro.commit();

    /* libs */
    _q2.copy(treeGroup.quaternion).invert().multiply(camera.quaternion);
    let bi = edges.length;
    libs.forEach((l, i) => {
      const appear = easeBack((p - 3.0 - l.delay * 0.4) / 0.2);
      const fly = easeIO((p - 3.12 - l.delay) / 0.42);
      const lockP = 3.12 + l.delay + 0.42;
      const flash = Math.max(0, 1 - Math.abs(p - lockP) / 0.05);
      const th = l.theta + t * 0.12;
      _a.set(Math.cos(th) * 20, 2 + Math.sin(th) * 6 + l.tilt * 4, Math.sin(th) * 14 - 6);
      _b.set(l.dockBase.x, l.dockBase.y - deadDrop + lift, l.dockBase.z);
      _c.lerpVectors(_a, _b, fly);
      _c.y += Math.sin(fly * Math.PI) * 3;
      const h = 0.5 * (phone ? 1.15 : 1), w = h * l.aspect;
      _tq.setFromAxisAngle(_b.set(0, 1, 0).normalize(), (1 - fly) * 2.5);
      _q.copy(_q2).multiply(_tq);
      const a = clamp01(appear) * labelFade;
      libSet.set(i, _c, _q, w * appear, h * appear, 0.22, 0.18, l.c, a, 0.8 + flash * 3, a);
      l.pos = l.pos || new THREE.Vector3();
      l.pos.copy(_c);
      l.lock = smooth(lockP - 0.01, lockP + 0.12, p);
    });
    libSet.commit();
    libLinks.forEach((lk) => {
      const l = libs[lk.li];
      _a.copy(l.pos); _a.x -= 0.18 * 0 + (0.5 * (phone ? 1.15 : 1) * l.aspect) / 2;
      _b.lerpVectors(_a, lk.target.mesh.position, l.lock);
      beams.set(bi++, _a, _b, 0.016, l.c, l.lock * 0.9, lk.li * 0.13);
    });
    beams.commit();

    /* output: core and plate */
    const coreIn = easeBack((p - 4.26) / 0.2);
    coreL.intensity = 30 * Math.max(0, Math.sin(clamp01((p - 4.15) / 0.5) * Math.PI));
    if (p > 4.2) {
      const cr = card.getBoundingClientRect();
      const D = 11, k = wpp(D);
      const m = phone ? 10 : 18;
      const cw = (cr.width + m * 2) / COLS, ch = (cr.height + m * 2) / ROWS;
      const spinQ = _q2.setFromEuler(new THREE.Euler(t * 0.35, t * 0.5, 0.3));
      for (let i = 0; i < TL; i++) {
        const td = tileData[i];
        const u = easeIO((p - 4.52 - td.delay * 0.16) / 0.26);
        // core position
        _a.copy(td.nrm).applyQuaternion(spinQ).multiplyScalar(2.3 * coreIn);
        _q.copy(spinQ).multiply(td.q);
        // plate position
        screenToWorld(cr.left - m + (td.c + 0.5) * cw, cr.top - m + (td.r + 0.5) * ch, D, _b);
        _c.lerpVectors(_a, _b, u);
        _c.addScaledVector(_fwd, -Math.sin(u * Math.PI) * 2.5);
        _q.slerp(camera.quaternion, u);
        const tw = lerp(0.62 * coreIn, (cw - 6) * k, u), th2 = lerp(0.62 * coreIn, (ch - 6) * k, u);
        const bit = Math.sin(td.seed + Math.floor(t * 5) * 1.7) > 0 ? 0.9 : 0.18;
        tmpCol.copy(td.color).lerp(plateCol, u);
        const glow = lerp(bit, 0.32, u);
        tiles.set(i, _c, _q, tw, th2, lerp(0.3, 0.02, u), 0, tmpCol, clamp01(coreIn) * lerp(1, 0.6, u), glow);
      }
    } else {
      for (let i = 0; i < TL; i++) tiles.set(i, _a, _q, 0, 0, 0, 0, tileData[i].color, 0, 0);
    }
    tiles.commit();
    if (html.classList.contains('fx')) {
      const cv = smooth(4.8, 4.97, p);
      card.style.opacity = String(cv);
      card.style.transform = `translateY(${(1 - cv) * 16}px)`;
    }

    /* labels */
    const lshow = labelFade;
    for (const n of nodes) {
      let o = smooth(0.55, 1, n.appear) * lshow;
      if (n.dead) o *= 1 - smooth(2.3, 2.6, p);
      // phones: the docked library chips sit over the leaf labels, so dim the leaves while linking
      if (phone && n.kind === 'leaf') o *= 1 - 0.88 * smooth(3.0, 3.35, p);
      if (o < 0.01) { n.el.style.opacity = '0'; continue; }
      _a.copy(n.world).project(camera);
      if (_a.z > 1) { n.el.style.opacity = '0'; continue; }
      const x = ((_a.x + 1) / 2) * W, y = ((1 - _a.y) / 2) * H;
      let tr;
      if (n.kind === 'leaf') tr = `translate(${(x + 12).toFixed(1)}px, ${y.toFixed(1)}px) translateY(-50%)`;
      else if (n.kind === 'area') tr = `translate(${x.toFixed(1)}px, ${(y - 16).toFixed(1)}px) translate(-50%, -100%)`;
      else tr = `translate(${x.toFixed(1)}px, ${(y + 26).toFixed(1)}px) translateX(-50%)`;
      n.el.style.transform = tr;
      n.el.style.opacity = o.toFixed(3);
      if (n.dead) n.el.classList.toggle('struck', p > 2.12);
    }

    /* HUD + panels */
    if (bytesEl && html.classList.contains('fx')) bytesEl.textContent = String(Math.round(deadBytes * smooth(2.25, 2.8, p)));
    // 6 is the runtime section after the 3D stages; main.js flags it on <html>.
    const stage = html.classList.contains('in-run') ? 6 : Math.min(5, Math.floor(p + 0.25));
    if (stage !== lastStage) {
      lastStage = stage;
      logEl.textContent = LOG[stage];
      steps.forEach((s, i) => { s.classList.toggle('on', i + 1 === stage); s.classList.toggle('done', i + 1 < stage); });
    }
    dustMat.uniforms.uFade.value = 1 - smooth(4.6, 5, p) * 0.5;
  }
  const _errC = col('err');

  /* ---------- resize ---------- */
  function resize() {
    W = innerWidth; H = innerHeight;
    camera.aspect = W / H;
    renderer.setSize(W, H, false);
    composer.setSize(W, H);
    bloom.resolution.set(W, H);
    finish.uniforms.uAspect.value = W / H;
    dustMat.uniforms.uPx.value = dpr * (H / 900);
  }
  addEventListener('resize', resize);
  resize();

  function render() {
    composer.render();
    window.__frames++;
  }

  /* ---------- reduced motion or no GSAP: one still frame ---------- */
  if (!motion) {
    html.classList.add('still');
    const still = () => {
      update(4.0, 6.0, 0);
      labelsEl.style.display = 'none';
      steps.forEach((st) => st.classList.remove('on', 'done'));
      render();
    };
    still();
    addEventListener('resize', still);
    return;
  }

  /* ---------- scroll wiring ---------- */
  html.classList.add('fx');
  gsap.registerPlugin(ScrollTrigger);
  gsap.ticker.lagSmoothing(0);
  const prog = [0, 0, 0, 0, 0, 0];
  document.querySelectorAll('.stage').forEach((sec) => {
    const k = +sec.dataset.stage;
    const panel = sec.querySelector('.panel, .card');
    ScrollTrigger.create({
      trigger: sec,
      start: 'top bottom',
      endTrigger: k === 5 ? sec : panel,
      end: k === 5 ? 'top top' : phone ? 'top 78%' : 'top 32%',
      onUpdate: (self) => { prog[k] = self.progress; },
      onRefresh: (self) => { prog[k] = self.progress; },
    });
    if (k !== 5) {
      gsap.from(panel.children, {
        y: 28, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.06,
        scrollTrigger: { trigger: panel, start: 'top 88%', toggleActions: 'play none none reverse' },
      });
    }
  });
  ScrollTrigger.refresh();

  if (location.search.includes('debug')) window.__dbg = { bloom, scene, tokenSet, gyro, tiles, libSet, beams, renderer, composer, dustMat };
  let p = 0, last = performance.now(), t = 0, warmed = false;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now; t += dt;
    // While the intro covers the page, render once to compile shaders, then wait.
    if (html.classList.contains('loading') && window.__frames > 0 && warmed) { requestAnimationFrame(frame); return; }
    warmed = true;
    const target = prog.reduce((a, b) => a + b, 0);
    p = window.__snap ? target : p + (target - p) * (1 - Math.exp(-dt * 5));
    window.__p = p;
    update(p, t, dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
