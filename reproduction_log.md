# Reproduction Log & Prompt History

[日本語版ドキュメント (Japanese Reproduction Log)](reproduction_log_ja.md)

This document is a comprehensive technical log and chronological record of prompts, design decisions, challenges encountered, and architectural solutions, designed so that other developers and AI coding agents can systematically reproduce and reconstruct the Jupyter-like Markdown Notebook Editor & Viewer (`md_editor`) from scratch in their own Google Antigravity environment.

---

## 1. Development Phases & Prompt Trajectory

### Phase 1: Requirements Definition & Foundational Prototype

#### Step 1: Requirements, Licensing & Architecture Feasibility
**[User Prompt]**
> I would like to create a "markdown editor and viewer" in Google Antigravity based on the following requirements:  
> (A cell-based Markdown editor like Jupyter Lab, keyboard shortcut compatibility, launched via `md_editor` command, file browser on the left, editor on the right, export capabilities, etc.)  
> First, is this feasible? Also, are there any licensing issues when distributing the application?

**[AI Proposal & Technical Decisions]**
- **Feasibility**: Fully feasible.
- **Licensing Strategy**:
  - Desktop GUI frameworks like PyQt primarily use the GPL license, which enforces source code disclosure.
  - To avoid this, an architecture combining a **FastAPI local web server + browser frontend (HTML/JS/CSS)** was selected. This allows distribution under the permissive MIT license while keeping the package lightweight.
- **Reproducibility**: To ensure seamless reproduction by others without Node.js or npm dependencies, a **zero-build frontend (Vanilla JS + CDN-loaded libraries)** was adopted.

#### Step 2: Implementation of Initial Web Prototype
**[User Prompt]**
> 1. Let's proceed with the web server approach (Plan A).  
> 2. I will not specify Python version or CSS frameworks; please select the optimal ones.  
> Additionally, I'd like this to be cross-platform compatible in the future. Is that possible?

**[AI Response & Implementation]**
- Established a foundation using FastAPI + Uvicorn + Vanilla JS + Tailwind CSS (via CDN).
- Created `md_editor/main.py`, `templates/index.html`, `static/js/app.js`, `static/css/style.css`, and `pyproject.toml`.

---

### Phase 2: Jupyter Lab Interaction & Cell Editing

#### Step 3: Resolving Cell Split Keybinding Conflict
**[User Prompt]**
> The `Ctrl` + `Shift` + `-` shortcut triggers browser zoom-out instead of splitting cells. Please fix this.  
> Also, please register `Split Cell` under the `Edit` menu bar item.

**[AI Response & Solution]**
- Changed the keybinding to **`Ctrl + Alt + -`** to prevent collisions with native browser zoom shortcuts.
- Added `Split Cell` to the `Edit` dropdown menu.
- Switched key detection to physical key codes (`e.code === 'Minus'`) to eliminate keycode mismatches on Japanese JIS keyboards and numeric keypads.

#### Step 4: Scroll Bounce Mitigation & Recenter Line
**[User Prompt]**
> Fix request for Edit mode behavior:  
> When a cell contains many lines, typing or pressing `Enter`/`Backspace` causes the editor viewport to abruptly scroll all the way to the bottom.  
> Also, in Edit mode, I'd like a shortcut (`Ctrl + L`) to center the active caret line on the screen.

**[AI Response & Solution]**
- **Scroll Bounce Fix**: Auto-expanding the `<textarea>` (`autoResizeTextarea`) caused browser layout recalculations that reset container scroll positions. Implemented a scroll-lock guard capturing `scrollTop` immediately prior to height reassignment and restoring it instantly.
- **Recenter Line**: Overriding the browser URL bar shortcut (`Ctrl + L`) is unreliable across browsers, so **`Ctrl + Alt + L`** was adopted. Calculated the caret's Y coordinate to smoothly center the active line relative to the header.

#### Step 5: Smooth Viewport Management on Cell Insertion
**[User Prompt]**
> In Command mode, when selecting a cell near the center of the screen and inserting a new cell directly below it, the viewport scrolls so that the new cell appears at the very bottom. Please fix this.

