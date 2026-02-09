# APPLY NGINX FIX ON YOUR PRODUCTION SERVER

## Quick Summary

I've created a script that will automatically fix your Nginx routing. Just run one command and everything gets fixed!

---

## Option 1: Automatic Fix (RECOMMENDED - 2 minutes)

### Step 1: Download and Run the Fix Script

SSH into your server:
```bash
ssh root@24.199.101.185
```

Then run this one-liner to download and execute the fix:

```bash
curl -fsSL https://raw.githubusercontent.com/MangChhunleang/ShopEase_E_Commerce/main/fix-nginx.sh | bash
```

Or if that doesn't work, do it manually:

```bash
# Download the script
wget https://raw.githubusercontent.com/MangChhunleang/ShopEase_E_Commerce/main/fix-nginx.sh

# Make it executable
chmod +x fix-nginx.sh

# Run it
sudo bash fix-nginx.sh
```

**What the script does automatically:**
- ✅ Checks Nginx is installed
- ✅ Checks backend is running
- ✅ Backs up your current config
- ✅ Installs the new config
- ✅ Tests the configuration
- ✅ Restarts Nginx
- ✅ Verifies everything works

---

## Option 2: Manual Fix (If script doesn't work)

### Step 1: SSH Into Server

```bash
ssh root@24.199.101.185
```

### Step 2: Create New Nginx Config

```bash
sudo nano /etc/nginx/sites-available/shopease
```

**Delete everything and paste this:**

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

    location /api/ {
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

    location /uploads/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /usr/share/nginx/html;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
}
```

**Save and exit:** Press `Ctrl+X`, then `Y`, then `Enter`

### Step 3: Test Configuration

```bash
sudo nginx -t
```

**You should see:**
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration will be successful
```

### Step 4: Restart Nginx

```bash
sudo systemctl restart nginx
```

### Step 5: Verify It Works

```bash
# Test backend API
curl http://localhost/api/health

# Should see something like:
# {"status":"ok","timestamp":"...","uptime":...}
```

---

## Testing

After the fix is applied, test these URLs:

### Backend API (should return JSON)
```bash
curl http://24.199.101.185/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-02-05T11:30:00.000Z","uptime":12345}
```

### Frontend (should show admin dashboard in browser)
Open: `http://24.199.101.185`

### File Uploads (should proxy to backend)
```bash
curl http://24.199.101.185/uploads/
```

---

## If Something Goes Wrong

### Issue: "502 Bad Gateway"
**Cause:** Backend is not running  
**Fix:** Start backend
```bash
cd /var/www/ShopEase_E_Commerce/backend
npm start
# Or with PM2
pm2 start server.js --name shopease-backend
```

### Issue: "Connection refused"
**Cause:** Nginx can't reach localhost:4000  
**Fix:** Check firewall and backend status
```bash
# Verify backend is running
ps aux | grep node

# Check if port 4000 is open
lsof -i :4000
```

### Issue: Still getting "Cannot POST /auth/firebase-login"
**Cause:** Nginx is routing to wrong place  
**Fix:** Check Nginx config is correct
```bash
# Check current config
sudo cat /etc/nginx/sites-enabled/shopease

# Verify it has: proxy_pass http://localhost:4000;
```

### Restore Backup (if needed)
```bash
# List backups
ls /etc/nginx/sites-available/shopease.backup.*

# Restore
sudo cp /etc/nginx/sites-available/shopease.backup.TIMESTAMP /etc/nginx/sites-available/shopease
sudo systemctl restart nginx
```

---

## Success Checklist

After applying the fix:

- [ ] Script ran successfully (or manual steps completed)
- [ ] `sudo nginx -t` says "syntax is ok"
- [ ] `sudo systemctl restart nginx` succeeds
- [ ] `curl http://24.199.101.185/api/health` returns JSON
- [ ] `http://24.199.101.185` shows admin dashboard (not error)
- [ ] Mobile app/web app can successfully call `/api/auth/firebase-login`

**If all ✅ then you're done!**

---

## Need Help?

If you get stuck:
1. Check the error message carefully
2. Try the troubleshooting section above
3. Share the error output - I can help debug

**You've got this!** 🚀
