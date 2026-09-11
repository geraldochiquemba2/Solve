FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY artifacts/solve-crm/package*.json ./
RUN npm ci
COPY artifacts/solve-crm/ .
ENV PORT=5173
ENV BASE_PATH=/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY standalone-server/ .
RUN npm install
COPY --from=frontend /frontend/dist/public ./public
EXPOSE 3000
CMD ["node", "index.js"]
