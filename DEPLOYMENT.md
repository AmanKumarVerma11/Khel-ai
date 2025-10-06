# Free Hosting Deployment Guide

## Quick Setup (Recommended)

### 1. Frontend - Vercel (Free)
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Sign up with GitHub
4. Click "New Project" → Import your repository
5. Set root directory to `frontend`
6. Add environment variables:
   - `NEXT_PUBLIC_API_URL`: `https://your-backend-app.railway.app`
   - `NEXT_PUBLIC_SOCKET_URL`: `https://your-backend-app.railway.app`
7. Deploy!

### 2. Backend - Railway (Free $5/month credit)
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Set root directory to `backend`
6. Add environment variables:
   - `NODE_ENV`: `production`
   - `PORT`: `5000`
   - `MONGODB_URI`: `your-mongodb-connection-string`
7. Deploy!

### 3. Database - Already Set Up ✅
Your MongoDB Atlas is already configured and ready to use.

## Alternative Free Options

### Option 1: Render (All-in-One)
**Frontend:**
- Connect GitHub repo
- Build command: `cd frontend && npm run build`
- Publish directory: `frontend/out`

**Backend:**
- Connect GitHub repo
- Build command: `cd backend && npm install`
- Start command: `cd backend && npm start`

### Option 2: Netlify + Railway
**Frontend (Netlify):**
- Drag & drop `frontend/out` folder after running `npm run build`
- Or connect GitHub for auto-deploy

**Backend (Railway):**
- Same as above Railway setup

### Option 3: GitHub Pages + Heroku
**Frontend (GitHub Pages):**
- Only works with static export
- Add `output: 'export'` to `next.config.js`

**Backend (Heroku):**
- Create `Procfile`: `web: cd backend && npm start`
- Push to Heroku Git

## Environment Variables Setup

### Frontend (.env.production)
```
NEXT_PUBLIC_API_URL=https://your-backend-url
NEXT_PUBLIC_SOCKET_URL=https://your-backend-url
```

### Backend (.env or Railway variables)
```
NODE_ENV=production
PORT=5000
MONGODB_URI=your-mongodb-connection-string
```

## Post-Deployment Steps

1. **Update CORS Origins**: Replace `your-app-name.vercel.app` in `backend/app.js` with your actual Vercel URL

2. **Test the Application**:
   - Visit your frontend URL
   - Try manual score entry
   - Run the simulation
   - Check real-time updates

3. **Custom Domain (Optional)**:
   - Vercel: Add custom domain in project settings
   - Railway: Add custom domain in service settings

## Cost Breakdown (All Free!)

| Service | Free Tier | Limits |
|---------|-----------|--------|
| Vercel | ✅ Free | 100GB bandwidth/month |
| Railway | ✅ $5 credit/month | Usually enough for small apps |
| MongoDB Atlas | ✅ Free | 512MB storage |
| **Total Cost** | **$0/month** | Perfect for demos/portfolio |

## Troubleshooting

### Common Issues:
1. **CORS Errors**: Update allowed origins in `backend/app.js`
2. **Environment Variables**: Make sure all env vars are set correctly
3. **Build Failures**: Check Node.js version compatibility
4. **Socket.io Issues**: Ensure WebSocket support is enabled

### Railway Specific:
- If app sleeps, first request might be slow
- Check logs in Railway dashboard
- Ensure `PORT` environment variable is set

### Vercel Specific:
- Build errors: Check Next.js version compatibility
- API routes won't work (use Railway for backend)
- Static export needed for some hosting options

## Performance Tips

1. **Enable Compression**: Railway automatically handles this
2. **CDN**: Vercel provides global CDN automatically
3. **Database Indexing**: Already configured in your MongoDB setup
4. **Caching**: Add Redis if needed (Railway has free Redis addon)

## Monitoring (Free Options)

1. **Vercel Analytics**: Built-in performance monitoring
2. **Railway Metrics**: CPU, memory, and network usage
3. **MongoDB Atlas Monitoring**: Database performance metrics
4. **UptimeRobot**: Free uptime monitoring (50 monitors)

## Scaling (When You Outgrow Free Tier)

1. **Railway Pro**: $5/month for more resources
2. **Vercel Pro**: $20/month for team features
3. **MongoDB Atlas**: Paid tiers for more storage
4. **Consider**: DigitalOcean App Platform, AWS Free Tier

Your app is now ready for free hosting! The total setup time should be under 30 minutes.