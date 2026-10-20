# Markdown Notebook Editor & Viewer (`md_editor`)

[日本語版ドキュメント (Japanese README)](README_ja.md)

A desktop-oriented, lightweight Markdown notebook editor & viewer inspired by Jupyter Lab. Write, view, and interact with Markdown cell-by-cell while seamlessly toggling between **Edit** and **Command (View)** modes.

---

## Key Features

- **Jupyter Lab-like Cell Paradigm**: Edit and preview Markdown, LaTeX formulas (KaTeX), code blocks with syntax highlighting, and emojis cell-by-cell.
- **Rich Keyboard Navigation**: Intuitive Command and Edit modes with full shortcut support (Vim-style navigation, cell split, insert, delete, and reorder).
- **Multi-Pane Workspace**: Split the editor vertically up to 3 panes with drag-and-drop tab management.
- **Security-First Architecture**: Built-in DOMPurify HTML sanitization prevents local XSS attacks from untrusted Markdown files. Directory traversal protections secure local file operations.
- **Table of Contents (ToC) Sidebar**: Instant heading outline with smooth jump-to-section.
- **Exporting Capabilities**: Export clean Markdown (without cell delimiters), standalone HTML, and browser-native PDF print.
- **No Frontend Build Step Required**: Works purely with Python backend (FastAPI) and Vanilla JS + CDN/local assets. No Node.js or npm build step needed for end users.

---

## Installation & Distribution

This application supports multiple installation methods depending on your environment and preferences.

### Option A: For Users with Python Installed

#### 1. For Developers / Customization
Run in editable mode to develop and customize the source code directly:

```bash
# 1. Clone repository and navigate
git clone https://github.com/user/md_editor.git
cd md_edit_and_view_app

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
md_editor
# Any changes to Python or JS files will reflect immediately without reinstalling!
```

#### 2. For Daily CLI Usage (Global command without activating venv)

**Using `pipx` or `uv`:**
```bash
# Using pipx
pipx install git+https://github.com/user/md_editor.git
# or from local clone:
pipx install .

# Using uv
uv tool install git+https://github.com/user/md_editor.git
# or from local clone:
uv tool install .
```

**Using Standard Python (Without external tools):**
```bash
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\Activate.ps1
pip install .

# macOS / Linux: Create a symlink to user bin
ln -s "$(pwd)/.venv/bin/md_editor" ~/.local/bin/md_editor

# Windows: Add .venv\Scripts to your user PATH or create a shortcut
```

---

### Option B: Standalone Executable (For Systems without Python)

Create a single standalone binary using PyInstaller:

```bash
python3 build.py
```
This builds an executable into the `dist/` directory (`dist/md-editor` on Linux/macOS or `dist/md-editor.exe` on Windows).
Place this binary in any directory included in your system `PATH` and launch it directly from terminal:
```bash
md-editor
```

---

## Quick Start & Usage

Run the command in your desired workspace folder:
```bash
# Launch without arguments (opens workspace)
md-editor
# or
md_editor

# Launch and directly open a Markdown file
md-editor document.md
```
Your default web browser will automatically open at `http://127.0.0.1:18000` (or the next available port).


---

## Operation & Shortcuts

The editor operates in two primary modes, identical to Jupyter Lab: **Edit mode** (editing cell contents) and **Command mode** (navigating and manipulating cells).

### Global Shortcuts
- **`Ctrl + Shift + F`**: Toggle File Browser sidebar.
- **`Ctrl + Alt + F`**: Toggle Table of Contents (ToC) sidebar.
- **`Ctrl + \`**: Split active editor vertically (up to 3 panes).
- **`Ctrl + S`**: Save current notebook.
- **`Ctrl + Alt + S`**: Save notebook as a new file.
- **`Ctrl + Alt + N`**: Create a new notebook.
- **`Ctrl + Alt + W`**: Close current tab.
- **`Ctrl + Shift + Q`**: Quit application and gracefully stop backend server.

### Edit Mode (Typing inside a cell)
- **`Esc`**: Switch to Command mode (preview rendered Markdown).
- **`Ctrl + Enter`**: Render cell and stay on current cell in Command mode.
- **`Shift + Enter`**: Render cell and select the cell below (creates a new cell if at the end).
- **`Ctrl + /`**: Toggle comment (`<!-- ... -->`) for selected lines or current line.
- **`Ctrl + Alt + -`**: Split current cell at selection.
- **`Ctrl + Shift + K`**: Delete current line(s).
- **`Ctrl + Shift + D`**: Duplicate current line(s) downward.
- **`Ctrl + Shift + ↑ / ↓`**: Move line(s) up or down within cell.
- **`Ctrl + B`**: Bold text (`**...**`).
- **`Ctrl + I`**: Italicize text (`*...*`).
- **`Ctrl + Alt + L`**: Recenter current line in editor view.

### Command Mode (Cell navigation)
- **`Enter`**: Enter Edit mode for selected cell.
- **`J`** or **`Ctrl + ↓`**: Select cell below.
- **`K`** or **`Ctrl + ↑`**: Select cell above.
- **`↑ / ↓`**: Smoothly scroll page up or down.
- **`Ctrl + Shift + ↑ / ↓`**: Move selected cell(s) up or down.
- **`A`**: Insert a new cell **above**.
- **`B`**: Insert a new cell **below**.
- **`D, D`** (press D twice): Delete selected cell(s).
- **`C`**: Copy selected cell.
- **`X`**: Cut selected cell.
- **`V`**: Paste cell below.
- **`Shift + V`**: Paste cell above.
- **`Shift + ↑ / ↓`** or **`Shift + Click`**: Multi-select cells.
- **`Esc`**: Clear multi-selection back to single cell.
- **`Shift + M`**: Merge selected cells.
- **`Z`**: Undo cell operations.
- **`Shift + Z`**: Redo cell operations.
- **`Ctrl + A`**: Select all cells.
- **`G, G`**: Jump to first cell.
- **`[Number] + G, G`** (e.g. `5gg`): Jump to specific cell number.
- **`Shift + G`**: Jump to last cell.

---

## Technical Stack

- **Backend**: Python (FastAPI, Uvicorn, Jinja2, WebSockets)
- **Frontend**: HTML5, Vanilla JavaScript, Tailwind CSS
- **Sanitizer**: DOMPurify (XSS prevention)
- **Markdown Parser**: Marked.js
- **LaTeX Math Renderer**: KaTeX (supports `$` and `$$` syntax)
- **Syntax Highlighting**: Highlight.js
- **Vector Emojis**: Twemoji

---

## Running Automated Tests

Run backend and parser tests using standard Python `unittest`:

```bash
python3 -m unittest discover tests
```

---

## License

MIT License