// Trace view behavior: open and close layer spans, open them as they scroll
// past the middle of the screen, and grow the bars when the panel appears.

export function initWaterfall({ reduce }) {
  const groups = [...document.querySelectorAll('#wf-years .group')];
  const toggleAll = document.getElementById('toggle-all');

  const set = (g, open) => {
    g.classList.toggle('open', open);
    g.querySelector('.row--layer').setAttribute('aria-expanded', String(open));
  };
  const sync = () => {
    toggleAll.textContent = groups.every((g) => g.classList.contains('open')) ? 'collapse all' : 'expand all';
  };

  for (const g of groups) {
    g.querySelector('.row--layer').addEventListener('click', () => {
      g.dataset.touched = '1';
      set(g, !g.classList.contains('open'));
      sync();
    });
  }
  toggleAll.addEventListener('click', () => {
    const open = !groups.every((g) => g.classList.contains('open'));
    groups.forEach((g) => { g.dataset.touched = '1'; set(g, open); });
    sync();
  });

  if (reduce) { set(groups[0], true); sync(); return; }

  // Scroll opens a span once, when it crosses the middle band of the viewport.
  // A span the visitor already clicked is left alone.
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const g = e.target.closest('.group');
      if (e.isIntersecting && !g.dataset.touched) { g.dataset.touched = '1'; set(g, true); sync(); }
    }
  }, { rootMargin: '-42% 0px -48% 0px' });
  groups.forEach((g) => io.observe(g.querySelector('.row--layer')));

  const gsap = window.gsap;
  if (!gsap || !window.ScrollTrigger) return;
  gsap.from('#wf-req .bar', {
    scaleX: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08,
    scrollTrigger: { trigger: '#wf-req', start: 'top 85%', once: true },
  });
  gsap.from('#wf-years .row--layer .bar', {
    scaleX: 0, duration: 1.1, ease: 'power3.out', stagger: 0.06,
    scrollTrigger: { trigger: '#wf-years', start: 'top 85%', once: true },
  });
}
