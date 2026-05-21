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
export NO_PROXY="*"

if [[ -x "./.venv/bin/python" ]]; then
  PYTHON="./.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  if [[ ! -d ./.venv ]]; then python3 -m venv .venv; fi
  PYTHON="./.venv/bin/python"
else
  echo "Python not found" >&2
  exit 1
fi

unset_pip() { "$PYTHON" -m pip config unset "$1" 2>/dev/null || true; }
unset_pip global.proxy
unset_pip user.proxy
unset_pip global.http-proxy
unset_pip global.https-proxy
unset_pip user.http-proxy
unset_pip user.https-proxy

echo "Installing SOCKS support..."
if ! "$PYTHON" -m pip install "requests[socks]" --no-cache-dir; then
  echo "requests[socks] failed; trying PySocks..."
  "$PYTHON" -m pip install PySocks --no-cache-dir
fi

echo "Installing requirements.txt..."
"$PYTHON" -m pip install -r requirements.txt --no-cache-dir

