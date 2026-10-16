// Dark by default. The switch flips <html data-theme>, remembers the choice, and tells the
// 3D layer through a 'themechange' event so its final pass can convert glow to ink.
const root = document.documentElement;
const meta = document.querySelector('meta[name="theme-color"]');

export const isLight = () => root.dataset.theme === 'light';

function paint() {
  const light = isLight();
  for (const b of document.querySelectorAll('[data-theme-toggle]')) {
    b.querySelector('span').textContent = light ? 'dark' : 'light';
    b.setAttribute('aria-label', `Switch to ${light ? 'dark' : 'light'} theme`);
  }
  meta?.setAttribute('content', getComputedStyle(document.body).backgroundColor);
}

export function mountTheme() {
  paint();
  for (const b of document.querySelectorAll('[data-theme-toggle]')) {
    b.addEventListener('click', () => {
      if (isLight()) delete root.dataset.theme; else root.dataset.theme = 'light';
      try { localStorage.setItem('theme', isLight() ? 'light' : 'dark'); } catch {}
      paint();
      dispatchEvent(new CustomEvent('themechange', { detail: { light: isLight() } }));
    });
  }
}