**[AI Response & Solution]**
- Modified the cell insertion/selection logic in `scrollIntoView` to check whether the newly inserted cell is already within the visible viewport, scrolling minimally only when outside visible boundaries.

#### Step 6: UI, Layout, & Menu Enhancements
**[User Prompt]**
> - Widen the spacing between status, mode badge, and directory path elements in the top-right header so they don't overlap.  
> - Allow toggling the left `FILE BROWSER` via `Ctrl + Shift + F` and by clicking a folder icon in a left activity bar.  
> - When hovering over the `File`, `Edit`, or `Help` menu dropdowns, moving the cursor toward items causes the menu to close prematurely. Please fix this.

**[AI Response & Solution]**
- Optimized top-right header spacing using Tailwind's `space-x-4`.
- Created an activity bar on the far left, implementing toggling via `Ctrl + Shift + F` and icon clicks.
- Adjusted dropdown positioning using `top-full` to eliminate margin gaps, preventing mouseleave events during hover navigation.

---

### Phase 3: Advanced Cell Operations & Utilities

#### Step 7: Floating Cell Toolbar
**[User Prompt]**
> Display action icons at the top-right of each cell to move cells up/down (`Ctrl + Shift + ↑/↓`), insert cells above/below (`a`/`b`), and delete cells (`d, d`) via mouse clicks.

**[AI Response & Solution]**
- Added floating cell toolbar components that fade in on hover, delegating click events directly to the corresponding keyboard action functions.

#### Step 8: Vim-Style Cell Navigation & Emoji Shortcodes
**[User Prompt]**
> - In Command mode, allow jumping to the first cell via `g, g` and to the last cell via `Shift + g` (Vim keybindings).  
> - Allow entering emojis via shortcodes like `:smile:`. Please verify that this won't break existing features.

**[AI Verification & Implementation]**
- Implemented sequence timer tracking (400ms threshold) for clean `gg` and `Shift + G` navigation without shortcut conflicts.
- Real-time emoji replacement during typing would disrupt caret positions and undo stacks, so an **on-demand rendering approach** was selected: shortcodes are parsed and converted during Markdown rendering.

#### Step 9: Automatic Commit on Focus Loss (Blur Commit)
**[User Prompt]**
> When clicking outside an Edit-mode cell (such as blank margin space), the cursor disappears and keyboard shortcuts stop responding. Please make the cell automatically switch to Command mode (rendered Markdown) whenever focus leaves the cell.

**[AI Response & Solution]**
- Listened for the textarea `blur` event with a brief 150ms debounce grace period to verify that focus did not move to another input element, automatically committing content to View mode.

---

### Phase 4: Multi-Pane Workspace & Tab Drag-and-Drop

