FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm exec esbuild artifacts/api-server/src/standalone.ts --bundle --platform=node --format=esm --outfile=dist/server.mjs --external:"*.node" --external:pg-native --sourcemap=linked
EXPOSE 3000
CMD ["node", "--enable-source-maps", "./dist/server.mjs"]
