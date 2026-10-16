# swarup.me

Personal site, served by GitHub Pages from the root of `master`. Plain HTML, CSS and JS with no build step.

The page is the profile as source code, compiled on scroll: lexer, parser, optimizer, linker, output.

- `index.html` holds all the content. It reads fine with JavaScript off.
- `source.js` holds `swarup.src` and the lexer that counts its tokens.
- `data.js` holds the palette, the tree of areas and projects, and the libraries the linker attaches.
- `scene.js` is the 3D layer (three.js 0.169.0 from jsDelivr, pinned in the import map). One scroll progress value from 0 to 5 drives every stage, so scrolling back replays it.
- `main.js` loads the scene only when WebGL works. GSAP 3.12.5 and ScrollTrigger drive the scroll. Reduced motion gets a still scene.

Other designs live on branches: `cinematic`, `trace`, `boot`, `redesign`.

Preview locally with `python3 -m http.server`.
