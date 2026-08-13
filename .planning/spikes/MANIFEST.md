# Spike Manifest

## Idea

Now that pi-claude-marketplace has a desired-state configuration file
(`claude-plugins.json`), do we still need field-level backward-compatibility
migration for every shape change to installed records (`state.json`) and to
the config file itself? Or can a version stamp + forced reinstall (using the
existing reinstall ledger) replace per-field migration code entirely, given
the project has few enough users that a forced reinstall on upgrade is an
acceptable cost?

## Requirements

- Any replacement for `migrate-config.ts` MUST NOT let "config file
  absent" collapse to "empty desired state" for a scope with a populated
  `state.json` -- that reads as "uninstall everything" to
  `reconcile/plan.ts`'s `buildUninstallBucket` (Spike 002).

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | installed-record-backcompat-audit | standard | Given state.json/agent-marker backward-compat code, when audited against force-reinstall, then produce an exact removal inventory | ✓ VALIDATED | backward-compat, migration, state-json, audit |
| 002 | config-file-backcompat-audit | standard | Given claude-plugins.json's first-run migration, when audited for removability, then produce an exact inventory and flag any unsafe removal | ⚠ PARTIAL | backward-compat, migration, config-file, audit |
