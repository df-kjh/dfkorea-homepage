#!/bin/bash

echo "🚀 Starting deployment..."

# Load environment
if [ "$1" == "production" ]; then
    echo "📦 Building for production..."
    ENV="production"
else
    echo "📦 Building for development..."
    ENV="development"
fi

# Build backend
echo "🔨 Building backend..."
cd dfkorea-backend
npm ci
npm run build

# Build frontend
echo "🔨 Building frontend..."
cd ../led-lighting-website
npm ci
npm run build

echo "✅ Build completed!"
echo ""
echo "📝 Next steps:"
echo "  - Copy backend dist/ to your server"
echo "  - Copy frontend dist/ to your web server"
echo "  - Configure environment variables"
echo "  - Start services"
