@echo off
REM VirtuClass Backend Deployment Script for Windows

echo 🚀 Starting VirtuClass Backend Deployment...

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker and try again.
    exit /b 1
)

REM Build the Docker image
echo 📦 Building Docker image...
docker build -t virtuclass-backend .

if %errorlevel% neq 0 (
    echo ❌ Docker build failed!
    exit /b 1
)

REM Stop and remove existing container (if any)
echo 🛑 Stopping existing container...
docker stop virtuclass-backend-container 2>nul
docker rm virtuclass-backend-container 2>nul

REM Run the new container
echo 🌟 Starting new container...
docker run -d --name virtuclass-backend-container --restart unless-stopped -p 5000:5000 --env-file .env virtuclass-backend

if %errorlevel% equ 0 (
    echo ✅ VirtuClass Backend deployed successfully!
    echo 🌐 Backend is running on http://localhost:5000
    echo 📊 Health check: http://localhost:5000/api/health
    
    REM Show container logs
    echo 📋 Container logs (last 20 lines):
    timeout /t 3 /nobreak >nul
    docker logs --tail 20 virtuclass-backend-container
) else (
    echo ❌ Deployment failed!
    exit /b 1
)
