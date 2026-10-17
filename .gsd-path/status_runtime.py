#!/usr/bin/env python3
"""Launch the project status runtime across an atomic refresh handoff."""

import argparse
import hashlib
import errno
import json
import os
import stat
import subprocess
import sys
import time
from pathlib import Path
from typing import Sequence

PROJECT_STATUS_MARKER = "gsd-path project status launcher"
INSTALL_LOCK_OWNER = "owner.json"
INSTALL_LOCK_SCHEMA = "gsd-path/install-lock/v2"


def process_identity(pid: int):
    if os.name == "nt":
        command = [
            "powershell.exe",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            f"(Get-Process -Id {pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks",
        ]
    else:
        command = ["ps", "-o", "lstart=", "-p", str(pid)]
    try:
        result = subprocess.run(command, capture_output=True, encoding="utf-8", errors="replace", check=False)
    except OSError:
        return None
    value = result.stdout.strip()
    return f"{os.name}:{value}" if result.returncode == 0 and value else None


def runtime_identity(runtime: Path):
    try:
        status = runtime.stat()
    except FileNotFoundError:
        return None
    return (status.st_dev, status.st_ino, status.st_mtime_ns, status.st_size)


def process_alive(pid: int) -> bool:
    """Whether pid names a running process, without signalling it.

    Windows os.kill(pid, 0) sends CTRL_C_EVENT, so Windows asks the kernel.
    status_runtime and install carry verbatim copies (they cannot import this
    module); tests/test_common_platform.py keeps them identical.
    """
    if pid <= 0:
        return False
    if os.name != "nt":
        try:
            os.kill(pid, 0)
        except OSError as error:
            return error.errno == errno.EPERM
        return True
    import ctypes
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.OpenProcess.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
    kernel32.GetExitCodeProcess.argtypes = (wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD))
    kernel32.CloseHandle.argtypes = (wintypes.HANDLE,)
    handle = kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
    if not handle:
        # ERROR_ACCESS_DENIED: a protected process exists but refuses the query.
        return ctypes.get_last_error() == 5
    try:
        code = wintypes.DWORD()
        if not kernel32.GetExitCodeProcess(handle, ctypes.byref(code)):
            return True
        return code.value == 259  # STILL_ACTIVE
    finally:
        kernel32.CloseHandle(handle)


