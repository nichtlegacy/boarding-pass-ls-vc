#!/usr/bin/env bash
# Renders the committed images with headless Chrome from the Playwright cache:
#   site/og.jpg (1200x630) and .github/images/social-preview.png (1280x640) from scripts/og.html,
#   the favicon PNGs from site/favicon.svg, and favicon.ico (16/32/48) via Pillow.
# Outputs are committed; the Pages runner needs no image tooling.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROME=${CHROME:-$(ls -d ~/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell | sort -V | tail -1)}
PY=${PY:-/tmp/bp-fonts/venv/bin/python}   # fonts.sh creates this venv with Pillow
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# The og template imports the site's ES modules, which Chrome refuses over file://, so it is served
# for the few seconds the screenshots take (loopback only, random free port).
PORT=$("$PY" -I -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1])')
"$PY" -I -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT" >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null; rm -rf "$TMP"' EXIT
for _ in $(seq 50); do curl -fs "http://127.0.0.1:$PORT/scripts/og.html" >/dev/null && break; sleep 0.1; done

shot(){ # url width height out [background RRGGBBAA]
  "$CHROME" --no-sandbox --hide-scrollbars --force-device-scale-factor=1 --window-size="$2,$3" \
    ${5:+--default-background-color=$5} --virtual-time-budget=5000 --screenshot="$4" "$1" 2>/dev/null
}
# The link card ships as a JPEG: a PNG of the photo is ~750 KB, and WhatsApp drops previews much over 600 KB.
# Its URL carries a content hash so Discord, Facebook and WhatsApp, which cache images by URL, pick up a re-render.
shot "http://127.0.0.1:$PORT/scripts/og.html" 1200 630 "$TMP/og.png"
"$PY" -I -c 'import sys; from PIL import Image; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2], quality=86, optimize=True)' "$TMP/og.png" "$ROOT/site/og.jpg"
OG_V=$(sha256sum "$ROOT/site/og.jpg" | cut -c1-8)
sed -i -E "s/og\.jpg\?v=[0-9a-f]+/og.jpg?v=$OG_V/g" "$ROOT/site/index.html"
mkdir -p "$ROOT/.github/images"   # GitHub's social preview takes PNG or JPG under 1 MB
shot "http://127.0.0.1:$PORT/scripts/og.html#1280x640" 1280 640 "$ROOT/.github/images/social-preview.png"

# Icons: transparent corners everywhere except the apple-touch icon, which iOS would fill with black.
ICON="http://127.0.0.1:$PORT/site/favicon.svg"
shot "$ICON" 32 32 "$ROOT/site/icon-32.png" 00000000
shot "$ICON" 192 192 "$ROOT/site/icon-192.png" 00000000
shot "$ICON" 512 512 "$ROOT/site/icon-512.png" 00000000
shot "$ICON" 256 256 "$TMP/ico.png" 00000000
shot "$ICON" 180 180 "$ROOT/site/apple-touch-icon.png" 1d1622ff
"$PY" -I -c 'import sys; from PIL import Image; Image.open(sys.argv[1]).save(sys.argv[2], sizes=[(16,16),(32,32),(48,48)])' "$TMP/ico.png" "$ROOT/site/favicon.ico"

ls -l "$ROOT/.github/images/social-preview.png" "$ROOT/site/og.jpg" "$ROOT/site/"*.png "$ROOT/site/favicon.ico"
