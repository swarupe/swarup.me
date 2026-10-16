// 3D version of the career map. Lines are elevated viaducts at different
// heights, trains run along them, and every station label is a real link.
// mount() returns { refreshTheme }. Throws if WebGL or the CDN fails, and
// main.js keeps the flat SVG map in that case.

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LINES, FIRST_YEAR, LAST_YEAR, W, H, LANE_TOP, AXIS_Y, x, lineRoute } from './map-data.js';

const SCALE = 100;
const LEVEL = { infra: 1.35, product: 0.95, data: 0.55, ai: 0.15 };
const TUBE_RADIUS = 0.055;
const INTRO_SECONDS = 2.8;

const toWorld = (px, py, h) => new THREE.Vector3((px - W / 2) / SCALE, h, (py - H / 2) / SCALE);
const ease = (t) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
const levelOf = (keys) => keys.reduce((s, k) => s + LEVEL[k], 0) / keys.length;

function readTheme() {
  const css = getComputedStyle(document.documentElement);
  const get = (name) => new THREE.Color(css.getPropertyValue(name).trim());
  return {
    surface: get('--surface'),
    ink: get('--ink'),
    rule: get('--rule'),
    glow: get('--board-ink'),
    lines: Object.fromEntries(LINES.map((l) => [l.key, get(l.color)])),
    dark: css.getPropertyValue('color-scheme').trim() === 'dark',
  };
}

function polylineCurve(points) {
  const path = new THREE.CurvePath();
  for (let i = 1; i < points.length; i++) path.add(new THREE.LineCurve3(points[i - 1], points[i]));
  return path;
}

function label(html, className, href) {
  const node = document.createElement(href ? 'a' : 'div');
  node.className = className;
  if (href) node.href = href;
  node.innerHTML = html;
  return node;
}