#### Step 10: Vertical Editor Splitting (Up to 3 Panes) & Tab Reordering
**[User Prompt]**
> - Highlight the active pane header with a blue border.  
> - Allow reordering tabs by dragging them with the mouse, similar to browser tabs.  
> - Allow switching between panes using Arrow Left/Right (or `h`/`l`), and switching tabs via `Ctrl + Shift + ←/→`.  
> - Enable vertical editor splitting (up to 3 panes) via `Ctrl + \`.

**[AI Response & Solution]**
- Designed a multi-pane layout (up to 3 panes) with independent tab stacks (`panes = [{tabs, activeTabId}, ...]`).
- Implemented HTML5 Drag and Drop API handlers for tab reordering and cross-pane tab transfers.
- Added visual split-drop overlays highlighting half the pane in blue when dragging near edges.

#### Step 11: Pane Merge & Stateful Editing Continuity
**[User Prompt]**
> When multiple panes are open and `Ctrl + Alt + m` is pressed, merge the current pane into the pane to its left. Automatically close panes when all tabs are moved out, and preserve caret positions and unsaved text when switching tabs.

**[AI Response & Solution]**
- Implemented `mergePaneLeft`, transferring all tabs to the left-adjacent pane and collapsing vacated pane slots.
- Built `syncDocEditingState` to capture and restore caret positions, scroll positions, and unsaved cell contents during tab and pane transitions.

---

### Phase 5: Advanced Editor Optics & In-Cell Manipulation

#### Step 12: Block Cursor & Current Line Highlighting
**[User Prompt]**
> In Edit mode, make the cursor a solid block and give the active line a subtle background highlight so it is easy to track.

**[AI Response & Solution]**
- Positioned a synchronized backdrop container (`comment-backdrop` / `cursor-highlight-layer`) behind the `<textarea>`.
- Dynamically calculated caret coordinates to render a full-width line highlight band (`rgba(33, 150, 243, 0.08)`) and block cursor.

#### Step 13: TODO / NOTE Comment Highlighting & Scrollbar Markers
**[User Prompt]**
> When comments contain `TODO:` or `NOTE:`:  
> - Edit mode: highlight text in yellow.  
> - Command mode: highlight the cell number badge in yellow.  
> - Both modes: display thin yellow indicator lines in the scrollbar area like search markers.

**[AI Response & Solution]**
- Projected regex-matched highlight tags onto the backdrop layer.
- Scanned document heights to dynamically position mini-map scroll markers (`scrollbar-marker-line`) along the right container margin.

#### Step 14: Line Operations & Undo/Redo Integration
**[User Prompt]**
> - Delete lines: `Ctrl + Shift + K`  
> - Move lines: `Ctrl + Shift + ↑ / ↓`  
> - Duplicate lines: `Ctrl + Shift + D`  
> - Bold / Italic formatting: `Ctrl + B` (`**...**`), `Ctrl + I` (`*...*`)  
> Ensure full Undo/Redo support for all operations.

**[AI Response & Solution]**
- Calculated logical line boundaries from `selectionStart`/`selectionEnd` for string splicing.
- Pushed atomic state snapshots (`serializeDocState`) to undo/redo history stacks before every mutation.

---

### Phase 6: Hierarchical Directory & File Management

#### Step 15: Subdirectory Breadcrumbs & Relative Image Resolution
**[User Prompt]**
> Enhance the FILE BROWSER with subfolder browsing, double-click navigation, breadcrumbs for ascending folders, folder creation, and renaming/deleting. Support relative image paths like `![img](./sample.png)`.

**[AI Response & Solution]**
- Added `path` query parameters to backend `/api/files` for arbitrary folder traversal.
- Maintained `currentBrowsePath` in frontend state linked to a Breadcrumbs UI component.
- Added `/api/raw-file?path=...` endpoint to resolve relative image paths relative to the active notebook's directory.

---

### Phase 7: Export Capabilities

#### Step 16: Clean Markdown & Standalone HTML Export
**[User Prompt]**
> Under `File -> Export Notebook`, add clean Markdown export (stripping `<!-- cell -->` comments) and standalone single-file HTML export with embedded styles, KaTeX math, and code highlighting.

**[AI Response & Solution]**
- Implemented `exportMarkdown` and `exportHtml`.
- Leveraged modern File System Access API (`window.showSaveFilePicker`), falling back to standard `<a>` downloads in unsupported browsers.

#### Step 17: High-Fidelity Browser-Print PDF Export with Twemoji
**[User Prompt]**
> Early PDF export (html2canvas / jsPDF) cuts characters in half at page boundaries. I want clean PDF output like Chrome print (`Ctrl + P`). Also fix missing emojis in Linux print outputs.

**[AI Technical Solution & Overhaul]**
- **Browser-Native Printing (`window.print`)**: Dynamically created hidden `<iframe>` containers formatted with A4 print CSS, triggering `iframe.contentWindow.print()`. Removed raster canvas libraries, eliminating text splitting glitches.
- **Twemoji Vector Embedding**: Replaced Unicode emojis with Twitter Twemoji SVGs, preventing emoji omissions in Linux Chrome PDF rendering.

---

### Phase 8: Table of Contents & 3-State Sidebar

#### Step 18: Heading Outline Tree & Mutually Exclusive Sidebar
**[User Prompt]**
> Add a Table of Contents (ToC) outline in the left sidebar extracting Markdown headings (`#`, `##`, `###`), clicking items should jump to cells. The sidebar should switch exclusively between "FILE BROWSER", "ToC", and "Closed".

