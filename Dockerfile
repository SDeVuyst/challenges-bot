FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && apk del python3 make g++

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV DATABASE_PATH=/data/challenge.db

VOLUME ["/data"]

CMD ["node", "dist/index.js"]
