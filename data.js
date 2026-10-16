// Every fact shown on the page lives here. The boot screen and the desktop both read it.

export const person = {
  name: 'Swarup E',
  title: 'Lead Engineer',
  org: 'Centre of Data for Public Good (CDPG)',
  city: 'Bengaluru',
  since: 2019,
  email: 'enamakalswarup@gmail.com',
  github: 'github.com/swarupe',
  linkedin: 'linkedin.com/in/swarupe',
};

// POST "hardware": skills grouped by the area they belong to.
export const post = [
  ['Go', 'backend'],
  ['Java', 'backend'],
  ['TypeScript', 'backend'],
  ['Python', 'ml'],
  ['SQL', 'data'],
  ['Kubernetes', 'devops'],
  ['Ceph / MinIO', 'devops'],
  ['Apache Flink', 'data'],
  ['Kafka / RabbitMQ', 'data'],
  ['ClickHouse', 'data'],
  ['PostgreSQL', 'data'],
  ['Keycloak', 'backend'],
  ['React / Angular', 'frontend'],
  ['PyTorch', 'ml'],
];

export const bootLog = [
  'Mounting /dev/cdpg on /work (lead engineer, since Apr 2023)',
  'Started Flink ingest pipeline (IUDX Adaptor Framework)',
  'Started Calcite SQL rules engine over RocksDB state',
  'Started IUDX Video Server: camera feeds proxied from behind NAT',
  'Started Data Sandbox API (Go, Keycloak JWT, SSE build progress)',
  'Reached target JupyterHub + BinderHub on Kubernetes',
  'Started ClickHouse cluster: billions of rows, sub-second queries',
  'Mounted hybrid storage: Ceph, MinIO, GPU nodes',
  'Started marketplace file service (Express, multipart S3 uploads)',
  'Loaded notebook images: Python, R, Julia, Scala',
  'Reached target research.target (4 papers, IISc M.Tech)',
  'Started swarup-wm on :0',
];

export const areas = ['backend', 'devops', 'data', 'frontend', 'ml'];

// htop processes: one per skill.
export const procs = [
  ['backend', 'go', 'Go APIs: sandbox, auth, SSE'],
  ['backend', 'java', 'Java + Vert.x services'],
  ['backend', 'node', 'TypeScript / Express'],
  ['backend', 'fastapi', 'Python / FastAPI'],
  ['backend', 'graphql', 'GraphQL APIs'],
  ['backend', 'keycloak', 'Keycloak authn / policy'],
  ['devops', 'kubelet', 'Kubernetes, cloud + on-prem'],
  ['devops', 'dockerd', 'Docker images'],
  ['devops', 'ceph-osd', 'Ceph + MinIO storage'],
  ['devops', 'jupyterhub', 'JupyterHub + BinderHub'],
  ['devops', 'prometheus', 'Prometheus, Grafana, Loki'],
  ['devops', 'cloud', 'AWS + Azure'],
  ['data', 'flink', 'Apache Flink streaming'],
  ['data', 'kafka', 'Kafka, RabbitMQ, Event Hubs'],
  ['data', 'clickhouse', 'ClickHouse analytics'],
  ['data', 'duckdb', 'DuckDB in the browser'],
  ['data', 'postgres', 'PostgreSQL, MongoDB, Redis'],
  ['frontend', 'react', 'React + Next.js'],
  ['frontend', 'angular', 'Angular'],
  ['frontend', 'echarts', 'ECharts dashboards'],
  ['ml', 'pytorch', 'PyTorch'],
  ['ml', 'segment', 'Satellite LULC segmentation'],
  ['ml', 'vlm-mem', 'VLM streaming memory'],
];

export const career = [
  ['2019-02', 'latitude', 'intern', 'Latitude Fintech. Built a Chrome extension that records clicks into guided product tours.'],
  ['2019-06', 'latitude', 'exit', 'Internship complete.'],
  ['2019-07', 'epikindifi', 'mts', 'Member of Technical Staff at EpikInDiFi.'],
  ['2020', 'epikindifi', 'ship', 'Listings moved to GraphQL, 32% faster.'],
  ['2020', 'epikindifi', 'ship', 'Async vendor integrations over RabbitMQ and Socket.IO.'],
  ['2020', 'epikindifi', 'ship', 'KYC OCR with Tesseract and Detectron2 at 96% accuracy.'],
  ['2020-12', 'cdpg', 'join', 'Software Engineer, Centre of Data for Public Good.'],
  ['2021', 'cdpg', 'ship', 'IUDX Adaptor Framework on Flink. Top contributor, 178 of 435 commits.'],
  ['2021', 'cdpg', 'ship', 'IUDX Video Server: live city camera feeds proxied to the cloud.'],
  ['2022-04', 'cdpg', 'promote', 'Senior Software Engineer.'],
  ['2022', 'cdpg', 'ship', 'IUDX Data Sandbox. 70 of 93 backend commits.'],
  ['2023-04', 'cdpg', 'promote', 'Lead Engineer.'],
  ['2023', 'cdpg', 'ship', 'ClickHouse analytics: billions of rows, sub-second queries.'],
  ['2024', 'research', 'paper', 'LULC segmentation, IEEE InGARSS 2024 and 2 arXiv papers.'],
  ['2025-08', 'iisc', 'enrol', 'Online M.Tech, Data Science and Business Analytics, IISc.'],
  ['2025', 'cdpg', 'ship', 'Data marketplace file service. 85 of 105 commits.'],
  ['2026', 'cdpg', 'ship', 'Multi-kernel notebook images. CPU 16.1 GB to 8.1 GB.'],
  ['now', 'cdpg', 'running', 'Lead Engineer, Bengaluru.'],
];

