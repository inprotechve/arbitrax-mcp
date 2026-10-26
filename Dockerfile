FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY bin ./bin

RUN chmod +x bin/cli.js

ENTRYPOINT ["node", "bin/cli.js"]
