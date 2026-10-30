# Markdown Notebook Editor & Viewer (`md_editor`)

[日本語版ドキュメント (Japanese README)](README_ja.md)

> **Note**: This English documentation has been translated from Japanese using machine translation.

A desktop-oriented, lightweight Markdown notebook editor & viewer inspired by Jupyter Lab. Write, view, and interact with Markdown cell-by-cell while seamlessly toggling between **Edit** and **Command (View)** modes.

---

## 🌟 About This Project & Design Philosophy

This application was created and developed with **Google Antigravity**.

The core design philosophy of this project is to provide a clean, transparent, and approachable foundation that **users can freely customize and extend to their own preferences using AI coding agents** (such as Google Antigravity, Claude Code, Cursor, GitHub Copilot, etc.).

To achieve this ideal, the application intentionally avoids modern complex frontend build chains:
- **Zero Frontend Build Step**: No Node.js, npm, Webpack, or Vite. The frontend runs purely on Vanilla JavaScript, Tailwind CSS, and CDN-loaded libraries.
- **Readable & Transparent Codebase**: The entire frontend is organized in a single, well-structured file (`app.js`) with clear section headers, and the backend is a lightweight FastAPI server (`main.py`).
- **AI Agent-Friendly Architecture**: Any edits to JavaScript, HTML, or Python files take effect immediately upon browser refresh or server restart. Both human developers and AI agents can rapidly inspect, debug, and modify features without build errors, bundling complexities, or tooling overhead.
- Detailed developer and AI agent instructions are documented in [`AGENTS.md`](AGENTS.md) (and [`AGENTS_ja.md`](AGENTS_ja.md)).

---

## 🚀 Key Features

