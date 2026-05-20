# Nexus Platform — Enterprise Architecture

## System Overview

Nexus Platform is a billion-dollar-grade AI-powered productivity & collaboration SaaS.
Built as a monorepo with microservice-ready architecture.

```
┌─────────────────────────────────────────────────────────────────┐
│                        NEXUS PLATFORM                           │
├───────────────┬───────────────────────┬─────────────────────────┤
│  NEXT.JS 15   │    NESTJS API         │   AI MICROSERVICES      │
│  App Router   │    REST + GraphQL     │   GPT-4o + Claude       │
│  React 19     │    WebSockets         │   Whisper + Deepgram    │
│  shadcn/ui    │    BullMQ queues      │   LangChain + RAG       │
│  Zustand      │    Prisma ORM         │   Pinecone vectors      │
│  TanStack Q   │    NestJS modules     │   Translation engine    │
└───────────────┴───────────────────────┴─────────────────────────┘
         │                │                        │
         └────────────────┼────────────────────────┘
                          │
┌─────────────────────────▼─────────────────────────┐
│               DATA LAYER                           │
│  PostgreSQL (primary)    Redis (cache + pub/sub)   │
│  Kafka (event stream)    Pinecone (vectors)        │
│  S3 / CloudFront (files) Elasticsearch (search)    │
└────────────────────────────────────────────────────┘
```

## Folder Structure

```
nexus-platform/
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   │   └── src/
│   │       ├── app/            # App Router pages
│   │       ├── components/     # UI components
│   │       ├── stores/         # Zustand state
│   │       ├── hooks/          # Custom hooks
│   │       ├── lib/            # Utilities & API client
│   │       ├── providers/      # Context providers
│   │       └── types/          # TypeScript types
│   └── api/                    # NestJS backend
│       └── src/
│           ├── modules/
│           │   ├── auth/       # JWT, OAuth, 2FA
│           │   ├── users/      # User management
│           │   ├── organizations/
│           │   ├── workspaces/
│           │   ├── projects/   # Agile project management
│           │   ├── tasks/      # Task CRUD + real-time
│           │   ├── chat/       # Channels + messaging
│           │   ├── documents/  # Wiki + collaborative docs
│           │   ├── ai/         # OpenAI + Claude + RAG
│           │   ├── meetings/   # Video + transcription
│           │   ├── crm/        # CRM module
│           │   ├── hr/         # HR module
│           │   ├── automation/ # Workflow automation
│           │   ├── analytics/  # Reporting + dashboards
│           │   ├── billing/    # Stripe subscriptions
│           │   ├── files/      # S3 file management
│           │   ├── notifications/
│           │   ├── realtime/   # Socket.io gateway
│           │   ├── time-tracking/
│           │   ├── integrations/
│           │   ├── webhooks/
│           │   └── admin/
│           ├── common/
│           │   ├── guards/     # JWT, Roles
│           │   ├── decorators/ # CurrentUser, Roles, Public
│           │   ├── filters/    # Global exception filter
│           │   ├── interceptors/ # Transform, Logging
│           │   └── adapters/   # Redis Socket.io adapter
│           ├── config/         # App configuration
│           └── database/       # Prisma service
├── packages/
│   ├── database/               # Prisma schema + client
│   └── shared/                 # Shared types
├── infrastructure/
│   ├── docker/
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.web
│   │   ├── docker-compose.dev.yml
│   │   └── docker-compose.prod.yml
│   ├── k8s/
│   │   ├── namespace.yaml
│   │   ├── api-deployment.yaml  # Deployment + HPA + PDB
│   │   └── ingress.yaml
│   └── terraform/
│       ├── main.tf              # VPC, EKS, RDS, ElastiCache, S3, CloudFront
│       └── variables.tf
└── .github/
    └── workflows/
        └── ci-cd.yml            # Full CI/CD pipeline
```

## Key Architectural Decisions

### 1. Multi-Tenant Architecture
- All data isolated by `organizationId`
- Row-level security via Prisma middleware
- Workspace-level scoping for all resources

