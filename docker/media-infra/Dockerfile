ARG MEDIAMTX_VERSION=1.13.1
FROM bluenviron/mediamtx:${MEDIAMTX_VERSION}-ffmpeg

# Install dependencies
RUN apk add --no-cache tini curl nodejs npm netcat-openbsd bash yq

# Copy base configuration
COPY docker-container/mediamtx.yml /mediamtx.yml

# Copy package files and install dependencies
COPY docker-container/package*.json /app/
WORKDIR /app
RUN npm install

# Copy source files
COPY docker-container/persist.ts /app/
COPY docker-container/tsconfig.json /app/

# Copy startup script
COPY docker-container/start /start
RUN chmod +x /start

# Create mediamtx config directory
RUN mkdir -p /opt/mediamtx

# Use tini as PID 1 (following TAK.NZ pattern)
ENTRYPOINT ["/sbin/tini", "--"]

# Run startup script
CMD ["/start"]