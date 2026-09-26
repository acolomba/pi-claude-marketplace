#!/usr/bin/env bash
# Demand signal for Claude Code plugin `workflows` (backlog WFLW-01).
#
# Question: do real Claude plugins in the wild ship the `workflows` component
# kind, and how do they declare it -- via the `workflows` manifest field, or by
# the default `<pluginRoot>/workflows/` convention scan?
#
# Method: GitHub code search finds workflow SCRIPTS by their contract signature
# (`export const meta` inside a `workflows/` path) rather than by the manifest
# field, because searching the field name over-matches description prose (see
# README "False start"). Each distinct repo is then checked over raw.github-
# usercontent.com for `.claude-plugin/plugin.json`, which is what makes it a
# Claude PLUGIN rather than a loose script collection.
#
# Requires: gh (authenticated), python3, curl.
# Code search is rate limited to 10 req/min, hence the sleeps.

set -uo pipefail

PAGES="${PAGES:-4}"
QUERY='"export const meta" path:workflows'
OUT="$(mktemp -d)"
REPOS="$OUT/repos.txt"
: >"$REPOS"

echo "== querying GitHub code search (${PAGES} pages) =="
gh api -X GET search/code -f q="$QUERY" -f per_page=1 --jq '"total hits: \(.total_count)"'

for page in $(seq 1 "$PAGES"); do
  gh api -X GET search/code -f q="$QUERY" -f per_page=25 -f page="$page" \
    --jq '.items[].repository.full_name' >>"$REPOS" 2>/dev/null
  [ "$page" -lt "$PAGES" ] && sleep 7
done

sort -u "$REPOS" -o "$REPOS"
echo "distinct repos sampled: $(wc -l <"$REPOS")"

echo
echo "== classifying each repo =="
plugins=0
field=0
convention=0
notplugin=0

while read -r repo; do
  manifest=""
  for br in main master; do
    manifest=$(curl -sf "https://raw.githubusercontent.com/$repo/$br/.claude-plugin/plugin.json") && break
  done

  if [ -z "$manifest" ]; then
    notplugin=$((notplugin + 1))
    printf '  %-45s  not-a-plugin\n' "$repo"
    continue
  fi

  plugins=$((plugins + 1))
  if printf '%s' "$manifest" | python3 -c 'import json,sys; sys.exit(0 if "workflows" in json.load(sys.stdin) else 1)' 2>/dev/null; then
    field=$((field + 1))
    printf '  %-45s  PLUGIN  declares workflows field\n' "$repo"
  else
    convention=$((convention + 1))
    printf '  %-45s  PLUGIN  default workflows/ convention\n' "$repo"
  fi
done <"$REPOS"

echo
echo "== summary =="
echo "  claude plugins shipping workflows/ : $plugins"
echo "    via explicit manifest field      : $field"
echo "    via default convention scan      : $convention"
echo "  script collections (not plugins)   : $notplugin"

rm -rf "$OUT"
