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
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Copy ALL node_modules from builder — Prisma 7.x CLI has deep transitive
# dependency tree (valibot, effect, c12, etc.) that's impractical to cherry-pick.
# The standalone output already has its own minimal node_modules, so we merge
# the full builder node_modules on top to ensure prisma db push works at runtime.
COPY --from=builder /app/node_modules ./node_modules

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
