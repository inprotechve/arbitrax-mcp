FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN chmod +x bin/cli.js
CMD ["node", "bin/cli.js"]
