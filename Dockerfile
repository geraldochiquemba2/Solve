FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN node -e "require('esbuild').buildSync({entryPoints:['artifacts/api-server/src/standalone.ts'],bundle:true,platform:'node',format:'esm',outfile:'dist/server.mjs',external:['*.node','pg-native'],sourcemap:'linked'})"
EXPOSE 3000
CMD ["node", "--enable-source-maps", "./dist/server.mjs"]
