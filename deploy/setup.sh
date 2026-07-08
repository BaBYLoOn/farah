#!/usr/bin/env bash
#
# One-shot production setup for the Farah site.
# Run as root:  sudo bash /home/hal/coding/farah-nuxt/deploy/setup.sh
#
set -euo pipefail

DOMAIN="farahali.org"
PROJ="/home/hal/coding/farah-nuxt"

echo "==> 1/6  Node 22"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> 2/6  systemd service"
cp "$PROJ/deploy/farah.service" /etc/systemd/system/farah.service
systemctl daemon-reload
systemctl enable farah

echo "==> 3/6  nginx + openssl"
apt-get install -y nginx openssl

echo "==> 4/6  origin TLS cert (self-signed; use Cloudflare SSL mode = Full)"
mkdir -p /etc/ssl/cloudflare
if [ ! -f /etc/ssl/cloudflare/farah.pem ]; then
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/ssl/cloudflare/farah.key \
    -out    /etc/ssl/cloudflare/farah.pem \
    -subj "/CN=${DOMAIN}"
  chmod 600 /etc/ssl/cloudflare/farah.key
fi

echo "==> 5/6  nginx site"
cp "$PROJ/deploy/nginx-farah.conf" /etc/nginx/sites-available/farah
ln -sf /etc/nginx/sites-available/farah /etc/nginx/sites-enabled/farah
rm -f /etc/nginx/sites-enabled/default
nginx -t

echo "==> 6/6  start everything (stop dev server first so :3000 is free)"
pkill -f "nuxt.mjs dev" 2>/dev/null || true
sleep 1
systemctl restart farah
systemctl reload nginx || systemctl restart nginx

# firewall (best-effort; also open 80/443 in your VPS provider's firewall)
if command -v ufw >/dev/null 2>&1; then
  ufw allow 'Nginx Full' 2>/dev/null || ufw allow 80,443/tcp 2>/dev/null || true
fi

echo ""
echo "======================================================================"
echo " Server is set up. App: 127.0.0.1:3000 (systemd 'farah'), nginx :80/:443"
systemctl --no-pager --lines=0 status farah | head -3 || true
echo ""
echo " NOW in Cloudflare (dashboard):"
echo "   1. DNS  -> A  @    157.173.123.91   (Proxied / orange cloud)"
echo "             A  www  157.173.123.91   (Proxied / orange cloud)"
echo "   2. SSL/TLS -> Overview -> encryption mode: Full"
echo ""
echo " Then open:  https://${DOMAIN}"
echo "======================================================================"
