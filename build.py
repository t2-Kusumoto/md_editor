import os
import subprocess
import sys

def main():
    print("Installing PyInstaller and application dependencies...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
    subprocess.check_call([sys.executable, "-m", "pip", "install", "."])
    
    sep = os.pathsep # ':' on Linux/Mac, ';' on Windows
    
    cmd = [
        "pyinstaller",
        "--name", "md-editor",
        "--onefile",
        "--add-data", f"md_editor/static{sep}md_editor/static",
        "--add-data", f"md_editor/templates{sep}md_editor/templates",
        "-c", "md_editor/main.py"
    ]
    
    print(f"Running: {' '.join(cmd)}")
    subprocess.check_call(cmd)
    
    print("Build complete. Executable is located in the dist/ directory.")

if __name__ == "__main__":
    main()
