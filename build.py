import os
import subprocess
import sys

def main():
    print("Installing PyInstaller and application dependencies...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--no-build-isolation", "."])
    
    sep = os.pathsep # ':' on Linux/Mac, ';' on Windows
    
    cmd = [
        sys.executable,
        "-m", "PyInstaller",
        "--name", "md-editor",
        "--onefile",
        "--clean",
        "--add-data", f"md_editor/static{sep}md_editor/static",
        "--add-data", f"md_editor/templates{sep}md_editor/templates",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespan.on",
        "--hidden-import", "websockets",
        "--hidden-import", "jinja2",
        "-c", "md_editor/main.py"
    ]
    
    print(f"Running: {' '.join(cmd)}")
    subprocess.check_call(cmd)

    
    print("Build complete. Executable is located in the dist/ directory.")

if __name__ == "__main__":
    main()
