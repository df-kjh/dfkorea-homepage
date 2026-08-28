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
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
