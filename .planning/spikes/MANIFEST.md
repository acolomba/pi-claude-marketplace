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

- [to be filled in as spikes progress]

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | installed-record-backcompat-audit | standard | Given state.json/agent-marker backward-compat code, when audited against force-reinstall, then produce an exact removal inventory | ✓ VALIDATED | backward-compat, migration, state-json, audit |
