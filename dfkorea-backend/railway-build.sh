#!/bin/sh
set -e

echo "🔨 Building application..."
npm run build

echo "🗃️ Running migrations..."
npm run migration:run:prod

echo "✅ Build complete!"
