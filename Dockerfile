# required envvars
# - ES_HOST: Elasticsearch https endpoint


FROM node:8

WORKDIR /home/satapi

COPY package.json /home/satapi/

RUN \
    npm install -g lerna; \
    yarn;

COPY . /home/satapi

RUN \
    yarn bootstrap; \
    yarn build; \
    yarn linkall

RUN \
    cd example; \
    yarn; yarn linkall
