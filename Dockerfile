FROM bluenviron/mediamtx:1.9.0-ffmpeg

ENV MEDIA_VERSION=1.9.3

RUN apk add bash vim yq nodejs npm

ADD mediamtx.yml /mediamtx.base.yml
ADD start /

ADD package.json /
ADD package-lock.json /

RUN npm install

ADD persist.ts /

ENTRYPOINT [ "/start" ]
