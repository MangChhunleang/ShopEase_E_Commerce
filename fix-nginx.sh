#!/bin/bash
# ShopEase Nginx Fix Script - Run on production server
# This script automatically fixes your Nginx routing configuration
# 
# Usage: bash fix-nginx.sh
# 
# Prerequisites:
# - You must be logged in as root or have sudo access
# - Nginx must be installed

set -e  # Exit on error

echo "=========================================="
echo "ShopEase Nginx Routing Fix"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root"
   echo "   Try: sudo bash fix-nginx.sh"
   exit 1
fi

echo "✅ Running with sudo access"
echo ""

# Step 1: Check if Nginx is installed
echo "🔍 Checking Nginx installation..."
if ! command -v nginx &> /dev/null; then
    echo "❌ Nginx is not installed"
    echo "   Install with: apt install -y nginx"
    exit 1
fi
echo "✅ Nginx is installed"
echo ""

# Step 2: Check if backend is running
echo "🔍 Checking if backend is running on port 4000..."
if curl -s http://localhost:4000/health > /dev/null 2>&1; then
    echo "✅ Backend is running on port 4000"
else
    echo "⚠️  Backend is NOT running on port 4000"
    echo "   You need to start it before continuing:"
    echo "   cd /var/www/ShopEase_E_Commerce/backend && npm start"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 1
    fi
fi
echo ""

# Step 3: Backup current Nginx config
echo "💾 Backing up current Nginx configuration..."
if [ -f /etc/nginx/sites-available/shopease ]; then
    BACKUP_FILE="/etc/nginx/sites-available/shopease.backup.$(date +%s)"
    cp /etc/nginx/sites-available/shopease "$BACKUP_FILE"
    echo "✅ Backed up to: $BACKUP_FILE"
else
    echo "ℹ️  No existing config to backup"
fi
echo ""

# Step 4: Create new Nginx config
echo "📝 Creating new Nginx configuration..."
cat > /tmp/shopease-nginx.conf << 'EOF'
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
    # does NOT intercept URLs like /uploads/*.jpg or /api/*.json.
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
EOF

cp /tmp/shopease-nginx.conf /etc/nginx/sites-available/shopease
echo "✅ New configuration created"
echo ""

# Step 5: Enable the site if not already enabled
echo "🔗 Checking if site is enabled..."
if [ ! -L /etc/nginx/sites-enabled/shopease ]; then
    ln -s /etc/nginx/sites-available/shopease /etc/nginx/sites-enabled/shopease
    echo "✅ Site enabled"
else
    echo "✅ Site already enabled"
fi
echo ""

# Step 6: Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
if nginx -t; then
    echo "✅ Configuration syntax is valid"
else
    echo "❌ Configuration has syntax errors"
    echo "   Restore backup and try again:"
    echo "   cp $BACKUP_FILE /etc/nginx/sites-available/shopease"
    exit 1
fi
echo ""

# Step 7: Restart Nginx
echo "🔄 Restarting Nginx..."
systemctl restart nginx
if [ $? -eq 0 ]; then
    echo "✅ Nginx restarted successfully"
else
    echo "❌ Failed to restart Nginx"
    exit 1
fi
echo ""

# Step 8: Verify the fix
echo "✅ Verifying the fix..."
sleep 2

echo ""
echo "Testing /api/health endpoint..."
if curl -s http://localhost/api/health | grep -q "status"; then
    echo "✅ Backend API is accessible at /api/"
else
    echo "⚠️  Could not reach /api/health"
    echo "   Make sure backend is running on port 4000"
fi

echo ""
echo "=========================================="
echo "✅ Nginx routing fix completed!"
echo "=========================================="
echo ""
echo "Test your setup:"
echo "  - API:      curl http://24.199.101.185/api/health"
echo "  - Frontend: http://24.199.101.185 (in browser)"
echo "  - Uploads:  curl http://24.199.101.185/uploads/"
echo ""
echo "Backup location: $BACKUP_FILE (if created)"
echo ""
