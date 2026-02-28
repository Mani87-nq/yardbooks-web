#!/bin/sh
set -e

MAX_RETRIES=3
RETRY_DELAY=5

echo "[entrypoint] Waiting for database to be ready..."

# Retry loop for prisma db push — the database may not be accepting
# connections immediately after a container restart.
attempt=1
while [ "$attempt" -le "$MAX_RETRIES" ]; do
  echo "[entrypoint] Attempt $attempt/$MAX_RETRIES: Running prisma db push..."

  if node node_modules/prisma/build/index.js db push 2>&1; then
    echo "[entrypoint] ✓ prisma db push succeeded on attempt $attempt."
    break
  else
    echo "[entrypoint] ✗ prisma db push failed on attempt $attempt."
    if [ "$attempt" -lt "$MAX_RETRIES" ]; then
      echo "[entrypoint] Retrying in ${RETRY_DELAY}s..."
      sleep "$RETRY_DELAY"
    else
      echo "[entrypoint] ERROR: All $MAX_RETRIES attempts failed."
      echo "[entrypoint] The database schema may be out of sync."
      echo "[entrypoint] Common causes:"
      echo "[entrypoint]   - Database not reachable (check DATABASE_URL)"
      echo "[entrypoint]   - Schema change requires --accept-data-loss"
      echo "[entrypoint]   - Column exists in DB but not in schema.prisma"
      echo "[entrypoint] Continuing with app startup using existing schema..."
    fi
  fi

  attempt=$((attempt + 1))
done

echo "[entrypoint] Starting application..."
exec "$@"
