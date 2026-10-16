// Palette shared by the 3D scene (CSS mirrors it in styles.css): amber phosphor leads, as in the Boot prototype.
export const PALETTE = {
  bg: 0x0b0907,
  kw: 0xff7a5c,
  id: 0x6fb4ff,
  str: 0xffb054,
  num: 0x9be37a,
  op: 0xb39dff,
  pun: 0xa39684,
  com: 0x6f6455,
  teal: 0x5fd6c4,
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

// Commit counts on the three repos where the share is known. The loader counts up to their sum.
export const COMMITS = [
  ['iudx-adaptor-framework', 178, 435],
  ['data-sandbox backend', 70, 93],
  ['marketplace file service', 85, 105],
];

// Areas in the runtime view, in tree order, with their palette key.
export const AREAS = [
  ['backend', 'id'], ['devops', 'op'], ['data', 'num'], ['frontend', 'str'], ['research', 'kw'], ['side', 'teal'],
];

// htop: skills as processes, grouped by area.
export const PROCS = [
  ['backend', 'go', 'Go APIs: sandbox, auth, SSE'],
  ['backend', 'java', 'Java and Vert.x services'],
  ['backend', 'node', 'TypeScript and Express'],
  ['backend', 'fastapi', 'Python and FastAPI'],
  ['backend', 'keycloak', 'Keycloak auth and policy'],
  ['devops', 'kubelet', 'Kubernetes, cloud and on-prem'],
  ['devops', 'dockerd', 'Docker images'],
  ['devops', 'ceph-osd', 'Ceph and MinIO storage'],
  ['devops', 'jupyterhub', 'JupyterHub and BinderHub'],
  ['devops', 'prometheus', 'Prometheus, Grafana, Loki'],
  ['data', 'flink', 'Apache Flink streaming'],
  ['data', 'rabbitmq', 'RabbitMQ, Kafka, Event Hubs'],
  ['data', 'clickhouse', 'ClickHouse analytics'],
  ['data', 'postgres', 'PostgreSQL, MongoDB, Redis'],
  ['frontend', 'react', 'React and Next.js'],
  ['frontend', 'angular', 'Angular and ECharts'],
  ['frontend', 'duckdb-wasm', 'Parquet previews in the browser'],
  ['research', 'segment', 'Satellite LULC segmentation'],
  ['research', 'vlm-mem', 'Streaming memory for VLMs'],
  ['research', 'pytorch', 'PyTorch'],
  ['side', 'guidemesh', 'Walkthroughs that survive code changes'],
  ['side', 'videopipe', 'Videos written as code'],
  ['side', 'agent-skills', '30 skills for coding agents'],
];

// tail -f career.log: [when, source, kind, message].
export const CAREER = [
  ['2019-02', 'latitude', 'intern', 'Intern at Latitude Fintech. Built a Chrome extension that records clicks into guided product tours.'],
  ['2019-07', 'epikindifi', 'join', 'Member of Technical Staff at EpikInDiFi.'],
  ['2020', 'epikindifi', 'ship', 'Listings moved to GraphQL, 32% faster.'],
  ['2020', 'epikindifi', 'ship', 'KYC OCR with Tesseract and Detectron2 at 96% accuracy.'],
  ['2020-12', 'cdpg', 'join', 'Software Engineer, Centre of Data for Public Good.'],
  ['2021', 'cdpg', 'ship', 'IUDX Adaptor Framework on Flink. 178 of 435 commits.'],
  ['2021', 'cdpg', 'ship', 'IUDX Video Server: city camera feeds proxied to the cloud.'],
  ['2022-04', 'cdpg', 'promote', 'Senior Software Engineer.'],
  ['2022', 'cdpg', 'ship', 'IUDX Data Sandbox. 70 of 93 backend commits.'],
  ['2023-04', 'cdpg', 'promote', 'Lead Engineer.'],
  ['2023', 'cdpg', 'ship', 'ClickHouse analytics: billions of rows, sub-second queries.'],
  ['2024', 'research', 'paper', 'LULC segmentation at IEEE InGARSS 2024, plus 2 arXiv papers.'],
  ['2025-07', 'research', 'paper', 'Comparison of segmentation methods for LULC, arXiv.'],
  ['2025-08', 'iisc', 'enrol', 'Online M.Tech, Data Science and Business Analytics, IISc.'],
  ['2025', 'cdpg', 'ship', 'Data marketplace file service. 85 of 105 commits.'],
  ['2026', 'cdpg', 'ship', 'Multi-kernel notebook images. CPU image 16.1 GB to 8.1 GB.'],
  ['now', 'cdpg', 'running', 'Lead Engineer, Bengaluru.'],
];
