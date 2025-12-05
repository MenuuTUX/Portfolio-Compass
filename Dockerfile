# Use the official Bun image
FROM oven/bun:1.2.4-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install system dependencies required for potential build tools or prisma
# libc6-compat might be needed for some native modules
RUN apk add --no-cache libc6-compat openssl

COPY package.json bun.lock ./
# Remove prisma from here if we want to install it later, but generally safe to install all
RUN bun install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client (uses DATABASE_URL if available, but for build we might need to mock or skip validation)
# We need to ensure we can generate the client without a DB connection if possible, or provide args.
# Using --no-engine logic might apply, but standard `bun x prisma generate` usually works if schema is valid.
# Since we removed `url` from schema, we need to ensure environment vars are present at runtime.
# For generation, it should be fine.
RUN bun x prisma generate

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
mkdir .next
chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# We also need prisma client in the runner
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

# Next.js 16+ standalone mode
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Cmd to start
CMD ["bun", "server.js"]
