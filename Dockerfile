# --- Build stage ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm install

COPY tsconfig.base.json ./
COPY server/ server/
COPY web/ web/

RUN npm run build

# --- Production stage ---
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
COPY server/package.json server/
RUN npm install -w server --omit=dev

COPY --from=build /app/server/dist server/dist
COPY --from=build /app/web/dist web/dist

# Serve frontend static files from Express in production
ENV NODE_ENV=production
ENV PORT=8787

EXPOSE 8787
CMD ["node", "server/dist/index.js"]
