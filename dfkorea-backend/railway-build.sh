#!/bin/sh
set -e

echo "🔨 Building application..."
npm run build

echo "🗃️ Running migrations..."
npm run migration:run:prod || echo "⚠️ Migration failed or already applied"

echo "✅ Build complete!"
