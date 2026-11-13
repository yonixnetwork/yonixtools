# syntax=docker/dockerfile:1
FROM node:22.12-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG NEXT_PUBLIC_SITE_URL=https://yonixtools.com
ARG NEXT_PUBLIC_DOWNLOADER_API_URL=/api
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
ARG NEXT_PUBLIC_BING_SITE_VERIFICATION=
# Advertising: ads render only from a separate ad origin (NEXT_PUBLIC_AD_ORIGIN); ADS=off disables every ad.
ARG NEXT_PUBLIC_ADS=on
ARG NEXT_PUBLIC_AD_ORIGIN=
ARG NEXT_PUBLIC_MONETAG=off
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_ADS=$NEXT_PUBLIC_ADS \
    NEXT_PUBLIC_AD_ORIGIN=$NEXT_PUBLIC_AD_ORIGIN \
    NEXT_PUBLIC_MONETAG=$NEXT_PUBLIC_MONETAG \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_DOWNLOADER_API_URL=$NEXT_PUBLIC_DOWNLOADER_API_URL \
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=$NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION \
    NEXT_PUBLIC_BING_SITE_VERIFICATION=$NEXT_PUBLIC_BING_SITE_VERIFICATION
RUN npm run build

FROM nginx:1.27-alpine
RUN rm /etc/nginx/conf.d/default.conf && mkdir -p /etc/nginx/snippets
COPY --from=deploy web.conf /etc/nginx/conf.d/yonixtools.conf
COPY --from=deploy security-headers.conf /etc/nginx/snippets/security-headers.conf
# Build options -> nginx security config (no-op with the production defaults). See the script's header.
ARG NEXT_PUBLIC_SITE_URL=https://yonixtools.com
ARG NEXT_PUBLIC_AD_ORIGIN=
ARG AD_FRAME_PARENT=
COPY --from=deploy apply-build-options.sh /tmp/apply-build-options.sh
RUN SITE_URL="$NEXT_PUBLIC_SITE_URL" AD_ORIGIN="$NEXT_PUBLIC_AD_ORIGIN" AD_FRAME_PARENT="$AD_FRAME_PARENT" \
    sh /tmp/apply-build-options.sh /etc/nginx/snippets/security-headers.conf /etc/nginx/conf.d/yonixtools.conf && rm /tmp/apply-build-options.sh
COPY --from=build /app/out /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
