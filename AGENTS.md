# 🤖 Agent Instructions (for Cursor, Claude Code, GitHub Copilot, Antigravity, etc.)

[日本語版エージェント指示書 (Japanese AGENTS.md)](AGENTS_ja.md)

This guideline is designed for AI coding agents modifying, customizing, or extending this project (`md_editor`).
Always refer to this document before editing to prevent architectural misunderstandings and maintain system consistency.

---

## 🌟 Philosophy: AI-Assisted User Customization

This project is created and designed with the primary philosophy that **users customize and extend features to their own workflow preferences using AI coding agents** (Google Antigravity, Claude Code, Cursor, GitHub Copilot, etc.).

To provide the ideal foundation for AI-assisted development:
1. **Zero Frontend Build Step**: No Node.js, npm, Webpack, or Vite. The frontend runs directly in modern browsers using Vanilla JavaScript, Tailwind CSS, and CDN-loaded libraries.
2. **Transparent Single-File Architecture (`app.js`)**: All frontend logic is contained in a single, well-structured file (~7400 lines) divided into distinct numbered functional sections.
3. **Immediate Feedback**: Edits to JavaScript, HTML, or Python take effect immediately upon refreshing the browser or restarting the server. No compilation or bundle step can fail.
4. **Agent Guidelines**: This document provides the architectural map so any AI agent can safely inspect, modify, and extend the application without breaking core data structures.

---

## 📁 Project Structure

```text
md_edit_and_view_app/
├── md_editor/
│   ├── __init__.py
│   ├── main.py            # FastAPI backend server (REST APIs, routing, file ops, WebSocket, multi-session)
│   ├── templates/
│   │   └── index.html     # Main UI HTML; loads Tailwind CSS, FontAwesome, KaTeX, Highlight.js, DOMPurify, Twemoji via CDN
│   └── static/
│       ├── css/
│       │   └── style.css  # Custom CSS styles (animations, gutters, caret highlights, @media print)
│       └── js/
│           └── app.js     # Single Vanilla JS file containing full frontend logic (~7400 lines)
├── tests/
│   ├── __init__.py
│   ├── test_backend.py    # Unit & integration tests for backend security, traversal, and file ops
│   ├── test_cli_args.py   # Unit tests for CLI args, workspace resolution, and OS launch behaviors
│   └── test_parser.py     # Parser tests for code-block math protection and safe cell splitting
├── pyproject.toml         # Package definition, CLI entry points, and dependencies
├── build.py               # PyInstaller standalone executable build script
├── README.md              # User documentation (English)
├── README_ja.md           # User documentation (Japanese)
├── AGENTS.md              # Agent guidelines (English)
├── AGENTS_ja.md           # Agent guidelines (Japanese)
├── reproduction_log.md    # Development prompt and reproduction history (English)
└── reproduction_log_ja.md # Development prompt and reproduction history (Japanese)
```

---

## 🏗️ Architecture & Core Principles

1. **No Frontend Build Step**
   - Dependencies (Tailwind CSS, FontAwesome, KaTeX, Highlight.js, Marked.js, DOMPurify, Twemoji) are loaded directly via CDN script and link tags in `index.html`.
   - **Do not introduce npm, Webpack, Vite, React, or TypeScript** unless explicitly instructed by the user.

2. **Single-File Frontend Architecture (`app.js`)**
   - `app.js` is intentionally structured as a single file with numbered section headers.
   - **Do not split `app.js` into ES modules or separate files** unless the user explicitly requests module splitting. Keep related functions within their designated section blocks.

3. **Security-First Paradigm**
   - **XSS Protection**: All Markdown output rendered via `marked.parse()` must be passed through `DOMPurify.sanitize()` before insertion into the DOM.
   - **Path Traversal Protection**: All filesystem access in `main.py` must go through `safe_join_path()`. Never use unvalidated user input directly with `os.path.join()`.
   - **Path Separators**: `main.py` must always return relative paths in POSIX format (using forward slashes `/`) via `to_posix_relpath()` to ensure Windows compatibility.
   - **FastAPI Threading**: Synchronous filesystem I/O endpoints must be defined with standard `def` (not `async def`) so FastAPI automatically runs them in worker threadpools without blocking the async event loop.

