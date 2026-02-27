# ── Build stage ──
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY tsconfig*.json nest-cli.json ./
COPY src/ src/
RUN npx nest build

# ── Production stage ──
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/uploads/resumes && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "dist/main.js"]
