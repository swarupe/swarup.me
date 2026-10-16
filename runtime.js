// Stage 06: the compiled binary running. A full-screen tiling window manager with three
// workspaces: main (htop, tail -f career.log), stack (fastfetch, git shortlog) and mail. Static HTML in the card already carries the same
// facts, so this view only renders when JavaScript runs.
import { AREAS, PROCS, CAREER, COMMITS, STACK, PLAN, CONTACT, PALETTE } from './data.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEYS = Object.fromEntries(AREAS);

function buildHtop(box) {
  const meters = AREAS.map(([a, k], i) => `
    <div class="rt-meter" style="--c: var(--${k})"><span class="rt-k">${i}</span><span class="rt-track"><span class="rt-fill" data-area="${a}"></span></span><span class="rt-v" data-v="${a}">0.0%</span><span class="rt-name">${a}</span></div>`).join('');
  let pid = 2019;
  const rows = PROCS.map(([a, cmd, desc]) => `
      <tr style="--c: var(--${KEYS[a]})"><td class="rt-pid">${pid++}</td><td class="rt-area">${a}</td>
      <td class="rt-cpu"><span class="rt-bar"><i data-cpu="${a}"></i><em>0.0</em></span></td>
      <td class="rt-cmd"><b>${cmd}</b> <span>${esc(desc)}</span></td></tr>`).join('');
  const years = new Date().getFullYear() - 2019;
  box.innerHTML = `
    <div class="rt-meters">${meters}</div>
    <div class="rt-sum"><span>Tasks: <b>${PROCS.length}</b>, ${AREAS.length} areas</span><span>Uptime: <b>${years}+ years</b></span><span>Host: <b>cdpg</b></span></div>
    <table class="rt-ptable"><thead><tr><th class="rt-pid">PID</th><th class="rt-area">AREA</th><th class="rt-cpu">CPU%</th><th>COMMAND</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// Decorative load: each area drifts around a resting level. The numbers are animation, not a claim.
const REST = { backend: 0.62, devops: 0.56, data: 0.7, frontend: 0.36, research: 0.42, side: 0.3 };
function tickHtop(box, t) {
  for (const [a] of AREAS) {
    const v = Math.max(0.04, Math.min(0.98, REST[a] + 0.22 * Math.sin(t * 0.7 + a.length * 1.7) + 0.1 * Math.sin(t * 2.3 + a.charCodeAt(0))));
    box.querySelector(`.rt-fill[data-area="${a}"]`).style.width = (v * 100).toFixed(1) + '%';
    box.querySelector(`[data-v="${a}"]`).textContent = (v * 100).toFixed(1) + '%';
  }
  box.querySelectorAll('i[data-cpu]').forEach((el, i) => {
    const v = Math.max(0.02, Math.min(0.99, REST[el.dataset.cpu] * (0.55 + 0.45 * Math.sin(t * (0.9 + (i % 5) * 0.23) + i * 2.1)) + 0.12 * Math.sin(t * 3.1 + i)));
    el.style.setProperty('--w', (v * 100).toFixed(0) + '%');
    el.nextElementSibling.textContent = (v * 100).toFixed(1);
  });
}

// Every line is in the layout from the start (hidden), so revealing them never moves anything.
function buildLog(box) {
  box.innerHTML = CAREER.map(([ts, src, kind, msg]) =>
    `<div class="rt-line k-${kind}"><span class="rt-ts">${ts}</span><span class="rt-src">${src}</span><span class="rt-msg"><span class="rt-kind">[${kind}]</span> ${esc(msg)}</span></div>`).join('')
    + '<div class="rt-line rt-follow"><span class="rt-ts"></span><span class="rt-src"></span><span class="rt-msg"><span class="rt-cursor"></span></span></div>';
}

function buildShortlog(box) {
  box.innerHTML = COMMITS.map(([repo, mine, all]) => `
    <div class="rt-sl"><span class="rt-sl-n"><b>${mine}</b> / ${all}</span><span class="rt-sl-repo">${repo}</span>
    <span class="rt-sl-bar"><i style="--w: ${(mine / all * 100).toFixed(1)}%"></i></span></div>`).join('');
}

function buildFetch(box) {
  const years = new Date().getFullYear() - 2019;
  const swatches = ['bg', 'kw', 'num', 'str', 'id', 'op', 'teal'].map((k) => `<i style="background: #${PALETTE[k].toString(16).padStart(6, '0')}"></i>`).join('');
  box.innerHTML = `<div class="rt-fetch"><div class="rt-logo" aria-hidden="true">SE<small>since 2019</small></div><dl class="rt-kv">
    <div class="rt-hd"><span class="t-str">swarup</span>@cdpg</div>
    <div><dt>role</dt><dd>Lead Engineer, Centre of Data for Public Good</dd></div>
    <div><dt>uptime</dt><dd>${years}+ years, engineer since 2019</dd></div>
    ${STACK.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}
    <div class="rt-swatches">${swatches}</div></dl></div>`;
}

// A real compose window: Send opens the reader's mail app with the subject and body filled in.
function buildMail(box) {
  box.innerHTML = `<form class="rt-mail" id="rt-mail-form">
    <div class="rt-hdr"><span>To:</span><span>Swarup E &lt;<a href="mailto:${CONTACT.email}">${CONTACT.email}</a>&gt;</span>
      <label for="rt-subject">Subject:</label><input id="rt-subject" name="subject" value="hello" autocomplete="off"></div>
    <label class="sr-only" for="rt-body">Message</label>
    <textarea id="rt-body" name="body" rows="6" placeholder="Building something with data, infra or the web? Write here."></textarea>
    <div class="rt-mail-actions"><button type="submit">send <kbd>ctrl enter</kbd></button><span class="rt-mail-note">opens your mail app</span></div>
    <div class="rt-links">${CONTACT.links.map(([k, href, label]) => `<a href="${href}" target="_blank" rel="noopener"><span>${k}</span>${esc(label)}</a>`).join('')}</div>
  </form>`;
  const form = box.querySelector('form');
  const send = (e) => {
    e?.preventDefault();
    const q = new URLSearchParams({ subject: form.subject.value || 'hello', body: form.body.value }).toString().replace(/\+/g, '%20');
    location.href = `mailto:${CONTACT.email}?${q}`;
  };
  form.addEventListener('submit', send);
  form.body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(e); });
}

function buildPlan(box) {
  box.innerHTML = `<div class="rt-plan">${PLAN.map(([h, items]) => `<p class="rt-plan-h">## ${h}</p><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`).join('')}</div>`;
}

// Workspaces: the tabs, Alt+1..3 while the runtime is on screen, and the focused pane's title.
function bindWm(sec) {
  const tabs = [...sec.querySelectorAll('.wm-ws button')];
  const spaces = [...sec.querySelectorAll('.wm-tiles')];
  const title = $('#wm-title');
  const focus = (pane) => {
    sec.querySelectorAll('.pane.is-focused').forEach((p) => p.classList.remove('is-focused'));
    pane.classList.add('is-focused');
    title.textContent = pane.dataset.title;
  };
  const show = (n) => {
    tabs.forEach((t) => t.setAttribute('aria-current', String(t.dataset.ws === n)));
    spaces.forEach((w) => w.classList.toggle('is-active', w.dataset.ws === n));
    focus(sec.querySelector(`.wm-tiles[data-ws="${n}"] .pane`));
  };
  tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.ws)));
  sec.querySelectorAll('.pane').forEach((p) => p.addEventListener('pointerdown', () => focus(p)));
  addEventListener('keydown', (e) => {
    if (!e.altKey || !document.documentElement.classList.contains('in-run')) return;
    const m = /^Digit([1-3])$/.exec(e.code);
    if (m) { e.preventDefault(); show(m[1]); }
  });
  show('1');
}

export function mountRuntime({ still }) {
  const sec = $('#run');
  const htop = $('#rt-htop'), log = $('#rt-log'), meta = $('#rt-log-meta');
  buildHtop(htop);
  buildLog(log);
  buildShortlog($('#rt-shortlog'));
  buildFetch($('#rt-fetch'));
  buildMail($('#rt-mail'));
  buildPlan($('#rt-plan'));
  bindWm(sec);
  sec.hidden = false;

  const lines = [...log.querySelectorAll('.rt-line:not(.rt-follow)')];
  const clock = $('#rt-clock');
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  const tickClock = () => { clock.textContent = `Bengaluru ${fmt.format(new Date())} IST`; };
  tickClock();

  if (still) {
    tickHtop(htop, 2);
    lines.forEach((l) => l.classList.add('on'));
    meta.textContent = `${lines.length}/${lines.length} lines`;
    return;
  }
  setInterval(tickClock, 15000);

  // tail -f: lines arrive once the section is on screen; htop only ticks while visible.
  let shown = 0, started = false, visible = false, t = 0;
  const next = () => {
    lines[shown].classList.add('on', 'fresh');
    shown++;
    meta.textContent = `${shown}/${lines.length} lines, following`;
    if (shown < lines.length) setTimeout(next, 140 + Math.random() * 160);
  };
  tickHtop(htop, 0);
  setInterval(() => { if (visible) tickHtop(htop, (t += 0.9)); }, 900);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !started) { started = true; setTimeout(next, 300); }
  }, { threshold: 0.15 }).observe(sec);
}
