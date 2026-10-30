FROM node:22-bookworm-slim
WORKDIR /srv/backend
COPY android-app/backend/package*.json ./
RUN npm ci --omit=dev
COPY android-app/backend/src ./src
COPY android-app/backend/public ./public
COPY android-app/backend/migrations ./migrations
ENV CONTENT_ROOT=https://devnazu.online/ PORT=8080 NODE_ENV=production
USER node
EXPOSE 8080
CMD ["node","src/server.mjs"]
