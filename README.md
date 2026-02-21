# Observing O11y News

A cloud-native news aggregation platform that polls multiple developer/DevOps news sources and presents them through a unified frontend. Built with Spring Boot 3, Next.js 15, PostgreSQL, and deployed on Kubernetes via Helm.

## Architecture

```
                    +-----------+
                    |  Traefik  |
                    |  Ingress  |
                    +-----+-----+
                          |
              +-----------+-----------+
              |                       |
        +-----+------+        +------+-----+
        |  Frontend   |        |  Backend    |
        |  Next.js 15 |        |  Spring Boot|
        |  port 3000  |        |  port 8080  |
        +-------------+        +------+------+
                                      |
                               +------+------+
                               | PostgreSQL  |
                               |  port 5432  |
                               +-------------+
```

**Backend** (Java 21, Spring Boot 3.4.2)
- REST API for articles, bookmarks, search, user preferences
- 8 scheduled pollers fetching from HackerNews, Reddit, Dev.to, GitHub Releases, Lobsters, YouTube, Kubernetes Blog, and CNCF Blog
- Resilience4j circuit breakers, retry with exponential backoff, and rate limiters per source
- API key authentication via SHA-256 hash lookup
- Flyway database migrations with `ddl-auto: validate`
- Virtual threads enabled, ZGC garbage collector
- Dead letter queue with automatic retry

**Frontend** (Next.js 15, React 19, TypeScript)
- Server-side rendered news feed with source and topic filtering
- Full-text search across articles
- Bookmark management and read state tracking
- User preferences/settings page
- Tailwind CSS styling, SWR data fetching

**Database** (PostgreSQL 16)
- 7 tables: sources, users, api_keys, articles, read_states, bookmarks, dead_letters
- JSONB columns for flexible metadata storage
- GIN indexes for full-text search and array operations
- Seeded with 6 news sources and a dev user/API key

## Project Structure

```
o11y-news-browsing/
├── backend/
│   └── src/main/java/com/o11ynews/
│       ├── config/          # Security, WebClient, Scheduling, Resilience
│       ├── controller/      # REST controllers (6)
│       ├── dto/             # Request/response records (6)
│       ├── entity/          # JPA entities (8)
│       ├── filter/          # Auth filter, keyword relevance filter
│       ├── poller/          # News source pollers (8 + base class)
│       ├── repository/      # Spring Data JPA repos (7)
│       └── service/         # Business logic services (6)
├── frontend/
│   ├── app/                 # Next.js app router pages
│   ├── components/          # React components (7)
│   └── lib/                 # API client, types
├── docker/
│   ├── backend.Dockerfile   # Multi-stage JDK 21 build
│   └── frontend.Dockerfile  # Multi-stage Node 22 build
├── helm/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── backend/         # Deployment, Service, HPA, ConfigMap, Secret
│       ├── frontend/        # Deployment, Service, ConfigMap
│       ├── postgres/        # StatefulSet, Service, Secret
│       ├── ingress.yaml
│       └── networkpolicy.yaml
└── scripts/
    ├── setup-cluster.sh
    ├── generate-api-key.sh
    └── seed-data.sh
```

## Prerequisites

- Docker (OrbStack recommended on macOS)
- k3d (`brew install k3d`)
- kubectl
- Helm 3
- Java 21 (for local backend development)
- Node.js 22 (for local frontend development)

## Quick Start

### 1. Create the k3d cluster

```bash
k3d cluster create o11y-news --agents 1 --wait
```

### 2. Build Docker images

```bash
# Backend
docker build -t o11y-news-backend:latest -f docker/backend.Dockerfile ./backend

# Frontend
docker build -t o11y-news-frontend:latest -f docker/frontend.Dockerfile ./frontend
```

### 3. Import images into k3d

```bash
k3d image import o11y-news-backend:latest o11y-news-frontend:latest -c o11y-news
```

### 4. Deploy with Helm