**[AI Response & Solution]**
- Scanned document cells for heading levels (H1–H3) excluding code blocks, generating an indented interactive tree.
- Implemented a 3-state state machine (`setSidebarView('file-browser' | 'toc' | null)`).

---

### Phase 9: Graceful Shutdown & Multi-Session Dynamic Ports

#### Step 19: Safe Application Shutdown (Quit Button, WebSocket Disconnect, Windows Code 0)
**[User Prompt]**
> - Add a `Quit` button (and `Ctrl + Shift + Q`) in the menu bar to safely stop the server.  
> - Automatically shut down the server when all browser tabs are closed.  
> - Prevent error codes (exit code 2) in Windows terminals on shutdown.

**[AI Response & Solution]**
- Added WebSocket heartbeat endpoint `/ws` to detect client disconnections and trigger shutdown timers.
- Used Uvicorn's standard shutdown mechanism (`server_instance.should_exit = True`) to guarantee clean exit code 0 on both Windows and Linux.

#### Step 20: Concurrent Multi-Session Port Allocation & Deduplication
**[User Prompt]**
> When launching `md_editor` from different terminal directories, avoid port 18000 collisions. If launched from the same directory, focus the existing session; if launched from a different directory, assign the next free port (18000–18050).

**[AI Response & Solution]**
- Implemented a two-phase port scan:
  1. Scan ports 18000–18050 to detect whether a session is already running for the current directory (suppressing duplicate processes).
  2. If no matching session exists, bind to the lowest available port and launch an independent server instance.

---

### Phase 10: Security Overhaul & Codebase Hardening

#### Step 21: DOMPurify XSS Elimination & Removal of SSRF Base64 Proxy
**[User Prompt / Audit Report]**
> Based on AI security audit reports (`gemini_say.md`, `grok_say.md`), eliminate XSS vulnerabilities in Markdown rendering and remove SSRF/DoS risks associated with the Base64 image proxy.

**[AI Response & Solution]**
- Applied `DOMPurify.sanitize()` to all `marked.parse()` outputs, whitelisting KaTeX MathML tags.
- Removed `/api/convert-images-base64` entirely, standardizing PDF printing on direct local proxy URLs.

#### Step 22: Threadpool Worker Execution, POSIX Paths, & Math Protection
**[AI Response & Solution]**
- Converted filesystem I/O endpoints from `async def` to standard `def`, running them in FastAPI worker threadpools to prevent event loop blocking.
- Implemented `to_posix_relpath()` to guarantee forward-slash (`/`) paths on Windows.
- Quarantined code blocks (````...````) prior to formula extraction, preventing environment variables (`$PATH`, `$HOME`) from triggering false-positive KaTeX math rendering. Protected `<!-- cell -->` comments inside code blocks from splitting.

#### Step 23: Automated Backend & Parser Test Suite
**[AI Response & Solution]**
- Built automated tests with Python's standard `unittest` (`tests/test_backend.py`, `tests/test_parser.py`) verifying traversal prevention, encoding fallback, and cell splitting safety.

---

### Phase 11: CLI Arguments & OS Desktop Association

#### Step 24: Direct File Launching via Command-Line Argument
**[User Prompt]**
> When launched as `md-editor some_file.md`, if the file has a `.md` extension and exists, open the app directly with that file active. Output error messages to stderr and exit with code 1 upon errors.

**[AI Response & Solution]**
- Implemented `parse_args_and_setup_workspace()`. Validated `.md` extension, existence, directory rejections, and single-file constraints, exiting with code 1 upon error.

