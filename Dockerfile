FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile
EXPOSE 3000
CMD ["pnpm", "exec", "tsx", "artifacts/api-server/src/standalone.ts"]
