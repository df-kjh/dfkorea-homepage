# Build stage
FROM node:22.18.0-alpine3.21 AS builder

WORKDIR /app

# Production images must bake a browser-reachable API URL into the Nuxt bundle.
ARG VITE_API_BASE_URL
RUN VITE_API_BASE_URL="$VITE_API_BASE_URL" node --input-type=module -e '\
  const value = process.env.VITE_API_BASE_URL?.trim(); \
  let parsed; \
  try { \
    parsed = new URL(value); \
  } catch { \
    parsed = undefined; \
  } \
  const hostname = parsed?.hostname.toLowerCase(); \
  const isLocalhost = hostname === "localhost" || hostname?.endsWith(".localhost") === true; \
  const isLoopback = hostname === "127.0.0.1" || hostname === "::1" || hostname === "0.0.0.0"; \
  const isValid = value && parsed && ["http:", "https:"].includes(parsed.protocol) && hostname && !isLocalhost && !isLoopback && !parsed.username && !parsed.password; \
  if (!isValid) { \
    console.error("VITE_API_BASE_URL must be a public http(s) URL (for example https://api.example.com/api), not localhost."); \
    process.exit(1); \
  } \
'

# Copy package files
COPY package*.json ./

# Pin npm before installing dependencies so the image follows packageManager.
RUN npm install --global npm@11.17.0 \
    && test "$(npm --version)" = "11.17.0" \
    && npm ci

# Copy source files
COPY . .

# Build application
RUN VITE_API_BASE_URL="$VITE_API_BASE_URL" npm run build

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
