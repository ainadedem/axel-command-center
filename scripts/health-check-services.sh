#!/bin/bash

set -euo pipefail

PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-}"
LOCAL_PORT="${PORT:-3009}"

if [ -n "$PUBLIC_BASE_URL" ]; then
  HEALTH_URL="${PUBLIC_BASE_URL%/}/api/health/supabase"
else
  HEALTH_URL="http://localhost:${LOCAL_PORT}/api/health/supabase"
fi

echo "Running health check on ${HEALTH_URL}"
curl --fail --silent --show-error "$HEALTH_URL" >/dev/null
echo "Health check passed."
