#!/usr/bin/env bash
set -euo pipefail

# Get repository root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
EXAMPLE_DIR="${REPO_ROOT}/example"
OUTPUT_DIR="${REPO_ROOT}/output"
ARCHIVE_NAME="emulator-webrtc-ui.tar.gz"
CHECKSUM_FILE="SHA256SUMS"

echo "=== Packaging Prebuilt Web UI for Release ==="
echo "Repository root: ${REPO_ROOT}"

# Ensure root protobuf generator has run if proto files are needed
if [ ! -f "${REPO_ROOT}/src/proto/emulator_controller_pb.js" ]; then
  echo "Generating proto bindings in repository root..."
  cd "${REPO_ROOT}"
  if [ -f "node_modules/protoc-gen-js/post-install.js" ] && [ ! -f "node_modules/protoc-gen-js/bin/protoc-gen-js" ]; then
    node node_modules/protoc-gen-js/post-install.js || true
  fi
  make protoc
fi

# Build example frontend
echo "Building example frontend..."
cd "${EXAMPLE_DIR}"
if [ -f "package-lock.json" ]; then
  npm ci
else
  npm install
fi
npm run build

DIST_DIR="${EXAMPLE_DIR}/dist"
if [ ! -d "${DIST_DIR}" ]; then
  echo "Error: Build output directory ${DIST_DIR} does not exist!" >&2
  exit 1
fi

# Prepare output directory
mkdir -p "${OUTPUT_DIR}"
ARCHIVE_PATH="${OUTPUT_DIR}/${ARCHIVE_NAME}"
CHECKSUM_PATH="${OUTPUT_DIR}/${CHECKSUM_FILE}"

echo "Creating compressed tarball: ${ARCHIVE_PATH}..."
tar -czf "${ARCHIVE_PATH}" -C "${DIST_DIR}" .

echo "Computing SHA-256 checksum..."
cd "${OUTPUT_DIR}"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${ARCHIVE_NAME}" > "${CHECKSUM_FILE}"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "${ARCHIVE_NAME}" > "${CHECKSUM_FILE}"
else
  openssl dgst -sha256 "${ARCHIVE_NAME}" | awk '{print $2 "  " "'"${ARCHIVE_NAME}"'"}' > "${CHECKSUM_FILE}"
fi

cat "${CHECKSUM_PATH}"
HASH_ONLY=$(awk '{print $1}' "${CHECKSUM_PATH}")

echo ""
echo "=== Packaging Complete ==="
echo "Archive:  ${ARCHIVE_PATH}"
echo "Checksum: ${CHECKSUM_PATH}"
echo "SHA-256:  ${HASH_ONLY}"
