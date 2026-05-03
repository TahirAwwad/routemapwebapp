# Optional: Zeabur auto-detects Node; use this for reproducible container builds.
FROM node:22-alpine AS builder
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
WORKDIR /app
COPY package.json package-lock.json ./
COPY patches ./patches
RUN npm install --frozen-lockfile
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY patches ./patches
RUN npm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