4. **Jupyter-like Cell Management**
   - Markdown documents are represented as an array of cells (`CellModel`), each with `edit` or `view` mode.
   - Cell separation uses `<!-- cell -->`. The splitter `splitDocumentIntoCells()` safely ignores `<!-- cell -->` tags located inside fenced code blocks.

---

## 🔄 Data Lifecycle & State Management

### 1. In-Memory State Hierarchy (No `localStorage`)
The application operates entirely on an in-memory data model in the frontend:
- **`documents`**: A `Map<string, DocumentModel>` storing all open documents in memory.
  - `DocumentModel`: `{ id, filename, relPath, cells: CellModel[], isModified, activeCellIndex, selectedCellIndices, undoStack, redoStack, ... }`
  - `CellModel`: `{ id, content, mode: 'edit' | 'view', cursorPos }`
- **`panes`**: An array of 3 pane objects managing multi-pane layout:
  - Each pane has `{ id, tabs: [docId], activeTabId, cellsListEl, cellsScrollEl, ... }`.
  - Up to 3 panes can be opened simultaneously (`openPaneCount: 1..3`).
  - Active pane index is tracked by `activePaneIndex`.
- **Important**: **The application does NOT use `localStorage`**. No drafts or cached files are kept in browser storage. All document states exist in memory until explicitly saved to disk via FastAPI.

### 2. Cell Lifecycle & Rendering Flow
Unlike traditional side-by-side Markdown editors, Markdown is **not** parsed or diff-rendered on every keystroke:
1. **Edit Mode (Typing)**:
   - When editing inside a `<textarea>`, the `'input'` event listener immediately syncs `cell.content = textarea.value` and marks `doc.isModified = true`.
   - Line numbers, cursor position, and comment backdrops are updated.
   - **Markdown parsing is intentionally skipped during typing** to keep editor performance instant and smooth.
2. **Transition to View Mode (Rendering)**:
   - Triggered on execution (`Shift + Enter`, `Ctrl + Enter`), cell navigation (`Esc`), or when clicking outside (`exitEditingCell`).
   - The rendering pipeline (`renderMarkdownWithMath`) executes:
     1. Protects inline math (`$...$`) and block math (`$$...$$`) by replacing them with unique placeholders.
     2. Parses Markdown to HTML using `marked.parse()`.
     3. Sanitizes the HTML via `DOMPurify.sanitize()`.
     4. Restores and renders LaTeX math using `katex.renderToString()`.
     5. Applies syntax highlighting via `hljs.highlightElement()`.
     6. Replaces standard unicode emojis with SVGs via `twemoji`.
3. **DOM Update Scope**:
   - Single-cell toggling uses `renderCellAt(index)` to update only the specific cell container DOM, preserving the rest of the document.
   - Full re-render (`renderCells()`) is reserved for structural changes (adding, deleting, moving, or merging cells).

### 3. File Persistence & Serialization
- **Save Flow**:
  - `saveNotebook()` concatenates all cells with delimiter: `doc.cells.map(c => c.content).join('\n<!-- cell -->\n')`.
  - Dispatches HTTP POST `/api/save-file` with `{ path, content }`.
  - FastAPI writes to the local filesystem and returns `{ success: true, mtime }`.
  - On success, `markModified(false, doc)` clears the dirty state and updates tab UI.
