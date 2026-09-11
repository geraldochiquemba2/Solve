FROM node:20 AS frontend
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /frontend
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY artifacts/solve-crm/package.json ./artifacts/solve-crm/
COPY lib/api-client-react/package.json ./lib/api-client-react/
RUN pnpm install --frozen-lockfile
COPY artifacts/solve-crm/ ./artifacts/solve-crm/
COPY lib/api-client-react/ ./lib/api-client-react/
ENV PORT=5173
ENV BASE_PATH=/
RUN pnpm --filter @workspace/solve-crm run build

FROM node:20
WORKDIR /app
COPY standalone-server/ .
RUN npm install
COPY --from=frontend /frontend/artifacts/solve-crm/dist/public ./public
EXPOSE 3000
CMD ["node", "index.js"]
