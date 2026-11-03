#!/bin/bash
set -e

# Error handling trap
error_handler() {
    local line=$1
    echo "" >&2
    echo "==========================================================" >&2
    echo "❌ Error: Uninstallation failed at line $line." >&2
    echo "==========================================================" >&2
    exit 1
}
trap 'error_handler $LINENO' ERR

echo "=== Uninstalling MD Editor (mded) for macOS ==="

APP_DIR="$HOME/Applications/MD Editor.app"
BIN_FILE="$HOME/.local/bin/mded"

REMOVED_ANY=false

# 1. Unregister from Launch Services if present
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
if [ -d "$APP_DIR" ] && [ -x "$LSREGISTER" ]; then
    "$LSREGISTER" -u "$APP_DIR" > /dev/null 2>&1 || true
fi

# 2. Remove Application Bundle
if [ -d "$APP_DIR" ]; then
    rm -rf "$APP_DIR"
    echo "✔ Removed $APP_DIR"
    REMOVED_ANY=true
fi

# 3. Remove CLI binary
if [ -f "$BIN_FILE" ]; then
    rm -f "$BIN_FILE"
    echo "✔ Removed $BIN_FILE"
    REMOVED_ANY=true
fi

echo ""
echo "=== Uninstallation Completed ==="
if [ "$REMOVED_ANY" = true ]; then
    echo "✔ MD Editor has been cleanly removed from your macOS user environment."
else
    echo "Notice: No installed components were found. Nothing to remove."
fi
