# Reproduction Log & Prompt History

[日本語版ドキュメント (Japanese Reproduction Log)](reproduction_log_ja.md)

This document is a comprehensive technical log and chronological record of prompts, design decisions, challenges encountered, and architectural solutions for developing and reproducing the Jupyter-like Markdown Notebook Editor & Viewer (`md_editor`).

---

## 1. Development Phases & Prompt Trajectory

### Phase 1: Requirements Definition & Foundational Prototype

#### Step 1: Requirements, Licensing & Viability
- **Requirements**: Jupyter Lab-style cell-based Markdown editor, keyboard shortcut compatibility, `md_editor` command-line launch, left file browser, right split editor, export features.
- **Licensing & Architecture Analysis**:
  - Pure desktop GUI frameworks (like PyQt) introduce GPL licensing constraints.
  - **Selected Architecture**: FastAPI backend + Browser-based Vanilla JS frontend (MIT license, lightweight distribution, clean separation).
  - **Zero Build Step**: To maximize portability and ease of reproduction, no Node.js/npm build pipeline is used. Dependencies (Tailwind, KaTeX, Highlight.js, DOMPurify, Twemoji) are loaded via CDN or local assets.

#### Step 2: Implementation of Initial Web Prototype
- Built `md_editor/main.py` with FastAPI, `templates/index.html`, `static/js/app.js`, and `static/css/style.css`.
- Registered CLI script entry point `md_editor = "md_editor.main:start"` in `pyproject.toml`.

---

### Phase 2: Jupyter Lab Interaction & Cell Editing

#### Step 3: Resolving Cell Split Keybinding Conflict
- Browser default `Ctrl + Shift + -` triggered browser zoom-out.
- Changed shortcut to **`Ctrl + Alt + -`** and bound physical `e.code === 'Minus'` to ensure JIS/ANSI keyboard consistency. Added `Split Cell` to the Edit menu.

#### Step 4: Scroll Bounce Mitigation & Recenter Line
- **Issue**: Auto-resizing `<textarea>` (`autoResizeTextarea`) caused parent containers to jump scroll positions to the bottom during typing.
- **Solution**: Implemented a scroll-lock mechanism capturing container `scrollTop` immediately before height reassignment.
- Added **`Ctrl + Alt + L`** to center the active caret line smoothly in the editor viewport.

#### Step 5: Smooth Viewport Management & Sidebar Toggle
- Added active file browser toggle via `Ctrl + Shift + F` and activity bar icon.
- Optimized multi-cell selection, Vim-style cell jumping (`[number] + G, G`), and cell deletion (`D, D`).

---

### Phase 3: Advanced Cell Features & Quality Improvements

#### Step 6: Native Print PDF Export
- Replaced fragile raster canvas splitting (`html2canvas`) with browser-native printing (`window.print()`) in a hidden iframe.
- Applied `@page { size: A4 portrait; margin: 15mm; }` and CSS `break-inside: avoid` to eliminate orphan headers and split table rows.
- Embedded vector Twemoji SVGs for crisp emoji rendering across Linux, Windows, and macOS print outputs.

#### Step 7: Multi-Session Port Allocation & Graceful Shutdown
- Implemented dynamic port discovery (scanning ports 18000–18050) to allow concurrent sessions in different working directories.
- Attached WebSocket heartbeat endpoint (`/ws`). When all browser tabs are closed, the backend server initiates graceful shutdown automatically.

---

### Phase 4: Security Overhaul, Bug Fixes & Codebase Hardening

Following an in-depth security and architecture audit based on AI evaluation reports (`gemini_say.md`, `grok_say.md`), a comprehensive hardening overhaul was conducted:

#### 1. DOMPurify XSS Elimination
- **Vulnerability**: Unsanitized Markdown output rendered via `marked.parse()` allowed `<script>` and `<img onerror="...">` execution from untrusted Markdown files, risking arbitrary local API invocation (`/api/delete`, `/api/save`).
- **Mitigation**: Integrated DOMPurify (`purify.min.js`) into all rendering pipelines (`renderMarkdownWithMath()`, PDF export, HTML export), with explicit support for KaTeX MathML tags.

#### 2. Attack Surface Reduction (Removal of Base64 Image Fetching)
- **Vulnerability**: `/api/convert-images-base64` fetched external URLs synchronously, creating potential SSRF and memory exhaustion (DoS) risks.
- **Mitigation**: Confirmed that PDF export prints via hidden iframes that load local `/api/raw/...` and external image URLs directly. Completely removed `/api/convert-images-base64` from both backend and frontend.

