#!/bin/bash

set -euo pipefail

APP_PATH="${APP_PATH:-$(cd "$(dirname "$0")/.." && pwd)}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-}"
REMOTE_NAME="${REMOTE_NAME:-origin}"

source_optional() {
  local file_path="$1"
  local label="$2"

  if [ -s "$file_path" ]; then
    set +e
    set +u
    . "$file_path"
    local source_status=$?
    set -e
    set -u

    if [ "$source_status" -ne 0 ]; then
      echo "Warning: ${label} returned status ${source_status}, continuing."
    fi
  fi
}

detect_runtime_user() {
  if [ -n "${PM2_RUN_AS:-}" ]; then
    echo "$PM2_RUN_AS"
    return 0
  fi

  if command -v stat >/dev/null 2>&1; then
    local owner
    owner="$(stat -c '%U' "$APP_PATH" 2>/dev/null || true)"
    if [ -n "$owner" ] && [ "$owner" != "UNKNOWN" ] && [ "$owner" != "root" ]; then
      echo "$owner"
      return 0
    fi
  fi

  if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
    echo "$SUDO_USER"
    return 0
  fi

  whoami
}

run_as_runtime_user() {
  local runtime_user="$1"
  shift

  if [ "$(whoami)" = "$runtime_user" ]; then
    "$@"
    return $?
  fi

  sudo -H -u "$runtime_user" "$@"
}

get_runtime_home() {
  local runtime_user="$1"
  local runtime_home

  runtime_home="$(getent passwd "$runtime_user" | cut -d: -f6)"
  if [ -z "$runtime_home" ]; then
    runtime_home="$HOME"
  fi

  echo "$runtime_home"
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
source_optional "$NVM_DIR/nvm.sh" "nvm.sh"
source_optional "$HOME/.profile" ".profile"
source_optional "$HOME/.bashrc" ".bashrc"
source_optional "$HOME/.bash_profile" ".bash_profile"
ensure_node_tools

cd "$APP_PATH"
RUNTIME_USER="$(detect_runtime_user)"
RUNTIME_HOME="$(get_runtime_home "$RUNTIME_USER")"

git fetch "$REMOTE_NAME" "$DEPLOY_BRANCH"

REMOTE_REF="${REMOTE_NAME}/${DEPLOY_BRANCH}"
RELEASE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/axel-ssr-release.XXXXXX")"
cleanup() {
  rm -rf "$RELEASE_DIR"
}
trap cleanup EXIT

git archive "$REMOTE_REF" | tar -x -C "$RELEASE_DIR"

echo "Using node: $(command -v node || echo 'not found')"
echo "Using npm: $(command -v npm || echo 'not found')"

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

cd "$RELEASE_DIR"
npm ci
NITRO_PRESET=node_server npm run build

if [ ! -f ".output/server/index.mjs" ]; then
  echo "Missing .output/server/index.mjs after build"
  exit 1
fi

if [ ! -d ".output/public" ]; then
  echo "Missing .output/public after build"
  exit 1
fi

cd "$APP_PATH"

if command -v rsync >/dev/null 2>&1; then
  rsync -a \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude 'logs' \
    --exclude '.env' \
    --exclude '.env.*' \
    "$RELEASE_DIR"/ "$APP_PATH"/
else
  echo "rsync is required on the VPS for SSR deploys."
  exit 1
fi

mkdir -p logs

run_as_runtime_user "$RUNTIME_USER" env NVM_DIR="$RUNTIME_HOME/.nvm" PATH="$PATH" pm2 startOrReload ecosystem.config.cjs --only axel-command-center-ssr
run_as_runtime_user "$RUNTIME_USER" env NVM_DIR="$RUNTIME_HOME/.nvm" PATH="$PATH" pm2 save

if [ -f "scripts/restart-ssr.sh" ]; then
  chmod +x scripts/restart-ssr.sh
fi

if [ -f "scripts/health-check-services.sh" ]; then
  chmod +x scripts/health-check-services.sh
  PUBLIC_BASE_URL="$PUBLIC_BASE_URL" ./scripts/health-check-services.sh
fi

sudo nginx -t
sudo systemctl reload nginx

echo "SSR deploy completed successfully."
