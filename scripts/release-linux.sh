#!/usr/bin/env bash
# Linux-only release: builds the .deb packages (x64 + arm64), writes their
# SHA-256 files and uploads all of it to the download server.
#
# Usage:  scripts/release-linux.sh [--no-upload]
#   --no-upload   build + checksums only (no server settings needed)
#
# Server settings come from the environment or from scripts/release.env
# (git-ignored; copy scripts/release.env.example and fill it in).
set -euo pipefail

cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
[[ -f scripts/release.env ]] && source scripts/release.env

UPLOAD=1
[[ "${1:-}" == "--no-upload" ]] && UPLOAD=0

VERSION=$(node -p "require('./package.json').version")
echo "==> Release version: ${VERSION}"

echo "==> [1/3] Building Linux packages (x64 + arm64)..."
npm run dist:x64
npm run dist:arm64

FILES=()
for arch in amd64 arm64; do
  deb="dist/openfatoai_${VERSION}_${arch}.deb"
  [[ -f "$deb" ]] || { echo "ERROR: expected $deb not found"; exit 1; }
  FILES+=("$deb")
done

echo "==> [2/3] Writing SHA-256 files..."
for deb in "${FILES[@]}"; do
  # `sha256sum` output uses the bare file name so users can run `sha256sum -c` next to the download
  (cd dist && sha256sum "$(basename "$deb")" > "$(basename "$deb").sha256")
  FILES+=("${deb}.sha256")
  cat "${deb}.sha256"
done

if [[ "$UPLOAD" -eq 0 ]]; then
  echo "==> --no-upload: done. Files are in dist/."
  exit 0
fi

VPS="${RELEASE_VPS:?Set RELEASE_VPS (user@host) in the environment or scripts/release.env}"
VPS_KEY="${RELEASE_VPS_KEY:?Set RELEASE_VPS_KEY (path to the SSH key) in the environment or scripts/release.env}"
VPS_DIR="${RELEASE_VPS_DIR:?Set RELEASE_VPS_DIR (remote downloads directory) in the environment or scripts/release.env}"

echo "==> [3/3] Uploading ${#FILES[@]} files..."
scp -i "$VPS_KEY" "${FILES[@]}" "${VPS}:${VPS_DIR}/"
ssh -i "$VPS_KEY" "$VPS" "ls -lh '${VPS_DIR}'"
echo "==> Done. Remember to update the download links on the website if the version changed."