- **Jupyter Lab-like Cell Paradigm**: Edit and preview Markdown, LaTeX formulas (KaTeX), code blocks with syntax highlighting, and emojis cell-by-cell.
- **Rich Keyboard Navigation**: Intuitive Command and Edit modes with comprehensive shortcut support (Vim-style navigation, cell split, insert, delete, reorder, in-cell search/replace, and go-to-line).
- **Multi-Pane Workspace & Tab Drag-and-Drop**: Split the editor vertically up to 3 panes (`Ctrl + \`), drag-and-drop tabs between panes or to the right edge to split, and merge panes (`Ctrl + Alt + M`).
- **Concurrent Multi-Session Support**: Launch independent sessions concurrently in different directories on automatically assigned dynamic ports (`18000`, `18002`, ...). Launching again in the same directory seamlessly restores and focuses the existing session.
- **Direct File Launching & OS Integration**: Open files directly from the command line (`mded document.md`) or via desktop environment actions (double-click or "Open With"). The application automatically sets the target file's directory as the active workspace.
- **Full-Featured File Browser**: Manage workspace files and folders with right-click context menu (create, rename, delete, duplicate, copy, cut, paste) and keyboard shortcuts.
- **Table of Contents (ToC) Sidebar**: Instant heading outline with smooth jump-to-section.
- **Clean Exporting Capabilities**: Export clean Markdown (without cell delimiters), standalone HTML, and browser-native PDF print.
- **Graceful Shutdown**: Close the application and release server resources cleanly via the menu `Quit` button or `Ctrl + Shift + Q` with a confirmation dialog.
- **No Frontend Build Step Required**: Works purely with a lightweight Python backend (FastAPI) and Vanilla JS + CDN assets. No Node.js or npm build step needed.

---

## 📦 Installation & Distribution

This application supports multiple installation methods depending on your environment and preferences.

### Option A: For Users with Python Installed

#### 1. For Developers / AI-Assisted Customization
Run in editable mode to develop and customize the source code directly:

```bash
# 1. Clone repository and navigate
git clone https://github.com/t2-Kusumoto/md_editor.git
cd md_editor

# 2. Create and activate a virtual environment
# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate

# Windows (PowerShell)
python -m venv .venv
.venv\Scripts\Activate.ps1

# 3. Install in editable mode
pip install -e .

# 4. Launch the application
mded
# Any changes to Python or JS files will reflect immediately without reinstalling!
```

#### 2. For Daily CLI Usage (Global command without activating venv)

**Using `pipx` or `uv`:**
```bash
# Using pipx
pipx install git+https://github.com/t2-Kusumoto/md_editor.git
# or from local clone:
pipx install .

# Using uv
uv tool install git+https://github.com/t2-Kusumoto/md_editor.git
# or from local clone:
uv tool install .
```

**Using Standard Python (Without external tools):**
```bash
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\Activate.ps1
pip install .

# macOS / Linux: Create a symlink to user bin
ln -s "$(pwd)/.venv/bin/mded" ~/.local/bin/mded

# Windows: Add .venv\Scripts to your user PATH or create a shortcut
```

---

### Option B: Standalone Executable (For Systems without Python)

Create a single standalone binary using PyInstaller:

```bash
python3 build.py
```
This builds an executable into the `dist/` directory (`dist/mded` on Linux/macOS or `dist/mded.exe` on Windows).
Place this binary in any directory included in your system `PATH` and launch it directly from terminal:
```bash
mded
```

---

## 💡 Quick Start & Usage

### 1. Launching from Terminal

Run the command in your desired workspace folder:
```bash
# Launch without arguments (opens current directory as workspace)
mded

# Directly open a specific Markdown file
mded document.md
# or with relative/absolute path:
mded path/to/notes.md
```
Your default web browser will automatically open at `http://127.0.0.1:18000` (or the next available port).

### 2. Multi-Session Support (Working in Multiple Directories)
You can work on different projects simultaneously:
- Running `mded` in directory `/path/to/project-A` launches a server on port `18000`.
- Running `mded` in another terminal in directory `/path/to/project-B` automatically assigns an available port (e.g. `18002`) and opens an independent browser window for project B.
- If you run `mded` again in a directory that is already running, it detects the existing session and restores/focuses it in your browser without creating duplicate servers.

### 3. Desktop / GUI File Integration (Open With & Double Click)
- **Linux (GNOME / Nautilus)**: You can right-click any `.md` file, select "Open With Other Application", and choose `mded`, or double-click `.md` files. The editor automatically sets the file's parent directory as the workspace and opens the file.
- **Windows**: Right-click a `.md` file -> "Open with" -> choose `mded.exe`.

### 4. Graceful Shutdown
- Click the **Quit** button in the top menu bar or press **`Ctrl + Shift + Q`**.
- A confirmation dialog will appear. Clicking **Quit** (or pressing Enter) will cleanly shut down the backend server and release the port.

---

## ⌨️ Operation & Shortcuts

The editor operates in two primary modes, similar to Jupyter Lab: **Edit mode** (editing cell contents) and **Command mode** (navigating and manipulating cells).

### Global Shortcuts
- **`Ctrl + Shift + ← / H`**: Switch to the tab on the left in the active pane.
- **`Ctrl + Shift + → / L`**: Switch to the tab on the right in the active pane.
- **`Ctrl + N`** or **`Ctrl + Alt + N`**: Create a new notebook (new tab).
- **`Ctrl + Alt + W`**: Close active tab in current pane.
- **`Ctrl + Alt + M`**: Merge current pane into adjacent left pane.
- **`Ctrl + S`**: Save current notebook.
- **`Ctrl + Alt + S`**: Save notebook as a new file (Save As).
- **`Ctrl + \`**: Split active editor vertically (up to 3 panes).
- **`Ctrl + Shift + F`**: Toggle File Browser sidebar.
- **`Ctrl + Alt + F`**: Toggle Table of Contents (ToC) sidebar.
- **`Ctrl + Shift + Q`**: Quit application and gracefully stop backend server.

### Edit Mode (Typing inside a cell)
- **`Esc`**: Switch to Command mode (preview rendered Markdown).
- **`Ctrl + Enter`**: Render cell and stay on current cell in Command mode.
- **`Shift + Enter`**: Render cell and select the cell below (creates a new cell if at the end).
- **`Ctrl + /`**: Toggle comment (`<!-- ... -->`) for selected lines or current line.
- **`Ctrl + Alt + -`**: Split current cell at cursor or selection midpoint.
- **`Ctrl + Shift + K`**: Delete current line(s).
- **`Ctrl + Shift + D`**: Duplicate current line(s) downward.
- **`Ctrl + Shift + ↑ / ↓`**: Move line(s) up or down within current cell.
- **`Ctrl + B`**: Bold text (`**...**`).
- **`Ctrl + I`**: Italicize text (`*...*`).
- **`Ctrl + ← / →`**: Move cursor to start / end of current line.
- **`Ctrl + ↑ / ↓`**: Move cursor to start / end of current cell.
- **`Ctrl + H`**: Open in-cell string replacement prompt (Interactive Replace: `y`/`n`/`a`/`q`/`Esc`).
- **`Ctrl + G`**: Open in-cell line jump prompt (Go to Line).
- **`Ctrl + Alt + L`**: Recenter current line 12 lines below editor header.

### Command Mode (Cell navigation & manipulation)
- **`Enter`**: Enter Edit mode for selected cell.
- **`J`** or **`Ctrl + ↓`**: Select cell below.
- **`K`** or **`Ctrl + ↑`**: Select cell above.
- **`↑ / ↓`**: Smoothly scroll viewport up or down.
- **`H`** or **`←`**: Move focus to left pane (in multi-pane layout).
- **`L`** or **`→`**: Move focus to right pane (in multi-pane layout).
- **`Shift + ↑ / ↓`** or **`Shift + J / K`**: Multi-select adjacent cells.
- **`Shift + Click`**: Range-select cells from anchor to clicked cell.
- **`Esc`**: Clear multi-cell selection back to single anchor cell.
- **`Ctrl + Shift + ↑ / ↓`**: Move selected cell(s) up or down (reorder).
- **`A`**: Insert a new cell **above** selected cell.
- **`B`**: Insert a new cell **below** selected cell.
- **`D, D`** (press D twice): Delete selected cell(s).
- **`C`**: Copy selected cell(s).
- **`X`**: Cut selected cell(s).
- **`V`**: Paste cell(s) below.
- **`Shift + V`**: Paste cell(s) above.
- **`Shift + M`**: Merge all selected cells into a single cell.
- **`Ctrl + Alt + -`**: Split selected cell into two cells.
- **`Z`** or **`Ctrl + Z`**: Undo cell operations.
- **`Shift + Z`** or **`Ctrl + Y`**: Redo cell operations.
- **`Ctrl + A`**: Select all cells.
- **`Ctrl + Alt + L`**: Recenter top edge of active cell 2 lines below editor header.
- **`G, G`**: Jump to first cell.
- **`[Number] + G, G`** (e.g. `5gg`): Jump to specific cell number.
- **`Shift + G`**: Jump to last cell.
- **`Shift + Enter`**: Render cell (preview).
- **`Ctrl + \`**: Split editor vertically into multiple panes.

### File Browser Shortcuts (When not editing cells)
- **`Ctrl + C`**: Copy selected file or folder in browser.
- **`Ctrl + X`**: Cut selected file or folder in browser.
- **`Ctrl + V`**: Paste copied or cut file/folder into current directory.

---

## 🛠️ Technical Stack

- **Backend**: Python (FastAPI, Uvicorn, Jinja2, WebSockets)
- **Frontend**: HTML5, Vanilla JavaScript, Tailwind CSS
- **Sanitizer**: DOMPurify (XSS prevention)
- **Markdown Parser**: Marked.js
- **LaTeX Math Renderer**: KaTeX (supports `$` and `$$` syntax)
- **Syntax Highlighting**: Highlight.js
- **Vector Emojis**: Twemoji

---

## 🧪 Running Automated Tests

Run backend and parser tests using standard Python `unittest`:

```bash
python3 -m unittest discover tests
```

---

## 📄 License

MIT License