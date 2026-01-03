#!/bin/sh
set -e

# Start Bun server in background
cd /app/server
bun run src/index.ts &

# Wait for Bun server to be ready (using wget to check localhost:4000)
echo "Waiting for Bun server to be ready on port 4000..."
until wget -q --spider http://127.0.0.1:4000/ 2>/dev/null; do
  sleep 0.5
done
echo "Bun server is ready"

# Start nginx in foreground
echo "Starting nginx..."
nginx -g "daemon off;"
