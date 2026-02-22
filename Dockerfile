# =============================================================================
# Multi-stage Dockerfile for Next.js standalone build
# =============================================================================

# --- Stage 1: Build ---
FROM node:22-alpine AS builder
WORKDIR /app

# Next.js bakes NEXT_PUBLIC_* vars into the client bundle at build time.
# These are public values (visible in browser), safe to embed in the image.
# Turbopack reads from .env files, NOT from process.env, so we must create
# a .env.production file inside the builder for the values to be picked up.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_SENTRY_DSN

# Promote build ARGs to ENVs so process.env.* is available during next build.
# NEXT_PUBLIC_* vars are inlined into the client JS bundle by the bundler AND
# used by server code (tRPC context). Both mechanisms need the values visible.
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Tell Next.js this is a production build so it loads .env.production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# --- Stage 2: Production ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output (no .env files — runtime vars come from Docker)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
