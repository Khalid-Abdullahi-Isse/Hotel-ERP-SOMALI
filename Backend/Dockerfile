FROM node:24-bookworm-slim AS base
RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM dependencies AS build
ENV DATABASE_URL=postgresql://build_only:build_only@localhost:5432/build_only
COPY . .
RUN npm run prisma:generate && npm run build && npm prune --omit=dev

FROM base AS production
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system --gid 1001 nestjs && useradd --system --uid 1001 --gid nestjs hotel-api
COPY --from=build --chown=hotel-api:nestjs /app/node_modules ./node_modules
COPY --from=build --chown=hotel-api:nestjs /app/dist ./dist
COPY --from=build --chown=hotel-api:nestjs /app/package.json ./package.json
USER hotel-api
EXPOSE 3000
CMD ["node", "dist/main.js"]
