ARG MEDIAMTX_REPO=https://github.com/bluenviron/mediamtx.git
ARG MEDIAMTX_BRANCH=v1.18.0

# Build Stage
FROM golang:1.25-alpine AS builder

ARG MEDIAMTX_REPO
ARG MEDIAMTX_BRANCH

RUN apk add --no-cache git make

WORKDIR /build
RUN git clone ${MEDIAMTX_REPO} . \
    && git checkout ${MEDIAMTX_BRANCH} \
    && case "${MEDIAMTX_REPO}" in *bluenviron/mediamtx*) ;; *) echo "v0.0.0-custom" > internal/core/VERSION ;; esac \
    && go generate ./... \
    && go build -o /mediamtx .

# Final Stage
FROM bluenviron/mediamtx:1.17.0-ffmpeg

# Copy custom binary
COPY --from=builder /mediamtx /mediamtx

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


RUN apk add --no-cache bash vim yq nodejs npm

COPY mediamtx.yml /
COPY start /

COPY package.json /
COPY package-lock.json /

RUN npm install

COPY index.ts /
COPY lib/ /lib/
COPY routes/ /routes/

ENTRYPOINT [ "/start" ]
