FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

COPY api ./api
COPY server ./server
COPY public ./public
COPY supabase ./supabase

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server/index.mjs"]