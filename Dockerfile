FROM bluenviron/mediamtx:1.12.3-ffmpeg

RUN apk add bash vim yq nodejs npm

ADD mediamtx.yml /mediamtx.base.yml
ADD start /

ADD package.json /
ADD package-lock.json /

RUN npm install

ADD persist.ts /

ENTRYPOINT [ "/start" ]
