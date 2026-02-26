# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (including devDependencies for build)
# Use npm install instead of npm ci for cross-platform compatibility
RUN npm install
# Explicitly install platform-specific native binaries for Alpine Linux (musl)
# These are optional deps that npm may not resolve correctly cross-platform
RUN npm install --no-save lightningcss-linux-x64-musl@1.30.2

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
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Install curl for health checks (lighter than spawning Node.js)
RUN apk add --no-cache curl

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
