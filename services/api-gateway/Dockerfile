FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000

CMD ["node", "dist/main.js"]
