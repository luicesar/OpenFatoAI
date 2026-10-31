#!/usr/bin/env bash
set -euo pipefail

# Downloads a small Portuguese Vosk model and repacks it as tar.gz
# for use with vosk-browser WASM (createModel expects a .tar.gz archive).
MODEL_URL="https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip"
OUT_TARBALL="src/models/vosk-model.tar.gz"

TMP_DIR=$(mktemp -d)
TMP_ZIP="${TMP_DIR}/model.zip"

cleanup() { rm -rf "${TMP_DIR}"; }
trap cleanup EXIT

echo "Creating output directory..."
mkdir -p "$(dirname "${OUT_TARBALL}")"

echo "Downloading model from ${MODEL_URL} (this may take a while)..."
if command -v curl >/dev/null 2>&1; then
  curl -L "${MODEL_URL}" -o "${TMP_ZIP}"
elif command -v wget >/dev/null 2>&1; then
  wget -O "${TMP_ZIP}" "${MODEL_URL}"
else
  echo "Please install curl or wget to download the model." >&2
  exit 2
fi

echo "Extracting zip..."
if command -v unzip >/dev/null 2>&1; then
  unzip -q "${TMP_ZIP}" -d "${TMP_DIR}/extracted"
else
  echo "Please install unzip to extract the model." >&2
  exit 2
fi

EXTRACTED_DIR=$(find "${TMP_DIR}/extracted" -maxdepth 1 -mindepth 1 -type d | head -n 1)
if [ -z "${EXTRACTED_DIR}" ]; then
  echo "Extraction failed or unexpected archive layout." >&2
  exit 3
fi

# vosk-browser expects the archive to contain a top-level "model/" folder
mv "${EXTRACTED_DIR}" "${TMP_DIR}/model"

echo "Repacking as tar.gz → ${OUT_TARBALL}..."
tar -C "${TMP_DIR}" -czf "${OUT_TARBALL}" model

echo "Model saved to ${OUT_TARBALL}"
echo "Done. You can now run: npm run start"
