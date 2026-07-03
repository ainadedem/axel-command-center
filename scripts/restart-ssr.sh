#!/bin/bash

set -euo pipefail

APP_PATH="${APP_PATH:-$(cd "$(dirname "$0")/.." && pwd)}"
RUNTIME_USER="${PM2_RUN_AS:-$(whoami)}"

cd "$APP_PATH"
mkdir -p logs

if [ "$(whoami)" = "$RUNTIME_USER" ]; then
  pm2 startOrReload ecosystem.config.cjs --only axel-command-center-ssr
  pm2 save
else
  sudo -H -u "$RUNTIME_USER" pm2 startOrReload ecosystem.config.cjs --only axel-command-center-ssr
  sudo -H -u "$RUNTIME_USER" pm2 save
fi
