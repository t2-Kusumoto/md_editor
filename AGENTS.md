# 🤖 Agent Instructions (for Cursor, Claude Code, GitHub Copilot, Antigravity, etc.)

[日本語版エージェント指示書 (Japanese AGENTS.md)](AGENTS_ja.md)

This guideline is designed for AI coding agents modifying or extending this project (`md_editor`).
Always refer to this document before editing to prevent architectural misunderstandings and maintain consistency.

---

## 📁 Project Structure

This application consists of a Python backend (FastAPI) and a Vanilla JavaScript frontend. There is **no frontend build step** (no Webpack, Vite, npm, etc.).

```text
md_edit_and_view_app/
├── md_editor/
│   ├── __init__.py
│   ├── main.py            # FastAPI backend server (REST APIs, routing, file system ops, WebSocket)
│   ├── templates/
│   │   └── index.html     # Main UI HTML; loads Tailwind CSS, FontAwesome, KaTeX, Highlight.js, DOMPurify, Twemoji via CDN
│   └── static/
│       ├── css/
│       │   └── style.css  # Custom CSS styles
│       └── js/
│           └── app.js     # Single Vanilla JS file containing full frontend logic (~7300 lines)
├── tests/
│   ├── __init__.py
│   ├── test_backend.py    # Unit & integration tests for backend security, traversal, and file ops
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
   - The frontend loads dependencies (Tailwind CSS, FontAwesome, KaTeX, Highlight.js, Marked.js, DOMPurify, Twemoji) directly via CDN script tags in `index.html`.
   - **Do not introduce npm, Webpack, Vite, React, or TypeScript** unless explicitly instructed by the user.

2. **Single-File Frontend Architecture (`app.js`)**
   - `app.js` is intentionally structured as a well-documented single file with numbered section headers.
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

## 🛠️ Modification Guidelines

- **UI Components**: To add buttons or modals, place HTML in `index.html`, style with Tailwind classes, and bind events in `app.js` using `document.getElementById()`.
- **Styles**: Favor Tailwind CSS utility classes. Only touch `style.css` for custom animations, complex pseudo-elements, or print styles (`@media print`).
- **Error Handling**: Use `try...catch` blocks for all API `fetch()` calls.
- **Automated Tests**: Whenever adding or modifying backend APIs or parser logic, run `python3 -m unittest discover tests` and ensure all tests pass.

---

## 🎯 Common Extension Points

- **Shortcuts & Keybindings**: Modify `handleGlobalKeydown` or `attachTextareaEvents` in `app.js`.
- **Markdown & Math Rendering**: Modify `renderMarkdownWithMath()` in `app.js`.
- **Backend Endpoints**: Add standard `def` functions with `@app.get`, `@app.post`, or `@app.delete` in `main.py`.
