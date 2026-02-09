# How Your ShopEase Admin Is Hosted

## Your setup

| What        | Where |
|------------|--------|
| **Server** | DigitalOcean Droplet `24.199.101.185` |
| **Domain** | `shopease-admi.me` (and `www.shopease-admi.me`) |
| **Code on server** | `/root/ShopEase_E_Commerce` (backend + frontend source) |
| **Nginx** | Serves the **frontend** from `/usr/share/nginx/html` |
| **Backend API** | Nginx proxies `/api/` to Node.js on port 4000 |

So the **admin site** (login, dashboard, orders, etc.) is the **frontend** built from `frontend/` and served by Nginx from `/usr/share/nginx/html`.

---

## "I deployed but still see the same errors"

The browser is almost certainly still loading the **old** JS bundle (e.g. `index-re453muT.js`). Fix it like this:

1. **On the server** – Build and deploy in one go, then confirm the new file name:
   ```bash
   cd /var/www/ShopEase_E_Commerce && git pull origin main
   cd frontend && npm run build
   grep -o 'index-[^"]*\.js' dist/index.html
   sudo cp -r dist/* /usr/share/nginx/html/
   grep -o 'index-[^"]*\.js' /usr/share/nginx/html/index.html
   sudo nginx -t && sudo systemctl reload nginx
   ```
   The two `grep` lines should show the **same** filename (e.g. `index-CgxN79ET.js`). If the second grep still shows `index-re453muT.js`, the copy didn’t work or Nginx root is wrong.

2. **In the browser** – Force load the new bundle:
   - Open the site in an **Incognito/Private** window, or  
   - Open DevTools (F12) → **Network** tab → check **Disable cache** → refresh (Ctrl+Shift+R).

3. **Check what’s actually loaded** – In DevTools → Network, refresh and look at the main `.js` file. If it’s still `index-re453muT.js`, the server is still serving the old build; fix the deploy path and copy step above.

---

## How to deploy the frontend (so the “recent orders” fix goes live)

You need to **build the frontend** and **put the built files** into `/usr/share/nginx/html` on the server.

### Option A: Deploy from your PC (recommended)

1. **On your PC** (in this project), build the frontend:
   ```bash
   cd frontend
   npm run build
   ```
2. **Upload the built files** to the server. From your PC (PowerShell), run:
   ```powershell
   scp -r frontend\dist\* root@24.199.101.185:/usr/share/nginx/html/
   ```
   (Use the password or SSH key you use for the Droplet.)

3. In the browser, do a **hard refresh**: **Ctrl+Shift+R** on the admin site.

After this, the server will serve the new bundle (e.g. `index-B2ctCQAi.js`) and the “recent orders” error should stop.

### Option B: Build on the server

1. **SSH into the server:**
   ```bash
   ssh root@24.199.101.185
   ```
2. **Go to the project and pull latest code:**
   ```bash
   cd /root/ShopEase_E_Commerce
   git pull origin main
   ```
3. **Build the frontend:**
   ```bash
   cd frontend
   npm install
   npm run build
   ```
4. **Copy the new build into Nginx’s folder:**
   ```bash
   sudo cp -r dist/* /usr/share/nginx/html/
   ```
5. **Reload Nginx** (required after replacing files so the new bundle is served; Nginx can otherwise serve cached paths):
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```
   **Deployment trap:** Your Nginx config `root` must point to the same folder you deploy to (e.g. `/usr/share/nginx/html`). If you deploy to a different path than the config’s `root`, the new JS will not be used.

6. In the browser, **hard refresh**: **Ctrl+Shift+R**. Confirm the page loads the **new** JS filename (DevTools → Network: main script should no longer be `index-re453muT.js`).

---

## If you get 403 Forbidden on `/assets/` (JS/CSS)

After uploading with `scp`, files are owned by `root` and Nginx may not be allowed to read them. **SSH into the server** and run:

```bash
ssh root@24.199.101.185
```

Then fix ownership and permissions (use the user your Nginx runs as—often `nginx` or `www-data`):

```bash
# Make Nginx the owner of everything in the html folder
chown -R nginx:nginx /usr/share/nginx/html

# If the command above says "unknown user nginx", try:
# chown -R www-data:www-data /usr/share/nginx/html

# Ensure directories are readable/executable, files are readable
chmod -R 755 /usr/share/nginx/html
chmod 644 /usr/share/nginx/html/*.html /usr/share/nginx/html/*.ico /usr/share/nginx/html/*.svg 2>/dev/null || true
chmod 644 /usr/share/nginx/html/assets/* 2>/dev/null || true
```

Reload Nginx and test:

```bash
sudo systemctl reload nginx
```

Then hard refresh the site (Ctrl+Shift+R).

---

## How to confirm you’re on the new deploy

- Before: errors referred to **`index-re453muT.js`**.
- After a correct deploy: the page should load **`index-B2ctCQAi.js`** (or another new hash).
- In Chrome: **F12 → Network → refresh** and check the name of the main `.js` file; it should no longer be `index-re453muT.js`.

---

## If you see errors in the console (Dashboard, Products, Orders, Categories, Banners)

Those pages call the backend API. If the backend does not allow your admin domain, the browser can block requests (CORS) or you get 404s. On the **server**:

1. **Set CORS** – Edit the backend `.env` (e.g. `/root/ShopEase_E_Commerce/.env`) and set:
   ```
   ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://shopease-admi.me,https://shopease-admi.me,http://www.shopease-admi.me,https://www.shopease-admi.me,http://24.199.101.185
   ```
   Add your real domain or IP if different.

2. **Restart the Node backend** so it picks up the new env (e.g. `pm2 restart all` or restart however you run the backend).

3. **Redeploy backend code** if you pulled changes that add `/api` routes, then restart the backend.

Then do a **hard refresh** (Ctrl+Shift+R) on the admin site.

**If you get 404 on `products` or `categories` (XHR in Network tab):**  
Those requests are `/api/admin/products` and `/api/admin/categories`. A 404 usually means the **backend** on the server doesn’t have those routes (old code) or isn’t receiving the request. On the server:

1. **Update backend code** and restart:
   ```bash
   cd /var/www/ShopEase_E_Commerce   # or /root/ShopEase_E_Commerce
   git pull origin main
   # Restart Node (e.g. if you use PM2:)
   pm2 restart all
   ```
2. **Confirm Nginx proxies `/api/` to Node:**  
   In your Nginx config you should have something like `location /api/ { proxy_pass http://localhost:4000; ... }`. If `/api/` is not proxied, those URLs will 404.
3. **Confirm the backend is running** on port 4000:  
   `curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/admin/products` (with no auth you may get 401; 404 means the route isn’t registered).

---

## Summary

- You’re **not** using Vercel/Netlify for the admin; you’re on a **DigitalOcean Droplet** with Nginx.
- Deploy = **build frontend** (`npm run build` in `frontend/`) then **copy `frontend/dist/*` to `/usr/share/nginx/html/`** on the server (Option A from PC, or Option B on the server).
- For Dashboard/Products/Orders/Categories/Banners to work, the server **must** have `ALLOWED_ORIGINS` in backend `.env` including your admin domain, and the backend restarted after changing it.
