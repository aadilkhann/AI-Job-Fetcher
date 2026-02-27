# AI Job Fetcher

A personal job scraping, AI-matching, and notification platform built with NestJS. It monitors career pages from target companies, extracts job postings, generates embeddings via Google Gemini, and notifies you about relevant matches.

## Architecture

- **NestJS** modular monolith (TypeScript)
- **PostgreSQL 16** + pgvector for vector similarity search
- **Redis 7** + BullMQ for async job queues
- **Gemini API** (text-embedding-004) for embeddings
- **Docker Compose** for deployment

See [doc/AI-Job-Fetcher-Planning-and-Architecture.md](doc/AI-Job-Fetcher-Planning-and-Architecture.md) for the full architecture document.

## Features

- **5 ATS Connectors**: Greenhouse, Lever, Ashby, Workday, SmartRecruiters
- **Resume Parsing**: PDF and DOCX support with SHA-256 deduplication
- **AI Matching**: Blended scoring (keyword 35% + vector similarity 45% + recency 15% + fit 5%)
- **Notifications**: Real-time email for high matches (≥0.75), daily digest for good matches (≥0.60)
- **Scheduled Scraping**: Every 6 hours with per-domain rate limiting
- **JWT Authentication**: Secure user registration and login

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Google Gemini API key
- SMTP credentials (Gmail app password, etc.)

### 1. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values:
#   GEMINI_API_KEY=your-key
#   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
#   JWT_SECRET=a-strong-random-string
```

### 2. Run with Docker Compose

```bash
docker compose up -d
```

This starts:
- **PostgreSQL** (port 5432) with pgvector extension
- **Redis** (port 6379)
- **API server** (port 3000)
- **Worker** (processes scrape/parse/embed/match/notify queues)

### 3. Register & Set Up

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"securepass123"}'

# Login (get JWT token)
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"securepass123"}' | jq -r .access_token)

# Add a target company
curl -X POST http://localhost:3000/api/companies/targets \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"careerUrl":"https://boards.greenhouse.io/example","companyName":"Example Inc","sourceHint":"greenhouse"}'

# Upload your resume
curl -X POST http://localhost:3000/api/resumes/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F 'file=@/path/to/resume.pdf'

# Add search profile
curl -X POST http://localhost:3000/api/users/search-profiles \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"keywords":["backend","typescript","node"],"locations":["remote","new york"],"remoteOnly":false}'
```

### 4. Check Health

```bash
curl http://localhost:3000/api/health
```

## Development (without Docker)

```bash
# Install dependencies
npm install

# Start PostgreSQL and Redis locally (with pgvector extension)
# Then configure .env with local connection strings

# Run API
npm run start:dev

# Run worker (separate terminal)
npx ts-node -r tsconfig-paths/register src/worker.ts
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, get JWT |
| GET | `/api/users/profile` | Get profile |
| PATCH | `/api/users/profile` | Update profile |
| POST | `/api/users/search-profiles` | Create search profile |
| GET | `/api/users/search-profiles` | List search profiles |
| POST | `/api/companies/targets` | Add target company |
| GET | `/api/companies/targets` | List targets |
| DELETE | `/api/companies/targets/:id` | Remove target |
| GET | `/api/jobs` | List scraped jobs |
| GET | `/api/jobs/:id` | Get job details |
| POST | `/api/resumes/upload` | Upload resume |
| GET | `/api/resumes` | List resumes |
| GET | `/api/matching/matches` | Get your matches |
| POST | `/api/matching/trigger` | Trigger matching run |
| GET | `/api/health` | Health check |

## Project Structure

```
src/
├── main.ts                    # API entry point
├── worker.ts                  # Queue worker entry point
├── app.module.ts              # Root module
├── config/
│   └── data-source.ts         # TypeORM data source config
├── common/
│   └── utils/ssrf-guard.ts    # URL safety validation
└── modules/
    ├── auth/                  # JWT authentication
    ├── users/                 # User profiles & search preferences
    ├── companies/             # Target companies & career URLs
    ├── jobs/                  # Job storage, dedup, source seeding
    ├── scrape/                # ATS connectors & scrape orchestration
    │   └── connectors/        # Greenhouse, Lever, Ashby, Workday, SmartRecruiters
    ├── resume/                # Upload, parse (PDF/DOCX)
    ├── embedding/             # Gemini API embeddings for jobs & resumes
    ├── matching/              # Blended scoring engine
    ├── notify/                # Email notifications & digests
    ├── scheduler/             # Cron scheduling
    └── health/                # Health check endpoint
```

## License

MIT
