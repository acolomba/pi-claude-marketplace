#!/usr/bin/env python3
# gsd-path guard — stable runtime launcher
import sys
sys.dont_write_bytecode = True
from pathlib import Path
from status_runtime import run_guard
try:
    run_guard(Path(__file__).resolve().parent.parent, 'guard_hook.py')
except (OSError, ValueError) as error:
    print(str(error), file=sys.stderr)
    raise SystemExit(2)
