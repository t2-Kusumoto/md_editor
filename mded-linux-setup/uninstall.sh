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

echo "=== Uninstalling MD Editor (mded) ==="

# 1. Remove installed files
REMOVED_ANY=false

if [ -f "$HOME/.local/bin/mded" ]; then
    rm -f "$HOME/.local/bin/mded"
    echo "✔ Removed $HOME/.local/bin/mded"
    REMOVED_ANY=true
fi

if [ -f "$HOME/.local/share/applications/mded.desktop" ]; then
    rm -f "$HOME/.local/share/applications/mded.desktop"
    echo "✔ Removed $HOME/.local/share/applications/mded.desktop"
    REMOVED_ANY=true
fi

if [ -f "$HOME/.local/share/icons/mded_icon.png" ]; then
    rm -f "$HOME/.local/share/icons/mded_icon.png"
    echo "✔ Removed $HOME/.local/share/icons/mded_icon.png"
    REMOVED_ANY=true
fi

# Clean up legacy ~/.icon/ if it exists from previous installations
if [ -f "$HOME/.icon/mded_icon.png" ]; then
    rm -f "$HOME/.icon/mded_icon.png"
    echo "✔ Removed legacy $HOME/.icon/mded_icon.png"
    REMOVED_ANY=true
fi

# 2. Update desktop database if available
if command -v update-desktop-database > /dev/null 2>&1; then
    update-desktop-database "$HOME/.local/share/applications" > /dev/null 2>&1 || true
fi

echo ""
echo "=== Uninstallation Completed ==="
if [ "$REMOVED_ANY" = true ]; then
    echo "✔ mded has been cleanly removed from your user environment."
else
    echo "Notice: No installed files were found. Nothing to remove."
fi
