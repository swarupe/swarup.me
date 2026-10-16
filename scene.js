// The 3D corridor: eight glass layers, a request packet with a particle trail,
// bloom and a lens pass. Scroll sets `progress` (0..1); the camera follows.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const LAYERS = [
  ['edge', 'video server · uploads'],
  ['auth', 'keycloak · jwt · policy'],
  ['api', 'go · express · graphql'],
  ['queue', 'rabbitmq · redis'],
  ['stream', 'flink · event hubs'],
  ['storage', 'clickhouse · ceph · minio'],
  ['cluster', 'kubernetes · jupyterhub'],
  ['browser', 'angular · react · duckdb'],
];
const N = LAYERS.length;
const GAP = 14;                       // distance between layers
const slabZ = (i) => -(i + 1) * GAP;
const BG = new THREE.Color('#05070d');
const COOL = new THREE.Color('#8ea2d8');
const HOT = new THREE.Color('#ff5b2e');

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

export async function initScene({ canvas, reduce }) {
  const phone = innerWidth < 640;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !phone, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = BG;
  scene.fog = new THREE.FogExp2(BG, phone ? 0.03 : 0.024);

  const camera = new THREE.PerspectiveCamera(phone ? 74 : 52, innerWidth / innerHeight, 0.05, 260);

  scene.add(new THREE.AmbientLight(0x4a5a8a, 0.6));
  const key = new THREE.DirectionalLight(0x9fb2ff, 1.2);
  key.position.set(-6, 10, 8);
  scene.add(key);

  // ---------- layers ----------
  // Portrait screens get portrait layers so the rims stay in view.
  const [W, H, AW, AH] = phone ? [5.4, 7.6, 2.2, 2.6] : [10, 6.2, 3.4, 2.1];
  const shape = roundedRect(W, H, 0.42);
  shape.holes.push(roundedRect(AW, AH, 0.32));
  const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 10 });
  slabGeo.translate(0, 0, -0.11);
  const faceGeo = new THREE.PlaneGeometry(W + 1.2, H + 1.2);

  if (document.fonts?.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);

  const slabs = LAYERS.map(([name, sub], i) => {
    const g = new THREE.Group();
    g.position.set(0, 0, slabZ(i));
    g.rotation.z = (i % 2 ? 1 : -1) * 0.025;

    const glass = new THREE.Mesh(slabGeo, new THREE.MeshPhysicalMaterial({
      color: 0x9fb0e6, roughness: 0.12, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08,
      transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide,
      emissive: 0x1a2340, emissiveIntensity: 0.3,
    }));
    g.add(glass);

    const face = new THREE.Mesh(faceGeo, faceMaterial(W, H, AW, AH, i));
    face.position.z = 0.13;
    g.add(face);

    const label = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshBasicMaterial({
      map: labelTexture(i, name, sub), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
    }));
    label.position.set(-W / 2 + 2.55, H / 2 - 0.85, 0.16);
    if (phone) { label.scale.setScalar(0.85); label.position.x = -W / 2 + 2.2; }
    g.add(label);

    scene.add(g);
    return { g, face, label, glass };
  });

  // Rails that tie the layers into one corridor.
  const railMat = new THREE.LineBasicMaterial({ color: COOL, transparent: true, opacity: 0.22, fog: true });
  const railPts = [];
  for (const [x, y] of [[-W / 2, -H / 2], [W / 2, -H / 2], [-W / 2, H / 2], [W / 2, H / 2]]) {
    railPts.push(new THREE.Vector3(x, y, slabZ(0)), new THREE.Vector3(x, y, slabZ(N - 1) - 30));
  }
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(railPts), railMat));


  // The trace wire the packet rides on.
  const wire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 150, 6, 1, true).rotateX(Math.PI / 2).translate(0, 0, -75),
    new THREE.MeshBasicMaterial({ color: HOT, transparent: true, opacity: 0.22, fog: true }),
  );
  scene.add(wire);

  // ---------- packet ----------
  const packet = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.2, 1.5) }));
  packet.add(core);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: HOT, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
  halo.scale.setScalar(2.4);
  packet.add(halo);
  const light = new THREE.PointLight(HOT, 40, 22, 1.5);
  packet.add(light);
  scene.add(packet);

  // ---------- particles ----------
  const trail = makeTrail(phone ? 160 : 420);
  scene.add(trail.points);
  const dust = makeDust(phone ? 600 : 1800);
  scene.add(dust);

  // ---------- post ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / (phone ? 2 : 1), innerHeight / (phone ? 2 : 1)), phone ? 0.6 : 0.85, 0.55, 0.32);
  composer.addPass(bloom);
  const lens = new ShaderPass(lensShader());
  composer.addPass(lens);
  composer.addPass(new OutputPass());
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);

  // ---------- state ----------
  let target = 0, progress = 0, visible = true;
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  // Hero: stand off to the side so the layers fan out in perspective.
  const heroPos = phone ? new THREE.Vector3(-4.5, 3.2, 8) : new THREE.Vector3(-13, 4.5, 10);
  const heroLook = phone ? new THREE.Vector3(2.5, 1.2, -70) : new THREE.Vector3(2, -0.5, -70);
  const tmp = new THREE.Vector3(), look = new THREE.Vector3();

  function pose(p, t) {
    // Corridor z: in front of layer k at p = (k+1)/N.
    const camZ = 9 - p * N * GAP;
    const corridor = tmp.set(Math.sin(t * 0.3) * 0.15, 0.55 + Math.cos(t * 0.25) * 0.1, camZ);
    const blend = smooth(clamp01(p * N));
    camera.position.lerpVectors(heroPos, corridor, blend);
    camera.position.x += mouse.sx * 0.7;
    camera.position.y -= mouse.sy * 0.45;

    // The packet waits in front of the first layer, then leads the camera.
    const pz = Math.min(camZ - 4.5, slabZ(0) + 7);
    packet.position.set(Math.cos(t * 2.1) * 0.35, Math.sin(t * 2.1) * 0.35, pz);
    look.set(packet.position.x * 0.3, 0.2, camZ - 30);
    look.lerpVectors(heroLook, look, blend);
    camera.lookAt(look);
    camera.rotation.z += mouse.sx * -0.02;
    // Desktop: nudge the corridor right of the layer cards.
    if (!phone) camera.rotateY(0.1 * blend);
    // Phone: the hero copy sits low, so lift the corridor into the top half.
    else {
      camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * 0.33 * (1 - blend), innerWidth, innerHeight);
      camera.updateProjectionMatrix();
    }
    return pz;
  }

  const clock = new THREE.Clock();
  window.__frames = window.__frames || 0;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    progress += (target - progress) * (1 - Math.exp(-dt * 7));
    mouse.sx += (mouse.x - mouse.sx) * (1 - Math.exp(-dt * 3));
    mouse.sy += (mouse.y - mouse.sy) * (1 - Math.exp(-dt * 3));

    const pz = pose(progress, t);
    for (let i = 0; i < N; i++) {
      const d = pz - slabZ(i);
      const pulse = Math.exp(-(d * d) / 6);
      const u = slabs[i].face.material.uniforms;
      u.uTime.value = t;
      u.uPulse.value = pulse;
      slabs[i].glass.material.emissiveIntensity = 0.3 + pulse * 0.7;
      slabs[i].label.material.opacity = 0.55 + 0.45 * Math.max(pulse, Math.exp(-((camera.position.z - slabZ(i) - 6) ** 2) / 40));
    }
    trail.update(dt, packet.position);
    dust.material.uniforms.uTime.value = t;
    lens.uniforms.uTime.value = t;
    light.intensity = 38 + Math.sin(t * 9) * 5;

    composer.render(dt);
    window.__frames++;
  }

  function loop() {
    if (visible) frame();
    requestAnimationFrame(loop);
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    composer.setSize(innerWidth, innerHeight);
    if (reduce) frame();
  });

  if (reduce) frame();
  else loop();

  return {
    setProgress(p) { target = clamp01(p); },
    setVisible(v) { visible = v; },
  };
}

