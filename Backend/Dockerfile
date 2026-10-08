FROM node:24-bookworm-slim AS base
RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY Backend/package.json ./Backend/package.json
RUN pnpm install --frozen-lockfile --filter somali-hotel-erp-backend...

FROM dependencies AS build
ENV DATABASE_URL=postgresql://build_only:build_only@localhost:5432/build_only
COPY Backend ./Backend
WORKDIR /app/Backend
RUN pnpm run prisma:generate && pnpm run build

FROM base AS production
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY Backend/package.json ./Backend/package.json
RUN pnpm install --frozen-lockfile --prod --filter somali-hotel-erp-backend...
RUN groupadd --system --gid 1001 nestjs && useradd --system --uid 1001 --gid nestjs hotel-api
COPY --from=build --chown=hotel-api:nestjs /app/Backend/dist ./Backend/dist
WORKDIR /app/Backend
USER hotel-api
EXPOSE 3000
CMD ["node", "dist/main.js"]
