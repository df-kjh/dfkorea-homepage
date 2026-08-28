# Build stage
FROM node:22.18.0-alpine3.21 AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Pin npm before installing dependencies so the image follows packageManager.
RUN npm install --global npm@11.17.0 \
    && test "$(npm --version)" = "11.17.0" \
    && npm ci

# Copy source files
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:22.18.0-alpine3.21 AS runner

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# Nuxt's node-server preset emits the complete production server in .output.
COPY --from=builder --chown=node:node /app/.output ./.output

USER node

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
