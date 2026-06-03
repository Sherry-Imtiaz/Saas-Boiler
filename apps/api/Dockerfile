FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/

RUN npm ci --workspaces --include-workspace-root

COPY apps/api apps/api
COPY eslint.config.mjs ./

RUN npm run build -w apps/api

ENV NODE_ENV=production
ENV PORT=4000
ENV API_BASE_PATH=/api

EXPOSE 4000

CMD ["node", "apps/api/dist/server.js"]