- **Load Flow**:
  - Dispatches HTTP GET `/api/file-content?path=...`.
  - The raw string is parsed into cells using `splitDocumentIntoCells()`. Any `<!-- cell -->` comment occurring inside fenced code blocks (```) is preserved as code content and not split.
- **Dirty State Protection**:
  - `doc.isModified` is checked whenever closing a tab, closing a pane, or quitting the application.
  - If modified, the custom confirmation modal (`#unsaved-modal`) warns the user before discarding or saving changes.

### 4. Scroll & Viewport Navigation (No Split-Pane Sync)
- **Panes are Independent Workspaces**:
  - The up to 3 split panes display independent tabs or files.
  - **There is NO scroll synchronization between panes**, nor is there an "editor pane vs preview pane" scroll sync.
- **Cell Viewport Rules**:
  - Selecting a cell calls `scrollIntoView({ behavior: 'smooth', block: 'nearest' })`.
  - Textarea caret navigation uses `scrollStartLineIntoViewIfNeeded` and `scrollEndLineIntoViewIfNeeded` to prevent the cursor from moving out of the visible screen.
  - `Ctrl + Alt + L` recenters the active line or cell relative to the top header line.

---

## 🗺️ Functional Sections in `app.js`

To navigate and modify `app.js` efficiently, refer to the primary functional areas:

| Lines (Approx.) | Section Title | Description |
| :--- | :--- | :--- |
| `22 – 386` | **01. Global State & DOM** | Global variables (`documents`, `panes`, `activePaneIndex`), DOM elements, initial event bindings |
| `387 – 720` | **02. Data Models & Factories** | `createCellModel`, `createDocumentModel`, `splitDocumentIntoCells` |
| `721 – 1528` | **UI & Pane Management** | `renderTabs`, `updatePaneVisibility`, `renderPane`, `setActivePane`, dummy bottom cells |
| `1529 – 2053` | **Cell Rendering & Modes** | `renderCells`, `renderCellAt`, `editCell`, `exitEditingCell`, `setDocGlobalMode` |
| `2054 – 2164` | **Markdown & Math Engine** | `renderMarkdownWithMath` (LaTeX protection, Marked.js, DOMPurify, KaTeX, Highlight.js, Twemoji) |
| `2165 – 2695` | **Cell Operations & History** | Cell selection, insert (A/B), delete (DD), copy/cut/paste, split (`Ctrl+Alt+-`), merge (`Shift+M`), Undo/Redo |
| `2696 – 3950` | **Gutter & Scroll Helpers** | Line numbers, block cursor highlight, `scrollStartLineIntoViewIfNeeded`, recentering |
| `3951 – 4997` | **File & Workspace Ops** | `openFileByPath`, `saveNotebook`, `saveNotebookAs`, clean Markdown / HTML / PDF export |
| `4998 – 5430` | **Split Panes & Drag-Drop** | Pane dividers resize, tab drag events, pane drop overlays, split-on-drop |
| `5431 – 5550` | **Modals & Dialogs** | Custom confirmation modal (`showConfirmDialog`), unsaved changes modal (`checkUnsavedChangesForDoc`) |
| `5551 – 6810` | **Keybindings & Routing** | Global keydown handler (`handleGlobalKeydown`), Command mode vs Edit mode routing, Vim shortcuts |
| `6811 – 7077` | **Sidebars & ToC** | 3-state collapsible sidebar (File Browser / ToC / Closed), heading parser, jump to heading |
| `7078 – 7450` | **Textarea Events & WebSocket**| `attachTextareaEvents`, auto-resize, comment backdrop, WebSocket keepalive and shutdown |

---

## 🛠️ Modification Guidelines

- **UI Components**: Place HTML in `index.html`, style with Tailwind classes, and bind events in `app.js` using `document.getElementById()`.
- **Modals & Prompts**: Always use the custom modal `showConfirmDialog({ title, message, confirmText, cancelText, isDanger })` instead of native `window.confirm()` or `window.prompt()` to ensure localized, clean English UI across all platforms.
- **Styles**: Favor Tailwind CSS utility classes. Only touch `style.css` for custom animations, complex pseudo-elements, or print styles (`@media print`).
- **Error Handling**: Use `try...catch` blocks for all API `fetch()` calls.
- **Automated Tests**: Whenever adding or modifying backend APIs or parser logic, run `python3 -m unittest discover tests` and ensure all tests pass.

---

## 🎯 Common Extension Points

- **Shortcuts & Keybindings**: Modify `handleGlobalKeydown` or `attachTextareaEvents` in `app.js`.
- **Markdown & Math Rendering**: Modify `renderMarkdownWithMath()` in `app.js`.
- **Cell Actions & Toolbar**: Modify `createCellToolbar` or cell action functions in `app.js`.
- **Backend Endpoints**: Add standard `def` functions with `@app.get`, `@app.post`, or `@app.delete` in `main.py`.
- **CLI & Launch Arguments**: Modify `parse_args_and_setup_workspace()` in `main.py`.
