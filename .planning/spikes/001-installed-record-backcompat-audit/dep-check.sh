#!/bin/bash
# Verifies migrate.ts fill functions are called ONLY from the load path (state-io.ts),
# never from the install/add write paths -- i.e. they are pure legacy-catchup code,
# not shared logic with fresh-record construction.
echo "=== Callers of migrateLegacyMarketplaceRecords ==="
grep -rn "migrateLegacyMarketplaceRecords(" extensions/pi-claude-marketplace --include="*.ts" | grep -v "^extensions/pi-claude-marketplace/persistence/migrate.ts"

echo ""
echo "=== Callers of GENERATED_AGENT_MARKER_LEGACY ==="
grep -rn "GENERATED_AGENT_MARKER_LEGACY" extensions/pi-claude-marketplace --include="*.ts" | grep -v "bridges/agents/marker.ts\|bridges/agents/index.ts"

echo ""
echo "=== Does install.ts ever call migrate.ts helpers? ==="
grep -n "from \"../../persistence/migrate" extensions/pi-claude-marketplace/orchestrators/plugin/install.ts extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts 2>/dev/null || echo "(no imports found -- confirmed disjoint)"

echo ""
echo "=== schemaVersion 1 write sites (does anything still WRITE schemaVersion:1?) ==="
grep -rn "schemaVersion: 1\b" extensions/pi-claude-marketplace --include="*.ts" | grep -v test
