# Build stage — use Debian slim (glibc) instead of Alpine (musl)
# for reliable native binary support (lightningcss, @tailwindcss/oxide, swc)
FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Copy package.json only (not lockfile — macOS lockfile lacks Linux native deps)
COPY package.json ./
COPY prisma ./prisma/

# Fresh install resolves correct platform-specific optional deps
# (lightningcss-linux-x64-gnu, @tailwindcss/oxide-linux-x64-gnu, etc.)
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the Next.js app with production env vars baked in
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_APP_URL="https://yaadbooks.com"
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_51RlcqrLiXrJVafWfxwLSgxRKx6ewuhFYRQJzGXEOz9cEw9a6XiKHwkkofnF5bWcy71Cp6muMsUe3YLecpZdsMRk500Tj6ODo5A"
RUN npm run build

# Production stage
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --gid nodejs nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Prisma 7.x CLI transitive deps needed for `prisma db push` at runtime
COPY --from=builder /app/node_modules/valibot ./node_modules/valibot
COPY --from=builder /app/node_modules/@mrleebo ./node_modules/@mrleebo
COPY --from=builder /app/node_modules/chevrotain ./node_modules/chevrotain
COPY --from=builder /app/node_modules/@chevrotain ./node_modules/@chevrotain
COPY --from=builder /app/node_modules/lodash ./node_modules/lodash
COPY --from=builder /app/node_modules/regexp-to-ast ./node_modules/regexp-to-ast
COPY --from=builder /app/node_modules/lilconfig ./node_modules/lilconfig
COPY --from=builder /app/node_modules/@hono ./node_modules/@hono
COPY --from=builder /app/node_modules/hono ./node_modules/hono
COPY --from=builder /app/node_modules/@electric-sql ./node_modules/@electric-sql
COPY --from=builder /app/node_modules/remeda ./node_modules/remeda
COPY --from=builder /app/node_modules/pathe ./node_modules/pathe
COPY --from=builder /app/node_modules/proper-lockfile ./node_modules/proper-lockfile
COPY --from=builder /app/node_modules/graceful-fs ./node_modules/graceful-fs
COPY --from=builder /app/node_modules/retry ./node_modules/retry
COPY --from=builder /app/node_modules/signal-exit ./node_modules/signal-exit
COPY --from=builder /app/node_modules/foreground-child ./node_modules/foreground-child
COPY --from=builder /app/node_modules/cross-spawn ./node_modules/cross-spawn
COPY --from=builder /app/node_modules/path-key ./node_modules/path-key
COPY --from=builder /app/node_modules/shebang-command ./node_modules/shebang-command
COPY --from=builder /app/node_modules/shebang-regex ./node_modules/shebang-regex
COPY --from=builder /app/node_modules/which ./node_modules/which
COPY --from=builder /app/node_modules/isexe ./node_modules/isexe
COPY --from=builder /app/node_modules/get-port-please ./node_modules/get-port-please
COPY --from=builder /app/node_modules/http-status-codes ./node_modules/http-status-codes
COPY --from=builder /app/node_modules/std-env ./node_modules/std-env
COPY --from=builder /app/node_modules/zeptomatch ./node_modules/zeptomatch
COPY --from=builder /app/node_modules/grammex ./node_modules/grammex
COPY --from=builder /app/node_modules/graphmatch ./node_modules/graphmatch
COPY --from=builder /app/node_modules/mysql2 ./node_modules/mysql2
COPY --from=builder /app/node_modules/postgres ./node_modules/postgres

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Fix permissions for .well-known
RUN chown -R nextjs:nodejs /app/public

# Copy the entrypoint script
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check — Coolify and Docker use this to detect unhealthy containers
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
