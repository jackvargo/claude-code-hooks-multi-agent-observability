# Homelab Deployment Template

Deploy containerized applications to a homelab environment with Traefik routing, Authentik authentication, and API key validation for machine-to-machine (M2M) calls.

## Overview

This template provides a standardized pattern for deploying applications to a homelab infrastructure that includes:

- **Container Orchestration**: Docker Compose with multi-stage builds
- **Reverse Proxy**: Traefik v3 with Let's Encrypt TLS
- **Identity Provider**: Authentik for OAuth-based human authentication
- **CI/CD Pipeline**: GitHub Actions building to GitHub Container Registry (GHCR)
- **Auto-Deployment**: Watchtower automatically pulling new images
- **Machine Authentication**: API key validation for service-to-service calls

## Prerequisites

### Homelab Infrastructure

Your homelab server must have:

- Docker and Docker Compose installed
- Traefik v3 running with Let's Encrypt certificate resolver
- Authentik identity provider configured with OAuth applications
- External Docker networks: `proxy` and `backend` (created and configured)
- Domain configured in DNS pointing to your server (via Tailscale or direct IP)
- Watchtower service monitoring GHCR for image updates

### Repository and CI/CD

Your GitHub repository must have:

- GitHub Actions enabled
- `packages: write` permission for pushing to GHCR
- Basic repository secrets (uses `GITHUB_TOKEN`, no additional setup needed)

### Application Requirements

Your application must be a containerizable service with:

- A Dockerfile supporting multi-stage builds
- A primary web interface served on a specific port (e.g., 80, 8080)
- Optional: Backend API endpoints that can be proxied separately
- Optional: WebSocket support if real-time features are needed

## Architecture Pattern

### Single-Container vs. Multi-Container

This template uses a **single-container architecture** where:

- A build stage compiles frontend assets (if applicable)
- A build stage prepares application runtime dependencies
- A production stage combines nginx (frontend) + application server (backend)
- A startup script orchestrates multiple processes within one container

**When to use**: Applications with tightly coupled frontend and backend, or when you want to minimize container sprawl.

**When not to use**: Applications requiring independent scaling, or where you have existing multi-container orchestration.

### Authentication Pattern

Two authentication mechanisms operate in parallel:

| Route | Method | Enforcer | Purpose |
|-------|--------|----------|---------|
| `/` (UI) | OAuth via Authentik | Traefik middleware | Human users |
| `/api/*` or `/events` | API key bearer token | Application middleware | Machine-to-machine calls |

This allows your web UI to be protected by a corporate identity provider while your webhooks and APIs can be secured with long-lived API keys suitable for CI/CD and external integrations.

## Deployment Steps

### Phase 1: Application Preparation

#### 1.1 Create Dockerfile (Multi-stage)

Create `Dockerfile` in your repository root. This example shows a typical pattern:

```dockerfile
# Stage 1: Build frontend (if applicable)
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Prepare application runtime
FROM your-runtime-base:version AS app-builder
WORKDIR /app
COPY app/package*.json ./
RUN <your-package-manager> install --frozen-lockfile
COPY app/ ./

# Stage 3: Production image
FROM your-runtime-base:version-alpine
RUN apk add --no-cache nginx

# Copy nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy built frontend to nginx (if applicable)
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Copy application
WORKDIR /app
COPY --from=app-builder /app ./

# Copy startup script and entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create persistent data directory
RUN mkdir -p /data
VOLUME /data

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
```

**Key points**:
- Use `-alpine` variants where possible to reduce image size
- Separate build stages minimize final image bloat
- Persistent data uses `/data` volume mount
- nginx serves static files on port 80

#### 1.2 Create nginx.conf

