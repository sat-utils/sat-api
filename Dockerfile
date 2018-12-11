# required envvars
# - ES_HOST: Elasticsearch https endpoint


FROM node:8

ENV \
    HOME=/home/sat-utils

WORKDIR ${HOME}/sat-api

COPY package.json ./

RUN \
    npm install -g lerna; \
    yarn;

COPY . ./

RUN \
    yarn bootstrap; \
    yarn build; \
    yarn linkall
