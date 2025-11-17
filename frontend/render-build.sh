#!/bin/bash
# Frontend build script for Render

echo "📦 Installing shared dependencies..."
cd ../shared
npm install

echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install

echo "🏗️  Building frontend..."
npm run build

echo "✅ Frontend build complete!"
ls -la dist/
