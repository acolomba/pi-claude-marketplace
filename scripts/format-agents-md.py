"""Run the markdown fixers on AGENTS.md everywhere except the gsd-path block.

The gsd-path installer requires its block byte for byte, and mdformat and the
texthooks fixers cannot skip part of a file. So the block is swapped for an
HTML comment, which mdformat keeps verbatim, while the fixers run.
"""

import subprocess
import sys
from pathlib import Path

BEGIN = "<!-- gsd-path:begin -->"
END = "<!-- gsd-path:end -->"
PLACEHOLDER = "<!-- gsd-path:block -->"
FIXERS = ("fix-smartquotes", "fix-unicode-dashes", "fix-ligatures")


def mask(text):
    start = text.find(BEGIN)
    stop = text.find(END, start)
    if start < 0 or stop < 0:
        return text, None

    stop += len(END)
    return text[:start] + PLACEHOLDER + text[stop:], text[start:stop]


def format_file(path):
    text = path.read_text(encoding="utf-8")
    masked, block = mask(text)
    # beside the original, so mdformat finds the repository's .mdformat.toml
    scratch = path.with_name(f".{path.name}.format.md")
    scratch.write_text(masked, encoding="utf-8")
    try:
        # the fixers exit 1 when they change a file, so only mdformat's exit
        # status reports a failure
        for fixer in FIXERS:
            subprocess.run([fixer, str(scratch)], check=False, capture_output=True)

        subprocess.run(["mdformat", str(scratch)], check=True)
        formatted = scratch.read_text(encoding="utf-8")
    finally:
        scratch.unlink()

    if block is not None:
        formatted = formatted.replace(PLACEHOLDER, block, 1)

    if formatted == text:
        return False

    path.write_text(formatted, encoding="utf-8")
    return True


def main(names):
    changed = [name for name in names if format_file(Path(name))]
    for name in changed:
        print(f"formatted {name}")

    return 1 if changed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