#### 3. Blocking I/O & Event Loop Freezing Resolution
- Converted synchronous filesystem endpoints in `main.py` (`get_files`, `create_file`, `create_folder`, `save_file`, `load_file`, `delete_item`, `rename_item`, `copy_file_item`) from `async def` to standard **`def`**, allowing FastAPI to execute them in background threadpools.

#### 4. Cross-Platform Path Normalization (POSIX Standard)
- Implemented `to_posix_relpath()` in `main.py` to ensure all relative paths returned to the frontend use forward slashes (`/`), preventing subfolder breakdown on Windows.

#### 5. Code Block & LaTeX Math Parser Hardening
- Quarantined code blocks (````...```` and ``...``) into placeholders prior to formula extraction, preventing environment variables (e.g. `$PATH`, `$HOME`) from misinterpreting as KaTeX expressions.
- Protected `<!-- cell -->` tags inside fenced code blocks from unintended cell splitting.

#### 6. Unsaved Changes Modal Bug Fix
- Bound confirmation dialog actions explicitly to `pendingDoc` to prevent closing background tabs from mutating or saving active foreground documents.

#### 7. Automated Test Suite
- Created `tests/test_backend.py` and `tests/test_parser.py` using Python standard `unittest` to ensure zero regression in path traversal security, encoding fallback, and code-block preservation.

---

## 2. Directory Structure

```text
md_edit_and_view_app/
├── md_editor/
│   ├── __init__.py
│   ├── main.py            # FastAPI backend (REST API, POSIX paths, threadpooled I/O, WebSocket heartbeat)
│   ├── templates/
│   │   └── index.html     # HTML structure with CDN script imports (DOMPurify, KaTeX, Twemoji, Marked, HLJS)
│   └── static/
│       ├── css/
│       │   └── style.css  # Restored markdown elements, cursor highlights, print page-break rules
│       └── js/
│           └── app.js     # Single Vanilla JS file with structured TOC sections (~7300 lines)
├── tests/
│   ├── __init__.py
│   ├── test_backend.py    # Unit tests for security, traversal prevention, and API CRUD
│   └── test_parser.py     # Parser tests for code-block isolation and safe cell splitting
├── pyproject.toml         # Packaging configuration and entry points
├── build.py               # PyInstaller standalone build configuration
├── README.md              # English documentation
├── README_ja.md           # Japanese documentation
├── AGENTS.md              # English agent guidelines
├── AGENTS_ja.md           # Japanese agent guidelines
├── reproduction_log.md    # English development log
└── reproduction_log_ja.md # Japanese development log
```

---

## 3. Step-by-Step Reproduction Guide

To recreate this application from scratch:

1. **Initialize Virtual Environment & Dependencies**:
   - Create a Python virtual environment: `python3 -m venv .venv`
   - Define `pyproject.toml` with `fastapi`, `uvicorn`, `jinja2`, `websockets`.
   - Install in editable mode: `pip install -e .`

2. **Implement Backend Server (`md_editor/main.py`)**:
   - Implement `safe_join_path()` to reject traversal (`../`) and null bytes.
   - Implement `to_posix_relpath()` for POSIX-normalized paths.
   - Define file CRUD routes as synchronous `def` functions.
   - Attach `/ws` endpoint for heartbeat auto-shutdown and port scanner (18000–18050).

3. **Construct UI (`md_editor/templates/index.html`)**:
   - Load Tailwind CSS, FontAwesome, KaTeX, DOMPurify, Marked.js, Highlight.js, Twemoji.
   - Assemble sidebar file browser, ToC outline, menu bars, and multi-pane notebook containers.

4. **Style Custom Elements (`md_editor/static/css/style.css`)**:
   - Restore standard HTML element stylings (h1–h6, lists, tables, blockquotes).
   - Configure `@media print` rules: A4 portrait, margins, and `page-break-inside: avoid`.

5. **Write Core Logic (`md_editor/static/js/app.js`)**:
   - Implement cell models and safe splitter `splitDocumentIntoCells()`.
   - Implement `renderMarkdownWithMath()` with code block isolation and DOMPurify sanitization.
   - Implement multi-pane tab manager and drag-and-drop mechanics.
   - Implement keyboard navigation matching Jupyter Lab and Vim.

6. **Validate with Automated Tests**:
   - Run `python3 -m unittest discover tests` and verify 100% pass rate.
