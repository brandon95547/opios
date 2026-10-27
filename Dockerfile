# Opios in production: the built app and its server on Node 24. See docker-compose.prod.yml.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The app is built for the path it is served under, such as /opios.
ARG OPIOS_BASE_PATH=
ENV OPIOS_BASE_PATH=$OPIOS_BASE_PATH
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=5340 OPIOS_DATA_DIR=/app/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY shared ./shared
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 5340
CMD ["node", "server/index.js"]