// ---------- helpers ----------

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// The lit face of a layer: rim light, light pooled inside the glass,
// scanlines, and a hot ring around the aperture when the packet passes.
function faceMaterial(W, H, AW, AH, index) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
    uniforms: {
      ...THREE.UniformsLib.fog,
      uTime: { value: 0 }, uPulse: { value: 0 }, uIndex: { value: index },
      uSize: { value: new THREE.Vector2(W + 1.2, H + 1.2) },
      uHalf: { value: new THREE.Vector2(W / 2, H / 2) },
      uAp: { value: new THREE.Vector2(AW / 2, AH / 2) },
      uCool: { value: COOL.clone() }, uHot: { value: HOT.clone() },
    },
    vertexShader: /* glsl */`
      varying vec2 vP;
      #include <fog_pars_vertex>
      uniform vec2 uSize;
      void main() {
        vP = (uv - 0.5) * uSize;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      varying vec2 vP;
      uniform float uTime, uPulse, uIndex;
      uniform vec2 uHalf, uAp;
      uniform vec3 uCool, uHot;
      #include <fog_pars_fragment>
      float sdBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        float dOut = sdBox(vP, uHalf, 0.42);
        float dIn = sdBox(vP, uAp, 0.32);
        float inside = step(dOut, 0.0) * step(0.0, dIn);

        // light pooled inside the slab, rising from the lower edge
        float pool = exp(-(vP.y + uHalf.y) * 0.55) * 0.22 + 0.035;
        float n = noise(vP * 0.9 + vec2(uTime * 0.12, uIndex * 3.1)) * noise(vP * 2.3 - vec2(0.0, uTime * 0.2));
        float body = inside * (pool + n * 0.12);

        // scanlines and a ruler along the top
        float scan = inside * smoothstep(0.92, 1.0, sin(vP.y * 22.0)) * 0.035;
        float ruler = inside * step(uHalf.y - 0.32, vP.y) * step(0.85, fract(vP.x * 2.0)) * 0.18;

        // rims
        float rimO = exp(-abs(dOut) * 26.0) * 0.85 + exp(-abs(dOut) * 4.0) * 0.12;
        float rimI = exp(-abs(dIn) * 22.0) + exp(-abs(dIn) * 3.0) * 0.25;

        vec3 col = uCool * (body + scan + ruler + rimO);
        col += mix(uCool * 0.6, uHot * 1.6, 0.25 + uPulse * 0.75) * rimI * (0.55 + uPulse * 0.9);
        col += uHot * inside * exp(-length(vP) * 0.6) * uPulse * 0.18;
        float a = 1.0;
        gl_FragColor = vec4(col, a);
        #ifdef USE_FOG
          // additive layer: fade to black, not to the fog color
          gl_FragColor.rgb *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
        #endif
      }`,
  });
}

