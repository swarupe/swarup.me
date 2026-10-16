// The tiling desktop. This is the real content, the no-WebGL fallback and the reduced-motion view.
import { person, procs, areas, career, bio, projects, sideProjects, research, stack } from './data.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

window.__frames = window.__frames || 0;

/* ---------- htop ---------- */
function buildHtop() {
  const meters = areas.map((a) => `
    <div class="meter a-${a}"><span class="k">${a}</span><span class="track"><span class="fill" data-area="${a}"></span></span><span class="v" data-v="${a}">0.0%</span></div>`).join('');
  let pid = 101;
  const rows = areas.map((a) => {
    const list = procs.filter((p) => p[0] === a);
    return `<tr class="grp"><td class="pid"></td><td colspan="3">${a}</td></tr>` + list.map(([, cmd, desc]) => `
      <tr class="row"><td class="pid">${pid++}</td><td class="area a-${a}">${a}</td>
      <td class="cpu"><span class="cpubar a-${a}"><i data-cpu="${a}"></i><em>0.0</em></span></td>
      <td class="cmd"><b class="a-${a}">${cmd}</b><span>${esc(desc)}</span></td></tr>`).join('');
  }).join('');
  const years = new Date().getFullYear() - person.since;
  $('#htop').innerHTML = `
    <div class="meters">${meters}</div>
    <div class="htop-sum"><span>Tasks: <b>${procs.length}</b>, ${areas.length} areas</span><span>Uptime: <b>${years}+ years</b> (since ${person.since})</span><span>Host: <b>cdpg</b></span></div>
    <table class="ptable"><thead><tr><th class="pid">PID</th><th class="area">AREA</th><th class="cpu">CPU%</th><th>COMMAND</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// Decorative load: each area drifts around a resting level. The numbers are animation, not a claim.
const rest = { backend: 0.62, devops: 0.55, data: 0.7, frontend: 0.34, ml: 0.4 };
const cpuEls = () => $$('#htop i[data-cpu]');
function tickHtop(t) {
  for (const a of areas) {
    const v = Math.max(0.04, Math.min(0.98, rest[a] + 0.22 * Math.sin(t * 0.7 + a.length * 1.7) + 0.12 * Math.sin(t * 2.3 + a.charCodeAt(0))));
    const fill = $(`#htop .fill[data-area="${a}"]`);
    if (fill) fill.style.width = (v * 100).toFixed(1) + '%';
    const lab = $(`#htop [data-v="${a}"]`);
    if (lab) lab.textContent = (v * 100).toFixed(1) + '%';
  }
  cpuEls().forEach((el, i) => {
    const base = rest[el.dataset.cpu];
    const v = Math.max(0.02, Math.min(0.99, base * (0.55 + 0.45 * Math.sin(t * (0.9 + (i % 5) * 0.23) + i * 2.1)) + 0.15 * Math.sin(t * 3.1 + i)));
    el.style.setProperty('--w', (v * 100).toFixed(0) + '%');
    el.nextElementSibling.textContent = (v * 100).toFixed(1);
  });
}

/* ---------- career log ---------- */
function logLine([ts, src, kind, msg], fresh) {
  const d = document.createElement('div');
  d.className = `logline k-${kind}${fresh ? ' fresh' : ''}`;
  d.innerHTML = `<span class="ts">${ts}</span><span class="src">${src}</span><span class="msg"><span class="kind">[${kind}]</span>${esc(msg)}</span>`;
  return d;
}
function streamLog(instant) {
  const box = $('#log');
  box.innerHTML = '';
  const cursor = document.createElement('div');
  cursor.innerHTML = '<span class="cursor"></span>';
  let i = 0;
  const meta = $('#log-meta');
  const push = () => {
    box.insertBefore(logLine(career[i], !instant), cursor);
    i++;
    if (!instant && box.scrollHeight > box.clientHeight) box.scrollTop = box.scrollHeight;
    meta.textContent = `${i}/${career.length} lines, following`;
  };
  box.appendChild(cursor);
  if (instant) { while (i < career.length) push(); return; }
  const step = () => { push(); if (i < career.length) setTimeout(step, 260 + Math.random() * 260); };
  setTimeout(step, 450);
}

/* ---------- vim ---------- */
function mdInline(s) {
  return esc(s).replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${u}"${u.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`);
}
function buildVim() {
  const lines = bio.map((l, i) => {
    const cls = l.startsWith('## ') ? 'h2' : l.startsWith('# ') ? 'h1' : '';
    return `<div class="vline${i === 0 ? ' cur' : ''}"><span class="ln">${i + 1}</span><span class="tx ${cls}">${mdInline(l) || ' '}</span></div>`;
  }).join('');
  const tildes = Array.from({ length: 3 }, () => '<div class="vline"><span class="ln"></span><span class="tx tilde">~</span></div>').join('');
  $('#vim').innerHTML = `<div class="vim-lines">${lines}${tildes}</div>
    <div class="vstatus"><span class="mode">NORMAL</span><span class="file">bio.md</span><span class="fill"></span><span>utf-8</span><span>${bio.length}L</span><span>1:1</span></div>`;
}

