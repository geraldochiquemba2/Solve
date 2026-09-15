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
ARG VITE_API_URL=https://solve-sqoh.onrender.com
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @workspace/solve-crm run build

FROM node:20
WORKDIR /app
COPY standalone-server/ .
RUN npm install
COPY --from=frontend /frontend/apps/web/dist/public ./public
EXPOSE 3000
CMD ["node", "index.js"]
