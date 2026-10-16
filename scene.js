// Particle pipeline. Every particle's position is a pure function of its
// seed, the time and the current chapter, computed in the vertex shader, so
// moving between chapters is one uniform blend and the CPU does no per-frame work.
//
// Chapters: 0 stream, 1 ingest, 2 key by and window, 3 columnar store,
// 4 fan-out to consumers, 5 segmentation map.

import * as THREE from 'three';

export const LATE_SHARE = 0.035;
const MEAN_SPEED = 0.085; // loops per second, mean of 0.05 + 0.07 * U(0,1)

const vertex = /* glsl */ `
  attribute vec4 aSeed;
  attribute vec2 aGrid;
  attribute float aSize;
  uniform float uTime, uState, uFocus, uHalfW, uHalfH, uPixelRatio, uMouseOn;
  uniform vec2 uMouse;
  varying vec3 vColor;
  varying float vAlpha;

  const vec3 BASE = vec3(0.93, 0.91, 0.87);
  const vec3 ACCENT = vec3(1.0, 0.61, 0.27);
  const vec3 LATE = vec3(1.0, 0.25, 0.25);

  float hash(float n) { return fract(sin(n) * 43758.5453); }
  vec3 keyColor(float k) {
    if (k < 1.0) return ACCENT;
    if (k < 2.0) return vec3(0.49, 0.77, 1.0);
    if (k < 3.0) return vec3(0.73, 0.95, 0.49);
    return vec3(0.95, 0.49, 0.77);
  }
  float edge(float ph) { return smoothstep(0.0, 0.05, ph) * smoothstep(1.0, 0.95, ph); }

  void chapter(int i, float ph, out vec3 p, out vec3 c, out float a) {
    vec4 s = aSeed;
    a = edge(ph);
    if (i == 0) {
      // A loose river of events.
      float u = -1.15 + 2.3 * ph;
      p = vec3(u, 0.64 + (s.z - 0.5) * 0.34 + 0.08 * sin(u * 2.5 + uTime * 0.4 + s.w * 3.0), (s.w - 0.5) * 3.0);
      c = s.w > 0.94 ? ACCENT : BASE;
    } else if (i == 1) {
      // Seven sources converge into one pipe.
      float src = floor(s.z * 7.0);
      float conv = smoothstep(0.05, 0.55, ph);
      float u = -1.1 + 2.2 * ph;
      float vs = -0.8 + src * (1.6 / 6.0) + (s.w - 0.5) * 0.06;
      p = vec3(u, mix(vs, (s.w - 0.5) * 0.12, conv), mix((hash(src) - 0.5) * 3.0, (s.y - 0.5) * 0.4, conv));
      c = mix(BASE * 0.8, ACCENT, conv * 0.55);
    } else if (i == 2) {
      // Key by into four lanes, then tumbling windows; late events drop to a side output.
      float key = floor(s.z * 4.0);
      float u = -1.1 + 2.2 * ph;
      float split = smoothstep(-0.55, -0.2, u);
      float v = mix((s.w - 0.5) * 0.12, -0.6 + key * 0.4 + (s.w - 0.5) * 0.1, split);
      if (u > -0.15) {
        float w = 0.28;
        float k = (u + 0.15) / w;
        u = -0.15 + floor(k) * w + fract(k) * w * 0.72;
      }
      c = mix(BASE, keyColor(key), split);
      if (s.y < ${LATE_SHARE.toFixed(3)} && u > 0.2) {
        float drop = smoothstep(0.2, 0.45, u);
        v = mix(v, -0.95, drop);
        c = mix(c, LATE, drop);
      }
      p = vec3(u, v, (s.x - 0.5) * 0.5);
    } else if (i == 3) {
      // Land in twelve columns that keep growing.
      float col = floor(s.z * 12.0);
      float colU = -0.6 + col * (1.5 / 11.0);
      float h = (0.35 + 0.55 * hash(col + 1.3)) * (0.88 + 0.12 * sin(uTime * 0.3 + col));
      float y = -0.75 + s.w * h * 1.5;
      if (ph < 0.35) {
        float q = ph / 0.35;
        p = vec3(mix(-1.1, colU, q), mix(0.0, y, smoothstep(0.55, 1.0, q)), 0.0);
        c = BASE;
      } else {
        p = vec3(colU + (s.y - 0.5) * 0.07, y, (fract(s.y * 7.0) - 0.5) * 0.35);
        c = mix(ACCENT, BASE, s.w);
      }
    } else if (i == 4) {
      // A core that fans out to nine consumers.
      float core = -0.35;
      if (s.y > 0.86) {
        float ang = uTime * 0.8 + s.x * 6.2832;
        float r = 0.07 + s.w * 0.05;
        float tilt = s.z * 3.1416;
        p = vec3(core + cos(ang) * r, sin(ang) * r * 1.7 * cos(tilt), sin(ang) * r * 4.0 * sin(tilt));
        c = ACCENT;
        a = 1.0;
      } else if (ph < 0.3) {
        float q = ph / 0.3;
        p = vec3(mix(-1.1, core, q), (s.w - 0.5) * 0.12 * (1.0 - q), 0.0);
        c = BASE;
      } else {
        float q = (ph - 0.3) / 0.7;
        float e = floor(s.z * 9.0);
        float t = smoothstep(0.0, 0.7, q);
        p = vec3(mix(core, 0.95, q), mix(0.0, -0.8 + e * 0.2, t), mix(0.0, (hash(e + 4.0) - 0.5) * 2.0, t));
        c = mix(BASE, keyColor(mod(e, 4.0)), t);
      }
    } else {
      // A tilted land-cover map, classified by a sweeping scan.
      vec2 g = aGrid;
      float vv = g.y - 0.5;
      float wave = 0.04 * sin(g.x * 10.0 + uTime * 0.8);
      p = vec3(-0.55 + g.x * 1.5, vv * 0.75 + wave, vv * 2.6);
      float n = sin(g.x * 7.0 + 1.3) * cos(g.y * 6.0 - 0.7) + 0.5 * sin((g.x + g.y) * 5.0);
      vec3 cls = n < -0.5 ? vec3(0.30, 0.64, 1.0) : n < 0.1 ? vec3(0.49, 0.85, 0.34) : n < 0.6 ? ACCENT : vec3(0.79, 0.70, 0.54);
      float scan = fract(uTime * 0.07) * 1.3 - 0.15;
      c = mix(BASE * 0.55, cls, smoothstep(scan + 0.02, scan - 0.02, g.x));
      a = 1.0;
    }
  }

  void main() {
    float speed = 0.05 + 0.07 * aSeed.y;
    float ph = fract(aSeed.x + uTime * speed);
    float st = clamp(uState, 0.0, 5.0);
    int i0 = int(floor(st));
    int i1 = int(min(floor(st) + 1.0, 5.0));
    float f = smoothstep(0.0, 1.0, fract(st));

    vec3 p0, p1, c0, c1; float a0, a1;
    chapter(i0, ph, p0, c0, a0);
    chapter(i1, ph, p1, c1, a1);
    vec3 p = mix(p0, p1, f);

    // Chapters sit to the right of the text panel on wide screens.
    p.x = p.x * mix(1.0, 0.6, uFocus) + 0.38 * uFocus;
    vec3 world = vec3(p.x * uHalfW * 0.92, p.y * uHalfH * 0.82, p.z);

    vec2 d = world.xy - uMouse;
    float dist = length(d) + 1e-4;
    world.xy += (d / dist) * max(0.0, 0.9 - dist) * 0.55 * uMouseOn;

    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (28.0 / -mv.z);
    vColor = mix(c0, c1, f);
    vAlpha = mix(a0, a1, f);
  }
`;

