# Fix Nginx Routing - Production Server Setup

## Quick Summary
Your Nginx is only serving the frontend and doesn't route `/api` to the backend. This guide will fix it in **5 minutes**.

---

## Step 1: SSH into Your Production Server

```bash
ssh root@24.199.101.185
# Or your username if not root:
ssh your-username@24.199.101.185
```

---

## Step 2: Verify Backend is Running

First, check if backend is running on port 4000:

```bash
curl http://localhost:4000/health
```

**Expected response:**
```json
{"status":"ok","timestamp":"...","uptime":...}
```

**If no response:**
- Backend is NOT running
- Need to start it first (see "Start Backend" section below)

---

## Step 3: Update Nginx Configuration

### Option A: Download from GitHub (Recommended)

```bash
cd /etc/nginx/sites-available/

# Backup current config
sudo cp shopease shopease.backup

# Download new config from your repo
sudo curl -o shopease https://raw.githubusercontent.com/MangChhunleang/ShopEase_E_Commerce/main/nginx-production.conf

# Update server_name if using a domain
# sudo nano shopease
# Find: server_name 24.199.101.185;
# Change to: server_name yourdomain.com www.yourdomain.com;
```

### Option B: Manual Edit

```bash
sudo nano /etc/nginx/sites-available/shopease
```

**Replace the entire content with this:**

```nginx
server {
    listen 80;
    server_name 24.199.101.185;
    
    client_max_body_size 50M;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # BACKEND API ROUTES
    # IMPORTANT: use ^~ so the regex static-assets block below
    # does NOT intercept URLs like /uploads/*.jpg.
    location ^~ /api/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_cache_bypass $http_upgrade;
    }

    # FILE UPLOADS
    # Uploaded images are served by the backend (Express static).
    # Use ^~ so the "static assets" regex block below won't steal .jpg/.png
    # requests and 404 them from /usr/share/nginx/html.
    location ^~ /uploads/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # FRONTEND STATIC ASSETS
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /usr/share/nginx/html;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # FRONTEND ROUTES (React Router)
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
}
```

Press `Ctrl+X`, then `Y`, then `Enter` to save.

---

## Step 4: Test Nginx Configuration

```bash
sudo nginx -t
```

**Expected output:**
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration will be successful
```

If you get an error, check the config for typos and try again.

---

## Step 5: Restart Nginx

```bash
sudo systemctl restart nginx
```

---

## Step 6: Test the Fix

### Test Backend API

```bash
curl http://24.199.101.185/api/health
# or
curl http://24.199.101.185/health
```

**Expected response:**
```json
{"status":"ok","timestamp":"...","uptime":...}
```

### Test Frontend

Open in browser: `http://24.199.101.185`

Should see the admin dashboard (not HTML error page).

---

## Bonus: Start Backend (if not running)

If backend is not running, start it on your server:

```bash
cd /var/www/ShopEase_E_Commerce/backend

# Install dependencies (first time only)
npm install --production

# Start backend
npm start

# Or use PM2 for auto-restart
npm install -g pm2
pm2 start server.js --name shopease-backend
pm2 startup
pm2 save
```

---

## Troubleshooting

### "502 Bad Gateway" Error
- Backend is not running on port 4000
- **Fix:** Start backend with `npm start` or PM2

### "Connection refused"
- Nginx can't connect to localhost:4000
- **Fix:** Check firewall isn't blocking local connections

### Mobile app still can't connect
- Frontend and backend are working
- Issue is mobile app configuration
- **Fix:** Update mobile app's API URL to `http://24.199.101.185`

### Want to use HTTPS?

```bash
sudo apt install certbot python3-certbot-nginx

# Get free certificate (requires domain name)
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is automatic
```

---

## Quick Checklist

- [ ] Backend running on port 4000
- [ ] Nginx config updated
- [ ] `sudo nginx -t` passes
- [ ] `sudo systemctl restart nginx` succeeds
- [ ] `curl http://24.199.101.185/api/health` returns JSON
- [ ] Browser shows dashboard at `http://24.199.101.185`

**That's it! Everything should work now.** ✅
