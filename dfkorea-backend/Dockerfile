# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install ALL dependencies (TypeORM CLI needs dev dependencies)
RUN npm ci

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy node_modules from builder (for TypeORM)
COPY --from=builder /app/node_modules ./node_modules

# Create uploads directory (이미지 저장용)
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start application with migration
CMD ["sh", "-c", "npm run migration:run:prod && npm run start:prod"]