export function mount(host, stations) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const narrow = () => host.clientWidth < 700;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, narrow() ? 1.5 : 2));
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const labels = new CSS2DRenderer();
  labels.domElement.className = 's3-labels';

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 14, 30);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  const target = new THREE.Vector3(0.1, 0.45, 0.05);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-4, 8, 6);
  scene.add(sun);

  const world = new THREE.Group();
  scene.add(world);

  // Ground grid: one rail per year, like the ticks on the flat map.
  const gridMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.6 });
  const zTop = (LANE_TOP - 70 - H / 2) / SCALE;
  const zBottom = (AXIS_Y - H / 2) / SCALE;
  for (let year = FIRST_YEAR; year < LAST_YEAR; year++) {
    const gx = (x(year) - W / 2) / SCALE;
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(gx, 0, zTop), new THREE.Vector3(gx, 0, zBottom)]);
    world.add(new THREE.Line(g, gridMat));
    const yl = new CSS2DObject(label(String(year), 's3-year'));
    yl.position.set(gx + 0.05, 0, zBottom + 0.12);
    yl.center.set(0, 0);
    world.add(yl);
  }

  const pillarMat = new THREE.MeshStandardMaterial({ roughness: 0.8, transparent: true, opacity: 0.55 });
  const pillarGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 6);
  const addPillar = (p) => {
    const m = new THREE.Mesh(pillarGeo, pillarMat);
    m.scale.y = p.y;
    m.position.set(p.x, p.y / 2, p.z);
    world.add(m);
  };

  const lineParts = [];
  const trains = [];
  for (const line of LINES) {
    const r = lineRoute(line, stations);
    if (!r) continue;
    // Station points sit at the station's height; lane points at the line's.
    const stationAt = (px, py) => stations.find((s) => s.x === px && s.y === py && s.lines.includes(line.key));
    const lift = ([px, py]) => {
      const s = stationAt(px, py);
      return toWorld(px, py, s ? levelOf(s.lines) : LEVEL[line.key]);
    };
    const curve = polylineCurve(r.route.map(lift));
    const segs = Math.max(40, Math.round(curve.getLength() * 40));
    const geo = new THREE.TubeGeometry(curve, segs, TUBE_RADIUS, 10, false);
    geo.setDrawRange(0, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.1 });
    world.add(new THREE.Mesh(geo, mat));

    const length = curve.getLength();
    for (let d = 0.6; d < length; d += 1.1) addPillar(curve.getPointAt(d / length));

    // Dotted tail: still running.
    const tailCurve = polylineCurve(r.tail.map(lift));
    const dotGeo = new THREE.SphereGeometry(TUBE_RADIUS * 0.9, 10, 8);
    const dots = [];
    for (let d = 0.12; d < tailCurve.getLength(); d += 0.16) {
      const dot = new THREE.Mesh(dotGeo, mat);
      dot.position.copy(tailCurve.getPointAt(d / tailCurve.getLength()));
      dot.visible = false;
      world.add(dot);
      dots.push(dot);
    }

    const name = new CSS2DObject(label(line.name, 's3-name'));
    name.position.copy(lift(r.route[0])).add(new THREE.Vector3(-0.25, 0, 0));
    name.center.set(1, 0.5);
    name.element.style.setProperty('--c', `var(${line.color})`);
    world.add(name);

    lineParts.push({ key: line.key, geo, mat, dots, delay: lineParts.length * 0.25, name });

    const trainMat = new THREE.MeshStandardMaterial({ emissiveIntensity: 2.2, roughness: 0.3 });
    for (let k = 0; k < 2; k++) {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.24, 6, 12), trainMat);
      world.add(mesh);
      trains.push({ mesh, mat: trainMat, curve, length, key: line.key, offset: k * 0.5, speed: 0.9 + 0.15 * lineParts.length });
    }
  }

  const stationMeshes = [];
  const discMat = new THREE.MeshStandardMaterial({ roughness: 0.4 });
  const ringMat = new THREE.MeshStandardMaterial({ roughness: 0.5 });
  const pulseMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const pulses = [];
  stations.forEach((s, i) => {
    const pos = toWorld(s.x, s.y, levelOf(s.lines));
    const big = s.lines.length > 1;
    const radius = big ? 0.15 : 0.1;
    const group = new THREE.Group();
    group.position.copy(pos);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.07, 32), discMat);
    disc.userData.id = s.id;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.026, 10, 40), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.036;
    group.add(disc, ring);
    group.scale.setScalar(0.001);
    world.add(group);
    addPillar(pos);
    stationMeshes.push(disc);

    if (s.year >= LAST_YEAR - 1) {
      const pulse = new THREE.Mesh(new THREE.RingGeometry(radius * 1.1, radius * 1.35, 40), pulseMat);
      pulse.rotation.x = -Math.PI / 2;
      pulse.position.y = 0.04;
      group.add(pulse);
      pulses.push(pulse);
    }

    // Flip the label below the station when a neighbour on the same lane is close.
    const crowded = stations.slice(0, i).some((o) => Math.abs(o.x - s.x) < 60 && Math.abs(o.y - s.y) < 1);
    const a = label(`<span>${s.label}</span>`, crowded ? 's3-station s3-station--below' : 's3-station', `#${s.id}`);
    a.setAttribute('aria-label', `${s.label}, ${Math.floor(s.year)}`);
    if (s.year < FIRST_YEAR + 2) a.classList.add('s3-station--far');
    const tag = new CSS2DObject(a);
    tag.position.set(0, crowded ? -0.04 : 0.12, 0);
    tag.center.set(0, crowded ? 0 : 1);
    group.add(tag);
    group.userData = { delay: 0.5 + i * 0.09, tag: a };
  });

  // Theme: materials take their colours from the same CSS tokens as the SVG.
  let composer = null;
  let bloom = false;
  function refreshTheme() {
    const t = readTheme();
    scene.background = t.surface;
    scene.fog.color.copy(t.surface);
    gridMat.color.copy(t.rule);
    pillarMat.color.copy(t.rule);
    discMat.color.copy(t.surface);
    ringMat.color.copy(t.ink);
    pulseMat.color.copy(t.glow);
    for (const p of lineParts) {
      p.mat.color.copy(t.lines[p.key]);
      p.mat.emissive.copy(t.lines[p.key]).multiplyScalar(t.dark ? 0.35 : 0.05);
    }
    for (const tr of trains) {
      tr.mat.color.copy(t.dark ? new THREE.Color(0xffffff) : t.lines[tr.key]);
      tr.mat.emissive.copy(t.dark ? t.glow : t.lines[tr.key]).multiplyScalar(t.dark ? 1 : 0.6);
    }
    bloom = t.dark && !narrow();
    if (bloom && !composer) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.5, 0.6));
      composer.addPass(new OutputPass());
    }
    if (composer) composer.setSize(host.clientWidth, host.clientHeight);
  }

  // Camera: fit the whole map for the current aspect, then drift gently.
  const base = { az: 0, el: 0, dist: 10 };
  const corners = [];
  for (const cx of [(x(FIRST_YEAR) - 90 - W / 2) / SCALE, (x(LAST_YEAR) - W / 2) / SCALE])
    for (const cz of [zTop, zBottom + 0.2])
      for (const cy of [0, 1.6]) corners.push(new THREE.Vector3(cx, cy, cz));

  function placeCamera(az, el, dist) {
    camera.position.set(
      target.x + dist * Math.sin(az) * Math.cos(el),
      target.y + dist * Math.sin(el),
      target.z + dist * Math.cos(az) * Math.cos(el),
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }

  function fit() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const portrait = w / h < 1;
    // Portrait screens look down the time axis from 2026, so recent work is
    // in front and the four lanes spread across the narrow width.
    base.az = THREE.MathUtils.degToRad(portrait ? 90 : -14);
    base.el = THREE.MathUtils.degToRad(portrait ? 74 : 38);
    host.classList.toggle('is-portrait', portrait);
    // Portrait: shift the map into the left of the frame so labels have room on the right.
    if (portrait) camera.setViewOffset(w, h, w * 0.2, 0, w, h);
    else camera.clearViewOffset();
    const xMin = -0.95;
    const xMax = portrait ? 0.35 : 0.95;
    let lo = 2;
    let hi = 80;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      placeCamera(base.az, base.el, mid);
      const fits = corners.every((c) => {
        const p = c.clone().project(camera);
        return p.x > xMin && p.x < xMax && Math.abs(p.y) < 0.9;
      });
      if (fits) hi = mid; else lo = mid;
    }
    base.dist = hi;
    // Fog fades the far end of the map, whatever distance the camera fits at.
    scene.fog.near = hi * 0.85;
    scene.fog.far = hi * 2.2;
    if (composer) composer.setSize(w, h);
  }

  // Pointer: parallax, hover and click on station discs.
  const pointer = { x: 0, y: 0, sx: 0, sy: 0, ndc: new THREE.Vector2(9, 9) };
  const raycaster = new THREE.Raycaster();
  host.addEventListener('pointermove', (e) => {
    const r = host.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    pointer.ndc.set(pointer.x, -pointer.y);
  });
  host.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; pointer.ndc.set(9, 9); });
  // Aim at the click itself: a tap on a phone has no pointermove before it.
  renderer.domElement.addEventListener('click', (e) => {
    const r = host.getBoundingClientRect();
    const at = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(at, camera);
    const hit = raycaster.intersectObjects(stationMeshes)[0];
    if (hit) location.hash = hit.object.userData.id;
  });

  host.classList.add('is-3d');
  host.replaceChildren(renderer.domElement, labels.domElement);
  refreshTheme();
  fit();
  new ResizeObserver(fit).observe(host);

  const clock = new THREE.Clock();
  const stats = (window.__scene = { frames: 0 });
  let hovered = null;

  function frame() {
    const t = clock.getElapsedTime();
    const intro = ease(t / INTRO_SECONDS);

    pointer.sx += (pointer.x - pointer.sx) * 0.05;
    pointer.sy += (pointer.y - pointer.sy) * 0.05;
    placeCamera(
      base.az - (1 - intro) * 0.9 + Math.sin(t * 0.12) * 0.06 + pointer.sx * 0.12,
      base.el + (1 - intro) * 0.45 + pointer.sy * 0.06,
      base.dist * (1 + (1 - intro) * 0.7),
    );

    for (const p of lineParts) {
      const grow = ease((t - p.delay) / 1.8);
      const step = 10 * 6;
      p.geo.setDrawRange(0, Math.floor((p.geo.index.count * grow) / step) * step);
      p.dots.forEach((d, i) => { d.visible = grow >= 1 && Math.floor(t * 6 - i) % 3 !== 0; });
    }
    for (const g of world.children) {
      if (g.userData?.delay === undefined) continue;
      const s = ease((t - g.userData.delay) / 0.5);
      g.scale.setScalar(Math.max(0.001, s));
      g.userData.tag.style.opacity = s;
    }
    for (const tr of trains) {
      const run = Math.max(0, t - 1.6);
      const u = ((run * tr.speed) / tr.length + tr.offset) % 2;
      const along = u < 1 ? u : 2 - u;
      tr.mesh.visible = t > 1.6;
      tr.mesh.position.copy(tr.curve.getPointAt(along));
      tr.mesh.position.y += 0.07;
      const dir = tr.curve.getTangentAt(along);
      tr.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }
    pulses.forEach((p, i) => {
      const k = (t * 0.6 + i * 0.3) % 1;
      p.scale.setScalar(1 + k * 1.8);
      p.material.opacity = 0.8 * (1 - k);
    });

    raycaster.setFromCamera(pointer.ndc, camera);
    const hit = raycaster.intersectObjects(stationMeshes)[0]?.object ?? null;
    if (hit !== hovered) {
      hovered?.parent.userData.tag.classList.remove('is-hot');
      hit?.parent.userData.tag.classList.add('is-hot');
      renderer.domElement.style.cursor = hit ? 'pointer' : '';
      hovered = hit;
    }

    if (bloom && composer) composer.render(); else renderer.render(scene, camera);
    labels.render(scene, camera);
    stats.frames++;
  }

  // Only render while the map is on screen and the tab is visible.
  let onScreen = true;
  const sync = () => renderer.setAnimationLoop(onScreen && !document.hidden ? frame : null);
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }).observe(host);
  document.addEventListener('visibilitychange', sync);
  sync();

  return { refreshTheme };
}
