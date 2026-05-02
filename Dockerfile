ARG BUILDPLATFORM
ARG MEDIAMTX_BASE_IMAGE=bluenviron/mediamtx:1.18.1-ffmpeg
ARG MEDIAMTX_REPO=https://github.com/dfpc-coe/mediamtx.git
ARG MEDIAMTX_BRANCH=ProfileLevelID

FROM --platform=$BUILDPLATFORM node:24-alpine AS app-builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY . .

RUN npm run build
RUN npm prune --omit=dev

FROM node:24-alpine AS node-runtime

FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS mediamtx-builder

ARG TARGETOS
ARG TARGETARCH
ARG TARGETVARIANT
ARG MEDIAMTX_REPO
ARG MEDIAMTX_BRANCH

RUN apk add --no-cache file git

WORKDIR /build
RUN git clone --depth 1 --branch "${MEDIAMTX_BRANCH}" "${MEDIAMTX_REPO}" .
RUN set -eux; \
	echo "v0.0.0-custom" > internal/core/VERSION; \
	go generate ./...; \
	targetos="${TARGETOS:-$(go env GOOS)}"; \
	targetarch="${TARGETARCH:-$(go env GOARCH)}"; \
	targetvariant="${TARGETVARIANT:-}"; \
	export CGO_ENABLED=0 GOOS="${targetos}" GOARCH="${targetarch}"; \
	goarm="${targetvariant#v}"; \
	if [ "${targetarch}" = "arm" ]; then export GOARM="${goarm:-7}"; fi; \
	go build -tags enable_upgrade -trimpath -ldflags="-s -w" -o /mediamtx .; \
	file /mediamtx; \
	case "${targetos}/${targetarch}" in \
		linux/amd64) file /mediamtx | grep -q 'ELF 64-bit.*x86-64' ;; \
		linux/arm64) file /mediamtx | grep -Eq 'ELF 64-bit.*(aarch64|ARM)' ;; \
		linux/arm) file /mediamtx | grep -q 'ELF 32-bit.*ARM' ;; \
	esac; \
	if [ "${targetos}" = "$(go env GOOS)" ] && [ "${targetarch}" = "$(go env GOARCH)" ]; then /mediamtx --version; fi

# Final Stage
FROM ${MEDIAMTX_BASE_IMAGE}

RUN apk add --no-cache aws-cli jq openssl

# Replace the runtime image binary with the selected remote source build.
COPY --from=mediamtx-builder /mediamtx /mediamtx

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
