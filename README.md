# swarup.me

Personal site, served by GitHub Pages from the root of `master`. Plain HTML, CSS and JS with no build step.

- `map-data.js` reads every element marked `data-station` in `index.html` and lays out the career map. To add a station, give a card an `id` and `data-station data-lines="<line>" data-year="<year>" data-short="<label>"`. Lines: `infra`, `product`, `data`, `ai`.
- `main.js` draws the flat SVG map, then loads `scene3d.js` (three.js 0.169.0 from jsDelivr, pinned in the import map in `index.html`). Reduced motion, no WebGL, or a failed CDN load keep the SVG map.
- `fx.js` holds the scroll and hover motion. It loads only without `prefers-reduced-motion`.

Preview locally with `python3 -m http.server`.
