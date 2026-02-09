#!/bin/bash
# Deploy frontend to DigitalOcean Droplet (Nginx serves from /usr/share/nginx/html)
# Run from project root. Requires: npm, ssh access to 24.199.101.185

set -e
SERVER_IP="24.199.101.185"
SERVER_USER="root"
NGINX_ROOT="/usr/share/nginx/html"

echo "========== Building frontend =========="
cd "$(dirname "$0")/frontend"
npm run build

echo ""
echo "========== Uploading to server =========="
echo "Target: ${SERVER_USER}@${SERVER_IP}:${NGINX_ROOT}/"
scp -r dist/* "${SERVER_USER}@${SERVER_IP}:${NGINX_ROOT}/"

echo ""
echo "========== Frontend deploy done =========="
echo "Do a hard refresh (Ctrl+Shift+R) on https://shopease-admi.me to see the update."
