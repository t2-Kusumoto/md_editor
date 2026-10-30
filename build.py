import os
import shutil
import subprocess
import sys


def run_pip_install(args: list[str]):
    """Run pip install with automatic retry for PEP 668 (--break-system-packages)."""
    base_cmd = [sys.executable, "-m", "pip", "install"]
    try:
        subprocess.check_call(base_cmd + args)
    except subprocess.CalledProcessError:
        # On Ubuntu 24.04+/26 (PEP 668), pip may require --break-system-packages if run outside venv
        if "--break-system-packages" not in args:
            try:
                print("Retrying pip install with --break-system-packages...")
                subprocess.check_call(base_cmd + ["--break-system-packages"] + args)
                return
            except subprocess.CalledProcessError:
                pass
        raise


def is_online() -> bool:
    """Check if PyPI is reachable without waiting for slow pip retries."""
    import socket
    try:
        with socket.create_connection(("pypi.org", 443), timeout=1.5):
            return True
    except OSError:
        return False


def get_pyinstaller_command() -> list[str]:
    """Find the best way to invoke PyInstaller (module invocation or binary)."""
    # 1. Check if PyInstaller module is available in current python environment
    try:
        res = subprocess.run(
            [sys.executable, "-m", "PyInstaller", "--version"],
            capture_output=True,
            text=True
        )
        if res.returncode == 0:
            return [sys.executable, "-m", "PyInstaller"]
    except Exception:
        pass

    # 2. Check if pyinstaller executable is in PATH
    pyinstaller_bin = shutil.which("pyinstaller")
    if pyinstaller_bin:
        return [pyinstaller_bin]

    raise RuntimeError("PyInstaller executable or module could not be found.")


def ensure_correct_python_environment():
    """Detect if an active virtual environment in the shell was bypassed (e.g. 'python3' alias on Windows)."""
    active_venv = os.environ.get("VIRTUAL_ENV")
    if not active_venv:
        return

    # Normalize paths for comparison (case-insensitive on Windows)
    norm_sys_prefix = os.path.normcase(os.path.abspath(sys.prefix))
    norm_active_venv = os.path.normcase(os.path.abspath(active_venv))

    if norm_sys_prefix != norm_active_venv:
        venv_python = (
            os.path.join(active_venv, "Scripts", "python.exe")
            if sys.platform.startswith("win")
            else os.path.join(active_venv, "bin", "python")
        )
        print("[Notice] Active virtual environment detected in shell, but build.py was invoked with a different Python:")
        print(f"  Shell environment: {active_venv}")
        print(f"  Current Python:    {sys.executable}")
        if os.path.exists(venv_python):
            print(f"  Automatically switching to: {venv_python}\n")
            sys.exit(subprocess.call([venv_python, os.path.abspath(__file__)] + sys.argv[1:]))
        else:
            print(f"[Error] Virtual environment Python executable not found at: {venv_python}")
            print("Please ensure your virtual environment is intact and re-run with 'python build.py'.")
            sys.exit(1)


def main():
    ensure_correct_python_environment()
    print("Checking dependencies for PyInstaller build...")

    if is_online():
        print("Network available: updating build tools and PyInstaller...")
        # 1. Ensure build tools are present (especially important for Python 3.12+ / 3.14)
        try:
            run_pip_install(["--upgrade", "setuptools>=61.0.0", "wheel"])
        except Exception as e:
            print(f"Notice: setuptools/wheel install step: {e}")

        # 2. Install or upgrade PyInstaller (PyInstaller >= 6.10.0 is required for Python 3.14 support)
        try:
            run_pip_install(["--upgrade", "pyinstaller>=6.10.0", "pyinstaller-hooks-contrib"])
        except Exception:
            run_pip_install(["--upgrade", "pyinstaller"])

        # 3. Install project dependencies directly (avoids running 'pip install .' which creates entrypoint executables in Scripts/)
        dependencies = [
            "fastapi>=0.100.0",
            "uvicorn>=0.22.0",
            "jinja2>=3.0.0",
            "websockets>=10.0",
        ]
        try:
            run_pip_install(dependencies)
        except Exception as e:
            print(f"Notice: dependency install step: {e}")
    else:
        print("Network unreachable or offline: using locally installed packages...")


    sep = os.pathsep  # ':' on Linux/Mac, ';' on Windows
    pyinstaller_cmd = get_pyinstaller_command()

    icon_ico = os.path.join("md_editor", "static", "img", "md_editor_icon.ico")
    icon_png = os.path.join("md_editor", "static", "img", "md_editor_icon.png")
    icon_args = []
    if sys.platform.startswith("win"):
        if os.path.exists(icon_ico):
            icon_args = ["--icon", icon_ico]
    else:
        if os.path.exists(icon_png):
            icon_args = ["--icon", icon_png]
        elif os.path.exists(icon_ico):
            icon_args = ["--icon", icon_ico]

    cmd = pyinstaller_cmd + [
        "--name", "mded",
        "--onefile",
        "--clean",
        "--add-data", f"md_editor/static{sep}md_editor/static",
        "--add-data", f"md_editor/templates{sep}md_editor/templates",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespan.on",
        "--hidden-import", "websockets",
        "--hidden-import", "jinja2",
    ] + icon_args + [
        "-c", "md_editor/main.py"
    ]

    print(f"Running: {' '.join(cmd)}")
    subprocess.check_call(cmd)

    print("Build complete. Executable is located in the dist/ directory.")


if __name__ == "__main__":
    main()

