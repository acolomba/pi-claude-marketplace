# Deferred Items

- `extensions/pi-claude-marketplace/persistence/state-io.ts:433,437` — repository-wide lint reports a redundant non-object guard and type assertion after Plan 110-08 narrowed `MigrationResult.marketplaces`. Plan 110-09 already owns this pair and the planned guard removal.
