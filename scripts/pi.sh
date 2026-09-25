#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/pi.sh [--clear] [--home PATH] [--cd PATH] [--] [pi args...]

Runs Pi with only this project, pi-mcp-adapter, pi-subagents, and
@quintinshaw/pi-dynamic-workflows loaded as extensions.

Pi is the version package-lock.json pins, run from node_modules -- run
`npm ci` first. This never launches a `pi` found on PATH.

The three companion extensions are installed, at versions pinned in this
script, into a private npm prefix outside the checkout. The default is
${XDG_CACHE_HOME:-$HOME/.cache}/pi-claude-marketplace/pi-runtime.
PI_CM_RUNTIME_PREFIX overrides the prefix, which must be outside the
checkout.

Options:
  --cd PATH    Run Pi from PATH instead of the current directory.
  --clear      Clear the terminal before preparing and launching Pi.
  -h, --help   Show this help.
  --home PATH  Use PATH as the Pi home for this run.

All remaining arguments are forwarded to pi.
USAGE
}

clear_screen=0
pi_home=""
pi_cd=""
pi_args=()

while (($# > 0)); do
  case "$1" in
    --clear)
      clear_screen=1
      shift
      ;;
    --home)
      if (($# < 2)); then
        echo "scripts/pi.sh: --home requires a path" >&2
        exit 2
      fi
      pi_home=$2
      shift 2
      ;;
    --cd)
      if (($# < 2)); then
        echo "scripts/pi.sh: --cd requires a path" >&2
        exit 2
      fi
      pi_cd=$2
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      pi_args+=("$@")
      break
      ;;
    *)
      pi_args+=("$1")
      shift
      ;;
  esac
done

if ((clear_screen)); then
  clear
fi

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)

# Resolve the repository's own Pi CLI through tests/pi-runtime.ts, never a
# `pi` on PATH. pathToFileURL keeps the import safe for spaces and `#` in
# repo_root. A resolution failure (package not installed) writes an `npm ci`
# hint to stderr and exits non-zero, which `set -e` turns into a script exit.
pi_cli=$(node --input-type=module -e '
import { pathToFileURL } from "node:url";
const { resolvePiRuntime } = await import(pathToFileURL(process.argv[1]).href);
try {
  process.stdout.write(resolvePiRuntime(process.argv[2]).cliPath);
} catch (error) {
  process.stderr.write(`scripts/pi.sh: ${error.message}\n`);
  process.exitCode = 1;
}
' "$repo_root/tests/pi-runtime.ts" "$repo_root")

# Companion extensions, pinned here only -- never in package.json or
# package-lock.json (NFR-5, D-98-10). 3.13.0 is the engine version
# docs/workflows-compatibility.md grades.
pi_cm_pins=(
  "pi-mcp-adapter@2.37.0"
  "pi-subagents@0.71.0"
  "@quintinshaw/pi-dynamic-workflows@3.13.0"
)

# Prefix resolved against the invocation directory, before the --cd change
# below moves the shell elsewhere. mkdir -p plus `cd ... && pwd -P` is the
# portable equivalent of `realpath -m`/`readlink -f`, neither of which macOS
# ships.
default_prefix="${XDG_CACHE_HOME:-$HOME/.cache}/pi-claude-marketplace/pi-runtime"
prefix="${PI_CM_RUNTIME_PREFIX:-$default_prefix}"
case "$prefix" in
  /*) ;;
  *) prefix="$PWD/$prefix" ;;
esac
mkdir -p "$prefix"
resolved_prefix=$(cd -- "$prefix" && pwd -P)
resolved_repo_root=$(cd -- "$repo_root" && pwd -P)
if [[ "$resolved_prefix" == "$resolved_repo_root" || "$resolved_prefix" == "$resolved_repo_root"/* ]]; then
  echo "scripts/pi.sh: PI_CM_RUNTIME_PREFIX ($resolved_prefix) is the checkout or inside it." >&2
  echo "scripts/pi.sh: refusing -- npm install --prefix there would write the workflow" >&2
  echo "scripts/pi.sh: engine into the repository's own manifests (NFR-5, D-98-10)." >&2
  exit 2
fi
prefix="$resolved_prefix"

if [[ -n "$pi_cd" ]]; then
  cd "$pi_cd"
fi

project_extension="$repo_root/extensions/pi-claude-marketplace/index.ts"

pin_met() {
  local name=$1
  local version=$2
  local pkg_json="$prefix/node_modules/$name/package.json"
  [[ -f "$pkg_json" ]] || return 1
  local installed
  installed=$(node -p 'require(process.argv[1]).version' "$pkg_json" 2>/dev/null) || return 1
  [[ "$installed" == "$version" ]]
}

need_install=0
for spec in "${pi_cm_pins[@]}"; do
  if ! pin_met "${spec%@*}" "${spec##*@}"; then
    need_install=1
  fi
done

if ((need_install)); then
  echo "scripts/pi.sh: installing pinned companions into $prefix" >&2
  # --legacy-peer-deps: Pi hands its own core packages (@earendil-works/*,
  # typebox) to every extension it loads, so the declared peers are never
  # used. Without this flag npm installs them, landing a second, unpinned Pi
  # in the prefix (against Decision 1). --ignore-scripts is deliberately not
  # used: the companions' own install scripts are expected to run.
  npm install --prefix "$prefix" --legacy-peer-deps --save-exact --no-audit --no-fund \
    "${pi_cm_pins[@]}" >&2
  for spec in "${pi_cm_pins[@]}"; do
    if ! pin_met "${spec%@*}" "${spec##*@}"; then
      echo "scripts/pi.sh: pin not satisfied after install: $spec" >&2
      exit 1
    fi
  done
fi

mcp_adapter_extension="$prefix/node_modules/pi-mcp-adapter/index.ts"
subagents_extension="$prefix/node_modules/pi-subagents/index.js"
workflows_extension="$prefix/node_modules/@quintinshaw/pi-dynamic-workflows/extensions/workflow.ts"

for extension_path in "$project_extension" "$mcp_adapter_extension" "$subagents_extension" "$workflows_extension"; do
  if [[ ! -f "$extension_path" ]]; then
    echo "scripts/pi.sh: extension not found: $extension_path" >&2
    exit 1
  fi
done

if [[ -n "$pi_home" ]]; then
  export PI_CODING_AGENT_DIR="$pi_home/agent"
  export PI_CODING_AGENT_SESSION_DIR="$pi_home/sessions"
  mkdir -p "$PI_CODING_AGENT_DIR" "$PI_CODING_AGENT_SESSION_DIR"
fi

exec node "$pi_cli" \
  --no-extensions \
  --no-skills \
  --no-prompt-templates \
  -e "$project_extension" \
  -e "$mcp_adapter_extension" \
  -e "$subagents_extension" \
  -e "$workflows_extension" \
  "${pi_args[@]}"
