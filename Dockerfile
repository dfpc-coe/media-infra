FROM bluenviron/mediamtx:1.14.0-ffmpeg

RUN apk add bash vim yq nodejs npm yq

ADD mediamtx.yml /
ADD start /

ADD package.json /
ADD package-lock.json /

RUN npm install

ADD persist.ts /

ENTRYPOINT [ "/start" ]
