# AI Job Fetcher — Planning & Architecture (Production, Bare Metal)

## 1) Executive Summary
AI Job Fetcher is a SaaS platform that collects job postings from major ATS platforms and selected job boards, matches jobs to user resumes, and sends relevant alerts. This design is production-ready for a startup and optimized for **bare-metal deployment** to keep recurring infra costs near zero.

### Core outcomes
- Scrape jobs every 6 hours from Greenhouse, Lever, Workday, Ashby, SmartRecruiters + selected public boards.
- Let users add custom company career URLs safely.
- Deduplicate jobs globally by `(source, external_job_id)`.
- Parse resume files (PDF/DOCX), generate embeddings once, and store efficiently.
- Match jobs using keyword + semantic similarity.
- Send email notifications with duplicate prevention.
- Scale from 10k to 100k users with horizontal workers.

---

## 2) Product Scope & Non-Goals

### In scope (MVP + near-term)
- User auth + profile
- Resume upload + parsing + embedding
- Company target management
- Scheduled scraping pipeline
- Deduplicated canonical job storage
- Match scoring and email notifications
- Basic admin monitoring pages

### Out of scope (initial)
- Login-protected scraping
- Browser extension
- Full applicant tracking workflow
- Native mobile apps

---

## 3) High-Level Architecture

```text
                    +-----------------------------+
                    |  Frontend (Web App)         |
                    |  User Dashboard + Auth      |
                    +-------------+---------------+
                                  |
                                  v
                      +-----------+-----------+
                      | NestJS API (Gateway)  |
                      | REST/GraphQL          |
                      +-----+-------------+---+
                            |             |
                            v             v
               +------------+---+     +---+----------------+
               | PostgreSQL     |     | Redis (BullMQ)     |
               | + pgvector     |     | queues + locks     |
               +-----+----------+     +---------+----------+
                     |                          |
                     |                          v
                     |             +------------+-------------------+
                     |             | Worker Pool (separate deploys) |
                     |             | scrape / parse / embed / match |
                     |             | notify / scheduler             |
                     |             +----+-----------+---------------+
                     |                  |           |
                     v                  v           v
             +-------+-------+    +----+----+   +--+----------------+
             | MinIO Object  |    | Embed API|   | Email Provider    |
             | Storage       |    | OpenAI   |   | SES/Postmark/etc. |
             +---------------+    +---------+   +--------------------+
```

Design principle: **modular monolith app code + distributed worker processes**.

---

## 4) Deployment Model (Bare Metal)

## 4.1 Server profile (starting point)
- 1x dedicated server (example):
  - 16–32 vCPU
  - 64–128 GB RAM
  - 2x NVMe SSD in RAID1
  - Ubuntu LTS
- Optional 2nd server for warm standby + offsite backups.

## 4.2 Runtime
- Docker Compose in production (simple + reliable).
- Services:
  - `api`
  - `scheduler`
  - `worker-scrape`
  - `worker-parse`
  - `worker-embed`
  - `worker-match`
  - `worker-notify`
  - `postgres`
  - `redis`
  - `minio`
  - `traefik` (TLS + reverse proxy)
  - `prometheus`, `grafana`, `loki`

## 4.3 Networking
- Public ingress only through Traefik/Nginx.
- Internal Docker network for DB/Redis/MinIO.
- Firewall: allow 80/443 + SSH from allowlist only.
- Fail2Ban + rate-limited login endpoints.

## 4.4 Backup/Recovery
- PostgreSQL: nightly full backup + continuous WAL archive.
- MinIO: versioning + daily snapshot replication to NAS/2nd host.
- Redis: AOF enabled (for queue durability).
- Quarterly recovery drill target: RTO < 2 hours, RPO < 15 minutes.

---

## 5) Tech Stack Decisions

### Backend
- Node.js 22 LTS
- NestJS + TypeScript
- BullMQ for distributed jobs

### Data
- PostgreSQL 16 + `pgvector`
- Redis 7
- MinIO for object storage

### Parsing & scraping
- HTTP: `undici`
- Optional render: Playwright (only for public JS-heavy pages)
- Resume parsing:
  - PDF: `pdf-parse` / `pdfjs-dist`
  - DOCX: `mammoth`

### AI/ML
- Embeddings: OpenAI `text-embedding-3-large` (or equivalent)
- Model versioning in DB for controlled upgrades

### Email
- SES (low cost) or Postmark (better deliverability UX)

### Observability
- OpenTelemetry SDK
- Prometheus + Grafana
- Loki for logs
- Alertmanager

---

## 6) Monolith vs Microservices Recommendation

### Recommendation: Modular Monolith + Queue Workers
Why this is best now:
- Faster execution for startup team.
- Lower ops burden on bare metal.
- Shared DB transaction safety for dedupe/matching/notifications.

### How to keep future migration clean
- Enforce strict module boundaries:
  - `scrape`, `normalize`, `resume`, `embedding`, `matching`, `notify`, `admin`
- Internal event contracts (`job.created`, `resume.embedded`, etc.)
- Separate worker deployments by domain and queue

