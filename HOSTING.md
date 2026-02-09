# ShopEase Hosting Guide

## Add a domain name

**Domain:** `shopease-admi.me` → Droplet **24.199.101.185**

---

### Step 1: Get or use a domain

- **New domain:** Register at [DigitalOcean](https://www.digitalocean.com/products/domains), [Namecheap](https://www.namecheap.com), [Cloudflare](https://www.cloudflare.com/products/registrar/), or any registrar.
- **Existing domain:** Use the DNS panel where the domain is managed.

---

### Step 2: Point the domain to your Droplet (DNS)

In your domain’s DNS settings, add an **A record**:

| Type | Name / Host | Value / Points to   | TTL  |
|------|-------------|---------------------|------|
| A    | `@`         | `24.199.101.185`    | 3600 |

- **`@`** = root domain (`shopease-admi.me`).

Optional – also serve `www`:

| Type | Name / Host | Value / Points to   | TTL  |
|------|-------------|---------------------|------|
| A    | `www`       | `24.199.101.185`    | 3600 |

Save the DNS changes. Propagation can take 5 minutes to 48 hours (often under 15 minutes).

---

### Step 3: Update Nginx on the Droplet

1. **SSH into the Droplet:**
   ```bash
   ssh root@24.199.101.185
   ```

2. **Edit the Nginx config:**
   ```bash
   sudo nano /etc/nginx/sites-available/shopease
   ```

3. **Set `server_name` to:**
   ```nginx
   server_name shopease-admi.me www.shopease-admi.me 24.199.101.185;
   ```
   (Or copy the updated `nginx-production.conf` from the repo to the server.)

4. **Test and reload Nginx:**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

---

### Step 4: Update backend CORS (if needed)

If you use a domain instead of the IP, add it to allowed origins so the API accepts requests from the new URL.

On your **local project** (or wherever your env is managed), in `.env` or on the server’s env:

```env
ALLOWED_ORIGINS=https://shopease-admi.me,https://www.shopease-admi.me,http://24.199.101.185
```

Then restart the backend on the Droplet (e.g. if using PM2):

```bash
pm2 restart all
```

---

### Step 5: Verify

- Open `http://shopease-admi.me` in a browser.
- You should see the ShopEase admin; login should work.

**Next:** Set up SSL/HTTPS (e.g. Let’s Encrypt with Certbot) so the site is served over `https://`.
