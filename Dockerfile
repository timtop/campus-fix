FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm exec prisma generate && pnpm build
RUN mkdir -p /data && chown node:node /data /app
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATABASE_URL=file:/data/campusfix.db COOKIE_SECURE=true
EXPOSE 3000
CMD ["sh", "-c", "pnpm db:deploy && node .output/server/index.mjs"]
