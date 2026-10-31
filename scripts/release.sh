#!/usr/bin/env bash
# Automates a full release: build Linux locally, trigger/wait for the
# Windows and macOS GitHub Actions builds, rename artifacts to the
# convention used by the download server, and upload everything to it.
#
# Server settings come from the environment or from scripts/release.env
# (git-ignored; copy scripts/release.env.example and fill it in).
set -euo pipefail

cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
[[ -f scripts/release.env ]] && source scripts/release.env

VERSION=$(node -p "require('./package.json').version")
REPO="${RELEASE_REPO:-luicesar/OpenFatoAI}"
VPS="${RELEASE_VPS:?Set RELEASE_VPS (user@host) in the environment or scripts/release.env}"
VPS_KEY="${RELEASE_VPS_KEY:?Set RELEASE_VPS_KEY (path to the SSH key) in the environment or scripts/release.env}"
VPS_DIR="${RELEASE_VPS_DIR:?Set RELEASE_VPS_DIR (remote downloads directory) in the environment or scripts/release.env}"

echo "==> Release version: ${VERSION}"

# ── 1. Build Linux packages locally ────────────────────────────────────
echo "==> [1/8] Building Linux packages (x64 + arm64)..."
npm run dist:x64
npm run dist:arm64

DEB_AMD64="dist/openfatoai_${VERSION}_amd64.deb"
DEB_ARM64="dist/openfatoai_${VERSION}_arm64.deb"
for f in "$DEB_AMD64" "$DEB_ARM64"; do
  [[ -f "$f" ]] || { echo "ERROR: expected $f not found"; exit 1; }
done

# ── 2. Trigger GitHub Actions builds ────────────────────────────────────
echo "==> [2/8] Triggering GitHub Actions workflows..."
gh workflow run build-windows.yml --repo "$REPO" --ref master
gh workflow run build-macos.yml --repo "$REPO" --ref master

# give GitHub a moment to register the new runs
sleep 10

# ── 3. Wait for both builds to finish ───────────────────────────────────
echo "==> [3/8] Waiting for Windows build..."
RUN_ID_WIN=$(gh run list --repo "$REPO" --workflow=build-windows.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$RUN_ID_WIN" --repo "$REPO" --exit-status

echo "==> [3/8] Waiting for macOS build..."
RUN_ID_MAC=$(gh run list --repo "$REPO" --workflow=build-macos.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$RUN_ID_MAC" --repo "$REPO" --exit-status

# ── 4. Download artifacts ───────────────────────────────────────────────
echo "==> [4/8] Downloading artifacts..."
rm -rf dist/windows dist/macOS
mkdir -p dist/windows dist/macOS
gh run download "$RUN_ID_WIN" --repo "$REPO" -n openfatoai-windows-x64 -D dist/windows
gh run download "$RUN_ID_MAC" --repo "$REPO" -n openfatoai-macos -D dist/macOS

# ── 5. Rename to the final naming convention ────────────────────────────
echo "==> [5/8] Renaming artifacts..."
WIN_EXE_FINAL="dist/windows/openfatoai_${VERSION}_win.exe"
DMG_ARM64_FINAL="dist/macOS/openfatoai_${VERSION}-arm64.dmg"
DMG_X64_FINAL="dist/macOS/openfatoai_${VERSION}.dmg"

win_src=$(find dist/windows -maxdepth 1 -name '*.exe' ! -name "$(basename "$WIN_EXE_FINAL")" | head -1)
[[ -n "$win_src" ]] && mv -fv "$win_src" "$WIN_EXE_FINAL"

mac_arm64_src=$(find dist/macOS -maxdepth 1 -iname '*arm64*.dmg' ! -name "$(basename "$DMG_ARM64_FINAL")" | head -1)
[[ -n "$mac_arm64_src" ]] && mv -fv "$mac_arm64_src" "$DMG_ARM64_FINAL"

mac_x64_src=$(find dist/macOS -maxdepth 1 -name '*.dmg' ! -iname '*arm64*' ! -name "$(basename "$DMG_X64_FINAL")" | head -1)
[[ -n "$mac_x64_src" ]] && mv -fv "$mac_x64_src" "$DMG_X64_FINAL"

# ── 6. Clean up stale release artifacts (cautious) ──────────────────────
echo "==> [6/8] Cleaning up stale artifacts..."
for f in dist/windows/*.zip dist/windows/*.exe dist/macOS/*.zip dist/macOS/*.dmg; do
  [[ -f "$f" ]] || continue
  case "$f" in
    "$WIN_EXE_FINAL"|"$DMG_X64_FINAL"|"$DMG_ARM64_FINAL") continue ;;
  esac
  echo "    removing stale artifact: $f"
  rm -fv "$f"
done

# Verify the 5 final files exist before touching the VPS
for f in "$DEB_AMD64" "$DEB_ARM64" "$WIN_EXE_FINAL" "$DMG_X64_FINAL" "$DMG_ARM64_FINAL"; do
  [[ -f "$f" ]] || { echo "ERROR: expected final file $f not found"; exit 1; }
done

# ── 7. Upload to the VPS ─────────────────────────────────────────────────
echo "==> [7/8] Uploading to ${VPS}:${VPS_DIR}..."
scp -i "$VPS_KEY" "$DEB_AMD64" "$DEB_ARM64" "$WIN_EXE_FINAL" "$DMG_X64_FINAL" "$DMG_ARM64_FINAL" "${VPS}:${VPS_DIR}/"

# ── 8. Verify remote directory ───────────────────────────────────────────
echo "==> [8/8] Verifying remote downloads directory..."
ssh -i "$VPS_KEY" "$VPS" "ls -la ${VPS_DIR}/"

echo "==> Release ${VERSION} published successfully."
