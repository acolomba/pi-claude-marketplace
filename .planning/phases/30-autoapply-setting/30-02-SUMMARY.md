---
phase: 30-autoapply-setting
plan: 02
subsystem: plugin command surface
tags: [autoapply, command, config]
requires:
  - phase: 30-autoapply-setting
    provides: "the autoapply key and the autoapply load (30-01)"
provides:
  - "/claude:plugin autoapply [on|off] [--scope user|project] [--local]"
  - "the autoapply-status JSON outcome kind"
requirements-completed: [AAP-04]
key-decisions:
  - "AAP-D2 (CONTEXT D-14): bare form shows, on|off sets, following Claude Code's /effort and /fast; scope and layer flags as enable uses them"
  - "Show lists user base, user local, project base, project local, filtered by --scope and --local; no flag selects the base layer alone"
  - "Set writes the user base config by default, under the scope lock, after the MIG-01 migration for a base write, and writes nothing while any config is invalid; it never runs apply and suggests nothing"
completed: 2026-10-25
---

# Phase 30 Plan 02: The autoapply command

**`/claude:plugin autoapply` shows the value in effect, the file that sets it and each file's own value; `autoapply on|off` writes one config file.**

## Accomplishments

- `persistence/config-merge.ts`: `loadAutoapplyFiles` and `effectiveAutoapply` return the effective value with its source file; the load uses them.
- New raw kind `autoapply-status` across types, resolve, grammar, JSON, wire schema (`schema/claude-plugin.schema.json` regenerated) and dispatch.
- `orchestrators/reconcile/autoapply-setting.ts` (show, set), `pending.ts::notifyInvalidConfigs`, `config-write-back.ts::writeAutoapplyConfig`.
- Handler, router, register, flag catalog (`--local`), help text, `on|off` completions.
- 15 new scenarios in `features/plugin/autoapply.feature` (32 in all); help.feature's usage text.
- Docs: `docs/json-output.md`, `docs/output-catalog.md`, README.md / README.es.md, CHANGELOG; AGENTS.md's network policy names AAP-D1 (user-approved).

## Task Commits

1. `46c6fc66` feat(plugin): add the autoapply command that shows and sets the setting
2. `bde0d5f8` fix(plugin): write nothing on an autoapply set while a config is invalid

## Deviations

- Code review CR-01 / WR-01 changed the set to check all four configs under the lock and write nothing while any is invalid (the first version wrote the target and then reported the other file).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-30-07 (a set hiding recorded plugins from MIG-01) is mitigated, including the invalid-local case the review found.
