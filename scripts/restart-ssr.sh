#!/bin/bash

set -euo pipefail

APP_PATH="${APP_PATH:-$(cd "$(dirname "$0")/.." && pwd)}"
RUNTIME_USER="${PM2_RUN_AS:-$(whoami)}"

source_optional() {
  local file_path="$1"

  if [ -s "$file_path" ]; then
    set +e
    set +u
    . "$file_path"
    set -e
    set -u
  fi
}

ensure_node_tools() {
  export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin:$PATH"

  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    return 0
  fi

  if command -v nvm >/dev/null 2>&1; then
    set +e
    nvm use default >/dev/null 2>&1
    if [ $? -ne 0 ]; then
      nvm use node >/dev/null 2>&1
    fi
    set -e
  fi

  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    return 0
  fi

  for candidate in "$NVM_DIR"/versions/node/*/bin; do
    if [ -d "$candidate" ]; then
      export PATH="$candidate:$PATH"
    fi
  done

  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    return 0
  fi

  echo "Node.js and npm could not be found on the server PATH."
  echo "Checked PATH: $PATH"
  exit 127
}

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
source_optional "$NVM_DIR/nvm.sh"
source_optional "$HOME/.profile"
source_optional "$HOME/.bashrc"
source_optional "$HOME/.bash_profile"
ensure_node_tools

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

cd "$APP_PATH"
mkdir -p logs

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3009}"
export SUPABASE_URL="${SUPABASE_URL:-}"
export SUPABASE_PUBLISHABLE_KEY="${SUPABASE_PUBLISHABLE_KEY:-}"
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-$SUPABASE_URL}"
export VITE_SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-$SUPABASE_PUBLISHABLE_KEY}"
export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
export OPENAI_API_KEY="${OPENAI_API_KEY:-}"

if [ "$(whoami)" = "$RUNTIME_USER" ]; then
  pm2 startOrReload ecosystem.config.cjs --only axel-command-center-ssr --update-env
  pm2 save
else
  sudo -H -u "$RUNTIME_USER" env \
    NODE_ENV="$NODE_ENV" \
    PORT="$PORT" \
    SUPABASE_URL="$SUPABASE_URL" \
    SUPABASE_PUBLISHABLE_KEY="$SUPABASE_PUBLISHABLE_KEY" \
    VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
    VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
    SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
    OPENAI_API_KEY="$OPENAI_API_KEY" \
    pm2 startOrReload ecosystem.config.cjs --only axel-command-center-ssr --update-env
  sudo -H -u "$RUNTIME_USER" pm2 save
fi
