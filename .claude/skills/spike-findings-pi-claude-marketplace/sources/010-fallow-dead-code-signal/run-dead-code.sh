#!/usr/bin/env bash
# Reproduces spike 010's fallow dead-code investigation.
# Run from the repo root: bash .planning/spikes/010-fallow-dead-code-signal/run-dead-code.sh
set -euo pipefail

SPIKE_DIR=".planning/spikes/010-fallow-dead-code-signal"
CFG="$SPIKE_DIR/fallowrc-explicit-entry.json"

echo "### Zero-config run (no entry point told to fallow) ###"
npx --yes fallow dead-code --format human --summary

echo
echo "### Explicit-entry + production-mode run ###"
echo "Config: $CFG"
cat "$CFG"
npx --yes fallow dead-code -c "$CFG" --format human --summary

echo
echo "### Unused files (explicit entry) ###"
npx --yes fallow dead-code -c "$CFG" --unused-files --format human

echo
echo "### Ground-truth check: is each 'unused file' really unimported? ###"
for f in \
  "extensions/pi-claude-marketplace/domain/index.ts" \
  "extensions/pi-claude-marketplace/orchestrators/marketplace/info.messaging.ts" \
  "extensions/pi-claude-marketplace/transaction/rollback.ts"; do
  echo "--- $f ---"
  base="${f%.ts}"
  base="$(basename "$base")"
  grep -rn "from [\"'].*/${base}\(\.ts\)\?[\"']" extensions/ tests/ --include="*.ts" \
    | grep -v "^${f}:" || echo "  (no importers found -- confirms unused)"
done
