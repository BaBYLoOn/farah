# Deploying Farah behind a Cloudflare domain (nginx + DNS)

Server: Ubuntu 26.04 at `157.173.123.91`. App runs on `127.0.0.1:3000`,
nginx terminates TLS on 443 and proxies to it, Cloudflare proxies the domain.

Replace `YOUR_DOMAIN` below with your real domain.

## A. On the server (sudo)

```bash
# 1. Install Node 22 system-wide
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v            # expect v22.x

# 2. Install the app as a systemd service (keeps it running + restarts on boot)
sudo cp /home/hal/coding/farah-nuxt/deploy/farah.service /etc/systemd/system/farah.service
sudo systemctl daemon-reload
sudo systemctl enable --now farah
systemctl status farah --no-pager        # should be active (running)
curl -sI http://127.0.0.1:3000 | head -1 # expect HTTP/1.1 200

# 3. Install nginx
sudo apt-get install -y nginx

# 4. Cloudflare Origin Certificate (create it in the dashboard — section B2)
sudo mkdir -p /etc/ssl/cloudflare
sudo tee /etc/ssl/cloudflare/farah.pem >/dev/null   # paste the CERTIFICATE, then Ctrl-D
sudo tee /etc/ssl/cloudflare/farah.key >/dev/null   # paste the PRIVATE KEY, then Ctrl-D
sudo chmod 600 /etc/ssl/cloudflare/farah.key

# 5. Install the nginx site (swap in your domain)
sudo cp /home/hal/coding/farah-nuxt/deploy/nginx-farah.conf /etc/nginx/sites-available/farah
sudo sed -i 's/YOUR_DOMAIN/YOUR_DOMAIN/g' /etc/nginx/sites-available/farah
sudo ln -sf /etc/nginx/sites-available/farah /etc/nginx/sites-enabled/farah
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# 6. Firewall (also open 80 + 443 in your VPS provider's firewall/security group)
sudo ufw allow 'Nginx Full' 2>/dev/null || true
```

## B. In the Cloudflare dashboard

1. **DNS** → add records → Proxy status **Proxied** (orange cloud):
   - `A  @    157.173.123.91`
   - `A  www  157.173.123.91`  (or a CNAME `www` → your root domain)
2. **SSL/TLS → Origin Server → Create Certificate** → keep defaults →
   copy the **Origin Certificate** into `farah.pem` and the **Private Key** into
   `farah.key` (step A4).
3. **SSL/TLS → Overview** → set encryption mode to **Full (strict)**.

## C. Verify

```bash
curl -sI https://YOUR_DOMAIN | head -5    # HTTP/2 200 via Cloudflare
```
Open `https://YOUR_DOMAIN` and `https://YOUR_DOMAIN/admin`. Login now works over
HTTPS (the session cookie is Secure in production automatically).

## Updating the site later

```bash
cd /home/hal/coding/farah-nuxt
npm run build
sudo systemctl restart farah
```

## Notes
- Persistent data lives in `.data/farah.db` and `public/uploads/` — the service
  runs from the project dir, so both are preserved across restarts/rebuilds.
- The old `nuxt dev` server (port 3000, 0.0.0.0) must be stopped before the
  service starts — they'd clash on the port.
