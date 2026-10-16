# swarup.me

Personal site, served by GitHub Pages from the root of `master`. Plain HTML, CSS and JS with no build step.

The page is the profile as source code, compiled on scroll: lexer, parser, optimizer, linker, output.

- `index.html` holds all the content. It reads fine with JavaScript off.
- `source.js` holds `swarup.src` and the lexer that counts its tokens.
- `data.js` holds the palette, the tree of areas and projects, and the libraries the linker attaches.
- `scene.js` is the 3D layer (three.js 0.169.0 from jsDelivr, pinned in the import map). One scroll progress value from 0 to 5 drives every stage, so scrolling back replays it.
- `intro.js` is the first-visit intro (replay it with `?intro`): a retro CRT workstation, ported from the `boot` prototype, where the keyboard types `swc swarup.src --release`, the monitor runs the build, and the camera pushes into the glass. The last frame on the screen is drawn from the live hero DOM, so the hand-off lands on the real page. It waits on the real scene load and is skippable with Esc, Enter or the skip button.
- `loader.js` is the terminal fallback, used on later visits in the same session or when the intro cannot load. It is the `swc` self-test shown while the 3D layer downloads. It counts from `data.js` and never reports "Finished" before the scene is ready. Any key, click or tap skips it.
- `runtime.js` renders stage 06, a full-screen tiling window manager with three workspaces: main (`htop`, `tail -f career.log`), stack (`fastfetch`, `git shortlog`) and mail (a compose window that opens the reader's mail app, and `.plan`). Alt+1 to 3 switches workspaces.
- `theme.js` is the light/dark switch. Dark is the default; the choice is saved in localStorage and applied before first paint. In light mode the 3D layer renders as usual and its final pass turns glow into ink on paper.
- `cursor.js` is the amber terminal cursor for mouse users. Touch screens and reduced motion keep the system cursor.
- `main.js` loads the scene only when WebGL works. GSAP 3.12.5 and ScrollTrigger drive the scroll. Reduced motion gets a still scene.

Other designs live on branches: `cinematic`, `trace`, `boot`, `redesign`.

Preview locally with `python3 -m http.server`.
