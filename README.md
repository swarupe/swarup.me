# swarup.me

Personal site, served by GitHub Pages from the root of `master`. Plain HTML, CSS and JS with no build step.

The career map in `main.js` is drawn from every element marked `data-station` in `index.html`. To add a station, add `data-station data-lines="<line>" data-year="<year>" data-short="<label>"` and an `id` to a card. Lines: `infra`, `product`, `data`, `ai`.

Preview locally with `python3 -m http.server`.
