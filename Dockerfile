ARG BUILDPLATFORM

FROM --platform=$BUILDPLATFORM node:24-alpine AS app-builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY . .

RUN npm run build
RUN npm prune --omit=dev

FROM node:24-alpine AS node-runtime

# Final Stage
FROM bluenviron/mediamtx:1.18.1-ffmpeg

RUN apk add --no-cache aws-cli jq openssl

# Copy a target-platform Node runtime without executing package-manager steps
COPY --from=node-runtime /usr/local/ /usr/local/

# SRT
EXPOSE 8890

# API
EXPOSE 9997

# Metrics
EXPOSE 9998

# PPROF
EXPOSE 9999

# Playback
EXPOSE 9996

# HLS
EXPOSE 8888

# WebRTC
EXPOSE 8889
EXPOSE 8189
EXPOSE 8189/udp

COPY mediamtx.yml /
COPY start /

COPY --from=app-builder /app/node_modules /node_modules
COPY --from=app-builder /app/dist /dist
COPY package.json /dist/package.json

ENTRYPOINT [ "/start" ]
