#!/bin/bash
set -e

# Error handling trap
error_handler() {
    local line=$1
    echo "" >&2
    echo "==========================================================" >&2
    echo "❌ Error: Installation failed at line $line." >&2
    echo "Please check the error messages above or refer to README.txt." >&2
    echo "==========================================================" >&2
    exit 1
}
trap 'error_handler $LINENO' ERR

# Get directory where setup.sh is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Installing MD Editor (mded) for macOS ==="

# 1. Pre-flight check: ensure executable binary exists
if [ ! -f "$SCRIPT_DIR/mded" ]; then
    echo "" >&2
    echo "❌ Error: Executable binary 'mded' not found in: $SCRIPT_DIR" >&2
    echo "Please place the compiled macOS executable named 'mded' in this folder and re-run ./setup.sh." >&2
    echo "(See mded.placeholder or README.txt for details)" >&2
    exit 1
fi

# Ensure required bundle component files exist
for file in "mded_icon.icns" "Info.plist" "mded-launcher"; do
    if [ ! -f "$SCRIPT_DIR/$file" ]; then
        echo "❌ Error: Required bundle component '$file' is missing in $SCRIPT_DIR." >&2
        exit 1
    fi
done

# 2. Install CLI executable to user local bin (~/.local/bin/mded)
mkdir -p "$HOME/.local/bin"
cp "$SCRIPT_DIR/mded" "$HOME/.local/bin/mded"
chmod 755 "$HOME/.local/bin/mded"
echo "✔ Installed CLI executable to $HOME/.local/bin/mded"

# 3. Create macOS Application Bundle (~/Applications/MD Editor.app)
APP_DIR="$HOME/Applications/MD Editor.app"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

cp "$SCRIPT_DIR/Info.plist" "$APP_DIR/Contents/Info.plist"
cp "$SCRIPT_DIR/mded_icon.icns" "$APP_DIR/Contents/Resources/mded_icon.icns"
cp "$SCRIPT_DIR/mded-launcher" "$APP_DIR/Contents/MacOS/mded-launcher"
chmod 755 "$APP_DIR/Contents/MacOS/mded-launcher"

# Also link or place mded in the app bundle for self-containment
ln -sf "$HOME/.local/bin/mded" "$APP_DIR/Contents/MacOS/mded"
echo "✔ Created application bundle at $APP_DIR"

# 4. Remove quarantine attribute if present (Gatekeeper friendly)
if command -v xattr > /dev/null 2>&1; then
    xattr -dr com.apple.quarantine "$HOME/.local/bin/mded" "$APP_DIR" 2>/dev/null || true
fi

# 5. Register with macOS Launch Services for Finder / Spotlight integration
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
if [ -x "$LSREGISTER" ]; then
    "$LSREGISTER" -f "$APP_DIR" > /dev/null 2>&1 || true
fi

# 6. Completion and PATH environment check
echo ""
echo "=== Installation Completed Successfully ==="
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo "⚠️  Notice: '$HOME/.local/bin' is not currently in your PATH environment variable."
    echo "   To launch 'mded' directly from your terminal, add the following to ~/.zshrc (or ~/.bash_profile):"
    echo '     export PATH="$HOME/.local/bin:$PATH"'
    echo "   (After editing, run 'source ~/.zshrc' or open a new terminal window)"
else
    echo "✔ '$HOME/.local/bin' is in your PATH. You can now run 'mded' directly from your terminal!"
fi
echo ""
echo "You can also launch 'MD Editor' from Spotlight (Cmd + Space), Launchpad,"
echo "or right-click any Markdown file (.md) in Finder and select 'Open With' -> 'MD Editor'."
echo ""
echo "Note: To uninstall, run './uninstall.sh' from this directory."
