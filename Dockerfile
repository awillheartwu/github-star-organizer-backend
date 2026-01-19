# syntax=docker/dockerfile:1.6

FROM node:22-slim AS base
WORKDIR /app
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
# Avoid Prisma Client generation during dependency install; we'll run it explicitly later.
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store/v3 \
    pnpm install --frozen-lockfile --ignore-scripts

FROM base AS builder
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm exec prisma generate
RUN pnpm build
RUN npm_config_ignore_scripts=true pnpm prune --prod

FROM node:22-slim AS runner
WORKDIR /app
LABEL org.opencontainers.image.title="gsor-backend"
LABEL org.opencontainers.image.source="github-star-organizer-backend"
ENV NODE_ENV=production
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
COPY package.json pnpm-lock.yaml ./
COPY src/scripts/nullPatch.mjs ./src/scripts/nullPatch.mjs
EXPOSE 3000
CMD ["node", "--experimental-specifier-resolution=node", "dist/main.js"]
