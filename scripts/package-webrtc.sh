#!/bin/bash
# Package prebuilt WebRTC static libraries and headers from a local build.
# Run this after a successful `npm run build`.
#
# Usage: ./scripts/package-webrtc.sh
# Output: webrtc-<platform>-<arch>.tar.gz   (static libs + object files)
#         webrtc-headers.tar.gz              (headers, platform-independent)
set -e

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
  *)       echo "Unsupported arch: $ARCH"; exit 1 ;;
esac

TRIPLE="${PLATFORM}-${ARCH}"
BUILD_DIR="build-${TRIPLE}/external/libwebrtc"
OBJ_DIR="${BUILD_DIR}/build/Release/obj"
SRC_DIR="${BUILD_DIR}/download/src"

if [ ! -d "$OBJ_DIR" ]; then
  echo "Build directory not found: $OBJ_DIR"
  echo "Run 'npm run build' first."
  exit 1
fi

# Package static libs and object files (platform-specific)
LIBS_OUTPUT="webrtc-${TRIPLE}.tar.gz"
echo "Packaging WebRTC libs for ${TRIPLE}..."
tar czf "$LIBS_OUTPUT" \
  -C "$(dirname "$OBJ_DIR")" \
  obj/libwebrtc.a \
  obj/api/libjingle_peerconnection_api.a \
  obj/api/video_codecs/libbuiltin_video_encoder_factory.a \
  obj/api/video_codecs/libbuiltin_video_decoder_factory.a \
  obj/media/librtc_internal_video_codecs.a \
  obj/media/librtc_simulcast_encoder_adapter.a \
  obj/buildtools/third_party/libc++/libc++/ \
  obj/buildtools/third_party/libc++abi/libc++abi/
echo "Created ${LIBS_OUTPUT} ($(du -h "$LIBS_OUTPUT" | cut -f1))"

# Package headers (platform-independent, only need to upload once)
HEADERS_OUTPUT="webrtc-headers.tar.gz"
if [ ! -f "$HEADERS_OUTPUT" ]; then
  echo "Packaging WebRTC headers..."
  (cd "$SRC_DIR" && (
    find . -name '*.h' -o -name '*.inc'
    find ./buildtools/third_party/libc++/trunk/include -type f
    find ./buildtools/third_party/libc++abi/trunk/include -type f
    find ./buildtools/third_party/libc++ -maxdepth 1 -name '__*' -type f
  ) | sort -u | tar czf - -T -) > "$HEADERS_OUTPUT"
  echo "Created ${HEADERS_OUTPUT} ($(du -h "$HEADERS_OUTPUT" | cut -f1))"
else
  echo "Headers tarball already exists, skipping."
fi
