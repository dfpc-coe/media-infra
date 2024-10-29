FROM bluenviron/mediamtx:1.9.0-ffmpeg

ENV MEDIA_VERSION=1.9.1

RUN apk add bash vim yq nodejs npm

COPY mediamtx.yml /mediamtx.base.yml

COPY start /

ENTRYPOINT [ "/start" ]
