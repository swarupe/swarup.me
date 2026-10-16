// A terminal cursor for mouse users: an amber block that sits at the pointer, blinks when
// idle, turns into brackets over anything clickable and into a text bar over inputs.
// Touch screens and reduced motion keep the system cursor.
export function mountCursor() {
  const root = document.documentElement;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const el = document.createElement('div');
  el.className = 'tcursor';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  root.classList.add('has-tcursor');

  const CLICK = 'a, button, [role="button"], label, summary, .pane-head, .hud-steps a';
  const TEXT = 'input, textarea, [contenteditable="true"]';
  let x = -100, y = -100, mode = '', idle = 0, raf = 0;

  const paint = () => {
    raf = 0;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };
  addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY;
    el.classList.remove('is-idle', 'is-hidden');
    clearTimeout(idle);
    idle = setTimeout(() => el.classList.add('is-idle'), 1200);
    const t = e.target instanceof Element ? e.target : null;
    const next = t?.closest(TEXT) ? 'text' : t?.closest(CLICK) ? 'link' : '';
    if (next !== mode) { mode = next; el.dataset.mode = mode; }
    if (!raf) raf = requestAnimationFrame(paint);
  }, { passive: true });
  addEventListener('pointerdown', () => el.classList.add('is-down'));
  addEventListener('pointerup', () => el.classList.remove('is-down'));
  document.addEventListener('pointerleave', () => el.classList.add('is-hidden'));
  addEventListener('blur', () => el.classList.add('is-hidden'));
}