Create `nginx.conf` in your repository root:

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Static file serving (SPA fallback for client-side routing)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy to application server
    location /api/ {
        proxy_pass http://127.0.0.1:4000;  # Adjust port to your app
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # For API key auth - pass through Authorization header
        proxy_set_header Authorization $http_authorization;
    }

    # WebSocket support (if needed)
    location /stream {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Static asset caching
    location ~* \.(?:js|css|woff2?|ttf|png|jpg|svg)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

**Key points**:
- `try_files` enables Single Page Application (SPA) client-side routing
- API proxy passes custom headers through to backend
- WebSocket upgrade headers required for real-time features
- Asset caching reduces bandwidth for long-lived browser sessions

#### 1.3 Create Startup Script

Create `docker-entrypoint.sh` in your repository root:

```bash
#!/bin/sh
set -e

# Start application server in background
cd /app
your-runtime-command src/index.ts &

# Wait for server to be ready
echo "Waiting for application server to be ready on port 4000..."
until wget -q --spider http://127.0.0.1:4000/ 2>/dev/null; do
  sleep 0.5
done
echo "Application server is ready"

# Start nginx in foreground
echo "Starting nginx..."
nginx -g "daemon off;"
```

**Key points**:
- Start application server in background
- nginx must run in foreground (Docker requires a foreground process)
- Use `wget --spider` to poll health endpoint (adjust URL to your app)
- Exit on any error (`set -e`) to fail fast on startup issues

### Phase 2: CI/CD Pipeline

#### 2.1 Create GitHub Actions Workflow

Create `.github/workflows/build-and-push.yml`:

```yaml
name: Build and Push Docker Image

on:
  push:
    branches:
      - main
    tags:
      - 'v*'
  pull_request:
    branches:
      - main

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: {GITHUB_ORG}/{APP_NAME}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata for Docker
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          target: production
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**Key points**:
- Triggers on `main` branch pushes and semantic version tags
- Only pushes image on actual merges (not pull requests)
- Tagging strategy: `latest` for main branch, semantic versions for releases, short SHA for debugging
- GitHub Actions cache reduces build time on subsequent runs

**Customization**:
- Replace `{GITHUB_ORG}` with your GitHub username or organization
- Replace `{APP_NAME}` with your application name (lowercase)

### Phase 3: Authentication Layer

#### 3.1 API Key Validation Middleware

Implement API key validation in your application's request handler. This example uses TypeScript/Node.js:

```typescript
// Validate API key from Authorization header
function validateApiKey(req: Request): boolean {
  const apiKey = Bun.env.API_KEY;

  // Skip validation if no API key configured (local development)
  if (!apiKey) return true;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  const token = authHeader.slice(7);
  return token === apiKey;
}

// In your POST /events handler (or equivalent):
export async function handleEventsPost(req: Request): Promise<Response> {
  if (!validateApiKey(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Process request
  const body = await req.json();
  // ... handle event
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
```

**Key points**:
- Load API key from environment variable, not code
- Skip validation in local development when API key is absent
- Return 401 for missing or invalid keys
- Validate on every request (no caching)

#### 3.2 Environment Variables

Create `deployment/.env.sample`:

```bash
# API Key Configuration
# Format: {APP_PREFIX}_sk_xxxxxxxxxxxxxxxxxxxx
# The "{APP_PREFIX}_sk_" prefix helps identify the key purpose
# Generate: openssl rand -hex 32 (then prepend prefix)
API_KEY={APP_PREFIX}_sk_CHANGE_ME

# Application Configuration
# Port for application server (nginx proxies to this internally)
APP_PORT=4000

# Database Configuration (if applicable)
# Mounted at /data in container
DB_PATH=/data/events.db

# Server Configuration
# Logging level: debug, info, warn, error
LOG_LEVEL=info
```

### Phase 4: Homelab Deployment Configuration

#### 4.1 Docker Compose for Homelab

Create `deployment/docker-compose.yml`:

```yaml
services:
  {APP_NAME}:
    image: ghcr.io/{GITHUB_ORG}/{APP_NAME}:latest
    container_name: {APP_NAME}
    restart: unless-stopped
    environment:
      - API_KEY=${API_KEY}
      - LOG_LEVEL=info
    volumes:
      # Data persistence (SQLite, uploads, etc.)
      - ~/data/{APP_NAME}:/data
    networks:
      - proxy
    labels:
      # Traefik base configuration
      - "traefik.enable=true"
      - "traefik.http.services.{APP_NAME}.loadbalancer.server.port=80"

      # Main router: UI with Authentik authentication
      - "traefik.http.routers.{APP_NAME}.rule=Host(`{SUBDOMAIN}.{DOMAIN}`)"
      - "traefik.http.routers.{APP_NAME}.entrypoints=websecure"
      - "traefik.http.routers.{APP_NAME}.tls.certresolver=letsencrypt"
      - "traefik.http.routers.{APP_NAME}.middlewares=authentik@file"

      # API router: No Authentik (uses API key validation in application)
      - "traefik.http.routers.{APP_NAME}-api.rule=Host(`{SUBDOMAIN}.{DOMAIN}`) && PathPrefix(`/api`)"
      - "traefik.http.routers.{APP_NAME}-api.entrypoints=websecure"
      - "traefik.http.routers.{APP_NAME}-api.tls.certresolver=letsencrypt"
      - "traefik.http.routers.{APP_NAME}-api.service={APP_NAME}"
      # No authentik middleware - server-side API key validation

networks:
  proxy:
    external: true
```

**Customization**:
- Replace `{APP_NAME}` with your application name (lowercase, no spaces)
- Replace `{GITHUB_ORG}` with your GitHub username or organization
- Replace `{SUBDOMAIN}` with your desired subdomain (e.g., `myapp`)
- Replace `{DOMAIN}` with your homelab domain (e.g., `flipgoal.xyz`)

#### 4.2 Deploy to Homelab

On your homelab server:

```bash
# Create stack directory
mkdir -p ~/stacks/apps/{APP_NAME}
cd ~/stacks/apps/{APP_NAME}

# Create data directory for persistence
mkdir -p ~/data/{APP_NAME}

# Copy docker-compose.yml and .env.sample
# (Assuming you've cloned or downloaded the deployment files)
cp <repo>/deployment/docker-compose.yml ./
cp <repo>/deployment/.env.sample .env

# Edit .env with your API key
nano .env
# Replace API_KEY=xxx with your generated key

# Deploy
docker compose up -d

# Verify
docker ps | grep {APP_NAME}
docker logs {APP_NAME}
```

### Phase 5: DNS and Traefik Configuration

#### 5.1 DNS Setup

In your DNS provider (e.g., DreamHost, Route53):

```
Record Type: A
Name: {SUBDOMAIN}.{DOMAIN}
Value: {HOMELAB_SERVER_IP}
TTL: 3600
```

Or if using Tailscale (for home networks):

```
Record Type: A
Name: {SUBDOMAIN}.{DOMAIN}
Value: {TAILSCALE_IP}
TTL: 3600
```

#### 5.2 Traefik Configuration (Already in place)

Assuming your homelab already has Traefik configured with:

- A `letsencrypt` certificate resolver (Let's Encrypt)
- An `authentik@file` middleware for OAuth
- The `proxy` external network created

If not, consult your Traefik configuration. The docker-compose labels reference these existing resources.

## Validation Checklist

### Local Development

- [ ] `docker build -t {APP_NAME}:test .` succeeds without errors
- [ ] `docker run -p 8080:80 {APP_NAME}:test` starts without errors
- [ ] `curl http://localhost:8080/` returns HTML content
- [ ] `curl http://localhost:8080/api/...` proxies correctly to backend
- [ ] `docker logs <container-id>` shows no error messages

### CI/CD Pipeline

- [ ] GitHub Actions workflow file is valid YAML
- [ ] Pushing to `main` branch triggers workflow automatically
- [ ] Workflow completes successfully (all steps pass)
- [ ] Image appears in GitHub Container Registry (`ghcr.io/{GITHUB_ORG}/{APP_NAME}`)
- [ ] Image is tagged with `latest` and short commit SHA

### Homelab Deployment

- [ ] `docker compose config` validates without errors
- [ ] `docker compose pull` successfully retrieves image
- [ ] `docker compose up -d` starts container without errors
- [ ] `docker ps` shows container running with status `Up`
- [ ] `docker logs {APP_NAME}` shows startup messages, no errors

### Network and Authentication

- [ ] DNS resolves: `nslookup {SUBDOMAIN}.{DOMAIN}` returns correct IP
- [ ] Traefik routes traffic: `curl -I https://{SUBDOMAIN}.{DOMAIN}` returns 200/301
- [ ] Authentik redirects: Browser shows Authentik login page at `https://{SUBDOMAIN}.{DOMAIN}`
- [ ] API key validation:
  - `curl https://{SUBDOMAIN}.{DOMAIN}/api/... -H "Authorization: Bearer wrong_key"` returns 401
  - `curl https://{SUBDOMAIN}.{DOMAIN}/api/... -H "Authorization: Bearer $API_KEY"` returns 200

### Data Persistence

- [ ] `docker compose restart` restarts container
- [ ] Data in `/data` volume persists across restart
- [ ] `docker compose down && docker compose up -d` preserves volume data

## Configuration Reference

### Environment Variables

| Variable | Example | Purpose | Required |
|----------|---------|---------|----------|
| `API_KEY` | `watcher_sk_abcd...` | Bearer token for API authentication | Yes (unless local dev) |
| `LOG_LEVEL` | `info`, `debug` | Application logging verbosity | No |
| `APP_PORT` | `4000` | Internal application server port | No |
| `DB_PATH` | `/data/events.db` | SQLite database location | No |

### Docker Compose Labels (Traefik)

| Label | Purpose |
|-------|---------|
| `traefik.enable=true` | Enable Traefik routing |
| `traefik.http.services.{APP_NAME}.loadbalancer.server.port=80` | Port nginx listens on inside container |
| `traefik.http.routers.{APP_NAME}.rule=...` | Routing rule (domain, path, method) |
| `traefik.http.routers.{APP_NAME}.middlewares=authentik@file` | Authentik OAuth middleware |
| `traefik.http.routers.{APP_NAME}-api.rule=...` | Separate router for API (no auth middleware) |

### Nginx Proxy Headers

| Header | Purpose |
|--------|---------|
| `Host` | Original host name |
| `X-Real-IP` | Original client IP |
| `X-Forwarded-For` | Proxy chain IP addresses |
| `X-Forwarded-Proto` | Original protocol (http/https) |
| `Authorization` | API key or JWT token |
| `Upgrade` + `Connection` | WebSocket upgrade headers |

## Troubleshooting

### Container Won't Start

**Symptom**: `docker logs {APP_NAME}` shows errors

**Causes and Solutions**:

1. **Build stage failed**: Check Dockerfile syntax
   - Run `docker build --no-cache .` to rebuild from scratch
   - Check for missing dependencies in build stages

2. **Application server won't start**: Check startup script
   - Verify application port matches entrypoint script probe
   - Check `LOG_LEVEL=debug` to see startup messages

3. **nginx won't start**: Check nginx.conf syntax
   - Run `docker run --entrypoint nginx -c /etc/nginx/http.d/default.conf {APP_NAME}:test` to validate
   - Check proxy_pass URL matches internal port

### API Key Not Working

**Symptom**: All requests to `/api/*` return 401

**Causes and Solutions**:

1. **API key not set**: Verify environment variable
   - Check `.env` file has correct key
   - Run `docker inspect {APP_NAME} | grep API_KEY` to confirm

2. **Header format incorrect**: API expects `Authorization: Bearer {KEY}`
   - Verify client sends `Bearer ` prefix
   - Check application middleware is checking correct header

3. **Caching old image**: GHCR image hasn't updated
   - Run `docker pull ghcr.io/{GITHUB_ORG}/{APP_NAME}:latest`
   - Or use commit SHA tag: `docker pull ghcr.io/{GITHUB_ORG}/{APP_NAME}:main-{SHA}`

### WebSocket Connection Fails

**Symptom**: Real-time features fail to connect, console shows WebSocket errors

**Causes and Solutions**:

1. **Missing upgrade headers**: Check nginx.conf has WebSocket location
   - Verify `proxy_http_version 1.1`
   - Verify `proxy_set_header Upgrade` and `Connection` present

2. **Traefik not forwarding**: Traefik may strip WebSocket headers
   - Ensure WebSocket endpoint not protected by Authentik middleware
   - Add explicit router rule: `traefik.http.routers.{APP_NAME}-ws.rule=Host(...) && PathPrefix(/stream)`

3. **Port mismatch**: Application listens on wrong port
   - Verify internal port in nginx proxy_pass
   - Verify entrypoint script waits for correct port

### Traefik Routing Issues

**Symptom**: Browser shows 404 or routes to wrong service

**Causes and Solutions**:

1. **Router priority**: More specific routes need explicit priority
   - If both main and API routers match, add `traefik.http.routers.{APP_NAME}-api.priority=100` to API router

2. **Middleware misconfiguration**: Authentik middleware not found
   - Check `traefik.enable=true` on service
   - Verify `authentik@file` middleware exists in Traefik config

3. **Outdated container**: Old labels cached
   - Run `docker compose down`
   - Run `docker compose up -d`
   - Check `docker inspect {APP_NAME} | grep traefik`

## Security Considerations

### API Key Management

1. **Generation**: Use cryptographically secure random generation
   ```bash
   # Generate 32-byte key in hex (64 characters)
   openssl rand -hex 32
   # Output: a7f8c9d2e1f3b4a6c8e0f2d4b6a8c0e2f4d6a8c0e2f4d6a8c0e2f4d6a8c0e2
   # Prepend prefix: {APP_PREFIX}_sk_a7f8c9d2e1f3b4a6c8e0f2d4b6a8c0e2f4d6a8c0e2f4d6a8c0e2f4d6a8c0e2
   ```

2. **Rotation**: Periodically rotate API keys
   - Set expiration dates in key prefix or metadata
   - Support multiple concurrent keys during transition period
   - Document rotation in runbooks

3. **Storage**: Never commit `.env` files
   - Add to `.gitignore`
   - Use separate `.env.sample` with placeholder values
   - Pass keys via environment variables only

4. **Scope**: Limit API key permissions
   - Only authorize specific endpoints (e.g., POST /api/events)
   - Use separate keys for different integrations
   - Don't reuse same key across multiple applications

### Container Security

1. **Base image**: Use minimal images
   - Alpine-based images reduce attack surface
   - Pin specific versions: `oven/bun:1-alpine` not `oven/bun:latest`

2. **User**: Don't run as root
   - Add non-root user in Dockerfile
   - Run application with least-privilege account

3. **Secrets**: Don't bake into image
   - API keys should come from environment variables
   - Build args can be logged, never use for secrets

4. **Network**: Limit exposed ports
   - Only expose port 80 to Traefik
   - Use `networks` to restrict inter-container communication

### Traefik Security

1. **TLS/HTTPS**: Let's Encrypt certificates
   - ACME provider automatically renews certificates
   - Traefik handles renewal within container

2. **Authentication**: Authentik middleware
   - GitHub OAuth provides user identity
   - Traefik can force authentication before routing

3. **Rate Limiting**: Consider adding Traefik middleware
   - Protect against brute force on `/api/*` endpoints
   - Use `ratelimit@file` middleware in labels

## Advanced Patterns

### Multiple Endpoint Authentication

If your application has different authentication requirements per endpoint:

```yaml
# Main UI - require Authentik
- "traefik.http.routers.main-ui.rule=Host(...) && PathPrefix(`/`)"
- "traefik.http.routers.main-ui.middlewares=authentik@file"

# API - require API key (validated by app)
- "traefik.http.routers.api.rule=Host(...) && PathPrefix(`/api`)"
# No middleware - app validates API key

# Public endpoints - no auth
- "traefik.http.routers.public.rule=Host(...) && PathPrefix(`/public`)"
# No middleware
```

### Database with Backup Strategy

For applications storing data in SQLite or file-based databases:

```yaml
volumes:
  # Daily backups in separate directory
  - ~/data/{APP_NAME}/db:/data/db
  - ~/data/{APP_NAME}/backups:/data/backups
```

Then create a backup script (cron job on host):

```bash
#!/bin/bash
# ~/bin/backup-{APP_NAME}.sh
SRC=~/data/{APP_NAME}/db/events.db
BACKUP_DIR=~/data/{APP_NAME}/backups
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
cp "$SRC" "$BACKUP_DIR/events.db.${DATE}.bak"

# Keep last 30 days
find "$BACKUP_DIR" -name "*.bak" -mtime +30 -delete
```

### Canary Deployments

Use image tags to control rollout:

```yaml
image: ghcr.io/{GITHUB_ORG}/{APP_NAME}:{TAG}
```

Where `{TAG}` can be:

- `latest` - production, requires manual approval
- `main` - bleeding edge, auto-updated by Watchtower
- Semantic version `v1.2.3` - stable releases
- Short SHA `main-a7f8c9d` - debug specific commit

## Related Documentation

- [Traefik Routing Documentation](https://doc.traefik.io/traefik/routing/overview/)
- [Authentik OIDC Configuration](https://goauthentik.io/)
- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

## Template Customization Summary

When adapting this template for a new application:

1. **Dockerfile**:
   - Adjust base image to match runtime (Node, Python, Go, etc.)
   - Change build stage commands to match build process
   - Update exposed port if not 80

2. **nginx.conf**:
   - Update `proxy_pass` port to match application server port
   - Add or remove location blocks for your API structure
   - Adjust root directory if not `/usr/share/nginx/html`

3. **GitHub Actions**:
   - Replace `IMAGE_NAME` env var with your registry path
   - Adjust trigger conditions if needed (e.g., specific branches)

4. **docker-compose.yml**:
   - Replace all `{APP_NAME}`, `{SUBDOMAIN}`, `{DOMAIN}` placeholders
   - Add additional environment variables your app requires
   - Mount additional volumes for application-specific data

5. **Environment Variables**:
   - Rename `API_KEY` to match your application naming
   - Add any additional configuration needed by your app
   - Document each variable in `.env.sample`

This template provides a foundation; adapt freely to your application's specific requirements while maintaining the core security and deployment patterns.
