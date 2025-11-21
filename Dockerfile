FROM bluenviron/mediamtx:1.15.4-ffmpeg

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


RUN apk add bash vim yq nodejs npm yq

ADD mediamtx.yml /
ADD start /

ADD package.json /
ADD package-lock.json /

RUN npm install

ADD index.ts /
COPY lib/ /lib/
COPY routes/ /routes/

ENTRYPOINT [ "/start" ]
