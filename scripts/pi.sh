#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/pi.sh [--clear] [--home PATH] [--cd PATH] [--] [pi args...]

Runs Pi with only this project, pi-mcp-adapter, and pi-subagents loaded as
extensions.

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

if [[ -n "$pi_cd" ]]; then
  cd "$pi_cd"
fi

project_extension="$repo_root/extensions/pi-claude-marketplace/index.ts"

ensure_global_package() {
  local package_name=$1
  if ! npm ls -g --depth=0 "$package_name" >/dev/null 2>&1; then
    npm install -g "$package_name"
  fi
}

ensure_global_package pi-mcp-adapter
ensure_global_package pi-subagents

npm_root=$(npm root -g)
mcp_adapter_extension="$npm_root/pi-mcp-adapter/index.ts"
subagents_extension="$npm_root/pi-subagents/src/extension/index.ts"

for extension_path in "$project_extension" "$mcp_adapter_extension" "$subagents_extension"; do
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

exec pi \
  --no-extensions \
  --no-skills \
  --no-prompt-templates \
  -e "$project_extension" \
  -e "$mcp_adapter_extension" \
  -e "$subagents_extension" \
  "${pi_args[@]}"
