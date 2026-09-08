FROM node:20-alpine
WORKDIR /app
COPY standalone-server/ .
RUN npm install
EXPOSE 3000
CMD ["node", "index.js"]