const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a * 0.85);
  }
`;

export function mount(canvas, { count, still }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x07080b, 1);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  const scene = new THREE.Scene();

  const seeds = new Float32Array(count * 4);
  const grid = new Float32Array(count * 2);
  const sizes = new Float32Array(count);
  const cols = Math.round(Math.sqrt(count * 1.6));
  const rows = Math.ceil(count / cols);
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 4; k++) seeds[i * 4 + k] = Math.random();
    grid[i * 2] = (i % cols) / (cols - 1);
    grid[i * 2 + 1] = Math.floor(i / cols) / (rows - 1);
    sizes[i] = 0.6 + Math.random() ** 3 * 1.8;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  geometry.setAttribute('aGrid', new THREE.BufferAttribute(grid, 2));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const uniforms = {
    uTime: { value: 0 }, uState: { value: 0 }, uFocus: { value: 0 },
    uHalfW: { value: 1 }, uHalfH: { value: 1 }, uPixelRatio: { value: 1 },
    uMouse: { value: new THREE.Vector2(99, 99) }, uMouseOn: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment, uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  const target = { state: 0, focus: 0, mx: 99, my: 99, mouseOn: 0 };

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio, w < 820 ? 1.5 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniforms.uHalfH.value = Math.tan(THREE.MathUtils.degToRad(17.5)) * 10;
    uniforms.uHalfW.value = uniforms.uHalfH.value * camera.aspect;
    uniforms.uPixelRatio.value = dpr;
    if (still) draw();
  }

  const clock = new THREE.Clock();
  const stats = (window.__scene = { frames: 0 });
  function draw() {
    renderer.render(scene, camera);
    stats.frames++;
  }
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    uniforms.uTime.value += dt;
    const k = 1 - Math.exp(-dt * 3);
    uniforms.uState.value += (target.state - uniforms.uState.value) * k;
    uniforms.uFocus.value += (target.focus - uniforms.uFocus.value) * k;
    uniforms.uMouse.value.x += (target.mx - uniforms.uMouse.value.x) * 0.12;
    uniforms.uMouse.value.y += (target.my - uniforms.uMouse.value.y) * 0.12;
    uniforms.uMouseOn.value += (target.mouseOn - uniforms.uMouseOn.value) * 0.08;
    camera.position.x = Math.sin(uniforms.uTime.value * 0.05) * 0.4;
    camera.position.y = Math.cos(uniforms.uTime.value * 0.04) * 0.2;
    camera.lookAt(0, 0, 0);
    draw();
  }

  new ResizeObserver(resize).observe(canvas);
  resize();

  let running = false;
  const play = (on) => {
    running = on && !still;
    renderer.setAnimationLoop(running ? frame : null);
  };
  document.addEventListener('visibilitychange', () => play(!document.hidden));
  play(true);
  if (still) {
    uniforms.uTime.value = 6;
    draw();
  }

  return {
    rate: Math.round(count * MEAN_SPEED),
    setState(state) {
      target.state = state;
      if (still) { uniforms.uState.value = state; draw(); }
    },
    setFocus(focus) {
      target.focus = focus;
      if (still) { uniforms.uFocus.value = focus; draw(); }
    },
    // x, y in -1..1 of the canvas; on = whether the pointer is over it.
    setPointer(x, y, on) {
      target.mx = x * uniforms.uHalfW.value;
      target.my = -y * uniforms.uHalfH.value;
      target.mouseOn = on ? 1 : 0;
    },
  };
}
