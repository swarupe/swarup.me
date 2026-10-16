// The profile as source code, plus the lexer that highlights it.
export const SOURCE = `// swarup.src
module swarup_e {
  role  = "Lead Engineer"
  org   = "CDPG"
  city  = "Bengaluru"
  since = 2019
  study = "M.Tech, IISc"

  areas = [backend, devops, data,
           frontend, research, side]

  dead {  // unreachable
    student_projects(2017)
    student_projects(2018)
  }

  link [go, kubernetes, flink,
        clickhouse, react, pytorch]

  fn ship(idea) -> system {
    idea |> build |> run |> observe
  }

  export contact
}`;

const KEYWORDS = new Set(['module', 'dead', 'link', 'fn', 'export']);
const RULES = [
  ['com', /^\/\/.*/],
  ['str', /^"[^"]*"/],
  ['num', /^\d+/],
  ['op', /^(\|>|->|=)/],
  ['word', /^[A-Za-z_][A-Za-z0-9_]*/],
  ['pun', /^[{}()[\],.]/],
];

// Returns [{type, text, line, col}] with whitespace dropped.
export function lex(src) {
  const out = [];
  src.split('\n').forEach((lineText, line) => {
    let col = 0;
    while (col < lineText.length) {
      const rest = lineText.slice(col);
      const ws = rest.match(/^\s+/);
      if (ws) { col += ws[0].length; continue; }
      let hit = null;
      for (const [type, re] of RULES) {
        const m = rest.match(re);
        if (m) { hit = { type, text: m[0] }; break; }
      }
      if (!hit) hit = { type: 'pun', text: rest[0] };
      if (hit.type === 'word') hit.type = KEYWORDS.has(hit.text) ? 'kw' : 'id';
      out.push({ ...hit, line, col });
      col += hit.text.length;
    }
  });
  return out;
}

// Byte length of the dead block, measured from the source itself.
export function deadBytes(src) {
  const lines = src.split('\n');
  const start = lines.findIndex((l) => l.trim().startsWith('dead {'));
  let end = start;
  while (end < lines.length && lines[end].trim() !== '}') end++;
  const block = lines.slice(start, end + 1).join('\n') + '\n';
  return { bytes: new TextEncoder().encode(block).length, startLine: start, endLine: end };
}

// Highlighted HTML, one span per token (used to write index.html).
export function toHTML(src) {
  const toks = lex(src);
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return src.split('\n').map((lineText, line) => {
    let html = '';
    let col = 0;
    for (const t of toks.filter((t) => t.line === line)) {
      html += esc(lineText.slice(col, t.col));
      html += `<span class="tk t-${t.type}">${esc(t.text)}</span>`;
      col = t.col + t.text.length;
    }
    return `<span class="ln">${html}</span>`;
  }).join('\n');
}
