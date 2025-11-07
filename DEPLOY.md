# 🚀 Deployment Guide - Render

## Prerequisites

- GitHub account with repository access
- Render account (https://render.com)

## Automatic Deployment (Blueprint)

1. **Connect GitHub Repository**
   - Go to https://dashboard.render.com
   - Click "New Blueprint Instance"
   - Connect your GitHub repository `alpro1000/Monolit-Planner`
   - Render will automatically detect `render.yaml`

2. **Configure Services**
   - **Backend (monolit-planner-api)**
     - Type: Web Service
     - Environment: Node
     - Build Command: `cd backend && npm install && cd ../shared && npm install`
     - Start Command: `cd backend && npm start`
     - Port: 3001

   - **Frontend (monolit-planner-frontend)**
     - Type: Static Site
     - Build Command: `cd shared && npm install && cd ../frontend && npm install && npm run build`
     - Publish Directory: `frontend/dist`

3. **Environment Variables**
   - Backend automatically gets `CORS_ORIGIN` from frontend URL
   - Frontend automatically gets `VITE_API_URL` from backend URL

4. **Deploy**
   - Click "Create New Resources"
   - Wait for build to complete (~5-10 minutes)
   - Your app will be live at:
     - Frontend: `https://monolit-planner-frontend.onrender.com`
     - Backend API: `https://monolit-planner-api.onrender.com`

## Manual Deployment

### Backend

```bash
# On Render Dashboard
1. New Web Service
2. Connect Repository
3. Name: monolit-planner-api
4. Build Command: bash backend/render-build.sh
5. Start Command: cd backend && npm start
6. Environment Variables:
   - NODE_ENV=production
   - PORT=3001
   - CORS_ORIGIN=<your-frontend-url>
```

### Frontend

```bash
# On Render Dashboard
1. New Static Site
2. Connect Repository
3. Name: monolit-planner-frontend
4. Build Command: bash frontend/render-build.sh
5. Publish Directory: frontend/dist
6. Environment Variables:
   - VITE_API_URL=<your-backend-url>
```

## Post-Deployment

1. **Test the Application**
   - Visit your frontend URL
   - Upload a test XLSX file
   - Verify calculations are correct

2. **Set Custom Domain (Optional)**
   - In Render dashboard → Settings → Custom Domain
   - Add your domain (e.g., `planner.monolit-planner.cz`)

3. **Monitor**
   - Check logs in Render dashboard
   - Set up alerts for errors

## Troubleshooting

### Build Fails

- Check that all dependencies in `package.json` are correct
- Verify shared package can be built
- Check build logs for errors

### Database Issues

- Render's free tier has ephemeral storage
- Database will reset on each deploy
- For persistent data, upgrade to paid plan or use external database

### CORS Errors

- Verify `CORS_ORIGIN` in backend matches frontend URL
- Check that frontend sends requests to correct backend URL

## Cost Estimate

- **Free Plan**: Both services can run on free tier
- **Paid Plan**: ~$7/month per service for persistent storage

## CI/CD

Auto-deploy is enabled by default:
- Push to `main` branch → Auto-deploys both services
- Environment-specific branches can be configured

## Monitoring

- Render provides built-in metrics
- Logs are available in dashboard
- Set up email alerts for downtime