#### Step 25: Desktop Environment Association & Automatic Workspace Resolution
**[User Prompt]**
> Fix an issue in Ubuntu GNOME where double-clicking or selecting "Open with" sets the workspace directory to `$HOME` instead of the file's parent folder.

**[AI Response & Solution]**
- Set the workspace directory (`BASE_DIR`) directly to the target file's parent directory (`os.path.dirname(os.path.abspath(raw_path))`) regardless of invocation CWD, synchronizing internal directory via `os.chdir(BASE_DIR)`.
- Passed initial file target via `data-initial-file` attribute and `?open={file}` URL parameter.
- Added GNOME Nautilus double-click simulation tests to `tests/test_cli_args.py`.

---

### Phase 12: Cross-Platform Build Hardening

#### Step 26: Ubuntu 26 / Python 3.14 Support & PEP 668 Fallbacks
**[User Prompt]**
> Running `build.py` on Ubuntu 26 (Python 3.14) produces errors and fails to build the standalone binary. Investigate and fix the issue.

**[AI Response & Solution]**
- Added automated `pyinstaller>=6.10.0` detection in `build.py` to handle standard library removals in Python 3.14.
- Added `--break-system-packages` fallbacks for PEP 668 managed environments.
- Added `multiprocessing.freeze_support()` at the application entry point.

#### Step 27: Standard setup.py Placement & UNKNOWN.egg-info Prevention
**[AI Response & Solution]**
- Added a standard minimal `setup.py` (`from setuptools import setup; setup()`) ensuring compatibility with legacy setuptools versions that cannot parse PEP 621 `pyproject.toml` directly.

---

### Phase 13: Keyboard Shortcut Audit & Documentation

#### Step 28: In-Cell Navigation/Replace Shortcuts & Help Modal Overhaul
**[User Prompt]**
> Audit all implemented shortcuts and synchronize them across READMEs and the Help menu modal. Change the modal title from `Jupyter Lab Keyboard Shortcuts` to `Keyboard Shortcuts`.

**[AI Response & Solution]**
- Expanded the Help modal width to `max-w-xl` and updated the header to `Keyboard Shortcuts`.
- Documented in-cell replace (`Ctrl + H`), go to line (`Ctrl + G`), line move/duplicate/delete, pane merge (`Ctrl + Alt + M`), and file browser clipboard actions (`Ctrl + C/X/V`), synchronizing with `README.md` and `README_ja.md`.

---

### Phase 14: UI Language Unification & Custom Modal System

#### Step 29: Elimination of Native Browser Confirm & English Cancel Guarantee
**[User Prompt]**
> When clicking `Quit`, the cancel button displays in Japanese as "キャンセル". Change this to `Cancel`, and ensure all UI text across the app is unified in English.

**[AI Response & Solution]**
- Native `window.confirm()` automatically localizes button labels according to the OS/browser language. Replaced all native dialogs with a Tailwind CSS custom modal `#confirm-modal` (`showConfirmDialog`).
- Guaranteed English button labels (`Quit`, `Delete`, `Cancel`) across quit, file deletion, folder deletion, download, and overwrite prompts.
- Unified drag overlay badges (`Drop to move tab`, `Drop to split pane`), Help modal descriptions, and `<html lang="en">` into clean English.

---

### Phase 15: AI-Assisted Customization Philosophy & Data Lifecycle

#### Step 30: Transparent Buildless Architecture for AI Customization
**[User Prompt]**
> Explicitly state that this application was created with Google Antigravity and designed with the philosophy that users customize it to their preferences using AI coding agents.

**[AI Response & Solution]**
- Articulated the project's core philosophy in `README.md`, `README_ja.md`, `AGENTS.md`, and `AGENTS_ja.md`: prioritizing zero frontend build steps, a transparent single-file structure (`app.js`), and immediate feedback for AI coding assistants.

#### Step 31: Data Lifecycle, In-Memory State, & app.js Roadmap Definition
**[User Prompt]**
> Clarify data flow and state management (input-to-rendering flow, synchronization, persistence) in AGENTS.md.

