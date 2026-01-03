# PRP-005: Homelab Deployment with Secure API Key Authentication

**Type**: single
**Status**: draft

## Goal

Deploy the Multi-Agent Observability dashboard to `watcher.flipgoal.xyz` with:
1. Single-container architecture (nginx + Bun)
2. Secure API key authentication for hook event ingestion
3. Authentik protection for the web UI
4. Watchtower auto-deployment on git push
5. Reusable deployment documentation template

## Why

- **Remote Monitoring**: View Claude Code agent activity from any device without running local server
- **Persistent Storage**: SQLite database persists across sessions on homelab
- **Secure Access**: UI protected by Authentik (GitHub OAuth), hooks authenticated via API key
- **Auto-Deployment**: Watchtower pulls new images automatically when pushed to GHCR
- **Reusable Pattern**: Creates documented template for future homelab app deployments

## What

### User-Visible Behavior

1. Navigate to `https://watcher.flipgoal.xyz` → Authentik login → Dashboard UI
2. Local hooks POST to `https://watcher.flipgoal.xyz/events` with API key header → Events appear in UI
3. Push to `main` branch → GitHub Actions builds image → Watchtower pulls → Auto-deployed

### Success Criteria

- [ ] `watcher.flipgoal.xyz` loads UI after Authentik authentication
- [ ] `curl -X POST https://watcher.flipgoal.xyz/events -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d '{"source_app":"test","session_id":"test","hook_event_type":"PreToolUse","payload":{}}'` returns 200
- [ ] Same request WITHOUT API key returns 401
- [ ] WebSocket connection works at `wss://watcher.flipgoal.xyz/stream`
- [ ] Git push to main triggers GHCR image build
- [ ] Watchtower auto-pulls new image within 5 minutes
- [ ] SQLite data persists across container restarts
- [ ] Deployment template documentation created and validated

## All Needed Context

### Documentation & References

```yaml
# MUST READ
- file: @PRPs/config/CLAUDE.vective.md
  why: Vective System standards

- file: @CLAUDE.md
  why: Project architecture and constraints

- file: /Users/johnvargo/Sites/homelab/CLAUDE.md
  why: Homelab infrastructure patterns (Traefik, Authentik, networks)

- file: /Users/johnvargo/Sites/crypto-dashboard/.github/workflows/build-and-push.yml
  why: Reference GitHub Actions workflow for GHCR publishing

- file: /Users/johnvargo/Sites/crypto-dashboard/Dockerfile
  why: Reference multi-stage Dockerfile with nginx production target

- file: /Users/johnvargo/Sites/crypto-dashboard/nginx.conf
  why: Reference nginx configuration for SPA serving
```

### Current Codebase Structure

```
.
├── apps/
│   ├── server/                 # Bun backend (port 4000)
│   │   ├── src/
│   │   │   ├── index.ts        # HTTP/WebSocket server
│   │   │   ├── db.ts           # SQLite operations
│   │   │   ├── theme.ts        # Theme API
│   │   │   └── types.ts        # TypeScript interfaces
│   │   └── package.json
│   └── client/                 # Vue 3 frontend
│       ├── src/
│       │   ├── App.vue
│       │   ├── components/
│       │   └── composables/
│       ├── vite.config.ts
│       └── package.json
├── .claude/hooks/              # Python hook scripts (local only)
└── PRPs/
```

### Desired Codebase Structure (Files to Add)

```
.
├── Dockerfile                  # Multi-stage: build client + run with Bun + nginx
├── nginx.conf                  # Nginx config for SPA + API proxy to Bun
├── .github/
│   └── workflows/
│       └── build-and-push.yml  # GitHub Actions for GHCR
├── deployment/
│   ├── docker-compose.yml      # Homelab deployment compose file
│   └── .env.example            # Environment variables template
├── docs/
│   └── HOMELAB_DEPLOYMENT_TEMPLATE.md  # Reusable deployment guide
└── apps/
    └── server/
        └── src/
            └── middleware/
                └── apiKey.ts   # API key validation middleware
```

### Known Gotchas

