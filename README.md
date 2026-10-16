# swarup.me

Prototype of the "trace" design for swarup.me, kept for reference. The live site is on `master`.

- `index.html` holds all the content. It reads fine with JavaScript off.
- `scene.js` is the particle pipeline (three.js 0.169.0 from jsDelivr, pinned in the import map). Each particle's position is computed in the vertex shader from its seed, the time and the current chapter (0 to 5).
- `app.js` maps scroll position to chapters via `data-state` on each section, and runs the loader and the HUD. Reduced motion renders a still frame per chapter; no WebGL leaves the plain page.

Preview locally with `python3 -m http.server`.
