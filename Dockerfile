FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @workspace/api-server run build
WORKDIR /app/artifacts/api-server
EXPOSE 3000
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