### Split criteria later
- If scrape and match need independent release cadence/SLAs.
- If queue throughput and team size justify domain isolation.

---

## 7) Data Model (Normalized & Scalable)

## 7.1 Core entities
- `users`
- `resumes`
- `sources`
- `companies`
- `user_company_targets`
- `jobs`
- `job_embeddings` (optional separate table at scale)
- `resume_embeddings` (optional separate table at scale)
- `job_matches`
- `notifications`
- `notification_job_links`
- `scrape_runs`

## 7.2 Key constraints
- `UNIQUE(source_id, external_job_id)` on `jobs` for hard dedupe.
- `UNIQUE(user_id, sha256)` on `resumes`.
- `UNIQUE(user_id, job_id, model_version)` on `job_matches`.
- `UNIQUE(dedupe_key)` on `notifications`.

## 7.3 Performance indexes
- `jobs(posted_date DESC)`
- `jobs(company_id, posted_date DESC)`
- Full-text index on `title + description` (`tsvector`)
- `pgvector` index for job embedding ANN search
- `job_matches(user_id, final_score DESC, matched_at DESC)`

## 7.4 Retention strategy
- Keep active jobs hot for 90 days.
- Archive old jobs/matches into partitioned historical tables.

---

## 8) Scraping Layer Design

## 8.1 Connector abstraction
Each connector implements:
- `discoverJobs(target)`
- `fetchJob(rawRef)`
- `normalize(rawJob) -> CanonicalJob`
- `respectRobotsAndLimits(target)`

Connectors:
- `GreenhouseConnector`
- `LeverConnector`
- `WorkdayConnector`
- `AshbyConnector`
- `SmartRecruitersConnector`
- `GenericCareerSiteConnector` (fallback)

## 8.2 Generic fallback
- Use site map / list page discovery.
- Parse JSON-LD where available.
- Optional Playwright render for public JS pages.

## 8.3 Rate limiting (legal + stability)
- Redis token bucket per domain + global limiter.
- Defaults:
  - 1–2 req/s per domain
  - burst <= 5
  - adaptive cooldown after 429/503
- Store limiter state in Redis keys with TTL.

## 8.4 Retry policy
- Retry network errors, 429, 5xx with exponential backoff + jitter.
- No retry for most 4xx.
- Dead-letter queue after max attempts.

## 8.5 Parser drift detection
- Alert if source job counts drop >40% week-over-week.
- Alert if extraction fields missing rate spikes.

---

## 9) Resume Processing Pipeline

1. User uploads PDF/DOCX -> MinIO.
2. Queue `resume.parse`.
3. Extract text.
4. Normalize text and remove noise.
5. Extract skills (dictionary/rule-based MVP).
6. Generate embedding once per unique file hash and model version.
7. Store parsed text + embedding metadata.
8. Emit `resume.updated` to trigger match refresh.

### Recompute rules
- Re-embed only when:
  - resume hash changed, or
  - embedding model version changed.

---

## 10) Matching Engine

## 10.1 Stage A: Keyword prefilter (cheap)
- Build filters from user profile:
  - include keywords
  - exclude keywords
  - location/remote constraints
- Use PostgreSQL full-text query to shortlist jobs.

## 10.2 Stage B: Semantic rerank
- Query candidate jobs by cosine similarity to resume embedding.
- Use ANN vector index for top-K retrieval.

## 10.3 Final score

Formula:

\[
S = 0.35K + 0.45V + 0.15R + 0.05F
\]

Where:
- `K`: keyword relevance score
- `V`: vector similarity score
- `R`: recency score
- `F`: fit constraints score (location/remote/seniority)

### Thresholds
- `S >= 0.75`: real-time alert eligible
- `0.60 <= S < 0.75`: include in digest
- `< 0.60`: store only, no alert

---

## 11) Scheduler & Queue Topology

## 11.1 Cron cadence
- Every 6 hours, scheduler enqueues scrape targets.
- Use distributed lock in Redis to ensure single active scheduler.

## 11.2 Queue graph
- `scrape.target`
- `job.normalize`
- `job.embed`
- `match.compute`
- `notify.prepare`
- `notify.send`
- Dead-letter queues per stage

## 11.3 Idempotency
- Every job payload includes deterministic idempotency key.
- Workers check DB unique constraints before side effects.

---

## 12) Notification System

### Modes
- Real-time alert for high-confidence matches.
- Daily digest for medium-confidence matches.

### Duplicate prevention
- `dedupe_key = hash(user_id + job_id + model_version + notification_type)`
- Unique constraint in DB and short-lived Redis send lock.

### User controls
- Frequency controls
- Quiet hours by timezone
- Unsubscribe link + suppression list

---

## 13) Security Architecture

## 13.1 SSRF controls for user-submitted URLs
- Accept only `http/https`.
- Resolve DNS and reject private/reserved IP ranges.
- Block redirects to internal ranges.
- Restrict scraper egress where possible.

## 13.2 App/API security
- DTO validation on all endpoints.
- Strong auth (JWT + refresh rotation).
- Password hashing with Argon2.
- CORS/CSRF protections for browser flows.

