#!/bin/bash
# Backend build script for Render

echo "📦 Installing shared dependencies..."
cd ../shared
npm install

echo "📦 Installing backend dependencies..."
cd ../backend
npm install

echo "✅ Backend build complete!"
