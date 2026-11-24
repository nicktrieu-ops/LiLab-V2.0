# LiLab V2.0 container for Cloud Run.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json /app/server.ts /app/firebase-applet-config.json ./
COPY --from=build /app/src ./src
COPY --from=build /app/scripts/ensure-build.mjs ./scripts/ensure-build.mjs
EXPOSE 8080
CMD ["npm", "start"]
