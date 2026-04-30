ARG BUILDPLATFORM

FROM --platform=$BUILDPLATFORM node:24-alpine AS node-runtime

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY index.ts lib/ routes/ ./

RUN npm run build \
    && npm prune --omit=dev

# Final Stage
FROM bluenviron/mediamtx:1.18.1-ffmpeg

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

COPY mediamtx.yml /
COPY start /

COPY --from=node-runtime /app/node_modules /node_modules
COPY --from=node-runtime /app/dist /dist
COPY package.json /dist/package.json

ENTRYPOINT [ "/start" ]
