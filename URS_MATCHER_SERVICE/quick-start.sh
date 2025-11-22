#!/bin/bash

# URS Matcher Service - Quick Start Script

echo "🚀 Starting URS Matcher Service..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    echo "   Visit: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose."
    exit 1
fi

# Create necessary directories
mkdir -p data uploads

# Copy env file if not exists
if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env (from .env.example)"
fi

# Build and start services
echo "📦 Building Docker images..."
docker-compose build

echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to start
echo "⏳ Waiting for services to start (30 seconds)..."
sleep 30

# Check if services are running
echo "🔍 Checking service status..."

backend_status=$(docker-compose ps backend | grep -i "up")
frontend_status=$(docker-compose ps frontend | grep -i "up")

if [[ $backend_status == *"Up"* ]]; then
    echo "✅ Backend: RUNNING"
else
    echo "❌ Backend: FAILED"
    docker-compose logs backend
    exit 1
fi

if [[ $frontend_status == *"Up"* ]]; then
    echo "✅ Frontend: RUNNING"
else
    echo "❌ Frontend: FAILED"
    docker-compose logs frontend
    exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✨ URS Matcher Service is READY!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "🌐 Web Interface:   http://localhost:3001"
echo "📡 API:             http://localhost:3001/api"
echo "💊 Health Check:    http://localhost:3001/health"
echo ""
echo "📋 View logs:       docker-compose logs -f"
echo "🛑 Stop services:   docker-compose down"
echo "🔄 Restart:         docker-compose restart"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "✅ Ready to use! Open http://localhost:3001 in your browser."
echo ""
