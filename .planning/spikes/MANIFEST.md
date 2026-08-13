# Spike Manifest

## Idea

### Backward-compatibility removal (spikes 001-003)

Now that pi-claude-marketplace has a desired-state configuration file
(`claude-plugins.json`), do we still need field-level backward-compatibility
migration for every shape change to installed records (`state.json`) and to
the config file itself? Or can a version stamp + forced reinstall (using the
existing reinstall ledger) replace per-field migration code entirely, given
the project has few enough users that a forced reinstall on upgrade is an
acceptable cost?

### Claude plugin dependency support (spikes 004-005)

Do Claude Code plugins support declaring a dependency on another plugin? If
so, is that dependency actually *resolved* (auto-installed) anywhere in the
pipeline -- upstream in Claude Code itself, or in this repo's own
`plugin.json`/`marketplace.json` handling -- or is it purely an informational
declaration the user must act on manually?

## Requirements

### Backward-compatibility removal

- Any replacement for `migrate-config.ts` MUST NOT let "config file
  absent" collapse to "empty desired state" for a scope with a populated
  `state.json` -- that reads as "uninstall everything" to
  `reconcile/plan.ts`'s `buildUninstallBucket` (Spike 002).
- Staleness detection for `state.json` should reuse `STATE_VALIDATOR.Check()`
  on the raw un-migrated JSON rather than introducing a new per-record
  version stamp -- it already fails on every REQUIRED-field addition and
  covers plugin- and marketplace-level records in one check (Spike 003).
- The combination "stale state.json AND absent claude-plugins.json" MUST
  fail loud (notify + explicit recovery step), never silently wipe or
  silently auto-migrate (Spike 003, composing Spike 002's finding).
- The D-13 `autoupdate` legacy field is not worth actively scrubbing --
  it's provably inert (CLASSIFY-ONLY read, reconciled against config
  truth before any write) and structurally invisible to a
  Check()-based staleness gate (TypeBox tolerates extra properties).
  Leave it in place rather than keeping the 3-file scrub threading alive
  (Spike 003).

### Claude plugin dependency support

[Updated as spikes 004-005 progress.]

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | installed-record-backcompat-audit | standard | Given state.json/agent-marker backward-compat code, when audited against force-reinstall, then produce an exact removal inventory | ✓ VALIDATED | backward-compat, migration, state-json, audit |
| 002 | config-file-backcompat-audit | standard | Given claude-plugins.json's first-run migration, when audited for removability, then produce an exact inventory and flag any unsafe removal | ⚠ PARTIAL | backward-compat, migration, config-file, audit |
| 003 | force-reinstall-on-version-mismatch | standard | Given a stale record, when STATE_VALIDATOR.Check() gates loading instead of field-by-field migration, then stale records are detected with no new plumbing, covering plugin- and marketplace-level records alike | ⚠ PARTIAL | backward-compat, migration, force-reinstall, design, prototype |
| 004 | claude-plugin-dependency-spec | standard | Given Anthropic's official Claude Code plugin/marketplace docs, when researched for a `dependencies` field, then determine whether it exists, its shape, and what Claude Code itself does with it at install time | ✓ VALIDATED | claude-code, plugin-dependencies, upstream-spec, research |
