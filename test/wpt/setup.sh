#!/bin/bash
# Download WPT webrtc tests
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -d "$DIR/webrtc" ] && [ -d "$DIR/resources" ]; then
  echo "WPT tests already downloaded"
  exit 0
fi

echo "Downloading WPT webrtc tests..."
TMP=$(mktemp -d)
git clone --depth 1 --filter=blob:none --sparse https://github.com/web-platform-tests/wpt.git "$TMP" 2>/dev/null
cd "$TMP"
git sparse-checkout set webrtc resources common mediacapture-streams 2>/dev/null
cp -r webrtc "$DIR/"
cp -r resources "$DIR/"
cp -r common "$DIR/"
cp -r mediacapture-streams "$DIR/"
rm -rf "$TMP"
echo "Done. $(ls "$DIR/webrtc/"*.html | wc -l | tr -d ' ') test files downloaded."
