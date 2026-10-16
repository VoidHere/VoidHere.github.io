#!/usr/bin/env bash
# Build the Cloudflare Pages output folder (pages.dev).
#
# The site is already generated — every HTML file is committed. This script
# only assembles what pages.dev should serve into dist/.
#
# Deliberately excluded:
#   build/      generator scripts, not part of the site
#   test-assets/ local test fixtures (also gitignored)
#   README.md   repo furniture
#   vendor/ffmpeg-core.wasm
#       31 MB, over Cloudflare Pages' 25 MiB per-file cap. pages.dev loads
#       the engine from the GitHub Pages mirror instead — see WASM_ORIGIN
#       in js/core.js.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
mkdir -p dist
cp -r ./*.html css js vendor \
      favicon.svg og-image.png apple-touch-icon.png \
      robots.txt sitemap.xml .nojekyll \
      dist/
rm -f dist/vendor/ffmpeg-core.wasm

echo "dist ready: $(find dist -type f | wc -l) files, $(du -sh dist | cut -f1)"
