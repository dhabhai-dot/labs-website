FROM node:20-alpine

WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public

RUN mkdir -p data

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server/index.mjs"]
