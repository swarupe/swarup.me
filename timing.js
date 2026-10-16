// Reads this visit's Navigation Timing entry and writes it into the page.
// Every number shown here comes from the browser; nothing is estimated.

const $ = (s) => document.querySelector(s);

export function fmt(ms) {
  if (ms == null || !Number.isFinite(ms)) return 'n/a';
  if (ms < 0.5) return 'under 1 ms';
  if (ms < 10) return `${ms.toFixed(1)} ms`;
  return `${Math.round(ms)} ms`;
}

function traceId() {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

// Phase list for one navigation entry. `start` is the offset from navigation start.
function phases(n) {
  const tlsStart = n.secureConnectionStart > 0 ? n.secureConnectionStart : null;
  const end = n.loadEventEnd > 0 ? n.loadEventEnd : n.domInteractive;
  return [
    { key: 'dns', start: n.domainLookupStart, dur: n.domainLookupEnd - n.domainLookupStart },
    { key: 'tcp', start: n.connectStart, dur: (tlsStart ?? n.connectEnd) - n.connectStart },
    { key: 'tls', start: tlsStart ?? n.connectEnd, dur: tlsStart == null ? null : n.connectEnd - tlsStart },
    { key: 'ttfb', start: n.requestStart, dur: n.responseStart - n.requestStart },
    { key: 'download', start: n.responseStart, dur: n.responseEnd - n.responseStart },
    { key: 'render', start: n.responseEnd, dur: end - n.responseEnd },
  ];
}

export function initTiming() {
  const id = traceId();
  $('#trace-id').textContent = id;
  $('#trace-id-2').textContent = id;

  const nav = performance.getEntriesByType?.('navigation')?.[0];
  if (!nav) {
    $('#total-ms').textContent = 'a moment';
    $('#timing-note').textContent = 'Your browser does not expose Navigation Timing, so the per-phase numbers are hidden.';
    return { total: 0, phases: [] };
  }

  const fill = (final) => {
    const list = phases(nav);
    const total = final && nav.loadEventEnd > 0 ? nav.loadEventEnd - nav.startTime : nav.domInteractive - nav.startTime;
    const cached = nav.transferSize === 0 && nav.decodedBodySize > 0;

    for (const p of list) {
      const dd = document.querySelector(`[data-phase="${p.key}"]`);
      let sub = '';
      if (p.key === 'tls' && p.dur == null) sub = 'plain http';
      else if (p.dur < 0.5 && p.key === 'dns') sub = 'cached';
      else if (p.dur < 0.5 && p.key === 'tcp') sub = 'reused';
      dd.innerHTML = `${p.key === 'tls' && p.dur == null ? 'none' : fmt(p.dur)}${sub ? `<small>${sub}</small>` : ''}`;
    }

    $('#total-ms-2').textContent = fmt(total);
    $('#proto').textContent = nav.nextHopProtocol || 'unknown';
    const edge = list.slice(0, 3).reduce((a, p) => a + (p.dur ?? 0), 0);
    $('#edge-ms').textContent = fmt(edge);
    $('#browser-ms').textContent = fmt(list[5].dur);

    // Request waterfall: bar position and width as a share of the whole load.
    const span = Math.max(total, 1);
    $('#axis-mid').textContent = fmt(span / 2);
    $('#axis-end').textContent = fmt(span);
    for (const p of list) {
      const row = document.querySelector(`[data-req="${p.key}"]`);
      const dur = p.dur ?? 0;
      row.style.setProperty('--l', `${Math.min(99, ((p.start - nav.startTime) / span) * 100)}%`);
      row.style.setProperty('--w', `${(dur / span) * 100}%`);
      row.querySelector('.row__dur').textContent = p.key === 'tls' && p.dur == null ? 'none' : fmt(dur);
      row.toggleAttribute('data-zero', dur < 0.5);
    }

    if (cached) $('#timing-note').textContent = 'Served from your browser cache this time, so the network phases are near zero. Measured by Navigation Timing.';
    return { total, list };
  };

  const first = fill(false);
  const el = $('#total-ms');
  el.textContent = fmt(first.total);

  return new Promise((resolve) => {
    const done = () => setTimeout(() => {
      const res = fill(true);
      countUp(el, res.total);
      resolve(res);
    }, 0);
    if (document.readyState === 'complete') done();
    else addEventListener('load', done, { once: true });
  });
}

function countUp(el, target) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || target < 10 || !window.gsap) { el.textContent = fmt(target); return; }
  const o = { v: 0 };
  window.gsap.to(o, { v: target, duration: 1.1, ease: 'power3.out', onUpdate: () => { el.textContent = `${Math.round(o.v)} ms`; } });
}
