FROM ubuntu:24.04

ENV MEDIA_VERSION=1.8.5

RUN apt-get upgrade \
    && apt-get update \
    && apt-get install -y curl

RUN curl -L "https://github.com/bluenviron/mediamtx/releases/download/v${MEDIA_VERSION}/mediamtx_v${MEDIA_VERSION}_linux_amd64.tar.gz" > /archive.tar.gz \
    && tar -xzvf /archive.tar.gz \
    && rm /archive.tar.gz

COPY mediamtx.yml /

COPY start /

ENTRYPOINT [ "/start" ]