function labelTexture(i, name, sub) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ff5b2e';
  g.font = '500 44px "JetBrains Mono", monospace';
  g.fillText(String(i + 1).padStart(2, '0'), 8, 92);
  g.fillStyle = '#e8ecf8';
  g.font = '600 104px "Inter Tight", sans-serif';
  g.fillText(name.toUpperCase(), 98, 104);
  g.fillStyle = '#8ea2d8';
  g.font = '400 38px "JetBrains Mono", monospace';
  g.fillText(sub, 10, 186);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.2, 'rgba(255,200,170,0.6)');
  r.addColorStop(0.5, 'rgba(255,120,80,0.15)');
  r.addColorStop(1, 'rgba(255,90,40,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// Particles shed by the packet. They drift back toward the camera and fade.
function makeTrail(count) {
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const life = new Float32Array(count);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('life', new THREE.BufferAttribute(life, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uHot: { value: HOT }, uCool: { value: COOL }, uScale: { value: innerHeight / 2 } },
    vertexShader: /* glsl */`
      attribute float life; varying float vL; uniform float uScale;
      void main() {
        vL = life;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = min(28.0, (0.05 + 0.09 * life) * uScale / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vL; uniform vec3 uHot, uCool;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vL;
        gl_FragColor = vec4(mix(uCool, uHot * 1.8, vL) * a, a);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  let head = 0, acc = 0;
  const rate = count / 1.6;
  return {
    points,
    update(dt, at) {
      acc += dt * rate;
      while (acc >= 1) {
        acc -= 1;
        const k = head * 3;
        pos[k] = at.x; pos[k + 1] = at.y; pos[k + 2] = at.z;
        vel[k] = (Math.random() - 0.5) * 0.6; vel[k + 1] = (Math.random() - 0.5) * 0.6; vel[k + 2] = 2.5 + Math.random() * 2;
        life[head] = 1;
        head = (head + 1) % count;
      }
      for (let i = 0; i < count; i++) {
        if (life[i] <= 0) continue;
        life[i] = Math.max(0, life[i] - dt / 1.6);
        const k = i * 3;
        pos[k] += vel[k] * dt; pos[k + 1] += vel[k + 1] * dt; pos[k + 2] += vel[k + 2] * dt;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.life.needsUpdate = true;
    },
  };
}

function makeDust(count) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 30;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
    pos[i * 3 + 2] = 18 - Math.random() * (N * GAP + 40);
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCool: { value: COOL }, uHot: { value: HOT }, uScale: { value: innerHeight / 2 } },
    vertexShader: /* glsl */`
      attribute float seed; uniform float uTime, uScale; varying float vA; varying float vS;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.3 + seed * 30.0) * 0.4;
        p.x += cos(uTime * 0.2 + seed * 20.0) * 0.3;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float depth = -mv.z;
        vA = smoothstep(0.5, 3.0, depth) * exp(-depth * 0.028) * (0.4 + 0.6 * fract(seed * 7.0));
        vS = seed;
        gl_PointSize = (0.035 + 0.05 * fract(seed * 13.0)) * uScale / max(depth, 0.5);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vA; varying float vS; uniform vec3 uCool, uHot;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d) * vA;
        vec3 c = vS > 0.94 ? uHot : uCool;
        gl_FragColor = vec4(c * a, a);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// Radial chromatic split, vignette and a little grain.
function lensShader() {
  return {
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmount: { value: 0.0022 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse; uniform float uTime, uAmount; varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec2 c = vUv - 0.5;
        float r2 = dot(c, c);
        vec2 off = c * uAmount * (1.0 + r2 * 6.0);
        vec4 base = texture2D(tDiffuse, vUv);
        float rC = texture2D(tDiffuse, vUv + off).r;
        float bC = texture2D(tDiffuse, vUv - off).b;
        vec3 col = vec3(rC, base.g, bC);
        col *= 1.0 - smoothstep(0.18, 0.75, r2 * 1.6) * 0.65;
        col += (hash(vUv * 900.0 + uTime) - 0.5) * 0.025;
        gl_FragColor = vec4(col, 1.0);
      }`,
  };
}