export const bio = [
  '# Swarup E',
  '',
  'Lead Engineer at the Centre of Data for Public Good',
  '(CDPG), Bengaluru. Writing software since 2019.',
  '',
  'I build whole systems: Go and TypeScript services,',
  'Kubernetes clusters across cloud and on-prem,',
  'streaming pipelines on Flink, ClickHouse analytics',
  'over billions of rows, and the front ends on top.',
  '',
  'On the side: research on satellite image',
  'segmentation, an online M.Tech at IISc, and tools',
  'that turn browser workflows and code into guides',
  'and videos.',
  '',
  '## reach me',
  '[email](mailto:enamakalswarup@gmail.com)  [github](https://github.com/swarupe)  [linkedin](https://linkedin.com/in/swarupe)',
];

export const projects = [
  { name: 'iudx-adaptor', years: '2021-23', tags: ['data', 'devops'],
    line: 'Ingest pipeline on Apache Flink. Calcite SQL rules over RocksDB state, RabbitMQ and PostgreSQL sinks, Prometheus, Grafana and Loki on Kubernetes. 178 of 435 commits.' },
  { name: 'iudx-video-server', years: '2021', tags: ['backend', 'devops'],
    line: 'Proxies live camera feeds from city servers behind NAT to the cloud, with load balancing and an API.' },
  { name: 'data-sandbox', years: '2022-25', tags: ['backend', 'devops'],
    line: 'Jupyter notebooks next to datasets. Go API with Keycloak JWT auth, build progress over SSE, JupyterHub and BinderHub on Kubernetes. 70 of 93 backend commits.' },
  { name: 'clickhouse-analytics', years: '2023-now', tags: ['data'],
    line: 'ClickHouse clusters holding billions of rows with sub-second queries, fed by Azure Functions and Event Hubs.' },
  { name: 'hybrid-clusters', years: '2023-now', tags: ['devops'],
    line: 'Ceph, MinIO and Kubernetes across cloud and on-prem, with GPU nodes.' },
  { name: 'marketplace-files', years: '2025', tags: ['backend', 'frontend'],
    line: 'TypeScript/Express file service: S3 and MinIO multipart uploads, presigned URLs, Keycloak and policy checks, Parquet previews in the browser via DuckDB, Redis job queue. 85 of 105 commits.' },
  { name: 'notebook-images', years: '2026', tags: ['devops', 'ml'],
    line: 'Multi-kernel images for Python, R, Julia and Scala. CPU image 16.1 GB to 8.1 GB, GPU image 38.9 GB to 26.5 GB.' },
  { name: 'epikindifi', years: '2019-20', tags: ['backend', 'ml'],
    line: 'Listings on GraphQL (32% faster), async vendor integrations over RabbitMQ and Socket.IO, KYC OCR with Tesseract and Detectron2 at 96% accuracy, MongoDB text search.' },
  { name: 'tour-recorder', years: '2019', tags: ['frontend'],
    line: 'Chrome extension at Latitude that records clicks into guided product tours.' },
];

export const sideProjects = [
  { name: 'guidemesh', tags: ['side'],
    line: 'Record a browser workflow, get a walkthrough that survives code changes. 37 of 38 steps still found 50 commits later.' },
  { name: 'videopipe', tags: ['side'],
    line: 'Videos written as code: HTML and GSAP scenes rendered in headless Chrome.' },
  { name: 'agent-skills', tags: ['side'],
    line: '30 skills for Claude Code and Codex.' },
];

export const research = [
  { venue: 'IEEE InGARSS 2024', title: 'Land use / land cover segmentation from satellite imagery.' },
  { venue: 'arXiv 2024 (x2)', title: 'Two more papers on land use / land cover segmentation.' },
  { venue: 'arXiv 2025', title: 'Fourth paper in the same line of work.' },
  { venue: 'IISc', title: 'Learning What to Remember: streaming memory for vision-language models. The learned memory did not beat the recent-frames baseline, and the report says so.' },
  { venue: 'IISc', title: 'GPT-2 fine-tuned on Mizo. Test perplexity 680 to 22.5.' },
];

export const stack = [
  ['languages', 'Go, Java, TypeScript, Python, SQL'],
  ['services', 'Express, FastAPI, Vert.x, GraphQL, Keycloak'],
  ['infra', 'Kubernetes, Docker, Ceph, MinIO, AWS, Azure, JupyterHub'],
  ['observe', 'Prometheus, Grafana, Loki'],
  ['streams', 'Flink, Kafka, RabbitMQ, Event Hubs'],
  ['storage', 'ClickHouse, DuckDB, PostgreSQL, MongoDB, Redis'],
  ['frontend', 'Angular, React, Next.js, ECharts'],
  ['ml', 'PyTorch'],
];
