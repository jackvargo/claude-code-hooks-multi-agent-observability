# Dockerfile
# Multi-stage build for Multi-Agent Observability dashboard
# Stage 1: Build Vue client
# Stage 2: Prepare Bun server
# Stage 3: Production - nginx serving static files + Bun API server

# Stage 1: Build Vue client
FROM oven/bun:1-alpine AS client-builder
WORKDIR /app/client
COPY apps/client/package.json apps/client/bun.lock* ./
RUN bun install --frozen-lockfile
COPY apps/client/ ./
RUN bun run build

# Stage 2: Prepare Bun server
FROM oven/bun:1 AS server-builder
WORKDIR /app/server
COPY apps/server/package.json apps/server/bun.lockb* ./
RUN bun install --frozen-lockfile
COPY apps/server/ ./

# Stage 3: Production image
FROM oven/bun:1-alpine AS production

# Install nginx and wget (for health checks in entrypoint)
RUN apk add --no-cache nginx wget

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

# Set environment variable for SQLite database path
ENV DATABASE_PATH=/data/events.db

# Expose port 80 for nginx
EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
