"""
Markdown Editor & Viewer - Backend Application (FastAPI)
"""

# ==============================================================================
# 01. IMPORTS & CONFIGURATION
# ==============================================================================
import os
import sys
import mimetypes
import urllib.parse
import webbrowser
import shutil
import socket
import json
import signal
import threading
import time
import asyncio
import multiprocessing
from contextlib import asynccontextmanager


from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import uvicorn

# Record the directory from which the application was started
BASE_DIR = os.getcwd()
CURRENT_PORT = 18000
INITIAL_FILE = None


# ==============================================================================
# 02. SECURITY & PATH HELPERS
# ==============================================================================
def safe_join_path(base: str, *paths: str) -> str:
    """Safely join paths ensuring the target is strictly within the base directory.
    Rejects null bytes, path traversal sequences, and unauthorized access.
    """
    for p in paths:
        if "\0" in p:
            raise HTTPException(status_code=400, detail="Invalid path: null byte detected")

    joined = os.path.join(base, *paths)
    target = os.path.realpath(joined)
    base_real = os.path.realpath(base)

    if not (target == base_real or target.startswith(base_real + os.sep)):
        raise HTTPException(status_code=400, detail="Invalid path / Access denied")
    return target


def to_posix_relpath(target_path: str, base_dir: str | None = None) -> str:
    """Return relative path normalized to POSIX forward slashes regardless of host OS."""
    if base_dir is None:
        base_dir = BASE_DIR
    rel = os.path.relpath(target_path, base_dir)
    return rel.replace("\\", "/")


# ==============================================================================
# 03. APPLICATION LIFECYCLE & ASSETS MOUNT
# ==============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Automatically open the web browser when the server starts
    def open_browser():
        time.sleep(1.0)  # Wait briefly for the server to bind to the port
        url = f"http://127.0.0.1:{CURRENT_PORT}"
        if INITIAL_FILE:
            url += f"?open={urllib.parse.quote(INITIAL_FILE)}"
        try:
            webbrowser.open(url)
        except Exception:
            pass

    threading.Thread(target=open_browser, daemon=True).start()
    yield



app = FastAPI(lifespan=lifespan)

# Get the path to static/templates files relative to package or frozen binary
if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    # Running in a PyInstaller bundle
    current_dir = os.path.join(sys._MEIPASS, "md_editor")
else:
    # Running in a normal Python environment
    current_dir = os.path.dirname(os.path.abspath(__file__))

static_dir = os.path.join(current_dir, "static")
templates_dir = os.path.join(current_dir, "templates")

# Ensure static and templates directories exist
os.makedirs(static_dir, exist_ok=True)
os.makedirs(templates_dir, exist_ok=True)

# Mount the static directory
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Configure Jinja2 templates
templates = Jinja2Templates(directory=templates_dir)


# ==============================================================================
# 04. REQUEST MODELS
# ==============================================================================
class CreateFolderRequest(BaseModel):
    path: str = ""
    name: str = "new_folder"


class CreateFileRequest(BaseModel):
    path: str = ""
    filename: str = "untitled.md"


class SaveRequest(BaseModel):
    filename: str
    content: str


class RenameRequest(BaseModel):
    old_path: str | None = None
    new_path: str | None = None
    old_filename: str | None = None
    new_filename: str | None = None
    is_folder: bool = False


class CopyRequest(BaseModel):
    src_path: str
    dest_dir: str = ""
    new_filename: str | None = None
    is_folder: bool = False


# ==============================================================================
# 05. UI & FILE SYSTEM API ROUTES
# Note: Synchronous file operations are defined as standard `def` so FastAPI
# runs them in an external threadpool without blocking the async event loop.
# ==============================================================================
@app.get("/", response_class=HTMLResponse)
async def read_index(request: Request):
    return templates.TemplateResponse(
        request,
        "index.html",
        {
            "cwd": BASE_DIR,
            "initial_file": INITIAL_FILE,
            "version": int(time.time())
        }
    )