## 13.3 Data security
- Encrypt at rest (disk/LUKS optional, DB backups encrypted).
- TLS everywhere externally.
- Secret management with SOPS/age or Vault.

## 13.4 Abuse controls
- API rate limits per IP/user.
- Per-user quota for target URLs.
- Suspicious activity detection and temporary blocks.

---

## 14) Legal Risk Mitigation

- Respect `robots.txt` and crawl-delay.
- No authenticated scraping.
- Prefer official/public endpoints.
- Maintain source allowlist with policy notes.
- Keep provenance metadata (source URL, fetch timestamp).
- Implement takedown process and rapid blocklist updates.
- Identify scraper user-agent with contact email.

---

## 15) Scalability Plan (10k -> 100k Users)

## 15.1 10k users
- Single bare-metal node.
- Multiple worker replicas by queue depth.
- Partition heavy tables by month.

## 15.2 25k–50k users
- Add second node:
  - move workers to node 2
  - keep DB on node 1 (or dedicated DB node)
- Introduce read replica for PostgreSQL if needed.

## 15.3 100k users
- Dedicated DB node + dedicated worker node(s).
- Optional migration to k3s for multi-node orchestration.
- Optional event bus (Kafka/NATS) if Redis queue pressure grows.

---

## 16) Observability & SRE Plan

## 16.1 Logging
- Structured JSON logs with correlation IDs.

## 16.2 Metrics
- Scrape success rate by source/domain
- Queue lag by queue name
- Match throughput and p95 latency
- Email send, bounce, complaint rate
- Embed API token/cost usage

## 16.3 Alerting
- Queue lag > threshold for 10 min
- Scrape success drop > 30%
- Notification failure spike
- DB CPU/disk saturation

## 16.4 SLO examples
- API availability: 99.9%
- Job freshness: 95% of targets refreshed < 8 hours
- Notification send latency: p95 < 5 minutes after match

---

## 17) Cost Estimate (Bare Metal, 10k Users)

If hardware already owned:
- Hosting: near-zero recurring
- Power + bandwidth + domain: low fixed cost
- External variable costs:
  - Embeddings: medium to high (largest lever)
  - Email: low to medium

Rough monthly range:
- Embeddings/API: $300–$2,500
- Email: $50–$500
- Misc (monitoring SaaS, DNS, backups): $20–$200

Estimated total: **$370–$3,200/month** (excluding hardware amortization).

Cost control levers:
- Embed once per hash/model
- Batch embedding calls
- Aggressive dedupe before embedding
- Use digest mode more than real-time

---

## 18) Delivery Plan (12 Weeks)

## Phase 1 (Weeks 1–2): Foundation
- Repo setup, NestJS modules, DB schema, auth, user profile
- Docker Compose baseline + CI/CD + secrets management

## Phase 2 (Weeks 3–5): Scraping + dedupe
- ATS connectors (2–3 first), canonical model, dedupe keys
- Scheduler + scrape queues + run telemetry

## Phase 3 (Weeks 6–7): Resume + embeddings
- Upload pipeline, parsing, embedding storage/versioning
- Recompute rules and model metadata

## Phase 4 (Weeks 8–9): Matching engine
- Keyword filter, vector retrieval, final score, thresholds
- Match persistence and user explainability fields

## Phase 5 (Weeks 10–11): Notifications + controls
- Real-time + digest pipelines, duplicate prevention
- Preferences, quiet hours, unsubscribe, bounce handling

## Phase 6 (Week 12): Hardening
- Load tests, security review, backup restore drill
- Parser drift alerts, production runbooks, go-live checklist

---

## 19) Risks & Tradeoffs

### Key risks
- ATS schema drift can break parsing.
- Embedding cost can rise with job volume.
- Single-node bare metal creates hardware SPOF.

### Mitigations
- Strong connector monitoring + fallback parsers.
- Strict embedding recompute rules.
- Frequent encrypted backups + optional standby node.

---

## 20) Go-Live Checklist

- [ ] SSL/TLS + DNS configured
- [ ] Backups verified with restore test
- [ ] Queue dead-letter handling in place
- [ ] Alert rules and on-call notifications configured
- [ ] Robots and source policy checks enabled
- [ ] Rate limits and abuse controls enabled
- [ ] Email domain warmed and SPF/DKIM/DMARC validated
- [ ] Load test passed for expected 10k profile

---

## 21) Future Roadmap

- Learning-to-rank from click/apply feedback
- Skill gap analysis and resume recommendations
- Additional channels (Slack/Telegram)
- Multi-language resume parsing and job normalization
- Optional local embedding model for cost control on bare metal

---

## Appendix A: Suggested Initial Queue Concurrency
- `worker-scrape`: 20
- `worker-parse`: 8
- `worker-embed`: 6 (external API constrained)
- `worker-match`: 12
- `worker-notify`: 10

Tune using queue lag + CPU + external API limits.

## Appendix B: Recommended Initial DB Maintenance
- Nightly `VACUUM (ANALYZE)` windows
- Weekly index bloat check
- Monthly partition maintenance
- Slow query review every week
