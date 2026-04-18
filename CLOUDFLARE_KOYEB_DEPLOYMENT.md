# Deploy C Struct Visualizer - Cloudflare Pages + Koyeb (Free)

This guide shows you how to deploy the C Struct Visualizer with a split architecture:
- **Frontend**: Cloudflare Pages (free global CDN, automatic HTTPS)
- **Backend**: Koyeb (free tier, Docker support, auto-scaling)

This setup is completely free and requires no credit card.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Prepare Your Repository](#step-1-prepare-your-repository)
4. [Step 2: Deploy Backend to Koyeb](#step-2-deploy-backend-to-koyeb)
5. [Step 3: Deploy Frontend to Cloudflare Pages](#step-3-deploy-frontend-to-cloudflare-pages)
6. [Step 4: Configure CORS](#step-4-configure-cors)
7. [Step 5: Testing](#step-5-testing)
8. [Custom Domain Setup](#custom-domain-setup)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
                         INTERNET
                              |
           +------------------+-------------------+
           |                                      |
    +-------------+                    +------------------+
    | Cloudflare  |                    |     Koyeb        |
    | Pages       |                    |                  |
    | (Frontend)  |                    |  Trace Server    |
    | - Global CDN|                    |  (Backend)       |
    | - SSL/HTTPS |                    |  - Docker        |
    | - Static    |                    |  - Auto-scaling  |
    +-------------+                    +------------------+
           |                                      |
           |  HTTPS API calls                     |
           +-------------------------------------->
```

**Why this architecture?**
- Cloudflare Pages: Fastest static site hosting with global CDN
- Koyeb: Generous free tier for Docker containers with auto-scaling
- Both: Automatic HTTPS, no credit card required
- Total cost: $0

---

## Prerequisites

### Accounts Needed (All Free)

1. **GitHub Account**: https://github.com (for code repository)
2. **Cloudflare Account**: https://dash.cloudflare.com/sign-up (for frontend hosting)
3. **Koyeb Account**: https://app.koyeb.com (for backend hosting)

### No Credit Card Required

All three services offer free tiers without requiring credit card information.

---

## Step 1: Prepare Your Repository

### 1.1 Fork/Clone the Repository

If you haven't already:

```bash
git clone https://github.com/yourusername/c-struct-visualizer.git
cd c-struct-visualizer
```

### 1.2 Create Koyeb Configuration

Create `koyeb.yaml` in the project root:

```yaml
name: c-struct-visualizer-backend

services:
  - name: trace-server
    type: web
    git:
      repository: github.com/yourusername/c-struct-visualizer
      branch: main
    dockerfile: server/Dockerfile
    ports:
      - port: 3001
        protocol: http
    env:
      - name: PORT
        value: "3001"
      - name: NODE_ENV
        value: "production"
      - name: CORS_ORIGIN
        value: "https://your-frontend.pages.dev"
    healthcheck:
      http:
        port: 3001
        path: /health
```

**Important**: Replace `yourusername` with your actual GitHub username.

### 1.3 Update Backend CORS Configuration

Create `server/src/config.ts`:

```typescript
export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
```

Update `server/src/index.ts` to use dynamic CORS:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from './config';

const app = new Hono();

// CORS configuration
app.use('*', cors({
  origin: config.corsOrigin,
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  maxAge: 86400,
}));

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: config.nodeEnv 
  });
});

// Your other routes here...

export default app;
```

### 1.4 Update Frontend API URL

Create `src/config.ts`:

```typescript
// API URL configuration
export const API_URL = import.meta.env.VITE_TRACE_API_URL || 'http://localhost:3001';

// Validate API URL is set in production
if (import.meta.env.PROD && !import.meta.env.VITE_TRACE_API_URL) {
  console.warn('Warning: VITE_TRACE_API_URL not set in production');
}
```

Update your API calls to use this config:

```typescript
import { API_URL } from './config';

// Example API call
const response = await fetch(`${API_URL}/api/trace`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
```

### 1.5 Create Cloudflare Pages Configuration

Create `wrangler.toml`:

```toml
name = "c-struct-visualizer"
compatibility_date = "2024-01-01"

[env.production]
vars = { ENVIRONMENT = "production" }
```

Create `_headers` file for security headers:

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()
```

### 1.6 Commit Changes

```bash
git add .
git commit -m "Add Koyeb and Cloudflare deployment configuration"
git push origin main
```

---

## Step 2: Deploy Backend to Koyeb

### 2.1 Sign Up for Koyeb

1. Go to https://app.koyeb.com
2. Click "Sign up"
3. Use GitHub OAuth (recommended) or email
4. No credit card required

### 2.2 Create New App

1. In Koyeb dashboard, click **"Create App"**
2. Select **"Docker"** as deployment method
3. Choose **"GitHub"** as source
4. Authorize Koyeb to access your repositories
5. Select your `c-struct-visualizer` repository

### 2.3 Configure Service

**Build Configuration:**
- **Root directory**: `server`
- **Dockerfile**: `Dockerfile` (auto-detected)
- **Build command**: (leave empty, Dockerfile handles it)

**Environment Variables:**
Click "Advanced" → "Environment Variables" and add:

```
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://your-frontend.pages.dev  # We'll update this after Pages deployment
```

**Instance Type:**
- Select **"Free"** (nano instance)
- Region: Choose closest to your users (e.g., "Washington, D.C.")

### 2.4 Configure Health Check

1. Go to "Health Check" section
2. Enable health check
3. Set:
   - **Protocol**: HTTP
   - **Port**: 3001
   - **Path**: /health
   - **Interval**: 30s
   - **Timeout**: 5s
   - **Failure Threshold**: 3

### 2.5 Deploy

1. Click **"Deploy"**
2. Wait for build to complete (2-5 minutes)
3. Once deployed, you'll see your app URL: `https://trace-server-yourname.koyeb.app`

**Copy this URL** - you'll need it for the frontend.

### 2.6 Test Backend

```bash
curl https://trace-server-yourname.koyeb.app/health
```

Should return:
```json
{"status":"ok","timestamp":"2024-...","env":"production"}
```

---

## Step 3: Deploy Frontend to Cloudflare Pages

### 3.1 Sign Up for Cloudflare

1. Go to https://dash.cloudflare.com/sign-up
2. Create account with email
3. Verify your email
4. No credit card required for Pages

### 3.2 Create New Pages Project

1. In Cloudflare dashboard, click **"Pages"** in sidebar
2. Click **"Create a project"**
3. Click **"Connect to Git"**
4. Authorize Cloudflare to access GitHub
5. Select your `c-struct-visualizer` repository
6. Click **"Begin setup"**

### 3.3 Configure Build Settings

**Build Configuration:**
- **Project name**: `c-struct-visualizer` (or your preferred name)
- **Production branch**: `main`
- **Framework preset**: `Vite`

**Build Settings:**
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: (leave empty or set to `/`)

**Environment Variables:**

Click "Environment variables (advanced)" and add:

```
VITE_TRACE_API_URL=https://trace-server-yourname.koyeb.app
```

**Important**: Use the URL from your Koyeb deployment.

### 3.4 Deploy

1. Click **"Save and Deploy"**
2. Cloudflare will build and deploy your site
3. Wait for build to complete (1-3 minutes)
4. Your site will be live at: `https://c-struct-visualizer.pages.dev`

**Copy this URL** - you'll need it to update CORS.

### 3.5 Configure SPA Routing

Create `public/_redirects` file:

```
/* /index.html 200
```

This ensures client-side routing works correctly.

Commit and push:
```bash
git add public/_redirects
git commit -m "Add SPA routing support for Cloudflare Pages"
git push origin main
```

Cloudflare will automatically redeploy.

---

## Step 4: Configure CORS

Now that both services are deployed, you need to update the CORS configuration.

### 4.1 Update Koyeb Environment Variable

1. Go to Koyeb dashboard
2. Select your app
3. Click **"Settings"**
4. Go to **"Environment Variables"**
5. Update `CORS_ORIGIN`:
   ```
   CORS_ORIGIN=https://c-struct-visualizer.pages.dev
   ```
6. Click **"Save"**
7. Koyeb will automatically redeploy with new settings

### 4.2 Verify CORS

Test from browser console on your Cloudflare Pages site:

```javascript
fetch('https://trace-server-yourname.koyeb.app/health')
  .then(r => r.json())
  .then(data => console.log(data));
```

Should work without CORS errors.

---

## Step 5: Testing

### 5.1 Test Frontend

1. Visit your Cloudflare Pages URL: `https://c-struct-visualizer.pages.dev`
2. Verify the UI loads correctly
3. Check browser console for any errors

### 5.2 Test Backend Integration

1. In the application, try the code execution feature
2. Open browser DevTools → Network tab
3. Verify requests to `trace-server-*.koyeb.app` succeed
4. Check response codes are 200

### 5.3 Test Complete Workflow

1. Create a simple C struct:
   ```c
   typedef struct Node {
     int data;
     struct Node* next;
   } Node;
   ```
2. Add to canvas
3. Create instances
4. Verify visualization works

---

## Custom Domain Setup (Optional)

### Using Cloudflare Domain

If you have a domain in Cloudflare:

1. In Cloudflare Pages dashboard, go to your project
2. Click **"Custom domains"**
3. Click **"Set up a custom domain"**
4. Enter your domain (e.g., `structviz.example.com`)
5. Follow DNS setup instructions
6. Update Koyeb CORS_ORIGIN to match new domain

### Free Custom Domain Options

1. **Freenom** (free .tk, .ml domains)
2. **DuckDNS** (free subdomains)
3. **No-IP** (free dynamic DNS)

See [FREE_DEPLOYMENT_GUIDE.md](FREE_DEPLOYMENT_GUIDE.md) for detailed instructions.

---

## Troubleshooting

### Issue 1: Backend Deployment Fails

**Symptoms:**
- Koyeb build fails
- "Dockerfile not found" error

**Solutions:**
```bash
# Ensure Dockerfile exists in server directory
ls server/Dockerfile

# Verify it's committed to git
git add server/Dockerfile
git commit -m "Add Dockerfile"
git push origin main
```

### Issue 2: Frontend Shows Blank Page

**Symptoms:**
- Cloudflare Pages loads but shows blank screen
- Console errors about modules

**Solutions:**
1. Check build output directory is set to `dist`
2. Verify `vite.config.ts` is properly configured
3. Check that all dependencies are in `package.json`
4. Review build logs in Cloudflare dashboard

### Issue 3: CORS Errors

**Symptoms:**
- Browser console shows "CORS policy" errors
- API requests fail

**Solutions:**
1. Verify CORS_ORIGIN in Koyeb matches your exact Cloudflare URL (including https://)
2. Check no trailing slash in URL
3. Ensure Koyeb has redeployed after CORS change
4. Clear browser cache and hard refresh

### Issue 4: API_URL Not Set

**Symptoms:**
- Frontend tries to connect to localhost:3001
- "Failed to fetch" errors

**Solutions:**
1. Verify VITE_TRACE_API_URL is set in Cloudflare Pages environment variables
2. Check variable name is correct (must start with VITE_)
3. Trigger manual redeploy in Cloudflare Pages
4. Check build logs to see if env var was injected

### Issue 5: Koyeb Service Sleeping

**Symptoms:**
- First request is slow (5-10 seconds)
- "Service waking up" message

**Explanation:**
Koyeb free tier scales to zero after inactivity to save resources.

**Solutions:**
1. Use a free ping service to keep it awake:
   - https://uptimerobot.com (free plan)
   - Set up HTTP monitor to ping every 5 minutes
2. This is normal for free tier - first user will experience delay

### Issue 6: Cloudflare Pages 404 on Routes

**Symptoms:**
- Homepage works but /visualizer or other routes show 404
- Refreshing page gives 404

**Solutions:**
1. Ensure `_redirects` file exists in `public/` directory
2. Content should be: `/* /index.html 200`
3. Commit and push - Cloudflare will redeploy
4. Or use `_routes.json` for more control:
   ```json
   {
     "version": 1,
     "include": ["/*"],
     "exclude": []
   }
   ```

---

## Performance Optimization

### Cloudflare Pages Optimizations

1. **Enable Automatic Image Optimization:**
   - In Cloudflare dashboard → Speed → Optimization
   - Enable "Polish" (lossless or lossy)
   - Enable "WebP"

2. **Enable Brotli Compression:**
   - Speed → Optimization → Brotli

3. **Set Cache Headers:**
   Create `_headers` file:
   ```
   /assets/*
     Cache-Control: public, max-age=31536000, immutable
   
   /*.js
     Cache-Control: public, max-age=86400
   
   /*.css
     Cache-Control: public, max-age=86400
   ```

### Koyeb Optimizations

1. **Use Instance Type:**
   - Free tier is sufficient for light usage
   - For better performance, upgrade to Starter ($0/month + usage)

2. **Enable Edge Locations:**
   - Koyeb automatically deploys to edge locations
   - Choose region closest to your users

---

## Monitoring & Analytics

### Cloudflare Analytics (Free)

1. In Cloudflare dashboard → Pages → Your Project
2. View:
   - Total requests
   - Bandwidth usage
   - Build history
   - Real-time traffic

### Koyeb Monitoring (Free)

1. In Koyeb dashboard → Your App
2. View:
   - CPU usage
   - Memory usage
   - Request logs
   - Instance health

---

## Backup & Recovery

### GitHub Repository

Your code is already backed up in GitHub. For extra safety:

1. Enable GitHub repository backup
2. Consider backing up to multiple remotes:
   ```bash
   git remote add backup https://gitlab.com/yourusername/c-struct-visualizer.git
   git push backup main
   ```

### Environment Variables

Document your environment variables:

Create `ENVIRONMENT.md`:
```markdown
# Environment Variables

## Production

### Cloudflare Pages
- VITE_TRACE_API_URL: https://trace-server-xxxxx.koyeb.app

### Koyeb
- PORT: 3001
- NODE_ENV: production
- CORS_ORIGIN: https://c-struct-visualizer.pages.dev
```

---

## Scaling (When You Grow)

### Current Free Limits

**Cloudflare Pages:**
- 500 builds per month
- Unlimited requests
- Unlimited bandwidth

**Koyeb Free Tier:**
- 1 web service
- 1 PostgreSQL database
- Scales to zero (sleep after inactivity)
- 2 vCPU, 512 MB RAM (nano instance)

### Upgrade Path

**When you need more:**

1. **Koyeb Starter** ($0/month + usage):
   - $0.0000037/second compute
   - No sleep/inactivity timeout
   - Better performance

2. **Cloudflare Pro** ($20/month):
   - More analytics
   - Advanced security features
   - Better support

3. **Alternative: Railway** ($5 credit/month):
   - Good alternative to Koyeb
   - No sleep mode
   - Simple deployment

---

## Summary

You now have a fully functional C Struct Visualizer deployed:

✅ Frontend: Cloudflare Pages (global CDN, automatic HTTPS)
✅ Backend: Koyeb (Docker, auto-scaling, free tier)
✅ Custom domain support (optional)
✅ Monitoring and analytics (free)
✅ Automatic deployments on git push

**Your URLs:**
- Frontend: `https://c-struct-visualizer.pages.dev`
- Backend: `https://trace-server-xxxxx.koyeb.app`

**Total Monthly Cost: $0**

---

## Quick Reference

### Rebuild and Redeploy

**After code changes:**
```bash
git add .
git commit -m "Your changes"
git push origin main
```

Both Cloudflare Pages and Koyeb will automatically redeploy.

### Manual Redeploy

**Cloudflare Pages:**
1. Dashboard → Pages → Your Project
2. Click "Retry deployment" on latest build

**Koyeb:**
1. Dashboard → Your App
2. Click "Redeploy"

### View Logs

**Cloudflare Pages:**
- Dashboard → Pages → Your Project → Builds → Click build

**Koyeb:**
- Dashboard → Your App → Logs tab

---

## Support & Resources

- **Cloudflare Pages Docs**: https://developers.cloudflare.com/pages/
- **Koyeb Docs**: https://www.koyeb.com/docs
- **Vite Deployment Guide**: https://vitejs.dev/guide/static-deploy.html
- **Project Issues**: Create issue in your GitHub repository

**Happy Coding!**