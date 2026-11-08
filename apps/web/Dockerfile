# syntax=docker/dockerfile:1
FROM node:22.12-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG NEXT_PUBLIC_SITE_URL=https://yonixtools.com
ARG NEXT_PUBLIC_DOWNLOADER_API_URL=/api
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
# Advertising: ADS=off disables every ad; AD_ISOLATION=sandboxed only for comparison (Adsterra fails in it).
ARG NEXT_PUBLIC_ADS=on
ARG NEXT_PUBLIC_AD_ISOLATION=same-origin
ARG NEXT_PUBLIC_MONETAG=off
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_ADS=$NEXT_PUBLIC_ADS \
    NEXT_PUBLIC_AD_ISOLATION=$NEXT_PUBLIC_AD_ISOLATION \
    NEXT_PUBLIC_MONETAG=$NEXT_PUBLIC_MONETAG \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_DOWNLOADER_API_URL=$NEXT_PUBLIC_DOWNLOADER_API_URL \
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=$NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
RUN npm run build

FROM nginx:1.27-alpine
RUN rm /etc/nginx/conf.d/default.conf && mkdir -p /etc/nginx/snippets
COPY --from=deploy web.conf /etc/nginx/conf.d/yonixtools.conf
COPY --from=deploy security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/out /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
