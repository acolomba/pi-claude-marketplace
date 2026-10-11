#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/pi.sh [--clear] [--home PATH] [--cd PATH] [--] [pi args...]

Runs Pi with only this project, pi-mcp-adapter, pi-subagents,
@quintinshaw/pi-dynamic-workflows and Pi's built-in tool search loaded as
extensions.

Pi is the version package-lock.json pins, run from node_modules -- run
`npm install` first. This never launches a `pi` found on PATH.

The three companion extensions are installed, at versions pinned in this
script, into a private npm prefix outside the checkout. The default is
${XDG_CACHE_HOME:-$HOME/.cache}/pi-claude-marketplace/pi-runtime.
PI_CM_RUNTIME_PREFIX overrides the prefix, which must be outside the
checkout.

pi-mcp-adapter writes to <agent dir>/settings.json when it starts (adapter
5 adds "-builtin:mcp", which turns off Pi's built-in MCP). To keep that
write out of ~/.pi/agent, the Pi home defaults to <prefix>/home when
neither --home nor PI_CODING_AGENT_DIR is set. Set PI_CODING_AGENT_DIR to
run against another agent directory, ~/.pi/agent included.

The default home starts without auth.json and models.json, so log in once
with /login or set your provider's environment variables. With the default
home, a PI_CODING_AGENT_SESSION_DIR that is already set is kept.

Options:
  --cd PATH    Run Pi from PATH instead of the current directory.
  --clear      Clear the terminal before preparing and launching Pi.
  -h, --help   Show this help.
  --home PATH  Use PATH as the Pi home for this run (PATH/agent and
               PATH/sessions). The default is <prefix>/home.

All remaining arguments are forwarded to pi.
USAGE
}

clear_screen=0
pi_home=""
default_home=0
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

# Companion extensions, pinned here only (PIFL-07): never as dependencies,
# devDependencies or package-lock.json entries (NFR-5, D-98-10). package.json
# declares pi-mcp-adapter and pi-subagents as optional peers. Engine 3.14.0
# is the newest release that docs/workflows-compatibility.md grades. It
# includes engine PR #232, which fixes result delivery under the
# --no-extensions -e launch below. It stores workflows under
# PI_CODING_AGENT_DIR when that variable is set, as the bridge does
# (WPTH-04). --home sets the variable, so an engine before 3.14.0 does not
# find the workflows the bridge installs.
pi_cm_pins=(
  "pi-mcp-adapter@5.2.0"
  "pi-subagents@0.74.0"
  "@quintinshaw/pi-dynamic-workflows@3.14.0"
)

# Prefix resolved against the invocation directory, before the --cd change
# below moves the shell elsewhere. The check runs before mkdir, so a refused
# prefix is never created: canonicalize the deepest existing ancestor with
# `cd ... && pwd -P` (macOS ships neither `realpath -m` nor `readlink -f`)
# and append the rest. A `..` in that not-yet-existing rest cannot be
# resolved without creating directories, so it is refused.
default_prefix="${XDG_CACHE_HOME:-$HOME/.cache}/pi-claude-marketplace/pi-runtime"
prefix="${PI_CM_RUNTIME_PREFIX:-$default_prefix}"
case "$prefix" in
  /*) ;;
  *) prefix="$PWD/$prefix" ;;
esac
resolved_repo_root=$(cd -- "$repo_root" && pwd -P)

refuse_prefix_in_checkout() {
  local dir=$1
  local rest=""
  while [[ ! -d "$dir" ]]; do
    rest="/$(basename -- "$dir")$rest"
    dir=$(dirname -- "$dir")
  done
  if [[ "$rest/" == */../* ]]; then
    echo "scripts/pi.sh: PI_CM_RUNTIME_PREFIX ($1) has a '..' below a directory that does not exist yet." >&2
    exit 2
  fi
  local resolved
  resolved="$(cd -- "$dir" && pwd -P)$rest"
  if [[ "$resolved" == "$resolved_repo_root" || "$resolved" == "$resolved_repo_root"/* ]]; then
    echo "scripts/pi.sh: PI_CM_RUNTIME_PREFIX ($resolved) is the checkout or inside it." >&2
    echo "scripts/pi.sh: refusing -- the pinned companions and the package.json," >&2
    echo "scripts/pi.sh: package-lock.json and node_modules that npm writes into the" >&2
    echo "scripts/pi.sh: prefix must stay outside the repository." >&2
    exit 2
  fi
}

refuse_prefix_in_checkout "$prefix"
mkdir -p "$prefix"
prefix=$(cd -- "$prefix" && pwd -P)

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
  # in the prefix beside the one package-lock.json pins. --ignore-scripts is
  # deliberately not used: the companions' own install scripts must run.
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

# pi-mcp-adapter 5 writes "-builtin:mcp" into <agent dir>/settings.json on
# its first start. Without --home or an explicit PI_CODING_AGENT_DIR, Pi
# would use ~/.pi/agent, so the edit would turn off the built-in MCP in the
# operator's normal Pi sessions. Default to a Pi home inside the prefix.
if [[ -z "$pi_home" && -z "${PI_CODING_AGENT_DIR:-}" ]]; then
  pi_home="$prefix/home"
  default_home=1
fi

if [[ -n "$pi_home" ]]; then
  export PI_CODING_AGENT_DIR="$pi_home/agent"
  if ((default_home)); then
    # The operator chose no home, so a session dir they exported still wins.
    export PI_CODING_AGENT_SESSION_DIR="${PI_CODING_AGENT_SESSION_DIR:-$pi_home/sessions}"
  else
    export PI_CODING_AGENT_SESSION_DIR="$pi_home/sessions"
  fi
  mkdir -p "$PI_CODING_AGENT_DIR" "$PI_CODING_AGENT_SESSION_DIR"
fi

# On Pi 1.0.0, --no-extensions also drops Pi's built-in tool-search
# extension. -e builtin:tool-search keeps tool_search available for a
# "defaultTools": ["+tool_search"] setting. Pi's builtin:mcp stays off,
# because pi-mcp-adapter replaces it.
exec node "$pi_cli" \
  --no-extensions \
  --no-skills \
  --no-prompt-templates \
  -e "$project_extension" \
  -e "$mcp_adapter_extension" \
  -e "$subagents_extension" \
  -e "$workflows_extension" \
  -e builtin:tool-search \
  "${pi_args[@]}"
