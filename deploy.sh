#!/bin/bash

# VirtuClass Backend Deployment Script

echo "🚀 Starting VirtuClass Backend Deployment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t virtuclass-backend .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed!"
    exit 1
fi

# Stop and remove existing container (if any)
echo "🛑 Stopping existing container..."
docker stop virtuclass-backend-container 2>/dev/null || true
docker rm virtuclass-backend-container 2>/dev/null || true

# Run the new container
echo "🌟 Starting new container..."
docker run -d \
  --name virtuclass-backend-container \
  --restart unless-stopped \
  -p 5000:5000 \
  --env-file .env \
  virtuclass-backend

if [ $? -eq 0 ]; then
    echo "✅ VirtuClass Backend deployed successfully!"
    echo "🌐 Backend is running on http://localhost:5000"
    echo "📊 Health check: http://localhost:5000/api/health"
    
    # Show container logs
    echo "📋 Container logs (last 20 lines):"
    sleep 3
    docker logs --tail 20 virtuclass-backend-container
else
    echo "❌ Deployment failed!"
    exit 1
fi
