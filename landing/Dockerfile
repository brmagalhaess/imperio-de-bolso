# syntax=docker/dockerfile:1
# Site estático (landing + políticas). Dados da empresa entram como build args e o build
# recusa publicar com campos pendentes (SITE_STRICT=1).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG SITE_LEGAL_NAME
ARG SITE_CNPJ
ARG SITE_CITY
ARG SITE_EMAIL
ARG SITE_GOOGLE_PLAY_URL=""
ARG SITE_APP_STORE_URL=""
ENV SITE_STRICT=1 NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/out /usr/share/nginx/html
EXPOSE 80