```typescript
// CRITICAL: Bun server architecture
// - Uses Bun.serve() not Express
// - WebSocket upgrade handled in same server
// - SQLite via bun:sqlite (native, not better-sqlite3)

// CRITICAL: Auth pattern for this app
// - UI routes: Protected by Authentik (Traefik middleware)
// - /events POST: Protected by API key (server-side validation)
// - /stream WebSocket: Needs consideration (Authentik cookies or API key)

// CRITICAL: Single container approach
// - Nginx serves Vue static files on port 80
// - Nginx proxies /events, /stream, /api/* to Bun on localhost:4000
// - Bun process must start before nginx (use supervisord or shell script)

// GOTCHA: WebSocket through Traefik + nginx
// - Requires proper upgrade headers
// - Traefik: websecure entrypoint handles WSS
// - Nginx: proxy_http_version 1.1, Upgrade headers
```

## Implementation Blueprint

### Data Models

```typescript
// No new data models required
// API key validation is stateless (compare against env var)

// Environment variable for API key:
// WATCHER_API_KEY=watcher_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Task List

```yaml
Task 1:
  description: Add API key validation to server
  file: apps/server/src/index.ts
  action: MODIFY
  details:
    - Add API_KEY constant from Bun.env
    - Add validateApiKey function
    - Wrap /events POST handler with API key check
    - Return 401 if invalid/missing key