/* ---------- projects ---------- */
function projRow(p, years) {
  return `<div class="proj" data-tags="${p.tags.join(' ')}"><span class="nm">${p.name}</span><span class="yr">${years || 'private'}</span>
    <span class="ln">${esc(p.line)}</span><span class="tags">${p.tags.map((t) => `<span class="a-${t}">${t}</span>`).join('')}</span></div>`;
}
function buildProjects() {
  const filters = ['all', ...areas, 'side'];
  $('#projects').innerHTML = `
    <div class="chips" role="group" aria-label="Filter projects">${filters.map((f, i) => `<button class="chip" aria-pressed="${i === 0}" data-f="${f}">${f}</button>`).join('')}</div>
    ${projects.map((p) => projRow(p, p.years)).join('')}
    <div class="sub" data-sub>~/side (private for now)</div>
    ${sideProjects.map((p) => projRow(p)).join('')}`;
  const total = projects.length + sideProjects.length;
  $('#proj-meta').textContent = `${total} entries`;
  $('#projects').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const f = b.dataset.f;
    $$('#projects .chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    let n = 0;
    $$('#projects .proj').forEach((el) => {
      const show = f === 'all' || el.dataset.tags.split(' ').includes(f);
      el.hidden = !show;
      if (show) n++;
    });
    $('#projects [data-sub]').hidden = !(f === 'all' || f === 'side');
    $('#proj-meta').textContent = f === 'all' ? `${total} entries` : `${n} of ${total}, #${f}`;
  });
}

/* ---------- other workspaces ---------- */
function buildOthers() {
  $('#research').innerHTML = `<p class="big">4 papers on <em>land use and land cover segmentation</em> from satellite imagery.</p>` +
    research.map((r) => `<div class="paper"><span class="venue">${r.venue}</span><span>${esc(r.title)}</span></div>`).join('');
  const commits = [
    ['a1f9c02', 'enrol: online M.Tech, Data Science and Business Analytics (Aug 2025)'],
    ['3c7d1e4', 'vlm: learned streaming memory vs recent-frames baseline'],
    ['5be20a9', 'vlm: report it honestly, learned memory did not win'],
    ['9d04f71', 'nlp: fine-tune GPT-2 on Mizo'],
    ['e62b8c3', 'nlp: test perplexity 680 to 22.5'],
  ];
  $('#iisc').innerHTML = `<p class="big">Indian Institute of Science, <em>since Aug 2025</em>.</p>` +
    commits.map(([h, m]) => `<div class="commit"><span class="h">${h}</span>${esc(m)}</div>`).join('');

  const years = new Date().getFullYear() - person.since;
  $('#fetch').innerHTML = `<div class="fetch"><div class="logo" aria-hidden="true">SE<small>SINCE ${person.since}</small></div><div class="kv">
    <span class="hd"><span>swarup</span>@blr</span><span class="rule">${'-'.repeat(60)}</span>
    <span class="k">role</span><span>${person.title}, ${esc(person.org)}</span>
    <span class="k">uptime</span><span>${years}+ years, engineer since ${person.since}</span>
    ${stack.map(([k, v]) => `<span class="k">${k}</span><span>${esc(v)}</span>`).join('')}
    <span class="swatches">${['#0b0d10', '#ff6b5e', '#9be37a', '#ffb054', '#6fb4ff', '#b39dff', '#5fd6c4', '#d9dce1'].map((c) => `<i style="background:${c}"></i>`).join('')}</span>
  </div></div>`;

  $('#mail').innerHTML = `<div class="mail">
    <div class="hdr"><span class="k">To:</span><span>${person.name} &lt;<a href="mailto:${person.email}">${person.email}</a>&gt;</span>
    <span class="k">From:</span><span>you</span><span class="k">Subject:</span><span>hello</span></div>
    <p class="big">Building something with data, infra or the web? <em>Write to me.</em></p>
    <p>Lead Engineer at CDPG, Bengaluru.</p>
    <div class="links"><a href="mailto:${person.email}">${person.email}</a><a href="https://${person.github}" target="_blank" rel="noopener">${person.github}</a><a href="https://${person.linkedin}" target="_blank" rel="noopener">${person.linkedin}</a></div>
  </div>`;
}

