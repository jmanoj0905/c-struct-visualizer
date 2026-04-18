# Deploy C Struct Visualizer for Free - No Credit Card Required

This guide shows you how to deploy the C Struct Visualizer application completely for free without needing a credit card. We cover free domain options, free hosting services, and step-by-step deployment instructions.

## Table of Contents

1. [Free Domain Options](#free-domain-options)
2. [Free Hosting Options](#free-hosting-options)
3. [Method 1: Using DuckDNS (Recommended)](#method-1-using-duckdns-recommended)
4. [Method 2: Using Dokploy with Free Traefik Domains](#method-2-using-dokploy-with-free-traefik-domains)
5. [Method 3: Using Oracle Cloud Free Tier](#method-3-using-oracle-cloud-free-tier)
6. [Method 4: Using Railway (Free Tier)](#method-4-using-railway-free-tier)
7. [Quick Comparison](#quick-comparison)
8. [Troubleshooting](#troubleshooting)

---

## Free Domain Options

### 1. DuckDNS (Recommended)
- **URL**: https://www.duckdns.org
- **Cost**: 100% Free, forever
- **Features**:
  - Create subdomains like `yourname.duckdns.org`
  - Up to 5 subdomains per account
  - Supports Let's Encrypt SSL
  - Dynamic DNS updates via API
  - No credit card required
- **Best For**: Self-hosted applications, home servers, VPS deployments

### 2. No-IP Free Dynamic DNS
- **URL**: https://www.noip.com
- **Cost**: Free (requires monthly confirmation)
- **Features**:
  - 1 free hostname (e.g., `yourname.ddns.net`)
  - Multiple domain options (.ddns.net, .hopto.org, .zapto.org)
  - Dynamic DNS client available
  - SSL certificate support
- **Best For**: Dynamic IP addresses, home networks

### 3. FreeDNS (afraid.org)
- **URL**: https://freedns.afraid.org
- **Cost**: 100% Free
- **Features**:
  - 5 free subdomains from shared domains
  - Choose from 26,000+ shared domains
  - Static and Dynamic DNS support
  - No expiration
- **Best For**: Variety of domain name options

### 4. Dokploy's Built-in Traefik.me (Easiest)
- **Cost**: Completely free, built into Dokploy
- **Features**:
  - Automatic subdomain generation
  - Works instantly
  - HTTP only (no HTTPS for free domains)
  - No DNS configuration needed
- **Best For**: Quick testing, temporary deployments

---

## Free Hosting Options

### 1. Oracle Cloud Free Tier (Best for VPS)
- **URL**: https://www.oracle.com/cloud/free
- **Specs**: 2 AMD-based Compute VMs with 1/8 OCPU and 1 GB RAM each
- **Always Free**: Yes, forever
- **Credit Card**: Required for verification but won't be charged
- **Best For**: Production-like Dokploy deployment

### 2. Google Cloud Free Tier
- **URL**: https://cloud.google.com/free
- **Specs**: 1 f1-micro instance (shared vCPU, 0.6 GB RAM)
- **Free Period**: Always free with monthly usage limits
- **Credit Card**: Required for verification
- **Best For**: Small applications, learning

### 3. AWS Free Tier
- **URL**: https://aws.amazon.com/free
- **Specs**: 750 hours/month of t2.micro or t3.micro
- **Free Period**: 12 months
- **Credit Card**: Required
- **Best For**: Learning AWS, temporary projects

### 4. Railway (No Credit Card)
- **URL**: https://railway.app
- **Specs**: $5 free credit per month (approximately 500 hours)
- **Credit Card**: Not required for free tier
- **Best For**: Containerized apps, quick deployments
- **Note**: Sleep after inactivity on free tier

### 5. Render (No Credit Card)
- **URL**: https://render.com
- **Specs**: Free web services with limitations
- **Credit Card**: Not required
- **Best For**: Static sites, web services
- **Note**: Services sleep after 15 minutes of inactivity

### 6. Fly.io
- **URL**: https://fly.io
- **Specs**: 3 shared-cpu-1x 256mb VMs (free allowance)
- **Credit Card**: Required
- **Best For**: Global edge deployment

### 7. Hetzner Cloud (Trial)
- **URL**: https://www.hetzner.com/cloud
- **Specs**: 20 EUR credit for 60 days
- **Credit Card**: Required
- **Best For**: Testing before paying

---

## Method 1: Using DuckDNS (Recommended)

This is the best completely free method with no credit card required anywhere.

### Step 1: Create a DuckDNS Account

1. Go to https://www.duckdns.org
2. Sign in with one of the following:
   - Google Account
   - Twitter Account
   - GitHub Account
   - Reddit Account (currently unavailable)
   - Persona Account

### Step 2: Create Your Subdomain

1. After login, you'll see the dashboard
2. In the "Domains" section, enter your desired subdomain name
3. Click "add domain"
4. Your domain will be: `yourname.duckdns.org`
5. Current IP will be auto-detected

### Step 3: Get Your Token

1. Your token is displayed at the top of the page
2. It looks like: `a7c4d9e2-3f5b-4a1c-8d6e-9f2a5b8c1d3e`
3. Save this token - you'll need it for updates

### Step 4: Set Up Dynamic DNS (Optional but Recommended)

If your IP changes, set up automatic updates:

**Option A: Using curl (Linux/Mac)**
```bash
# Add to crontab to run every 5 minutes
crontab -e

# Add this line:
*/5 * * * * curl -k "https://www.duckdns.org/update?domains=yourname&token=your-token&ip="
```

**Option B: Using Docker**
```bash
docker run -d \
  --name=duckdns \
  -e SUBDOMAINS=yourname \
  -e TOKEN=your-token \
  -e UPDATE_IP=ipv4 \
  --restart unless-stopped \
  lscr.io/linuxserver/duckdns:latest
```

### Step 5: Get a Free VPS (Oracle Cloud Free Tier)

Oracle Cloud offers truly free VPS with no credit card charges:

1. Go to https://www.oracle.com/cloud/free
2. Click "Start for free"
3. Create an account (credit card required for verification only)
4. You'll get:
   - 2 AMD-based Compute VMs (1/8 OCPU, 1 GB RAM each)
   - 200 GB block storage
   - Always free, never expires

**Create a VM:**
1. Log into Oracle Cloud Console
2. Go to Compute → Instances
3. Click "Create Instance"
4. Choose "VM.Standard.E2.1.Micro" (Always Free)
5. Select Ubuntu 22.04 image
6. Add your SSH key
7. Create

### Step 6: Configure Your Server

SSH into your server:
```bash
ssh ubuntu@YOUR_SERVER_IP
```

Update and install prerequisites:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git ufw

# Configure firewall
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
sudo ufw enable
```

### Step 7: Install Dokploy

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

Access Dokploy at: `http://YOUR_SERVER_IP:3000`

### Step 8: Deploy Your Application

Follow the [main deployment guide](DOKPLOY_DEPLOYMENT_GUIDE.md) but use your DuckDNS domain:

**In docker-compose.prod.yml:**
```yaml
labels:
  - "traefik.http.routers.frontend.rule=Host(`yourname.duckdns.org`)"
  - "traefik.http.routers.api.rule=Host(`api-yourname.duckdns.org`)"
```

### Step 9: Configure DNS

**In DuckDNS Dashboard:**
1. Set your domain IP to your Oracle Cloud server IP
2. Create a second subdomain for API: `api-yourname`
3. Set both to the same IP

### Step 10: SSL with Let's Encrypt

Dokploy automatically handles Let's Encrypt SSL for DuckDNS domains. Just enable HTTPS in the domain settings.

---

## Method 2: Using Dokploy with Free Traefik Domains

This is the fastest method for testing - no domain registration needed.

### Step 1: Get Any Free VPS or Use Your Own Server

Use any of the free VPS options listed above, or use an existing server.

### Step 2: Install Dokploy

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

### Step 3: Access Dokploy and Generate Free Domain

1. Go to `http://YOUR_SERVER_IP:3000`
2. Create your admin account
3. Create a new project
4. Create a Compose service
5. In the "Domains" tab, click "Generate Domain"
6. Dokploy will create: `random-name.traefik.me`

### Step 4: Deploy Your Application

Use the auto-generated domain in your configuration:

**docker-compose.prod.yml:**
```yaml
services:
  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`your-app.traefik.me`)"
      - "traefik.http.routers.frontend.entrypoints=web"
      - "traefik.http.services.frontend.loadbalancer.server.port=80"
  
  trace-server:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`your-api.traefik.me`)"
      - "traefik.http.routers.api.entrypoints=web"
      - "traefik.http.services.api.loadbalancer.server.port=3001"

networks:
  dokploy-network:
    external: true
```

### Important Notes:

- **HTTP Only**: traefik.me domains don't support HTTPS
- **Not for Production**: Use this for testing only
- **Random Names**: Domain names are auto-generated

---

## Method 3: Using Oracle Cloud Free Tier

Oracle Cloud offers the most generous free tier with no expiration.

### What You Get (Always Free):
- 2 AMD-based Compute VMs (1/8 OCPU, 1 GB RAM each)
- 4 Arm-based Ampere A1 cores and 24 GB RAM (configurable)
- 200 GB block storage
- 10 TB outbound data transfer
- 2 VNICs with public IPs

### Sign Up Steps:

1. Go to https://www.oracle.com/cloud/free
2. Click "Start for free"
3. Enter your details
4. **Credit Card**: Required for identity verification only - you won't be charged
5. Complete phone verification
6. Your account will be ready in a few minutes

### Create Your Free Server:

1. Log into Oracle Cloud Console
2. Navigate to: Compute → Instances
3. Click "Create Instance"
4. Configure:
   - Name: `dokploy-server`
   - Shape: VM.Standard.E2.1.Micro (Always Free-eligible)
   - Image: Ubuntu 22.04
   - VCN: Create new VCN
   - Subnet: Public subnet
   - Add SSH keys: Generate new or upload your own
5. Click "Create"

### Configure Security Rules:

1. Go to: Networking → Virtual Cloud Networks
2. Click your VCN
3. Go to: Security Lists → Default Security List
4. Add Ingress Rules:
   - TCP port 22 (SSH) - Source: 0.0.0.0/0
   - TCP port 80 (HTTP) - Source: 0.0.0.0/0
   - TCP port 443 (HTTPS) - Source: 0.0.0.0/0
   - TCP port 3000 (Dokploy) - Source: 0.0.0.0/0

### Deploy with DuckDNS:

Follow Method 1 steps using your Oracle Cloud VM.

---

## Method 4: Using Railway (Free Tier)

Railway offers $5 free credit monthly with no credit card required.

### Step 1: Create Railway Account

1. Go to https://railway.app
2. Sign up with GitHub
3. No credit card required for free tier

### Step 2: Deploy Frontend (Static Site)

1. In Railway dashboard, click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your C Struct Visualizer repository
4. Railway will auto-detect it's a Vite/React app
5. Add environment variable:
   - Name: `VITE_TRACE_API_URL`
   - Value: Your backend URL (we'll update this after deploying backend)
6. Deploy

### Step 3: Deploy Backend (Trace Server)

1. Create another project
2. Deploy from the same repo
3. Set root directory to: `/server`
4. Add environment variables:
   - `PORT=3001`
   - `NODE_ENV=production`
5. Deploy

### Step 4: Update CORS and Frontend URL

1. Get your backend URL from Railway (e.g., `https://trace-server.up.railway.app`)
2. Update frontend environment variable with this URL
3. Redeploy frontend
4. Add CORS settings to backend to allow your frontend domain

### Limitations:

- Free tier services sleep after inactivity (15-30 minutes)
- Cold start on first request
- $5/month credit limit
- Best for demo/personal use, not production

---

## Quick Comparison

| Method | Cost | Credit Card | SSL | Best For |
|--------|------|-------------|-----|----------|
| DuckDNS + Oracle Cloud | Free | Verification only | Yes | Production deployment |
| Dokploy traefik.me | Free | No | No | Quick testing |
| Railway | $5/mo credit | No | Yes | Simple container deployment |
| Render | Free tier | No | Yes | Static sites, light usage |
| Fly.io | Free allowance | Yes | Yes | Global edge deployment |

---

## Troubleshooting

### Issue 1: DuckDNS Domain Not Working

**Check:**
1. Is the IP address in DuckDNS dashboard correct?
2. Are ports 80/443 open on your server firewall?
3. Can you access via IP address directly?

**Fix:**
```bash
# Test your domain
curl -I http://yourname.duckdns.org

# Check if IP is correct
dig yourname.duckdns.org

# Update DuckDNS manually
curl "https://www.duckdns.org/update?domains=yourname&token=YOUR_TOKEN&ip=YOUR_IP"
```

### Issue 2: Let's Encrypt SSL Fails

**Check:**
1. Domain DNS is propagated (wait 5-10 minutes)
2. Port 80 is accessible from internet
3. Domain points to correct server IP

**Fix:**
```bash
# Test Let's Encrypt challenge
curl http://yourname.duckdns.org/.well-known/acme-challenge/test

# Check Traefik logs in Dokploy
# Go to: Monitoring → Traefik → Logs
```

### Issue 3: Oracle Cloud Instance Not Accessible

**Check:**
1. Instance is running
2. Public IP is assigned
3. Security list allows ports 80/443

**Fix:**
1. Go to: Compute → Instances
2. Check Instance Access → Public IP Address
3. Go to: Networking → Virtual Cloud Networks → Security Lists
4. Ensure ingress rules allow your ports

### Issue 4: Railway Service Sleeping

**Symptom:** First request is slow, subsequent requests are fast

**Fix:** Use a ping service to keep it awake:
- https://uptimerobot.com (free plan)
- Set up monitor to ping your service every 5 minutes

### Issue 5: Free Tier Limitations

**Oracle Cloud:**
- If you exceed always free limits, upgrade or resources stop
- Monitor usage in Billing → Cost Analysis

**Railway:**
- $5 credit resets monthly
- If exceeded, deployment stops until next month

---

## Additional Free Resources

### Free SSL Certificates
- **Let's Encrypt**: Free SSL for any domain
- **ZeroSSL**: Free 90-day certificates
- **SSL For Free**: Free Let's Encrypt wrapper

### Free Monitoring
- **UptimeRobot**: 50 monitors, 5-minute intervals (free)
- **Freshping**: 50 monitors, 1-minute intervals (free)
- **StatusCake**: 10 monitors (free)

### Free Backups
- **Oracle Cloud**: Manual snapshots (free)
- **AWS S3**: 5 GB free for 12 months
- **Google Cloud Storage**: 5 GB free
- **Backblaze B2**: 10 GB free

---

## Conclusion

You have multiple completely free options to deploy your C Struct Visualizer:

**Best Overall: DuckDNS + Oracle Cloud Free Tier**
- Truly free forever
- Full VPS control
- SSL support
- No sleep/idle issues

**Quickest: Dokploy with traefik.me**
- Instant setup
- No domain registration
- Perfect for testing

**Simplest: Railway**
- No server management
- Git-based deployment
- Good for demos

Choose based on your needs and get your application online today without spending a penny or sharing credit card details (except for Oracle verification).

---

## Useful Links

- DuckDNS: https://www.duckdns.org
- No-IP: https://www.no-ip.com
- FreeDNS: https://freedns.afraid.org
- Oracle Cloud Free: https://www.oracle.com/cloud/free
- Railway: https://railway.app
- Render: https://render.com
- Dokploy: https://dokploy.com
- Let's Encrypt: https://letsencrypt.org

**Happy Free Hosting**