#!/bin/bash
# Download prebuilt WebRTC headers and static libraries from GitHub Releases
# and set up the directory structure that CMakeLists.txt expects.
#
# Usage: ./scripts/download-prebuilt-webrtc.sh <build-dir>
#   e.g.: ./scripts/download-prebuilt-webrtc.sh build-linux-x64
set -e

BUILD_DIR="$1"
if [ -z "$BUILD_DIR" ]; then
  echo "Usage: $0 <build-dir>"
  exit 1
fi

PLATFORM="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "$PLATFORM" in
  darwin) PLATFORM="darwin" ;;
  linux)  PLATFORM="linux" ;;
  *)      echo "Unsupported platform: $PLATFORM"; exit 1 ;;
esac
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  ARCH="x64" ;;
  aarch64) ARCH="arm64" ;;
  arm64)   ARCH="arm64" ;;
esac

TRIPLE="${PLATFORM}-${ARCH}"
REPO="kevindhanna/node-webrtc"
TAG="webrtc-m114"
BASE_URL="https://github.com/${REPO}/releases/download/${TAG}"

WEBRTC_DIR="${BUILD_DIR}/external/libwebrtc"
SRC_DIR="${WEBRTC_DIR}/download/src"
OBJ_DIR="${WEBRTC_DIR}/build/Release"

# Download and extract headers
echo "Downloading WebRTC headers..."
curl -fSL "${BASE_URL}/webrtc-headers.tar.gz" -o /tmp/webrtc-headers.tar.gz
mkdir -p "${SRC_DIR}"
tar xzf /tmp/webrtc-headers.tar.gz -C "${SRC_DIR}"
rm /tmp/webrtc-headers.tar.gz

# Create the webrtc -> src symlink that CMake expects
ln -sfn src "${WEBRTC_DIR}/download/webrtc"

# Download and extract prebuilt libs
echo "Downloading prebuilt WebRTC libs for ${TRIPLE}..."
curl -fSL "${BASE_URL}/webrtc-${TRIPLE}.tar.gz" -o /tmp/webrtc-libs.tar.gz
mkdir -p "${OBJ_DIR}"
tar xzf /tmp/webrtc-libs.tar.gz -C "${OBJ_DIR}"
rm /tmp/webrtc-libs.tar.gz

echo "Done. WebRTC headers and libs installed for ${TRIPLE}."
