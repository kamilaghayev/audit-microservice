FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci || npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

EXPOSE 7070

ENV GATEWAY_PORT=7070
CMD ["node", "dist/index.js"]
