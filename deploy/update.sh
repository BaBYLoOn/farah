#!/usr/bin/env bash
#
# Rebuild the site and redeploy it. Run as root:
#   sudo bash /home/hal/coding/farah-nuxt/deploy/update.sh
#
set -e
PROJ="/home/hal/coding/farah-nuxt"

echo "==> building (as hal)…"
sudo -u hal bash -lc "cd $PROJ && node node_modules/nuxt/bin/nuxt.mjs build"

echo "==> restarting service…"
systemctl restart farah
sleep 1
systemctl --no-pager --lines=0 status farah | head -3
echo "✓ deployed"