def install_lock_active(lock: Path) -> bool:
    if lock.is_symlink() or not lock.is_dir():
        return False
    try:
        owner = json.loads((lock / INSTALL_LOCK_OWNER).read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        return False
    pid = owner.get("pid")
    valid_pid = isinstance(pid, int) and not isinstance(pid, bool) and pid > 0
    identity = owner.get("identity")
    if (
        owner.get("schema") != INSTALL_LOCK_SCHEMA
        or not valid_pid
        or not isinstance(identity, str)
    ):
        return False
    current_identity = process_identity(pid)
    if current_identity is None:
        return process_alive(pid)
    return current_identity == identity


RUNTIME_SCHEMA = "gsd-path/runtime/v1"


def runtime_home() -> Path:
    return Path.home() / ".gsd-path" / "runtimes"


def declaration(repo: Path) -> dict:
    path = repo / ".gsd-path" / "runtime.json"
    if path.is_symlink() or path.parent.is_symlink():
        raise ValueError(f"unsafe runtime declaration: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if (not isinstance(data, dict) or data.get("schema") != RUNTIME_SCHEMA
            or not isinstance(data.get("version"), str)
            or not isinstance(data.get("digest"), str)
            or len(data["digest"]) != 64
            or any(c not in "0123456789abcdef" for c in data["digest"])):
        raise ValueError(f"invalid runtime declaration: {path}")
    return data


def manifest_digest(manifest: dict) -> str:
    return hashlib.sha256(json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def validate_runtime(data: dict) -> Path:
    root = runtime_home() / data["digest"]
    hint = (f"Runtime {data['version']} ({data['digest']}) is unavailable or invalid at {root}. "
            "Run gsd-path --runtime-restore --project <project-root> "
            "--source-root <matching-package-root> to restore this exact runtime.")
    try:
        if any(p.is_symlink() for p in (root, root.parent, root.parent.parent)):
            raise ValueError("symlinked runtime storage")
        manifest_path = root / "manifest.json"
        if manifest_path.is_symlink():
            raise ValueError("symlinked manifest")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if (not isinstance(manifest, dict) or manifest_digest(manifest) != data["digest"]
                or manifest.get("version") != data["version"]):
            raise ValueError("manifest identity mismatch")
        files = manifest.get("files")
        if not isinstance(files, dict) or "pipeline_state.py" not in files:
            raise ValueError("invalid runtime file inventory")
        for name, expected in files.items():
            if Path(name).name != name or not name.endswith(".py"):
                raise ValueError("invalid runtime file name")
            path = root / name
            if path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
                raise ValueError(f"runtime file changed: {name}")
        runtime_entries = set()
        for path in root.iterdir():
            if path.name == "__pycache__":
                if not stat.S_ISDIR(path.lstat().st_mode):
                    raise ValueError("unexpected runtime files")
                for cached in path.iterdir():
                    if cached.suffix != ".pyc" or not stat.S_ISREG(cached.lstat().st_mode):
                        raise ValueError("unexpected runtime files")
                continue
            runtime_entries.add(path.name)
        if runtime_entries != set(files) | {"manifest.json"}:
            raise ValueError("unexpected runtime files")
    except (OSError, ValueError, TypeError) as error:
        raise ValueError(hint + f" ({error})") from error
    return root


def resolve_runtime(repo: Path) -> Path:
    return validate_runtime(declaration(repo))


def run_guard(repo: Path, name: str) -> None:
    # Keep the guard's project identity while executing verified external bytes.
    root = resolve_runtime(repo)
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(root))
    previous_pycache_prefix = sys.pycache_prefix
    sys.pycache_prefix = str(root / "manifest.json")
    try:
        code = compile((root / name).read_bytes(), str(root / name), "exec")
        exec(code, {"__name__": "__main__", "__file__": str(repo / ".gsd-path" / name)})
    finally:
        sys.pycache_prefix = previous_pycache_prefix


def launch(repo: Path) -> int:
    parent = repo / ".gsd-path"
    if os.path.lexists(parent / "runtime.json"):
        try:
            runtime = resolve_runtime(repo) / "pipeline_state.py"
        except (OSError, ValueError) as error:
            print(str(error), file=sys.stderr)
            return 2
        return subprocess.call([sys.executable, "-B", "-X",
                                f"pycache_prefix={runtime.parent / 'manifest.json'}",
                                str(runtime), "status", "--repo", str(repo)],
                               env={**os.environ, "GIT_OPTIONAL_LOCKS": "0"})
    runtime = parent / "runtime" / "pipeline_state.py"
    lock = repo / ".gsd-path-install-lock"
    command = [sys.executable, "-B", str(runtime), "status", "--repo", str(repo)]
    environment = os.environ.copy()
    environment["GIT_OPTIONAL_LOCKS"] = "0"
    while True:
        if install_lock_active(lock):
            time.sleep(0.05)
            continue
        before = runtime_identity(runtime)
        if before is None:
            if install_lock_active(lock):
                continue
            if runtime_identity(runtime) is not None:
                continue
            if install_lock_active(lock):
                continue
            print(f"GSD Path status runtime is unavailable: {runtime}", file=sys.stderr)
            return 2
        try:
            result = subprocess.run(
                command, capture_output=True, check=False, env=environment
            )
        except OSError as error:
            print(f"GSD Path status runtime failed: {error}", file=sys.stderr)
            return 2
        if install_lock_active(lock) or runtime_identity(runtime) != before:
            continue
        sys.stdout.write(result.stdout.decode())
        sys.stderr.write(result.stderr.decode())
        return result.returncode


def main(argv: Sequence[str] = sys.argv[1:]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, type=Path)
    parser.add_argument("--runtime-path", action="store_true")
    args = parser.parse_args(argv)
    if not args.repo.is_absolute():
        print("GSD Path status repository must be absolute", file=sys.stderr)
        return 2
    if args.runtime_path:
        try:
            # Forward slashes: agents paste this into Git Bash on Windows, where
            # unquoted backslashes are escapes.
            print(resolve_runtime(args.repo.resolve()).as_posix())
            return 0
        except (OSError, ValueError) as error:
            print(str(error), file=sys.stderr)
            return 2
    return launch(args.repo.resolve())


if __name__ == "__main__":
    raise SystemExit(main())
