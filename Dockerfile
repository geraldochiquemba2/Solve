FROM node:20 AS frontend
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /frontend
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/api-client-react/package.json ./packages/api-client-react/
RUN pnpm install --frozen-lockfile
COPY apps/web/ ./apps/web/
COPY packages/api-client-react/ ./packages/api-client-react/
ENV PORT=5173
ENV BASE_PATH=/
# Vazio por omissão: o frontend usa URLs relativas (same-origin), por isso o
# bundle funciona em qualquer domínio sem reconstruir. Só definir se a API
# viver noutro host (ex.: render.yaml buildArgs).
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @workspace/solve-crm run build

FROM node:20
WORKDIR /app
COPY standalone-server/ .
RUN npm ci --omit=dev
COPY --from=frontend /frontend/apps/web/dist/public ./public
EXPOSE 3000
USER node
CMD ["node", "index.js"]
