import os
import base64
import mimetypes
import urllib.parse
import urllib.request
import webbrowser
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from contextlib import asynccontextmanager
import uvicorn
import threading
import time
import asyncio
import signal

import shutil

# Record the directory from which the application was started
BASE_DIR = os.getcwd()

def safe_join_path(base: str, *paths: str) -> str:
    """Safely join paths ensuring the target is within the base directory."""
    target = os.path.realpath(os.path.join(base, *paths))
    base_real = os.path.realpath(base)
    if not (target == base_real or target.startswith(base_real + os.sep)):
        raise HTTPException(status_code=400, detail="Invalid path / Access denied")
    return target

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Automatically open the web browser when the server starts
    def open_browser():
        time.sleep(1.0)  # Wait briefly for the server to bind to the port
        webbrowser.open("http://127.0.0.1:18000")
    
    threading.Thread(target=open_browser, daemon=True).start()
    yield

app = FastAPI(lifespan=lifespan)

# Get the path to static/templates files relative to this package location
import sys
if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
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

class ImageConvertRequest(BaseModel):
    paths: list[str]
    current_dir: str = ""

@app.post("/api/convert-images-base64")
async def convert_images_base64(req: ImageConvertRequest):
    mapping = {}
    base_real = os.path.realpath(BASE_DIR)
    
    for raw_path in req.paths:
        # Handle external HTTP/HTTPS URLs
        if raw_path.startswith("http://") or raw_path.startswith("https://"):
            try:
                url_req = urllib.request.Request(
                    raw_path,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
                    }
                )
                with urllib.request.urlopen(url_req, timeout=6) as resp:
                    if resp.status == 200:
                        content_type = resp.headers.get_content_type()
                        if not content_type or content_type == "application/octet-stream":
                            content_type = mimetypes.guess_type(raw_path.split("?")[0])[0] or "image/png"
                        img_bytes = resp.read()
                        b64_data = base64.b64encode(img_bytes).decode("utf-8")
                        mapping[raw_path] = f"data:{content_type};base64,{b64_data}"
                    else:
                        mapping[raw_path] = "unavailable"
            except Exception:
                mapping[raw_path] = "unavailable"
            continue

        clean_path = raw_path.split("?")[0].split("#")[0]
        unquoted = urllib.parse.unquote(clean_path)
        if unquoted.startswith("/api/raw/"):
            rel_path = unquoted[len("/api/raw/"):].lstrip("/\\")
        elif unquoted.startswith("./"):
            rel_path = unquoted[2:]
        elif unquoted.startswith("/"):
            rel_path = unquoted.lstrip("/\\")
        else:
            rel_path = unquoted
        
        # Check current_dir first if provided, then root BASE_DIR
        candidate_paths = []
        if req.current_dir:
            candidate_paths.append(os.path.join(BASE_DIR, req.current_dir, rel_path))
        candidate_paths.append(os.path.join(BASE_DIR, rel_path))
        
        found_path = None
        for p in candidate_paths:
            try:
                rp = os.path.realpath(p)
                if (rp == base_real or rp.startswith(base_real + os.sep)) and os.path.isfile(rp):
                    found_path = rp
                    break
            except Exception:
                continue
                
        if found_path:
            try:
                mime_type, _ = mimetypes.guess_type(found_path)
                if not mime_type:
                    ext = os.path.splitext(found_path)[1].lower()
                    mime_type = {
                        '.png': 'image/png',
                        '.jpg': 'image/jpeg',
                        '.jpeg': 'image/jpeg',
                        '.gif': 'image/gif',
                        '.svg': 'image/svg+xml',
                        '.webp': 'image/webp',
                        '.bmp': 'image/bmp',
                        '.ico': 'image/x-icon'
                    }.get(ext, 'application/octet-stream')
                    
                with open(found_path, "rb") as img_f:
                    b64_data = base64.b64encode(img_f.read()).decode("utf-8")
                mapping[raw_path] = f"data:{mime_type};base64,{b64_data}"
            except Exception:
                mapping[raw_path] = "unavailable"
        else:
            mapping[raw_path] = "unavailable"
            
    return {"mapping": mapping}

@app.get("/", response_class=HTMLResponse)
async def read_index(request: Request):
    return templates.TemplateResponse(request, "index.html", {"cwd": BASE_DIR, "version": int(time.time())})

@app.get("/api/files")
async def get_files(path: str = ""):
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
            "current_path": clean_path,
            "directories": directories,
            "files": files
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/create-folder")
async def create_folder(req: CreateFolderRequest):
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
            "path": clean_path,
            "rel_path": os.path.relpath(folder_path, BASE_DIR)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/create-file")
