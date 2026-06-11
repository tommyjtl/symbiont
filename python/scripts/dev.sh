#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is not installed."
  echo "Symbiont v0 requires Docker Desktop to build images and run sandboxes."
  echo "Install from: https://www.docker.com/products/docker-desktop/"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker is installed but not running."
  echo "Start Docker Desktop, wait until it is ready, then run this script again."
  echo "Install from: https://www.docker.com/products/docker-desktop/"
  exit 1
fi

echo "Building symbiont/bash:0.1 image..."
docker build -t symbiont/bash:0.1 docker/bash/

echo "Building symbiont/mojo:0.1 image (first build downloads ~200MB)..."
docker build -t symbiont/mojo:0.1 docker/mojo/

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q -e .

echo "Starting Symbiont backend on http://127.0.0.1:${SYMBIONT_PORT:-7341}"
exec symbiont
