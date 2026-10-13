# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts ./
USER node
EXPOSE 3000
# Migrações e catálogo antes de subir a API (ambos idempotentes).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/db/seed.js && node dist/server.js"]
