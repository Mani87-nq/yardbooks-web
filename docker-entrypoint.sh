#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations with Prisma..."
# Use prisma db push WITHOUT --accept-data-loss to prevent silent data loss.
# If the schema change would drop columns/tables, this will FAIL instead of
# silently destroying data (which caused the Feb 25 outage).
#
# For production: migrate to `prisma migrate deploy` once migration history is established.
# For now, db push without --accept-data-loss is the safe intermediate step.
node node_modules/prisma/build/index.js db push --skip-generate 2>&1 || {
  echo "[entrypoint] ERROR: prisma db push failed."
  echo "[entrypoint] This likely means a schema change would cause data loss."
  echo "[entrypoint] Review the change and apply it manually if intentional."
  echo "[entrypoint] Continuing with app startup using existing schema..."
}

echo "[entrypoint] Starting application..."
exec "$@"