```bash
helm upgrade --install o11y-news ./helm --set dash0.enabled=false
```

### 5. Access the application

```bash
# Port-forward frontend and backend
kubectl port-forward svc/o11y-news-frontend 3000:3000 &
kubectl port-forward svc/o11y-news-backend 8080:8080 &
```

- **Frontend UI**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **Health check**: http://localhost:8080/api/health

Alternatively, add `o11y-news.local` to `/etc/hosts` pointing to `127.0.0.1` to use the Traefik ingress.

## API Endpoints

### Public (no auth required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/v1/articles` | List articles (paginated) |
| GET | `/api/v1/articles/{id}` | Get article detail |
| GET | `/api/v1/sources` | List news sources |

### Authenticated (requires `X-API-Key` header)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/search?q=` | Full-text search |
| POST | `/api/v1/articles/{id}/read` | Mark article as read |
| GET | `/api/v1/bookmarks` | List bookmarks |
| POST | `/api/v1/bookmarks` | Add bookmark |
| DELETE | `/api/v1/bookmarks/{articleId}` | Remove bookmark |
| GET | `/api/v1/users/{id}` | Get user profile |
| PUT | `/api/v1/users/{id}/preferences` | Update preferences |
| GET | `/api/v1/feed/sources` | Get feed source status |

## News Sources

| Source | Schedule | Description |
|--------|----------|-------------|
| Hacker News | Every 3 min | Top, new, and best stories |
| Reddit | Every 5 min | r/kubernetes, r/devops, r/selfhosted, r/homelab, r/cloudnative |
| Dev.to | Every 10 min | kubernetes, devops, cloud, docker, observability tags |
| GitHub Releases | Hourly | kubernetes, prometheus, grafana, otel-collector, argo-cd, helm, istio, cilium, crossplane, flux2 |
| Lobsters | Every 10 min | devops, kubernetes, networking, security tags |
| RSS Feeds | Every 15 min | KubeWeekly, CNCF Blog, Kubernetes Blog |

## Configuration

### API Keys for External Sources

Set via Helm values or `--set`:

```bash
helm upgrade --install o11y-news ./helm \
  --set apiKeys.reddit.clientId=YOUR_ID \
  --set apiKeys.reddit.clientSecret=YOUR_SECRET \
  --set apiKeys.github.token=YOUR_TOKEN \
  --set apiKeys.devto.apiKey=YOUR_KEY
```

### Resource Limits

Default resource allocations in `values.yaml`:

| Component | CPU Request | CPU Limit | Memory Request | Memory Limit |
|-----------|------------|-----------|----------------|--------------|
| Backend | 250m | 2 | 768Mi | 1536Mi |
| Frontend | 100m | 1 | 256Mi | 512Mi |
| PostgreSQL | 250m | 2 | 512Mi | 1Gi |

### HPA

The backend has a HorizontalPodAutoscaler configured:
- Min replicas: 1
- Max replicas: 5
- Target CPU: 70%
- Target memory: 80%

## Development

### Run backend locally

```bash
cd backend
./gradlew bootRun
```

Requires PostgreSQL running on `localhost:5432` (see `application.yml` for credentials).

### Run frontend locally

```bash
cd frontend
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_URL=http://localhost:8080` for the backend connection.

## Teardown

```bash
# Remove Helm release
helm uninstall o11y-news

# Delete the k3d cluster
k3d cluster delete o11y-news
```

## Tech Stack

- **Backend**: Java 21, Spring Boot 3.4.2, Gradle, Virtual Threads, ZGC
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, SWR
- **Database**: PostgreSQL 16 with Flyway migrations
- **Resilience**: Resilience4j (circuit breakers, retry, rate limiters)
- **Infrastructure**: k3d, Helm 3, Traefik Ingress, HPA, NetworkPolicies
- **Observability**: Micrometer OTLP metrics, OpenTelemetry tracing support