async def create_file(req: CreateFileRequest):
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
            
        rel_path = os.path.relpath(file_path, BASE_DIR)
        return {
            "status": "success",
            "filename": candidate,
            "path": clean_path,
            "rel_path": rel_path
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/save")
async def save_file(req: SaveRequest):
    try:
        clean_path = req.filename.strip().lstrip("/\\")
        if not clean_path.endswith(".md"):
            clean_path += ".md"
        
        filepath = safe_join_path(BASE_DIR, clean_path)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(req.content)
        
        rel_path = os.path.relpath(filepath, BASE_DIR)
        return {
            "status": "success",
            "filename": os.path.basename(filepath),
            "rel_path": rel_path
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/load/{filepath:path}")
async def load_file(filepath: str):
    try:
        clean_path = filepath.strip().lstrip("/\\")
        if not clean_path.endswith(".md"):
            clean_path += ".md"
        real_path = safe_join_path(BASE_DIR, clean_path)
            
        if not os.path.exists(real_path) or not os.path.isfile(real_path):
            raise HTTPException(status_code=404, detail="File not found")
            
        with open(real_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        rel_path = os.path.relpath(real_path, BASE_DIR)
        return {
            "filename": os.path.basename(real_path),
            "rel_path": rel_path,
            "content": content
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/raw/{filepath:path}")
async def get_raw_file(filepath: str):
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
async def get_raw_file_query(path: str = ""):
    return await get_raw_file(path)

@app.delete("/api/delete/{filepath:path}")
async def delete_item(filepath: str, is_dir: bool = False):
    try:
        clean_path = filepath.split("?")[0].strip().lstrip("/\\")
        real_path = safe_join_path(BASE_DIR, clean_path)
        
        # Security: root directory cannot be deleted
        if real_path == os.path.realpath(BASE_DIR):
            raise HTTPException(status_code=400, detail="Cannot delete root directory")
            
        if not os.path.exists(real_path):
            # Check with .md if not directory
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
            
        return {"status": "success", "deleted": clean_path}
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
        
        safe_name = os.path.basename(filename.strip())
        if not safe_name:
            raise HTTPException(status_code=400, detail="Filename required")
        
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
            "rel_path": os.path.relpath(dest_path, BASE_DIR)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/rename")
async def rename_item(req: RenameRequest):
    try:
        old_val = (req.old_path or req.old_filename or "").strip().lstrip("/\\")
        new_val = (req.new_path or req.new_filename or "").strip().lstrip("/\\")
        
        if not old_val or not new_val:
            raise HTTPException(status_code=400, detail="Paths cannot be empty")
            
        if not req.is_folder:
            # Check if old_val exists on disk as-is
            real_old_test = safe_join_path(BASE_DIR, old_val)
            if not os.path.exists(real_old_test):
                # If not exists as-is, check if it exists with .md
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
            "old_path": old_val,
            "new_path": new_val,
            "old_filename": os.path.basename(real_old),
            "new_filename": os.path.basename(real_new)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/copy-file")
async def copy_file_item(req: CopyRequest):
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
            "src_path": src_val,
            "filename": target_filename,
            "dest_dir": dest_val,
            "rel_path": os.path.relpath(dest_path, BASE_DIR)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


active_connections = 0

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global active_connections
    await websocket.accept()
    active_connections += 1
    try:
        while True:
            # Keep the connection open and wait for disconnect
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections -= 1
        if active_connections == 0:
            # Wait a few seconds in case it's a page reload (F5)
            await asyncio.sleep(3)
            if active_connections == 0:
                print("All UI clients disconnected. Shutting down server...")
                os.kill(os.getpid(), signal.SIGINT)

@app.post("/api/shutdown")
async def shutdown_api():
    print("Quit button pressed. Shutting down server...")
    async def delayed_shutdown():
        await asyncio.sleep(0.5)
        os.kill(os.getpid(), signal.SIGINT)
    asyncio.create_task(delayed_shutdown())
    return {"status": "shutting_down"}

@app.get("/api/status")
async def get_status():
    return {"app": "md_editor", "status": "running"}

import json
import urllib.error

def is_server_running(port: int) -> bool:
    try:
        req = urllib.request.Request(f"http://127.0.0.1:{port}/api/status")
        with urllib.request.urlopen(req, timeout=1.0) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                if data.get("app") == "md_editor":
                    return True
    except Exception:
        pass
    return False

def start():
    port = 18000
    if is_server_running(port):
        print(f"Server is already running on port {port}. Opening browser to restore session...")
        webbrowser.open(f"http://127.0.0.1:{port}")
        return

    print(f"Starting Markdown Editor & Viewer in: {BASE_DIR}")
    print(f"Point your browser to http://127.0.0.1:{port}")
    uvicorn.run(app, host="127.0.0.1", port=port, reload=False)

if __name__ == "__main__":
    start()
