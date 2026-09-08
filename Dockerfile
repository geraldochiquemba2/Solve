FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY lib/ lib/
COPY artifacts/api-server/ artifacts/api-server/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server run build
WORKDIR /app/artifacts/api-server
EXPOSE 3000
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
