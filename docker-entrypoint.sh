#!/bin/sh
set -e

echo "[entrypoint] Syncing database schema with Prisma..."
# Run prisma db push to apply any pending schema changes to the database.
# --skip-generate: Prisma client was already generated at build time.
# If push fails (e.g. destructive change needing manual migration), log warning and continue.
node node_modules/prisma/build/index.js db push --skip-generate 2>&1 || {
  echo "[entrypoint] WARNING: prisma db push failed. If this is a destructive schema change, apply it manually."
  echo "[entrypoint] Continuing with app startup..."
}

echo "[entrypoint] Starting application..."
exec "$@"
