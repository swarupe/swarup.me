// Syntax palette shared by the 3D scene (CSS mirrors it in styles.css).
export const PALETTE = {
  bg: 0x07080c,
  kw: 0xff6b9a,
  id: 0x7fd4ff,
  str: 0xb8f27c,
  num: 0xffc66d,
  op: 0xc792ea,
  pun: 0x8a93ad,
  com: 0x5d6884,
  teal: 0x5eead4,
  err: 0xff5d5d,
};

// The AST. Areas carry a palette key; leaves are projects.
export const TREE = {
  label: 'swarup.src',
  children: [
    { label: 'Backend', color: 'id', children: ['Data Sandbox API (Go)', 'Marketplace file service', 'IUDX Video Server', 'GraphQL listings'] },
    { label: 'DevOps / Kubernetes', color: 'op', children: ['Hybrid Ceph + MinIO clusters', 'JupyterHub + BinderHub', 'Multi-kernel notebook images', 'Prometheus, Grafana, Loki'] },
    { label: 'Data', color: 'num', children: ['Adaptor Framework (Flink)', 'Calcite SQL rules engine', 'ClickHouse analytics'] },
    { label: 'Frontend', color: 'str', children: ['Parquet previews (DuckDB)', 'Guided-tour Chrome extension', 'Angular, React, Next.js'] },
    { label: 'Research', color: 'kw', children: ['LULC segmentation, 4 papers', 'Learning What to Remember', 'GPT-2 on Mizo'] },
    { label: 'Side projects', color: 'teal', children: ['GuideMesh', 'videopipe', 'agent-skills'] },
    { label: 'dead', color: 'com', dead: true, children: ['dead code: 2017 student projects', 'dead code: 2018 student projects'] },
  ],
};

// Libraries linked in stage 4: name, palette key, target node labels.
export const LIBS = [
  ['Go', 'id', ['Data Sandbox API (Go)']],
  ['Java', 'num', ['Adaptor Framework (Flink)']],
  ['TypeScript', 'id', ['Marketplace file service']],
  ['Python', 'kw', ['LULC segmentation, 4 papers']],
  ['Kubernetes', 'op', ['JupyterHub + BinderHub', 'Hybrid Ceph + MinIO clusters']],
  ['Docker', 'op', ['Multi-kernel notebook images']],
  ['Ceph', 'op', ['Hybrid Ceph + MinIO clusters']],
  ['MinIO', 'op', ['Marketplace file service']],
  ['Keycloak', 'id', ['Data Sandbox API (Go)']],
  ['Flink', 'num', ['Adaptor Framework (Flink)']],
  ['RabbitMQ', 'num', ['GraphQL listings']],
  ['PostgreSQL', 'num', ['Calcite SQL rules engine']],
  ['ClickHouse', 'num', ['ClickHouse analytics']],
  ['Event Hubs', 'num', ['ClickHouse analytics']],
  ['Redis', 'num', ['Marketplace file service']],
  ['DuckDB', 'str', ['Parquet previews (DuckDB)']],
  ['React', 'str', ['Angular, React, Next.js']],
  ['Prometheus', 'op', ['Prometheus, Grafana, Loki']],
  ['PyTorch', 'kw', ['Learning What to Remember', 'GPT-2 on Mizo']],
  ['JupyterHub', 'teal', ['JupyterHub + BinderHub']],
];
