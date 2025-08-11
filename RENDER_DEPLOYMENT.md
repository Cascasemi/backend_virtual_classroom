# Deploying VirtuClass Backend to Render

## Step 1: Prepare Your Repository
Make sure your backend code is pushed to GitHub with all the Docker files we created.

## Step 2: Create a New Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select your repository and branch (usually `main`)

## Step 3: Configure the Service

### Basic Settings:
- **Name**: `virtuclass-backend` (or your preferred name)
- **Region**: Choose the region closest to your users
- **Branch**: `main`
- **Runtime**: `Docker`

### Build & Deploy Settings:
- **Docker Context Directory**: `/backend` (if backend is in a subfolder)
- **Dockerfile Path**: `./Dockerfile`

### OR if you prefer Node.js runtime instead of Docker:
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

## Step 4: Environment Variables
Add these in the Render dashboard under "Environment":

```
NODE_ENV=production
MONGODB_URI=your_mongodb_connection_string_here
JWT_SECRET=your_super_secure_jwt_secret
JWT_REFRESH_SECRET=your_super_secure_refresh_secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
EMAIL_FROM=your_email@gmail.com
APP_URL=https://virtuclass-dash.vercel.app
CORS_ORIGINS=https://virtuclass-dash.vercel.app,http://localhost:5173,http://localhost:3000
```

## Step 5: Deploy
1. Click "Create Web Service"
2. Render will automatically build and deploy your backend
3. You'll get a URL like: `https://your-service-name.onrender.com`

## Step 6: Update Frontend Configuration
Once deployed, update your frontend's API base URL to point to your Render backend URL.

## Step 7: Update CORS Settings
After deployment, add your Render backend URL to the CORS_ORIGINS:
```
CORS_ORIGINS=https://virtuclass-dash.vercel.app,https://your-backend.onrender.com,http://localhost:5173
```

## Health Check
Your backend includes a health check endpoint at `/api/health` that Render can use to monitor service health.

## Auto-Deploy
Render will automatically redeploy when you push changes to your connected branch.

## Troubleshooting
- Check the deployment logs in Render dashboard
- Ensure all environment variables are set correctly
- Verify your MongoDB connection string is accessible from Render
- Check that your CORS origins include your frontend domain
