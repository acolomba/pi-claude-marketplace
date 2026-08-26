#!/usr/bin/env bash
#
# Launch the /claude:plugin browse picker demo with a TypeScript-capable Node.
#
# Native .ts stripping is UNFLAGGED on Node >= 23.6 and FLAGGED
# (--experimental-strip-types) on 22.6-23.5. This script detects the Node
# version on PATH and supplies the right flag, silencing the
# ExperimentalWarning. No hardcoded interpreter paths -- portable across
# machines.
#
#   ./demos/run-browse-demo.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "node not found on PATH. Install Node >= 22.6 to run the demo." >&2
  echo "  npm install -D tsx && npx tsx demos/browse-demo.ts" >&2
  exit 1
fi

ver="$(node --version 2>/dev/null | sed 's/^v//')"
major="${ver%%.*}"
rest="${ver#*.}"
minor="${rest%%.*}"

if [ "$major" -gt 23 ] 2>/dev/null || { [ "$major" -eq 23 ] && [ "$minor" -ge 6 ]; } 2>/dev/null; then
  exec node --no-warnings demos/browse-demo.ts
elif [ "$major" -eq 22 ] && [ "$minor" -ge 6 ] 2>/dev/null; then
  exec node --no-warnings --experimental-strip-types demos/browse-demo.ts
else
  echo "Node $ver cannot run .ts directly (need >= 22.6). Got:" >&2
  echo "  $(command -v node)" >&2
  echo "Install a newer Node, or run via tsx:" >&2
  echo "  npm install -D tsx && npx tsx demos/browse-demo.ts" >&2
  exit 1
fi