**[AI Technical Solution & Documentation]**
- Defined on-demand cell rendering (memory-only update on input, single-cell DOM replacement via `renderCellAt` upon View mode transition).
- Explicitly documented the zero-`localStorage` in-memory state hierarchy (`documents`, `panes`, `CellModel`) and FastAPI REST synchronization.
- Provided a complete 13-section roadmap table of `app.js` (~7400 lines) with line ranges and functional responsibilities.

---

### Phase 16: Clean Distribution Repository & URL Standardization

#### Step 32: Pure Source Distribution in md_editor_app & Exclusion of Binary
**[User Prompt]**
> Remove `dist/md-editor` from the distribution directory `md_editor_app`, and do not run `build.py` inside that directory in future updates.

**[AI Response & Solution]**
- Removed `md_editor_app/dist`, establishing `md_editor_app` strictly as a clean source repository. Documented the operational rule.

#### Step 33: Standardization of Official GitHub Repository URLs
**[User Prompt]**
> Replace placeholder repository URLs in READMEs with `https://github.com/t2-Kusumoto/md_editor.git`.

**[AI Response & Solution]**
- Updated all git clone, pipx, uv, and `pyproject.toml` URLs to the official repository path, updating post-clone navigation instructions to `cd md_editor`.

---

## 2. Architecture & Design Essentials

1. **CLI Entry Points & Packaging (`pyproject.toml`)**:
   - Registered `md_editor = "md_editor.main:start"` and `md-editor = "md_editor.main:start"`.
   - Installable via `pip install -e .` or `pipx install .`, launching in any directory via terminal command.

2. **Path Traversal Prevention & POSIX Path Normalization (`md_editor/main.py`)**:
   - All filesystem paths are validated with `safe_join_path()`, strictly blocking path traversal attempts (`../`) and null bytes.
   - `to_posix_relpath()` ensures all relative paths returned to the frontend use forward slashes (`/`), maintaining Windows compatibility.

3. **FastAPI Threadpool Worker Execution**:
   - Synchronous filesystem I/O endpoints are defined with standard `def` (not `async def`), allowing FastAPI to automatically offload them to worker threadpools without freezing the async event loop.

4. **Dynamic Port Discovery & Multi-Session Concurrency**:
   - Scans ports 18000–18050 using a two-phase check: detects existing matching directory sessions to prevent duplication, and assigns the lowest available port for independent concurrent directory workspaces.

5. **WebSocket Heartbeat & Graceful Shutdown**:
   - Monitors active UI tabs via `/ws`. Tab closures or `Quit` triggers invoke `server_instance.should_exit = True`, terminating cleanly with exit code 0 on both Windows and Linux.

6. **In-Memory State Hierarchy & Zero `localStorage` Policy**:
   - Frontend state exists strictly in JavaScript memory (`documents`, `panes`, `CellModel`). No cached drafts or local storage sync conflicts exist.

7. **On-Demand Cell Lifecycle & Single-Cell DOM Replacement**:
   - Text editing performs lightweight memory updates without real-time parsing.
   - View mode transitions trigger `renderMarkdownWithMath()`, and `renderCellAt(index)` updates only the affected cell's DOM node.

