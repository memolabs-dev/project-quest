# The public visit (#16): the built game and a server with the read-only visit only (src/server/prod.ts).
# Needs GITHUB_TOKEN at run time: a token that reads public repositories, nothing more.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY src ./src
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
# Node 24 runs the TypeScript sources directly (erasable syntax only, see tsconfig).
CMD ["node", "src/server/prod.ts"]
