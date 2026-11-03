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

echo "=== Installing MD Editor (mded) ==="

# 1. Pre-flight check: ensure required files exist in package
for file in "mded" "mded_icon.png" "mded.desktop"; do
    if [ ! -f "$SCRIPT_DIR/$file" ]; then
        echo "❌ Error: Required file '$file' is missing in $SCRIPT_DIR." >&2
        echo "Please make sure the archive was extracted completely." >&2
        exit 1
    fi
done

# 2. Install executable (~/.local/bin/mded)
# install -D creates directories, copies file, and sets permissions atomically
install -Dm755 "$SCRIPT_DIR/mded" "$HOME/.local/bin/mded"
echo "✔ Installed executable to $HOME/.local/bin/mded"

# 3. Install icon image (~/.local/share/icons/mded_icon.png)
install -Dm644 "$SCRIPT_DIR/mded_icon.png" "$HOME/.local/share/icons/mded_icon.png"
echo "✔ Installed icon to $HOME/.local/share/icons/mded_icon.png"

# 4. Install desktop entry (~/.local/share/applications/mded.desktop)
mkdir -p "$HOME/.local/share/applications"
sed "s|\$HOME|$HOME|g" "$SCRIPT_DIR/mded.desktop" > "$HOME/.local/share/applications/mded.desktop"
chmod 644 "$HOME/.local/share/applications/mded.desktop"
echo "✔ Installed desktop entry to $HOME/.local/share/applications/mded.desktop"

# 5. Update desktop database if available
if command -v update-desktop-database > /dev/null 2>&1; then
    update-desktop-database "$HOME/.local/share/applications" > /dev/null 2>&1 || true
fi

# 6. Completion and PATH environment check
echo ""
echo "=== Installation Completed Successfully ==="
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo "⚠️  Notice: '$HOME/.local/bin' is not currently in your PATH environment variable."
    echo "   To launch 'mded' directly from any terminal, add the following line to your ~/.bashrc or ~/.profile:"
    echo '     export PATH="$HOME/.local/bin:$PATH"'
    echo "   (After editing, run 'source ~/.bashrc' or restart your terminal session)"
else
    echo "✔ '$HOME/.local/bin' is in your PATH. You can now run 'mded' directly from your terminal!"
fi
echo ""
echo "You can also launch 'MD Editor' from your desktop application menu or"
echo "right-click any Markdown file (.md) and select 'Open With' -> 'MD Editor'."
echo ""
echo "Note: To uninstall, run './uninstall.sh' from this directory."