@app.get("/api/files")
def get_files(path: str = ""):
    try:
        clean_path = path.strip().lstrip("/\\")
        target_dir = safe_join_path(BASE_DIR, clean_path)
        if not os.path.isdir(target_dir):
            raise HTTPException(status_code=404, detail="Directory not found")

        entries = os.listdir(target_dir)

        # Directories (skip hidden)
        directories = [
            d for d in entries
            if not d.startswith(".") and os.path.isdir(os.path.join(target_dir, d))
        ]
        directories.sort(key=lambda s: s.lower())

        # Files (all types, skip hidden)
        files = [
            f for f in entries
            if not f.startswith(".") and os.path.isfile(os.path.join(target_dir, f))
        ]
        files.sort(key=lambda s: s.lower())

        return {
            "cwd": BASE_DIR,
            "current_path": clean_path.replace("\\", "/"),
            "directories": directories,
            "files": files
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/create-folder")
def create_folder(req: CreateFolderRequest):
    try:
        clean_path = req.path.strip().lstrip("/\\")
        target_parent = safe_join_path(BASE_DIR, clean_path)
        if not os.path.isdir(target_parent):
            raise HTTPException(status_code=404, detail="Parent directory not found")

        base_name = req.name.strip() or "new_folder"
        candidate = base_name
        counter = 1
        while os.path.exists(os.path.join(target_parent, candidate)):
            candidate = f"{base_name}_{counter}"
            counter += 1

        folder_path = os.path.join(target_parent, candidate)
        os.makedirs(folder_path, exist_ok=False)
        return {
            "status": "success",
            "folder_name": candidate,
            "path": clean_path.replace("\\", "/"),
            "rel_path": to_posix_relpath(folder_path, BASE_DIR)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/create-file")
def create_file(req: CreateFileRequest):
    try:
        clean_path = req.path.strip().lstrip("/\\")
        target_parent = safe_join_path(BASE_DIR, clean_path)
        if not os.path.isdir(target_parent):
            raise HTTPException(status_code=404, detail="Parent directory not found")

        filename = req.filename.strip() or "untitled.md"
        if not filename.endswith(".md"):
            filename += ".md"

        stem = filename[:-3]
        candidate = filename
        counter = 1
        while os.path.exists(os.path.join(target_parent, candidate)):
            candidate = f"{stem}_{counter}.md"
            counter += 1

        file_path = os.path.join(target_parent, candidate)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("")

        return {
            "status": "success",
            "filename": candidate,
            "path": clean_path.replace("\\", "/"),
            "rel_path": to_posix_relpath(file_path, BASE_DIR)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/save")
def save_file(req: SaveRequest):
    try:
        clean_path = req.filename.strip().lstrip("/\\")
        if not clean_path.endswith(".md"):
            clean_path += ".md"

        filepath = safe_join_path(BASE_DIR, clean_path)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(req.content)

        return {
            "status": "success",
            "filename": os.path.basename(filepath),
            "rel_path": to_posix_relpath(filepath, BASE_DIR)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/load/{filepath:path}")
def load_file(filepath: str):
    try:
        clean_path = filepath.strip().lstrip("/\\")
        if not clean_path.endswith(".md"):
            clean_path += ".md"
        real_path = safe_join_path(BASE_DIR, clean_path)

        if not os.path.exists(real_path) or not os.path.isfile(real_path):
            raise HTTPException(status_code=404, detail="File not found")

        # Robust decoding: UTF-8 -> CP932 (Shift_JIS) fallback -> replace error handling
        content = ""
        try:
            with open(real_path, "r", encoding="utf-8") as f:
                content = f.read()
        except UnicodeDecodeError:
            try:
                with open(real_path, "r", encoding="cp932") as f:
                    content = f.read()
            except UnicodeDecodeError:
                with open(real_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()

        return {
            "filename": os.path.basename(real_path),
            "rel_path": to_posix_relpath(real_path, BASE_DIR),
            "content": content
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/raw/{filepath:path}")
def get_raw_file(filepath: str):
    try:
        clean_path = filepath.strip().lstrip("/\\")
        real_path = safe_join_path(BASE_DIR, clean_path)
        if not os.path.exists(real_path) or not os.path.isfile(real_path):
            raise HTTPException(status_code=404, detail="File not found")

        mime_type, _ = mimetypes.guess_type(real_path)
        if not mime_type:
            mime_type = "application/octet-stream"
        return FileResponse(real_path, media_type=mime_type)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/raw-file")
def get_raw_file_query(path: str = ""):
    return get_raw_file(path)


@app.delete("/api/delete/{filepath:path}")
def delete_item(filepath: str, is_dir: bool = False):
    try:
        clean_path = filepath.split("?")[0].strip().lstrip("/\\")
        real_path = safe_join_path(BASE_DIR, clean_path)

        # Security: root directory cannot be deleted
        if real_path == os.path.realpath(BASE_DIR):
            raise HTTPException(status_code=400, detail="Cannot delete root directory")

        if not os.path.exists(real_path):
            if not is_dir and not clean_path.endswith(".md"):
                candidate = safe_join_path(BASE_DIR, clean_path + ".md")
                if os.path.exists(candidate):
                    real_path = candidate
            if not os.path.exists(real_path):
                raise HTTPException(status_code=404, detail="Target not found")

        if os.path.isdir(real_path):
            shutil.rmtree(real_path)
        else:
            os.remove(real_path)

        return {"status": "success", "deleted": clean_path.replace("\\", "/")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/upload-file")
async def upload_file(request: Request, path: str = "", filename: str = "", overwrite: bool = True):
    try:
        clean_path = path.strip().lstrip("/\\")
        target_dir = safe_join_path(BASE_DIR, clean_path)
        if not os.path.isdir(target_dir):
            raise HTTPException(status_code=404, detail="Target directory not found")

        # Sanitize filename against path traversal
        raw_name = filename.strip().replace("\\", "/")
        safe_name = os.path.basename(raw_name)
        if not safe_name or safe_name in (".", ".."):
            raise HTTPException(status_code=400, detail="Valid filename required")

        dest_path = safe_join_path(target_dir, safe_name)
        if not overwrite and os.path.exists(dest_path):
            stem, ext = os.path.splitext(safe_name)
            counter = 1
            while os.path.exists(safe_join_path(target_dir, f"{stem}_{counter}{ext}")):
                counter += 1
            dest_path = safe_join_path(target_dir, f"{stem}_{counter}{ext}")
            safe_name = f"{stem}_{counter}{ext}"

        with open(dest_path, "wb") as f:
            async for chunk in request.stream():
                f.write(chunk)

        return {
            "status": "success",
            "filename": safe_name,
            "rel_path": to_posix_relpath(dest_path, BASE_DIR)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rename")
def rename_item(req: RenameRequest):
    try:
        old_val = (req.old_path or req.old_filename or "").strip().lstrip("/\\")
        new_val = (req.new_path or req.new_filename or "").strip().lstrip("/\\")

        if not old_val or not new_val:
            raise HTTPException(status_code=400, detail="Paths cannot be empty")

        if not req.is_folder:
            real_old_test = safe_join_path(BASE_DIR, old_val)
            if not os.path.exists(real_old_test):
                if os.path.exists(safe_join_path(BASE_DIR, old_val + ".md")):
                    old_val += ".md"
                    if not new_val.endswith(".md"):
                        new_val += ".md"
                elif not old_val.endswith(".md") and "." not in os.path.basename(old_val):
                    old_val += ".md"
                    if not new_val.endswith(".md"):
                        new_val += ".md"

        real_old = safe_join_path(BASE_DIR, old_val)
        real_new = safe_join_path(BASE_DIR, new_val)

        base_real = os.path.realpath(BASE_DIR)
        if real_old == base_real or real_new == base_real:
            raise HTTPException(status_code=400, detail="Cannot rename root directory")

        if not os.path.exists(real_old):
            raise HTTPException(status_code=404, detail="Source not found")
        if os.path.exists(real_new) and real_old.lower() != real_new.lower():
            raise HTTPException(status_code=400, detail="Destination already exists")

        shutil.move(real_old, real_new)

        return {
            "status": "success",
            "old_path": to_posix_relpath(real_old, BASE_DIR),
            "new_path": to_posix_relpath(real_new, BASE_DIR),
            "old_filename": os.path.basename(real_old),
            "new_filename": os.path.basename(real_new)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/copy-file")
def copy_file_item(req: CopyRequest):
    try:
        src_val = req.src_path.strip().lstrip("/\\")
        dest_val = req.dest_dir.strip().lstrip("/\\")

        if not src_val:
            raise HTTPException(status_code=400, detail="Source path cannot be empty")

        real_src = safe_join_path(BASE_DIR, src_val)
        if not os.path.exists(real_src):
            if not req.is_folder and os.path.exists(safe_join_path(BASE_DIR, src_val + ".md")):
                src_val += ".md"
                real_src = safe_join_path(BASE_DIR, src_val)
            else:
                raise HTTPException(status_code=404, detail="Source not found")

        real_dest_dir = safe_join_path(BASE_DIR, dest_val)
        if not os.path.isdir(real_dest_dir):
            raise HTTPException(status_code=404, detail="Destination directory not found")

        orig_filename = os.path.basename(real_src)
        target_filename = req.new_filename.strip() if req.new_filename else orig_filename

        dest_path = safe_join_path(real_dest_dir, target_filename)
        if os.path.exists(dest_path):
            stem, ext = os.path.splitext(target_filename)
            counter = 1
            candidate_name = f"{stem}_copy{ext}"
            while os.path.exists(safe_join_path(real_dest_dir, candidate_name)):
                counter += 1
                candidate_name = f"{stem}_copy_{counter}{ext}"
            target_filename = candidate_name
            dest_path = safe_join_path(real_dest_dir, target_filename)

        if os.path.isdir(real_src):
            shutil.copytree(real_src, dest_path)
        else:
            shutil.copy2(real_src, dest_path)

        return {
            "status": "success",
            "src_path": to_posix_relpath(real_src, BASE_DIR),
            "filename": target_filename,
            "dest_dir": dest_val.replace("\\", "/"),
            "rel_path": to_posix_relpath(dest_path, BASE_DIR)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# 06. WEBSOCKET & LIFECYCLE MANAGEMENT
# ==============================================================================
active_connections = 0
is_shutting_down = False
server_instance = None


def trigger_graceful_shutdown():
    global is_shutting_down, server_instance
    if not is_shutting_down:
        is_shutting_down = True
        if server_instance is not None:
            server_instance.should_exit = True
        else:
            try:
                os.kill(os.getpid(), signal.SIGINT)
            except Exception:
                pass


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global active_connections, is_shutting_down
    await websocket.accept()
    active_connections += 1
    try:
        while True:
            # Keep connection open and wait for messages / disconnect
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections -= 1
        if active_connections == 0:
            # Wait 5 seconds in case it is a page reload or brief tab switch
            await asyncio.sleep(5)
            if active_connections == 0 and not is_shutting_down:
                print("All UI clients disconnected. Shutting down server...")
                trigger_graceful_shutdown()


@app.post("/api/shutdown")
async def shutdown_api():
    global is_shutting_down
    if not is_shutting_down:
        print("Quit button pressed. Shutting down server...")
        async def delayed_shutdown():
            await asyncio.sleep(0.5)
            trigger_graceful_shutdown()
        asyncio.create_task(delayed_shutdown())
    return {"status": "shutting_down"}


@app.get("/api/status")
async def get_status():
    return {
        "app": "md_editor",
        "status": "running",
        "cwd": os.path.realpath(BASE_DIR),
        "port": CURRENT_PORT,
        "initial_file": INITIAL_FILE
    }


# ==============================================================================
# 07. PORT SCANNING & APPLICATION START
# ==============================================================================
def parse_args_and_setup_workspace(argv: list[str]) -> tuple[str, str | None]:
    """Parse CLI arguments, validate target file, and determine workspace directory.
    Returns (base_dir, initial_file_relpath_or_none).
    Exits with code 1 if validation fails.
    """
    args = argv[1:]
    if len(args) > 1:
        print("Error: Only one file can be specified at a time.", file=sys.stderr)
        sys.exit(1)

    if len(args) == 0:
        return os.getcwd(), None

    raw_path = args[0]

    # Validate extension
    _, ext = os.path.splitext(raw_path)
    if ext.lower() != ".md":
        print(f"Error: Target file must have a .md extension: '{raw_path}'", file=sys.stderr)
        sys.exit(1)

    target_abs = os.path.realpath(os.path.abspath(raw_path))

    # Validate existence
    if not os.path.exists(target_abs):
        print(f"Error: File not found: '{raw_path}'", file=sys.stderr)
        sys.exit(1)

    # Validate is a regular file
    if not os.path.isfile(target_abs):
        print(f"Error: Specified path is a directory, not a file: '{raw_path}'", file=sys.stderr)
        sys.exit(1)

    # Determine workspace
    current_cwd = os.path.realpath(os.getcwd())
    try:
        rel = os.path.relpath(target_abs, current_cwd)
        if not rel.startswith("..") and not os.path.isabs(rel):
            # Inside current_cwd
            base_dir = current_cwd
            initial_file = to_posix_relpath(target_abs, base_dir)
        else:
            # Outside current_cwd (e.g. OS 'Open with' or double-click with absolute path)
            base_dir = os.path.dirname(target_abs)
            initial_file = os.path.basename(target_abs)
    except ValueError:
        # Cross-drive paths on Windows (e.g. C: vs D:)
        base_dir = os.path.dirname(target_abs)
        initial_file = os.path.basename(target_abs)

    return base_dir, initial_file


def is_port_listening(port: int) -> bool:
    """Quickly check if a port is currently open and listening."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.05)
        return s.connect_ex(("127.0.0.1", port)) == 0


def is_port_bindable(port: int) -> bool:
    """Check if we can bind to 127.0.0.1 on this port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def get_server_info(port: int) -> dict | None:
    try:
        req = urllib.request.Request(f"http://127.0.0.1:{port}/api/status")
        with urllib.request.urlopen(req, timeout=0.5) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                if data.get("app") == "md_editor":
                    return data
    except Exception:
        pass
    return None


def start():
    multiprocessing.freeze_support()
    global server_instance, CURRENT_PORT, BASE_DIR, INITIAL_FILE

    base_dir, initial_file = parse_args_and_setup_workspace(sys.argv)
    BASE_DIR = base_dir
    INITIAL_FILE = initial_file
    os.chdir(BASE_DIR)

    current_cwd = os.path.normcase(os.path.realpath(BASE_DIR))

    # Phase 1: Thoroughly check across ALL ports (18000-18050) if an instance is already running for current_cwd
    for port in range(18000, 18051):
        if is_port_listening(port):
            info = get_server_info(port)
            if info:
                server_cwd = os.path.normcase(info.get("cwd", ""))
                if server_cwd and server_cwd == current_cwd:
                    print(f"Session already running for this directory on port {port}.")
                    return

    # Phase 2: No instance is running for current_cwd. Find the first free, bindable port.
    chosen_port = None
    for port in range(18000, 18051):
        if not is_port_listening(port) and is_port_bindable(port):
            chosen_port = port
            break

    if chosen_port is None:
        print("Error: Could not find an available port in range 18000-18050.", file=sys.stderr)
        sys.exit(1)

    CURRENT_PORT = chosen_port
    print(f"Starting Markdown Editor & Viewer in: {BASE_DIR}")
    print(f"Point your browser to http://127.0.0.1:{CURRENT_PORT}")
    config = uvicorn.Config(app, host="127.0.0.1", port=CURRENT_PORT, reload=False)
    server_instance = uvicorn.Server(config)
    try:
        server_instance.run()
    except KeyboardInterrupt:
        pass
    except asyncio.CancelledError:
        pass



if __name__ == "__main__":
    multiprocessing.freeze_support()
    start()