8. **Safe Markdown Splitting & Code-Block Math Quarantine**:
   - Cells are serialized using `<!-- cell -->` delimiters.
   - Fenced code blocks (```` ``` ````) protect internal formulas and delimiter comments from premature parsing.

9. **Multi-Pane Workspace with Drag-and-Drop**:
   - Supports up to 3 independent editor panes without scroll synchronization. Drag-and-drop handles tab transfers and split layouts.

10. **Browser-Print High-Fidelity PDF Engine with Twemoji Vectors**:
    - Generates crisp PDFs via hidden `<iframe>` containers and `window.print()`, eliminating canvas text splitting bugs. Twemoji SVGs guarantee full-color vector emoji printing on Linux and Windows.

---

## 3. Pitfalls & Solutions

A reference table of real-world pitfalls encountered and resolved during development:

| Issue / Symptom | Root Cause | Solution |
| :--- | :--- | :--- |
| **Browser zoom triggers on cell split** | `Ctrl + Shift + -` collides with native browser zoom-out shortcut. | Replaced with `Ctrl + Alt + -` and bound physical `e.code === 'Minus'`. |
| **PDF export slices text characters in half** | Raster slicing limitations in canvas pagination libraries (`html2canvas`). | Replaced canvas export with hidden `<iframe>` + native `window.print()`. |
| **Emojis missing in Linux PDF export** | Skia PDF engine in Linux Chrome drops color bitmap font glyphs. | Converted emojis to Twemoji SVG vector images prior to rendering. |
| **Subdirectory files with identical names collide** | Using basename (`untitled.md`) as unique dictionary key. | Changed keying to fully unique relative paths (`dirPath + filename`). |
| **Port collisions across multiple directories** | Hardcoded port 18000 prevented concurrent directory execution. | Implemented dynamic port discovery scanning ports 18000–18050. |
| **Server shutdown returns code 2 on Windows** | `os.kill(SIGINT)` invokes `TerminateProcess` on Windows. | Switched to Uvicorn's `server.should_exit = True` ensuring exit code 0. |
| **Textarea typing bounces scroll to bottom** | Layout recalculations during `autoResizeTextarea` reset scroll offsets. | Added scroll guards capturing and restoring `scrollTop` around resizing. |
| **XSS vulnerability in cell rendering** | Raw `marked.parse()` output inserted directly into DOM innerHTML. | Passed all rendered HTML through `DOMPurify.sanitize()` with MathML tags. |
| **SSRF / DoS risk in Base64 image proxy** | Synchronous server fetches of remote image URLs. | Removed `/api/convert-images-base64`, standardizing on direct local URLs. |
| **Filesystem I/O freezes async event loop** | Running blocking synchronous file reads inside `async def` endpoints. | Converted routes to standard `def` to run in FastAPI worker threadpools. |
| **Broken subdirectory paths on Windows** | `os.path.relpath` returns backslashes (`\`), breaking web URL paths. | Implemented `to_posix_relpath()` normalizing all paths to forward slashes. |
| **Environment variables parsed as math** | Inline math regex extracted `$PATH` and `$HOME` inside code blocks. | Quarantined code blocks into placeholders prior to math extraction. |
| **PyInstaller build failure on Python 3.14** | Standard library removals and PEP 668 managed environments. | Added `pyinstaller>=6.10.0` checks, `--break-system-packages`, and `freeze_support()`. |
| **Ubuntu double-click launches in `$HOME`** | GNOME Nautilus launches `.desktop` applications with CWD as `$HOME`. | Resolved `BASE_DIR` from target file's parent directory and synced with `os.chdir()`. |
| **Legacy setuptools generates `UNKNOWN.egg-info`** | Setuptools < 61.0.0 cannot parse PEP 621 `pyproject.toml` directly. | Added minimal standard `setup.py` (`setup()`) for backward compatibility. |
| **Confirmation dialog displays localized Japanese** | Native `window.confirm()` uses browser/OS locale ("キャンセル"). | Built custom Tailwind modal `#confirm-modal` (`showConfirmDialog`). |

---

## 4. Step-by-Step Reproduction Guide

To reconstruct this application from scratch:

```text
md_edit_and_view_app/
├── md_editor/
│   ├── __init__.py
│   ├── main.py            # FastAPI backend (REST API, dynamic ports, WebSocket, file operations)
│   ├── templates/
│   │   └── index.html     # HTML structure with CDN script imports (DOMPurify, KaTeX, Twemoji, Marked, HLJS)
│   └── static/
│       ├── css/
│       │   └── style.css  # Restored markdown elements, cursor highlights, print page-break rules
│       └── js/
│           └── app.js     # Single Vanilla JS file with structured sections (~7400 lines)
├── tests/
│   ├── __init__.py
│   ├── test_backend.py    # Unit tests for security, traversal prevention, and API CRUD
│   ├── test_cli_args.py   # Unit tests for CLI arguments and workspace resolution
│   └── test_parser.py     # Parser tests for code-block isolation and safe cell splitting
├── pyproject.toml         # Packaging configuration and entry points
├── setup.py               # Minimal setup script for legacy setuptools compatibility
├── build.py               # PyInstaller standalone executable build script
├── AGENTS.md              # English agent guidelines
├── AGENTS_ja.md           # Japanese agent guidelines
├── README.md              # English documentation
└── README_ja.md           # Japanese documentation
```

1. **Environment Setup & Dependencies (`pyproject.toml`, `setup.py`)**:
   - Create a virtual environment: `python3 -m venv .venv && source .venv/bin/activate`
   - Configure `pyproject.toml` with `fastapi`, `uvicorn`, `jinja2`, `websockets`.
   - Register scripts: `md_editor = "md_editor.main:start"` and `md-editor = "md_editor.main:start"`.
   - Add minimal `setup.py`: `from setuptools import setup; setup()`.

2. **Implement Backend Server (`md_editor/main.py`)**:
   - Add `multiprocessing.freeze_support()` at the entry point.
   - Implement `parse_args_and_setup_workspace()` for argument validation and workspace resolution.
   - Implement `safe_join_path()` for traversal prevention and `to_posix_relpath()` for POSIX normalization.
   - Define file CRUD routes as synchronous `def` functions for worker threadpools.
   - Implement dynamic port scanning (18000–18050) and WebSocket `/ws` auto-shutdown.

3. **Construct UI (`md_editor/templates/index.html`)**:
   - Set `<html lang="en">`.
   - Load Tailwind CSS, FontAwesome, KaTeX, Marked.js, Highlight.js, Twemoji, DOMPurify via CDN.
   - Assemble activity bar, sidebars (File Browser / ToC), menu bar, multi-pane container, and modals (`#confirm-modal`, `#unsaved-modal`, `#shortcuts-modal`).

4. **Style Custom Elements (`md_editor/static/css/style.css`)**:
   - Restore Tailwind-reset Markdown styling (h1–h6, tables, lists, blockquotes).
   - Define block cursor, line highlight, TODO/NOTE comments, and scrollbar mini-map markers.
   - Configure `@media print` rules: A4 portrait, margins, and `break-inside: avoid`.

5. **Write Core Frontend Logic (`md_editor/static/js/app.js`)**:
   - Initialize in-memory state hierarchy (`documents`, `panes`, `CellModel`).
   - Implement safe cell splitter `splitDocumentIntoCells()` and join-saving logic.
   - Build `renderMarkdownWithMath()` with placeholder math protection, `marked.parse`, `DOMPurify`, KaTeX, and Twemoji.
   - Implement multi-pane splitting (up to 3 panes), tab drag-and-drop, and pane merging.
   - Implement heading extraction for ToC and the 3-state sidebar switch.
   - Implement `showConfirmDialog()` custom modal to eliminate native confirm.
   - Add clean Markdown, HTML, and browser-print PDF export.
   - Bind keyboard navigation matching Jupyter Lab and Vim (`handleGlobalKeydown`).

6. **Implement Automated Test Suite (`tests/`)**:
   - `test_backend.py`: Traversal rejection, file CRUD, encoding detection.
   - `test_cli_args.py`: `.md` validation, missing file errors, workspace auto-resolution, GNOME Nautilus double-click simulation.
   - `test_parser.py`: Math isolation, code-block delimiter protection.

7. **Implement Standalone Builder (`build.py`)**:
   - Configure PyInstaller single-executable generation.
   - Add automated package updates, PEP 668 `--break-system-packages` fallback, and Python 3.14 compatibility checks.

8. **Validate Execution & Quality Assurance**:
   - Run `python3 -m unittest discover tests` and verify 100% pass rate.
   - Test CLI launching (`md-editor`, `md-editor file.md`), concurrent multi-session execution, ToC navigation, PDF export, and graceful quit.
