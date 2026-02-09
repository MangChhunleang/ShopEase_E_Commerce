#!/bin/bash

# Deployment script for Firebase endpoint to production

SERVER_IP="24.199.101.185"
SERVER_PATH="/root/ShopEase_E_Commerce"

echo "========== Deploying Firebase Endpoint =========="
echo "Server: $SERVER_IP"
echo "Path: $SERVER_PATH"
echo ""

# SSH and execute deployment commands
ssh root@$SERVER_IP << 'EOF'
echo "[1/5] Current directory:"
pwd

echo "[2/5] Pulling latest code from GitHub..."
cd /root/ShopEase_E_Commerce
git pull origin main

echo "[3/5] Stopping old Node.js backend process..."
pkill -f "node server.js" || echo "No process found"
sleep 2

echo "[4/5] Starting new backend with Firebase endpoint..."
cd /root/ShopEase_E_Commerce/backend
npm start > /tmp/backend.log 2>&1 &
sleep 3

echo "[5/5] Verifying backend started..."
if ps aux | grep -q "[n]ode server.js"; then
    echo "✓ Backend process started successfully!"
    echo ""
    echo "Firebase endpoint should now be available at:"
    echo "  POST http://24.199.101.185:4000/api/auth/firebase-login"
    echo ""
    echo "Recent backend logs:"
    tail -20 /tmp/backend.log
else
    echo "✗ Backend process failed to start"
    echo "Error logs:"
    tail -30 /tmp/backend.log
    exit 1
fi
EOF

echo ""
echo "========== Deployment Complete =========="
