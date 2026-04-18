# Deploying C Struct Visualizer with Dokploy - Complete Guide

This guide provides step-by-step instructions for deploying the C Struct Visualizer application using Dokploy, a self-hosted Platform-as-a-Service (PaaS) solution.

## Table of Contents

1. [Overview](#overview)
2. [Architecture Understanding](#architecture-understanding)
3. [Prerequisites](#prerequisites)
4. [Server Setup & Dokploy Installation](#server-setup--dokploy-installation)
5. [Deployment Strategy](#deployment-strategy)
6. [Step-by-Step Deployment](#step-by-step-deployment)
7. [Domain Configuration](#domain-configuration)
8. [Environment Variables Setup](#environment-variables-setup)
9. [Monitoring & Maintenance](#monitoring--maintenance)
10. [Troubleshooting](#troubleshooting)
11. [Security Considerations](#security-considerations)

---

## Overview

### What is Dokploy?

Dokploy is an open-source, self-hosted Platform-as-a-Service (PaaS) that simplifies application deployment and management. It provides:

- **Docker & Docker Compose Support**: Native integration for containerized applications
- **Automatic SSL**: Let's Encrypt integration for HTTPS certificates
- **Domain Management**: Easy custom domain setup with Traefik reverse proxy
- **Monitoring**: Real-time CPU, memory, and network usage
- **Auto-deployment**: Git webhook integration for continuous deployment
- **Database Management**: Built-in support for MySQL, PostgreSQL, MongoDB, Redis

### Why Use Dokploy for This Project?

The C Struct Visualizer consists of two components:
1. **Frontend**: React + TypeScript + Vite application
2. **Backend**: Node.js trace server with GDB for C/C++ code execution

Dokploy is ideal because:
- Native Docker Compose support for multi-service applications
- Automatic HTTPS with Let's Encrypt
- Git-based deployment with auto-deploy
- Built-in monitoring and logging
- Zero-downtime deployments

---

## Architecture Understanding

### Project Structure

```
c-struct-visualizer/
├── src/                          # Frontend React application
│   ├── components/               # React components
│   ├── engine/                   # Code execution engine
│   ├── parser/                   # C struct parser
│   ├── store/                    # Zustand state management
│   └── App.tsx                   # Main application
├── server/                       # Trace server (Node.js + Hono)
│   ├── src/
│   │   ├── index.ts             # Server entry point
│   │   ├── sandbox.ts           # Compilation & GDB execution
│   │   └── gdb-trace.py         # GDB Python script
│   ├── Dockerfile               # Multi-stage build
│   └── package.json
├── docker-compose.yml            # Current local setup
├── package.json                  # Frontend dependencies
└── vite.config.ts               # Vite configuration
```

### Current Docker Setup

**docker-compose.yml** (Local Development):
```yaml
services:
  trace-server:
    build: ./server
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
```

**server/Dockerfile**:
- Multi-stage build with Node.js 20
- Installs GCC, G++, GDB, Python3 for C/C++ execution
- Exposes port 3001

### Deployment Architecture

```
                         INTERNET
                              |
                           HTTPS
                              |
                       DOKPLOY SERVER
                     Traefik (Reverse Proxy)
                     - SSL Termination (Let's Encrypt)
                     - Domain Routing
                              |
           +------------------+-------------------+
           |                                      |
   +----------------+                 +----------------------+
   | Frontend       |                 |  Trace Server        |
   | (Static)       |                 |  (Docker)            |
   | - Nginx        |                 |  - Node.js + Hono    |
   | - Port 80/443  |                 |  - GDB + GCC/G++     |
   +----------------+                 |  - Python3           |
                                      +----------------------+
```

---

## Prerequisites

### Server Requirements

**Minimum Specifications:**
- **CPU**: 2 cores (4 cores recommended)
- **RAM**: 4GB (8GB recommended for GDB operations)
- **Storage**: 40GB SSD (20GB for system + 20GB for builds)
- **OS**: Ubuntu 20.04 LTS or higher (Ubuntu 22.04/24.04 recommended)
- **Network**: Public IP with ports 80, 443, and 3000 open

**Recommended VPS Providers:**
- Hetzner (excellent price/performance)
- DigitalOcean
- Linode
- Vultr
- AWS EC2 (t3.medium or higher)

### Domain Requirements

You'll need either:
1. **Custom Domain**: Purchase from Cloudflare, Namecheap, Porkbun, etc.
2. **Free Subdomain**: Use Dokploy's built-in `traefik.me` domains (HTTP only)

### Required Tools (Local Machine)

- SSH client (built-in on macOS/Linux, PuTTY on Windows)
- Git
- Web browser

---

## Server Setup & Dokploy Installation

### Step 1: Provision Your Server

1. **Create a VPS** with your preferred provider (Ubuntu 22.04/24.04 LTS)
2. **Note the IP address** assigned to your server
3. **Configure SSH key authentication** (recommended for security)

### Step 2: Initial Server Setup

Connect to your server via SSH:

```bash
ssh root@YOUR_SERVER_IP
```

Update the system:

```bash
# Update package lists
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git ufw

# Set up firewall (optional but recommended)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp  # Dokploy UI
sudo ufw enable
```

### Step 3: Install Dokploy

Run the automated installation script:

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

This script will:
- Install Docker and Docker Compose
- Set up Traefik reverse proxy
- Install Dokploy management UI
- Configure necessary networks

**Installation Output:**
```
[INFO] Installing Dokploy...
[INFO] Docker is already installed
[INFO] Setting up Traefik...
[INFO] Setting up Dokploy...
[INFO] Dokploy is now running on http://YOUR_SERVER_IP:3000
```

### Step 4: Access Dokploy Dashboard

1. Open your browser: `http://YOUR_SERVER_IP:3000`
2. **Create Admin Account** on first visit:
   - Username: admin
   - Email: your-email@example.com
   - Password: Create a strong password
3. **Login** with your credentials

### Step 5: Configure Dokploy Settings

1. **Navigate to Settings** (gear icon in sidebar)
2. **Server IP**: Verify your server IP is correct
3. **Domain** (optional): Set up a domain for the Dokploy panel itself
4. **Save settings**

---

## Deployment Strategy

### Option 1: Docker Compose Deployment (Recommended)

Deploy both services together using Docker Compose. This is the simplest approach and matches your current local setup.

**Pros:**
- Single deployment configuration
- Services share the same network
- Easier to manage

**Cons:**
- Both services must be redeployed together

### Option 2: Separate Application Deployments

Deploy frontend and backend as separate Dokploy applications.

**Pros:**
- Independent scaling
- Independent deployments
- Hot reload for domain changes

**Cons:**
- More complex setup
- Need to manage CORS between services

### Recommended Approach: Option 1 - Docker Compose

We'll use Docker Compose because:
- It matches your existing local development setup
- Simpler configuration
- Services can communicate internally
- Easier maintenance

---

## Step-by-Step Deployment

### Phase 1: Prepare Your Repository

#### Step 1.1: Create Dokploy-Compatible Configuration

Create a new file `docker-compose.prod.yml` in your project root:

```yaml
version: "3.8"

services:
  # Trace Server - Backend API
  trace-server:
    build:
      context: ./server
      dockerfile: Dockerfile
    restart: always
    expose:
      - "3001"
    environment:
      - PORT=3001
      - NODE_ENV=production
    networks:
      - dokploy-network
    labels:
      # Traefik labels for API routing
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`api.YOURDOMAIN.com`)"
      - "traefik.http.routers.api.entrypoints=websecure"
      - "traefik.http.routers.api.tls.certResolver=letsencrypt"
      - "traefik.http.services.api.loadbalancer.server.port=3001"
      # CORS headers
      - "traefik.http.middlewares.api-cors.headers.accesscontrolallowmethods=GET,POST,OPTIONS"
      - "traefik.http.middlewares.api-cors.headers.accesscontrolalloworiginlist=*"
      - "traefik.http.middlewares.api-cors.headers.accesscontrolallowheaders=Content-Type"
      - "traefik.http.routers.api.middlewares=api-cors"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Frontend - Static Site (Nginx)
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
      args:
        - VITE_TRACE_API_URL=https://api.YOURDOMAIN.com
    restart: always
    expose:
      - "80"
    networks:
      - dokploy-network
    depends_on:
      - trace-server
    labels:
      # Traefik labels for frontend routing
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`YOURDOMAIN.com`) || Host(`www.YOURDOMAIN.com`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certResolver=letsencrypt"
      - "traefik.http.services.frontend.loadbalancer.server.port=80"
      # Redirect www to non-www
      - "traefik.http.middlewares.www-redirect.redirectregex.regex=^https?://www\\.(.*)"
      - "traefik.http.middlewares.www-redirect.redirectregex.replacement=https://$${1}"
      - "traefik.http.middlewares.www-redirect.redirectregex.permanent=true"
      - "traefik.http.routers.frontend.middlewares=www-redirect"

networks:
  dokploy-network:
    external: true
```

**Important Notes:**
- Replace `YOURDOMAIN.com` with your actual domain
- The `dokploy-network` is created automatically by Dokploy
- Backend is NOT exposed on host ports - only through Traefik

#### Step 1.2: Create Frontend Dockerfile

Create `Dockerfile.frontend` in your project root:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build argument for API URL
ARG VITE_TRACE_API_URL
ENV VITE_TRACE_API_URL=${VITE_TRACE_API_URL}

# Build the application
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### Step 1.3: Create Nginx Configuration

Create `nginx.conf`:

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # Handle client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

#### Step 1.4: Update Backend for Production

Create `server/.dockerignore`:

```
node_modules
npm-debug.log
.git
.env
.env.local
dist
coverage
.vscode
.idea
```

Update `server/src/index.ts` to add a health check endpoint if not present:

```typescript
// Add this route to your Hono app
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

#### Step 1.5: Commit and Push Changes

```bash
# Add new files
git add docker-compose.prod.yml Dockerfile.frontend nginx.conf server/.dockerignore

# Commit
git commit -m "Add production Docker configuration for Dokploy deployment"

# Push to your repository
git push origin main
```

### Phase 2: Deploy in Dokploy

#### Step 2.1: Create a Project

1. **Login** to your Dokploy dashboard
2. Click **"Create Project"**
3. Enter project name: `c-struct-visualizer`
4. Click **"Create"**

#### Step 2.2: Create Docker Compose Service

1. Inside your project, click **"Create Service"**
2. Select **"Compose"**
3. Configure the service:
   - **Name**: `c-struct-visualizer`
   - **Type**: `Docker Compose` (not Stack)
   - **Description**: `C Struct Visualizer with Trace Server`

#### Step 2.3: Configure Git Repository

1. **Go to the "General" tab**
2. Set **Provider** to your Git provider (GitHub, GitLab, etc.)
3. Click **"Load Repositories"** and authorize Dokploy
4. Select your repository: `yourusername/c-struct-visualizer`
5. **Branch**: `main` (or your default branch)
6. **Compose Path**: `./docker-compose.prod.yml`
7. Click **"Save"**

#### Step 2.4: Configure Environment Variables

1. **Go to the "Environment" tab**
2. Add the following environment variables:

```bash
# Backend Configuration
PORT=3001
NODE_ENV=production

# CORS Settings (adjust based on your domain)
CORS_ORIGIN=https://YOURDOMAIN.com

# Optional: API Keys (generate a secure random key)
# API_KEY=your-secure-api-key-here
```

3. Click **"Save"**

#### Step 2.5: Deploy the Application

1. **Go to the "General" tab**
2. Click **"Deploy"** button
3. Watch the deployment logs in the **"Deployments"** tab

**Expected Output:**
```
[00:00:00] Building trace-server...
[00:00:15] Building frontend...
[00:00:30] Creating network...
[00:00:31] Starting services...
[00:00:35] Deployment successful
```

### Phase 3: Configure Domains

#### Step 3.1: Point Your Domain to Server

**In your DNS provider (Cloudflare, Namecheap, etc.):**

1. Create an **A record**:
   - **Name**: `@` (or your subdomain)
   - **Value**: `YOUR_SERVER_IP`
   - **TTL**: Auto or 300

2. Create another **A record** for API subdomain:
   - **Name**: `api`
   - **Value**: `YOUR_SERVER_IP`
   - **TTL**: Auto or 300

3. **Wait for DNS propagation** (can take 5 minutes to 24 hours)

#### Step 3.2: Configure Domains in Dokploy

1. **Go to the "Domains" tab** in your service
2. **For the frontend service**:
   - Click **"Add Domain"**
   - **Host**: `YOURDOMAIN.com`
   - **Path**: `/`
   - **Internal Path**: `/`
   - **Container Port**: `80`
   - **HTTPS**: Enabled
   - **Certificate**: `letsencrypt`
   - Click **"Create"**

3. **Repeat for www subdomain** (optional):
   - **Host**: `www.YOURDOMAIN.com`
   - Same settings as above

4. **For the API service**:
   - The Traefik labels in docker-compose.prod.yml already handle API routing
   - Alternatively, you can add a domain manually:
     - **Host**: `api.YOURDOMAIN.com`
     - **Container Port**: `3001`
     - **HTTPS**: Enabled

#### Step 3.3: Verify Deployment

1. Wait 1-2 minutes for Traefik to generate SSL certificates
2. Visit `https://YOURDOMAIN.com` - you should see the C Struct Visualizer
3. Visit `https://api.YOURDOMAIN.com/health` - should return `{"status":"ok"}`

---

## Environment Variables Setup

### Frontend Build-time Variables

These are passed during the Docker build:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_TRACE_API_URL` | URL of the trace server | `https://api.structviz.example.com` |

### Backend Runtime Variables

These are set in the Dokploy Environment tab:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment mode | `production` |
| `CORS_ORIGIN` | Allowed CORS origin | `https://structviz.example.com` |
| `API_KEY` | Optional API authentication | - |

---

## Monitoring & Maintenance

### Monitoring Your Application

1. **Go to the "Monitoring" tab** in your service
2. View real-time metrics:
   - CPU usage
   - Memory consumption
   - Network I/O
   - Disk usage

### Viewing Logs

1. **Go to the "Logs" tab**
2. Select the service you want to view (frontend or trace-server)
3. Logs are streamed in real-time
4. Use the search/filter functionality to find specific entries

### Setting Up Auto-Deploy

1. **Go to the "Deployments" tab**
2. Copy the webhook URL provided
3. **In your GitHub/GitLab repository**:
   - Go to Settings → Webhooks
   - Add a new webhook
   - Paste the Dokploy webhook URL
   - Select events: `Push events`
   - Save

Now every push to your main branch will automatically trigger a deployment.

### Backup Strategy

1. **Enable Volume Backups** (if using persistent data):
   - Go to **"Volume Backups"** tab
   - Configure S3 destination
   - Set backup schedule (e.g., daily at 2 AM)

2. **Database backups** (if you add a database later):
   - Use Dokploy's built-in database backup feature

---

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: Deployment Fails at Build Stage

**Symptoms:**
- Build fails with npm errors
- "Cannot find module" errors

**Solutions:**
```bash
# Check if package.json is correct
# Ensure all dependencies are in dependencies (not devDependencies) for server
# Clear npm cache in Dockerfile:
RUN npm cache clean --force
```

#### Issue 2: SSL Certificate Not Generated

**Symptoms:**
- Site accessible via HTTP but not HTTPS
- Browser shows "Your connection is not private"

**Solutions:**
1. Verify DNS A records point to server IP
2. Wait 5-10 minutes for Let's Encrypt
3. Check Traefik logs in Dokploy dashboard
4. Ensure ports 80 and 443 are open in firewall

#### Issue 3: Frontend Can't Connect to Backend

**Symptoms:**
- Frontend loads but code execution doesn't work
- Browser console shows CORS errors

**Solutions:**
1. Verify `VITE_TRACE_API_URL` is set correctly in Dockerfile.frontend
2. Check CORS settings in trace server
3. Ensure both services are on same network
4. Check that API domain is accessible:
   ```bash
   curl https://api.YOURDOMAIN.com/health
   ```

#### Issue 4: GDB/Code Execution Not Working

**Symptoms:**
- Code execution times out
- "Compilation failed" errors

**Solutions:**
1. Check trace-server logs for GDB errors
2. Ensure server has enough RAM (GDB needs memory)
3. Verify GCC/G++ are installed in Dockerfile
4. Check if code has compilation errors

#### Issue 5: 404 Errors on Page Refresh

**Symptoms:**
- Navigation works but refresh gives 404
- Direct links don't work

**Solutions:**
- Ensure nginx.conf has the SPA fallback:
  ```nginx
  location / {
      try_files $uri $uri/ /index.html;
  }
  ```

### Getting Help

1. **Dokploy Documentation**: https://docs.dokploy.com
2. **Dokploy Discord**: https://discord.gg/2tBnJ3jDJc
3. **GitHub Issues**: https://github.com/dokploy/dokploy/issues
4. **Project Issues**: Create an issue in your project repository

---

## Security Considerations

### Production Checklist

- [ ] **Use strong passwords** for Dokploy admin account
- [ ] **Enable 2FA** in Dokploy settings
- [ ] **Use HTTPS only** (redirect HTTP to HTTPS)
- [ ] **Set up firewall rules** (UFW)
- [ ] **Regular backups** enabled
- [ ] **Keep Dokploy updated** (check for updates monthly)
- [ ] **Monitor logs** for suspicious activity
- [ ] **Use API keys** for backend authentication (optional)

### Security Headers

The provided nginx.conf includes basic security headers:
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Referrer-Policy

### Rate Limiting

Consider adding rate limiting to your trace server to prevent abuse:

```typescript
// In server/src/index.ts
import { rateLimiter } from 'hono-rate-limiter';

app.use('/api/trace', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));
```

---

## Advanced Configuration

### Using Docker Stack (Swarm Mode)

If you need horizontal scaling:

1. Change service type from "Docker Compose" to "Stack"
2. Update docker-compose.prod.yml:

```yaml
services:
  trace-server:
    deploy:
      replicas: 2
      labels:
        - "traefik.enable=true"
        # ... other labels
    # Remove build section, use pre-built image
    image: your-registry/trace-server:latest
```

### Adding a Database (Future Enhancement)

If you later want to add user accounts or save workspaces:

```yaml
# Add to docker-compose.prod.yml
services:
  database:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: structviz
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: structviz
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - dokploy-network

volumes:
  postgres_data:
```

---

## Cost Estimation

### Server Costs (Monthly)

| Provider | Specs | Estimated Cost |
|----------|-------|----------------|
| Hetzner | 4 vCPU, 8GB RAM | 7.50 EUR (~8.50 USD) |
| DigitalOcean | 2 vCPU, 4GB RAM | 24 USD |
| Linode | 2 vCPU, 4GB RAM | 24 USD |
| Vultr | 2 vCPU, 4GB RAM | 20 USD |
| AWS EC2 | t3.medium | ~30 USD |

### Domain Costs (Yearly)

| Provider | .com Domain | Privacy Protection |
|----------|-------------|-------------------|
| Cloudflare | 9.18 USD | Free |
| Namecheap | 10-15 USD | Free |
| Porkbun | 10-12 USD | Free |

### Total Estimated Monthly Cost

- **Server**: 8-30 USD/month
- **Domain**: 1 USD/month (amortized)
- **Total**: 9-31 USD/month

---

## Conclusion

You now have a complete production deployment of the C Struct Visualizer using Dokploy. Your application includes:

- Automated SSL certificates
- Reverse proxy with Traefik
- Docker containerization
- Git-based auto-deployment
- Monitoring and logging
- Production-ready configuration

### Next Steps

1. **Test the application** thoroughly in production
2. **Set up monitoring alerts** in Dokploy
3. **Configure automated backups**
4. **Share your deployment** with users

### Useful Resources

- **Dokploy Docs**: https://docs.dokploy.com
- **Traefik Docs**: https://doc.traefik.io/traefik/
- **Docker Compose Reference**: https://docs.docker.com/compose/compose-file/
- **Let's Encrypt**: https://letsencrypt.org/docs/

---

**Happy Deploying**

If you encounter issues or have questions, refer to the troubleshooting section or reach out to the Dokploy community on Discord.