### 2. Real-Time Architecture
- Socket.io with Redis adapter for horizontal scaling
- Event-driven via NestJS EventEmitter
- Kafka for durable event streaming between services
- Presence system via Redis with TTL

### 3. AI Architecture
- GPT-4o for chat, task generation, project insights
- Claude Opus for long-form document generation
- Whisper for audio transcription
- LangChain for RAG (Retrieval Augmented Generation)
- Pinecone/Weaviate for vector embeddings
- Queue-based AI processing via BullMQ

### 4. Security
- JWT with refresh token rotation (token family tracking)
- PKCE-based OAuth flows
- 2FA with TOTP (speakeasy) + backup codes
- OWASP-compliant headers via Helmet
- Row-level access control via Prisma + Guards
- Secret encryption for sensitive fields
- Rate limiting per user/IP

### 5. Scalability
- Horizontal scaling via K8s HPA (3–20 pods)
- Redis pub/sub for distributed WebSocket state
- BullMQ for async processing (email, AI, exports)
- CDN (CloudFront) for static assets and files
- Connection pooling via Prisma
- Optimistic UI updates with TanStack Query

### 6. Performance
- Next.js 15 PPR (Partial Pre-rendering)
- React 19 concurrent features
- Infinite scrolling for all lists
- Image optimization via Next.js
- Redis caching (5-minute TTL)
- Database query optimization with proper indexes

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9.1+
- Docker & Docker Compose

### Development Setup

```bash
# Clone and install
git clone https://github.com/your-org/nexus-platform
cd nexus-platform
pnpm install

# Start infrastructure
pnpm docker:dev

# Copy environment
cp .env.example .env
# Fill in your API keys in .env

# Run migrations and seed
pnpm db:migrate
pnpm db:seed

# Start development servers
pnpm dev
```

- Frontend: http://localhost:3000
- API:      http://localhost:4000
- Swagger:  http://localhost:4000/docs
- pgAdmin:  http://localhost:5050
- Redis:    http://localhost:8081
- MailHog:  http://localhost:8025
- MinIO:    http://localhost:9001

### Demo Credentials
- **Email:** admin@nexus-demo.com
- **Password:** Demo123!

## Module Feature Matrix

| Module | Status | Key Features |
|--------|--------|-------------|
| Auth | ✅ | JWT, OAuth (Google/GitHub/MS), 2FA, Magic Link, Device Management |
| Organizations | ✅ | Multi-tenant, hierarchical, custom branding |
| Workspaces | ✅ | Multi-workspace, roles, invitations |
| Tasks | ✅ | CRUD, dependencies, subtasks, time tracking, AI generation |
| Projects | ✅ | Scrum, Kanban, Gantt, sprints, milestones |
| Kanban | ✅ | Drag-and-drop, real-time sync, WIP limits |
| Chat | ✅ | Channels, DMs, threads, reactions, file sharing |
| Documents | ✅ | TipTap editor, collaborative, versioning, AI writing |
| Meetings | ✅ | WebRTC, recording, AI transcription, summaries |
| AI Assistant | ✅ | GPT-4o + Claude, streaming, voice input, RAG |
| AI Translation | ✅ | Real-time multilingual, Whisper transcription |
| CRM | ✅ | Leads, contacts, companies, pipelines, activities |
| HR | ✅ | Employees, attendance, leave, performance, payroll |
| Automation | ✅ | No-code builder, triggers, actions, AI suggestions |
| Analytics | ✅ | Project, team, revenue dashboards, AI insights |
| Billing | ✅ | Stripe subscriptions, usage metering, invoices |
| Files | ✅ | S3 upload, previews, versioning, CDN delivery |
| Notifications | ✅ | In-app, email, push, SMS, WebSocket |
| Integrations | ✅ | Slack, GitHub, Zoom, Google Drive, Zapier |
| API | ✅ | REST v1, API keys, webhooks, rate limiting |

## AWS Architecture

```
Route 53 → CloudFront → ALB → EKS (nexus-api × 3-20 pods)
                                  ↓
                     RDS PostgreSQL (Multi-AZ)
                     ElastiCache Redis (Cluster)
                     MSK Kafka (3 brokers)
                     S3 + CloudFront (files CDN)
```