function buildExtra() {
  const repos = [
    ['iudx-adaptor-framework', 178, 435, 'Top contributor. Flink ingest, Calcite rules engine.'],
    ['iudx-data-sandbox (backend)', 70, 93, 'Go API, Keycloak JWT, SSE build progress.'],
    ['marketplace-file-service', 85, 105, 'Express, multipart S3/MinIO uploads, DuckDB previews.'],
  ];
  $('#shortlog').innerHTML = `<div class="slog">${repos.map(([r, n, total, note]) => `
    <div class="row"><span class="repo">${r}</span><span class="n">${n}<span> / ${total}</span></span>
    <span class="track"><i style="width:${(n / total * 100).toFixed(1)}%"></i></span><span class="note">${esc(note)}</span></div>`).join('')}</div>`;
  $('#plan').innerHTML = `<div class="plan">
    <p class="h">## work</p><ul><li>Lead Engineer at CDPG since Apr 2023</li><li>ClickHouse analytics over billions of rows</li><li>Ceph, MinIO and Kubernetes across cloud and on-prem</li><li>Multi-kernel notebook images</li></ul>
    <p class="h">## study</p><ul><li>Online M.Tech at IISc, Data Science and Business Analytics</li></ul>
    <p class="h">## side</p><ul><li>guidemesh</li><li>videopipe</li><li>agent-skills</li></ul></div>`;
}

/* ---------- window manager ---------- */
let activeWs = '1';
function focusPane(p, scroll) {
  if (!p) return;
  $$('.pane.is-focused').forEach((x) => x.classList.remove('is-focused'));
  p.classList.add('is-focused');
  $('#bar-title').textContent = p.dataset.title;
  p.focus({ preventScroll: !scroll });
  if (scroll && innerWidth <= 760) p.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
}
function switchWs(n) {
  activeWs = String(n);
  $$('.ws').forEach((w) => w.classList.toggle('is-active', w.dataset.ws === activeWs));
  $$('.ws-btn').forEach((b) => b.setAttribute('aria-current', String(b.dataset.ws === activeWs)));
  focusPane($(`.ws[data-ws="${activeWs}"] .pane`));
  if (innerWidth <= 760) scrollTo({ top: 0 });
}
function moveFocus(dir) {
  const cur = $('.pane.is-focused');
  const panes = $$(`.ws[data-ws="${activeWs}"] .pane`);
  if (!cur) return focusPane(panes[0]);
  const a = cur.getBoundingClientRect();
  const ac = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
  let best = null, bestD = Infinity;
  for (const p of panes) {
    if (p === cur) continue;
    const b = p.getBoundingClientRect();
    const bc = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    const dx = bc.x - ac.x, dy = bc.y - ac.y;
    const ok = { left: dx < -10, right: dx > 10, up: dy < -10, down: dy > 10 }[dir];
    if (!ok) continue;
    const along = dir === 'left' || dir === 'right' ? Math.abs(dx) : Math.abs(dy);
    const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    const d = along + across * 2;
    if (d < bestD) { bestD = d; best = p; }
  }
  if (best) focusPane(best, true);
}
function bindWm() {
  $$('.ws-btn').forEach((b) => b.addEventListener('click', () => switchWs(b.dataset.ws)));
  $$('.pane').forEach((p) => p.addEventListener('pointerdown', () => focusPane(p)));
  $$('.pane').forEach((p) => p.addEventListener('focusin', () => { if (!p.classList.contains('is-focused')) focusPane(p); }));
  addEventListener('keydown', (e) => {
    if (document.documentElement.classList.contains('booting') && !document.documentElement.classList.contains('handoff')) return;
    if (!e.altKey) return;
    if (/^Digit[1-4]$/.test(e.code)) { e.preventDefault(); switchWs(e.code.slice(5)); }
    const dir = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key];
    if (dir) { e.preventDefault(); moveFocus(dir); }
  });
}

/* ---------- clock + loop ---------- */
const clockFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
function tickClock() { $('#clock').textContent = clockFmt.format(new Date()).replace(',', '') + ' IST'; }

let lastHtop = -1;
function loop(now) {
  window.__frames++;
  const t = now / 1000;
  if (t - lastHtop > 0.9) { lastHtop = t; tickHtop(t); tickClock(); }
  if (!reduce) requestAnimationFrame(loop);
}

/* ---------- public ---------- */
let revealed = false;
export function initDesktop() {
  buildHtop(); buildVim(); buildProjects(); buildOthers(); buildExtra(); bindWm(); tickClock();
  tickHtop(1.3);
  focusPane($('.p-htop'));
  document.activeElement?.blur?.();
  requestAnimationFrame(loop);
  if (reduce) setInterval(tickClock, 30000);
}
export function revealDesktop() {
  if (revealed) return;
  revealed = true;
  document.documentElement.classList.add('revealed');
  streamLog(reduce);
}
