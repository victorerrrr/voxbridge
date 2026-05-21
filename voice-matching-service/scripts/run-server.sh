#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export HTTP_PROXY=""
export HTTPS_PROXY=""
export ALL_PROXY=""
export http_proxy=""
export https_proxy=""
export all_proxy=""
unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy NO_PROXY no_proxy 2>/dev/null || true

if [[ -x "./.venv/bin/python" ]]; then
  PYTHON="./.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON="python3"
else
  echo "Python not found. Run scripts/install-deps.sh first." >&2
  exit 1
fi

echo "Starting uvicorn on http://0.0.0.0:8000 (proxies cleared)..."
exec "$PYTHON" -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