Task 2:
  description: Create nginx configuration
  file: nginx.conf (NEW)
  action: CREATE
  details:
    - Serve Vue static files from /usr/share/nginx/html
    - Proxy /events to localhost:4000
    - Proxy /stream to localhost:4000 with WebSocket upgrade
    - Proxy /api/* to localhost:4000
    - SPA fallback for client-side routing

Task 3:
  description: Create multi-stage Dockerfile
  file: Dockerfile (NEW)
  action: CREATE
  details:
    - Stage 1 (client-builder): Node, npm ci, build Vue app
    - Stage 2 (server-builder): Bun, install deps
    - Stage 3 (production): Bun base, copy built client to nginx dir, copy server
    - Use startup script to run both Bun and nginx
    - Expose port 80

Task 4:
  description: Create startup script for container
  file: docker-entrypoint.sh (NEW)
  action: CREATE
  details:
    - Start Bun server in background
    - Wait for Bun to be ready
    - Start nginx in foreground

Task 5:
  description: Create GitHub Actions workflow
  file: .github/workflows/build-and-push.yml (NEW)
  action: CREATE
  mirror: /Users/johnvargo/Sites/crypto-dashboard/.github/workflows/build-and-push.yml
  details:
    - Trigger on push to main and tags
    - Build with docker/build-push-action
    - Push to ghcr.io/jackvargo/agent-watcher:latest
    - Include API key as build arg (for baking into image) OR use env var at runtime

Task 6:
  description: Create homelab docker-compose
  file: deployment/docker-compose.yml (NEW)
  action: CREATE
  details:
    - Image: ghcr.io/jackvargo/agent-watcher:latest
    - Networks: proxy, backend (external)
    - Traefik labels for watcher.flipgoal.xyz
    - Skip Authentik middleware for /events endpoint
    - Volume for SQLite persistence
    - Environment: WATCHER_API_KEY

Task 7:
  description: Create environment template
  file: deployment/.env.example (NEW)
  action: CREATE
  details:
    - WATCHER_API_KEY=watcher_sk_CHANGE_ME
    - Comments explaining each variable

Task 8:
  description: Update hook configuration for remote server
  file: .claude/hooks/send_event.py
  action: MODIFY (document only, actual change is local)
  details:
    - Document --server-url flag usage
    - Document WATCHER_API_KEY env var for Authorization header
    - Show example settings.json with remote URL

Task 9:
  description: Create deployment documentation template
  file: docs/HOMELAB_DEPLOYMENT_TEMPLATE.md (NEW)
  action: CREATE
  details:
    - Step-by-step deployment guide
    - Generic enough for reuse with other apps
    - Includes: Dockerfile pattern, GitHub Actions, Traefik config, API key auth
```

### Task Pseudocode

#### Task 1: API Key Validation

```typescript
// apps/server/src/index.ts

// Add at top
const API_KEY = Bun.env.WATCHER_API_KEY;

function validateApiKey(req: Request): boolean {
  // Skip validation if no API key configured (local dev)
  if (!API_KEY) return true;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  const token = authHeader.slice(7);
  return token === API_KEY;
}

// In /events handler, add at start:
if (!validateApiKey(req)) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}
```

#### Task 2: Nginx Configuration

```nginx
# nginx.conf

server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # API proxy to Bun server
    location /events {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Pass through Authorization header
        proxy_set_header Authorization $http_authorization;
    }

    # WebSocket proxy
    location /stream {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Other API endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static asset caching
    location ~* \.(?:js|css|woff2?|ttf|png|jpg|svg)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Task 3: Dockerfile

```dockerfile
# Dockerfile

# Stage 1: Build Vue client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY apps/client/package*.json ./
RUN npm ci
COPY apps/client/ ./
RUN npm run build

# Stage 2: Prepare Bun server
FROM oven/bun:1 AS server-builder
WORKDIR /app/server
COPY apps/server/package.json apps/server/bun.lockb* ./
RUN bun install --frozen-lockfile
COPY apps/server/ ./

# Stage 3: Production image
FROM oven/bun:1-alpine AS production

# Install nginx
RUN apk add --no-cache nginx

# Copy nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy built client to nginx
COPY --from=client-builder /app/client/dist /usr/share/nginx/html

# Copy server
WORKDIR /app/server
COPY --from=server-builder /app/server ./

# Copy startup script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create data directory for SQLite
RUN mkdir -p /data
VOLUME /data

ENV DATABASE_PATH=/data/events.db

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
```

#### Task 6: Docker Compose for Homelab

```yaml
# deployment/docker-compose.yml

services:
  agent-watcher:
    image: ghcr.io/jackvargo/agent-watcher:latest
    container_name: agent-watcher
    restart: unless-stopped
    environment:
      - WATCHER_API_KEY=${WATCHER_API_KEY}
    volumes:
      - ~/data/agent-watcher:/data
    networks:
      - proxy
    labels:
      # Traefik base config
      - "traefik.enable=true"
      - "traefik.http.services.agent-watcher.loadbalancer.server.port=80"

      # Main router (with Authentik)
      - "traefik.http.routers.agent-watcher.rule=Host(`watcher.flipgoal.xyz`)"
      - "traefik.http.routers.agent-watcher.entrypoints=websecure"
      - "traefik.http.routers.agent-watcher.tls.certresolver=letsencrypt"
      - "traefik.http.routers.agent-watcher.middlewares=authentik@file"

      # API router (no Authentik - uses API key)
      - "traefik.http.routers.agent-watcher-api.rule=Host(`watcher.flipgoal.xyz`) && PathPrefix(`/events`)"
      - "traefik.http.routers.agent-watcher-api.entrypoints=websecure"
      - "traefik.http.routers.agent-watcher-api.tls.certresolver=letsencrypt"
      - "traefik.http.routers.agent-watcher-api.service=agent-watcher"
      # No authentik middleware - server validates API key

networks:
  proxy:
    external: true
```

### Integration Points

```yaml
DNS:
  - Add A record: watcher.flipgoal.xyz → 100.93.50.86 (via Dreamhost)

GitHub:
  - Enable GitHub Actions for repository
  - Add GHCR write permissions (packages: write)
  - No secrets needed (uses GITHUB_TOKEN)

Homelab Server:
  - Create ~/stacks/apps/agent-watcher/
  - Create ~/data/agent-watcher/ for SQLite persistence
  - Add WATCHER_API_KEY to .env file
  - docker compose up -d

Local Development:
  - Set WATCHER_API_KEY env var
  - Update hook settings.json with --server-url flag
  - Add Authorization header to send_event.py
```

## Validation Loop

### Level 1: Local Build Test

```bash
# Build image locally
docker build -t agent-watcher:test .

# Run locally
docker run -p 8080:80 -e WATCHER_API_KEY=test_key agent-watcher:test

# Test API key validation
curl http://localhost:8080/events -X POST \
  -H "Content-Type: application/json" \
  -d '{"source_app":"test","session_id":"1","hook_event_type":"Test","payload":{}}'
# Expected: 401 Unauthorized

curl http://localhost:8080/events -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test_key" \
  -d '{"source_app":"test","session_id":"1","hook_event_type":"Test","payload":{}}'
# Expected: 200 OK

# Test UI loads
curl http://localhost:8080/
# Expected: HTML content
```

### Level 2: GitHub Actions Build

```bash
# Push to main branch
git push origin main

# Verify in GitHub Actions:
# - Build completes successfully
# - Image pushed to ghcr.io/jackvargo/agent-watcher:latest

# Verify image is public/accessible
docker pull ghcr.io/jackvargo/agent-watcher:latest
```

### Level 3: Homelab Deployment

```bash
# SSH to homelab server (via Tailscale)
ssh ubuntu@100.93.50.86

# Deploy
cd ~/stacks/apps/agent-watcher
docker compose up -d

# Check container running
docker ps | grep agent-watcher

# Check logs
docker logs agent-watcher

# Test endpoints (from local machine)
curl https://watcher.flipgoal.xyz/events -X POST \
  -H "Authorization: Bearer $WATCHER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source_app":"deploy-test","session_id":"1","hook_event_type":"Test","payload":{}}'

# Open browser: https://watcher.flipgoal.xyz
# Should redirect to Authentik login
```

### Level 4: End-to-End Hook Test

```bash
# Update local hook settings to point to remote server
# In any project's .claude/settings.json:
# --server-url https://watcher.flipgoal.xyz/events

# Set API key
export WATCHER_API_KEY=watcher_sk_xxxxx

# Run Claude Code in a project with hooks
# Events should appear in watcher.flipgoal.xyz UI
```

## Final Validation Checklist

- [ ] Docker image builds successfully
- [ ] API key authentication works (401 without, 200 with)
- [ ] UI serves correctly after Authentik auth
- [ ] WebSocket connection establishes
- [ ] Events persist in SQLite after container restart
- [ ] GitHub Actions workflow triggers on push
- [ ] Watchtower pulls new image automatically
- [ ] Documentation template is complete and accurate
- [ ] No secrets committed to repository

## Anti-Patterns to Avoid

- ❌ Don't hardcode API keys in code or Dockerfile
- ❌ Don't skip Authentik for UI routes
- ❌ Don't use basic auth (Authentik provides GitHub OAuth)
- ❌ Don't run as root in container
- ❌ Don't store SQLite in container (use volume mount)
- ❌ Don't forget WebSocket upgrade headers in nginx

## Team Communication Protocol - Agent Updates

### Agent Organizer Analysis Matrix - Homelab Deployment

#### Technology Stack Analysis
- **Languages Detected**: TypeScript (primary - Bun server), Vue 3 (client), Python (hooks - not deployed)
- **Frameworks**: Bun.serve() for HTTP/WebSocket, Vue 3 + Vite for frontend
- **Databases**: SQLite (bun:sqlite native driver)
- **Infrastructure**: Docker, nginx, GitHub Actions, Traefik v3, Authentik
- **Architecture Pattern**: Single-container (nginx + Bun), API key auth for M2M, Authentik for human auth

#### Codebase Pattern Verification

| Pattern Category | Documented Pattern | Verified in Codebase | Status |
|-----------------|-------------------|---------------------|--------|
| Server structure | Bun.serve() with fetch handler | ✓ apps/server/src/index.ts | ✓ |
| API routes | Direct path matching in fetch() | ✓ apps/server/src/index.ts:40-94 | ✓ |
| WebSocket | Bun.serve websocket option | ✓ apps/server/src/index.ts:285-309 | ✓ |
| Client build | Vite + vue-tsc | ✓ apps/client/package.json | ✓ |
| Reference Dockerfile | Multi-stage with nginx | ✓ crypto-dashboard/Dockerfile | ✓ |
| Reference GitHub Actions | docker/build-push-action to GHCR | ✓ crypto-dashboard/.github/workflows/ | ✓ |

**Pattern Gaps**: None - PRP references verified patterns from crypto-dashboard

#### Complexity Assessment
- **Technical Complexity**: Low-Medium - Standard containerization with one twist (dual auth pattern)
- **Integration Points**: 5 (Traefik routing, Authentik middleware, GHCR, Watchtower, SQLite volume)
- **Risk Factors**:
  - WebSocket through nginx proxy (needs correct headers)
  - Traefik split routing (auth vs no-auth)
  - Bun + nginx in same container (process management)
- **Estimated Effort**: 4-6 hours (9 tasks, mostly CREATE operations)

#### Recommended Agent Team

| Agent | Primary Role | Justification | Task Assignments |
|-------|-------------|---------------|------------------|
| **typescript-pro** | API key auth implementation | Expert in Bun/TypeScript patterns | Task 1 |
| **deployment-engineer** | Container infrastructure | Docker, nginx, CI/CD expertise | Tasks 2, 3, 4, 5, 7 |
| **homelab-cd-specialist** | Traefik + homelab config | Specializes in Traefik routing, Portainer | Task 6 |
| **documentation-expert** | Reusable documentation | Technical writing for templates | Tasks 8, 9 |

#### Optimal Execution Strategy

**Execution Groups**:

```
Group 1 (Parallel - No dependencies):
├── Task 1: API key validation (typescript-pro)
├── Task 2: nginx.conf (deployment-engineer)
└── Task 7: .env.example (deployment-engineer)
    Gate: API key works, nginx syntax valid

Group 2 (Sequential - Depends on Group 1):
├── Task 3: Dockerfile (deployment-engineer)
└── Task 4: entrypoint.sh (deployment-engineer)
    Gate: docker build succeeds locally

Group 3 (Parallel - Depends on Group 2):
├── Task 5: GitHub Actions (deployment-engineer)
└── Task 6: docker-compose.yml (homelab-cd-specialist)
    Gate: Workflow syntax valid, compose valid

Group 4 (Parallel with Group 3 - Depends on Group 1):
└── Task 8: Hook documentation (documentation-expert)
    Gate: Documentation complete

Group 5 (Final - Depends on Groups 2, 3, 4):
└── Task 9: Deployment template (documentation-expert)
    Gate: Template covers all patterns
```

**Critical Path**: 1/2 → 3 → 4 → 5/6 → 9 (minimum 4 hours)

**Coordination Points**:
- After Group 1: Validate API key pattern works before baking into Dockerfile
- After Group 2: Local docker build test before CI/CD setup
- After Group 3: End-to-end validation before documentation finalization

#### Success Criteria
- **Technical Validation**:
  - `docker build` completes without errors
  - API returns 401 without key, 200 with key
  - WebSocket connects through nginx proxy
  - UI serves after nginx starts
- **Quality Gates**:
  - Gate 1: Local container runs (after Group 2)
  - Gate 2: GitHub Actions builds successfully (after Group 3)
  - Gate 3: Homelab deployment works (manual validation)
- **Performance Targets**:
  - Container startup < 10 seconds
  - Event ingestion latency < 100ms

#### Risk Mitigation
- **Identified Risks**:
  - Risk 1: Bun + nginx process management in container
  - Risk 2: WebSocket upgrade headers through double proxy (Traefik + nginx)
  - Risk 3: Traefik router priority (API vs main routes)
- **Mitigation Strategies**:
  - Risk 1 → Use shell entrypoint with background Bun, foreground nginx
  - Risk 2 → Verified nginx config includes all upgrade headers
  - Risk 3 → API router has more specific PathPrefix rule (higher priority)
- **Contingency Plans**:
  - If single-container too complex: Fall back to two-container approach
  - If WebSocket fails: Add dedicated /ws route with separate router

#### Confidence Assessment
- **Overall Confidence**: 85% - Well-understood patterns from crypto-dashboard reference
- **High Confidence Areas**:
  - Dockerfile structure (mirrors working crypto-dashboard)
  - GitHub Actions workflow (proven pattern)
  - API key authentication (standard bearer token)
- **Low Confidence Areas**:
  - Traefik split routing for auth bypass (not tested in crypto-dashboard)
  - Bun + nginx single container (novel combination)
- **Critical Unknowns**: None - all patterns have references

### Agent Task Updates
[TCP-SATC and TCP-SATR updates will be appended here during execution]

---

## Revision Log

| Version | Date | Changes |
|---------|------|---------|
| 1 | 2025-01-03 | Initial PRP draft for homelab deployment |
| 1.1 | 2025-01-03 | Added TCP-AOAM with orchestration plan |
