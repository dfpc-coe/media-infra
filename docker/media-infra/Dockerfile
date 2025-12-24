FROM bluenviron/mediamtx:1.15.5-ffmpeg

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

RUN apk add bash vim yq nodejs npm

ADD docker-container/mediamtx.yml /mediamtx.yml
ADD docker-container/start /start

ADD docker-container/package.json /package.json
ADD docker-container/package-lock.json /package-lock.json

RUN npm install

ADD docker-container/index.ts /index.ts
COPY docker-container/lib/ /lib/
COPY docker-container/routes/ /routes/

ENTRYPOINT [ "/start" ]