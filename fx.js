// Motion layer. main.js loads this only when the visitor has not asked for
// reduced motion, so nothing here needs its own check.

const FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·';
const BOARD_LINES = [
  'Backend · DevOps · Streaming pipelines · Data platforms',
  'Lead Engineer · Centre of Data for Public Good',
  'M.Tech (Online) · IISc · since Aug 2025',
  'Flink · Kubernetes · ClickHouse · Go · TypeScript',
];

// Split-flap board: each character spins through letters before it lands.
function splitFlap() {
  const node = document.querySelector('.board__text');
  if (!node) return;
  node.setAttribute('aria-hidden', 'true');
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = BOARD_LINES[0];
  node.after(sr);

  let index = 0;
  const flip = (text) => {
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      let out = '';
      let done = true;
      for (let i = 0; i < text.length; i++) {
        const settle = 120 + i * 22;
        if (elapsed >= settle || text[i] === ' ') out += text[i];
        else {
          out += FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)];
          done = false;
        }
      }
      node.textContent = out;
      if (!done) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  flip(BOARD_LINES[0]);
  setInterval(() => {
    if (document.hidden) return;
    index = (index + 1) % BOARD_LINES.length;
    flip(BOARD_LINES[index]);
  }, 5200);
}

// Name: letters drop in with a 3D swing.
function dropName() {
  const h1 = document.querySelector('.hero h1');
  if (!h1) return;
  const text = h1.textContent;
  h1.setAttribute('aria-label', text);
  h1.innerHTML = [...text]
    .map((ch, i) => `<span class="ch" aria-hidden="true" style="--i:${i}">${ch === ' ' ? '&nbsp;' : ch}</span>`)
    .join('');
  h1.classList.add('is-split');
}

// Sections, cards and timeline stops rise into place as they scroll in.
function reveals() {
  const targets = document.querySelectorAll('section:not(.hero) h2, .card, .stop, .stacklist > div, .contact, .socials');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  targets.forEach((t, i) => {
    t.classList.add('reveal');
    t.style.setProperty('--stagger', `${(i % 3) * 70}ms`);
    io.observe(t);
  });
}

// Cards tilt toward the pointer, with a glare that follows it.
function tilt() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  for (const card of document.querySelectorAll('.card')) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--ry', `${(px - 0.5) * 7}deg`);
      card.style.setProperty('--rx', `${(0.5 - py) * 7}deg`);
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
      card.classList.add('is-tilting');
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
      card.classList.remove('is-tilting');
    });
  }
}

// The timeline track fills as you scroll through it.
function timelineTrack() {
  const list = document.querySelector('.timeline');
  if (!list) return;
  list.classList.add('is-tracked');
  const update = () => {
    const r = list.getBoundingClientRect();
    const progress = (innerHeight * 0.6 - r.top) / r.height;
    list.style.setProperty('--progress', Math.min(1, Math.max(0, progress)).toFixed(3));
  };
  addEventListener('scroll', update, { passive: true });
  update();
}

export function start() {
  splitFlap();
  dropName();
  reveals();
  tilt();
  timelineTrack();
}
