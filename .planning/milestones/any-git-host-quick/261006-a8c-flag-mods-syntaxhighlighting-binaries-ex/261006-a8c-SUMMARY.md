---
phase: 261006-a8c
plan: 01
subsystem: domain/resolver
tags: [resolver, unsupported-components, hooks, upstream-parity]
status: complete
requires: []
provides:
  - "`mod` unsupported kind from a non-empty hooks.json `modules` array (default and referenced hooks files)"
  - "`syntaxHighlighting` unsupported kind, top level and under `experimental`"
  - "`experimental.outputStyles` detection"
  - "`binaries` unsupported kind for Claude Code's 14 official marketplace names only"
  - "Required `ResolveContext.marketplaceName`, threaded from every resolveStrict caller"
affects:
  - extensions/pi-claude-marketplace/domain/components/hooks.ts
  - extensions/pi-claude-marketplace/domain/hooks-resolution.ts
  - extensions/pi-claude-marketplace/domain/unsupported-components.ts
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/domain/resolver-types.ts
  - extensions/pi-claude-marketplace/orchestrators (11 resolveStrict caller files)
tech-stack:
  added: []
  patterns:
    - "Rule B: `marketplaceContext: Pick<ResolveContext, \"marketplaceRoot\" | \"marketplaceName\">` replaces a positional `marketplaceRoot` string"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/components/hooks.ts
    - extensions/pi-claude-marketplace/domain/hooks-resolution.ts
    - extensions/pi-claude-marketplace/domain/unsupported-components.ts
    - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
    - extensions/pi-claude-marketplace/domain/resolver-types.ts
    - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
    - skills/claude-code-compat-research/SKILL.md
    - docs/prd/pi-claude-marketplace-prd.md
    - CHANGELOG.md
decisions:
  - "UKIND-01: `parseHooksConfig` success arm carries `declaresModule`; a module wrapper may omit `hooks` and parses as an empty hooks set; the parser never reads the module"
  - "UKIND-01: hooks files named by the entry/manifest `hooks` field are read once each, only for a module, only when the default hooks.json declares none; their parse failures are ignored"
  - "UKIND-03: `ResolveContext.marketplaceName` is required so typecheck proves every caller passes it; the official-name check lowercases the name like upstream"
metrics:
  duration: "~30 min (07:58 plan commit to 08:25 docs commit, local time)"
  completed: 2026-10-06
estimate:
  tokens: 150000
  tasks: 3
actuals:
  tokens: 27063
  tasks: 3
  commits: 4
plan_head_before: dce7ec8048cafcc0eebc271dc395bb8d8e6d0f0e
plan_head_after: a3e0a50ee2b4bcb01274a600df27a234821e6515
---

# Quick Task 261006-a8c: Flag mod, syntaxHighlighting, binaries, and experimental outputStyles Summary

The resolver now flags four upstream Claude Code component kinds as unsupported (`partially-available` with `contains <kind>`): a hooks module declared by a non-empty `modules` array in `hooks/hooks.json` or in a hooks file named by the `hooks` field (`mod`), `syntaxHighlighting` at the top level or under `experimental`, `experimental.outputStyles`, and a non-empty `binaries` map from one of Claude Code's 14 official marketplaces. A modules-only `hooks.json` no longer makes its plugin `unavailable`.

`actuals.tokens` is chars/4 over the realized diff (`git diff dce7ec80..HEAD | wc -c` = 108252 bytes).

## Baseline

- Plan base: `dce7ec80` (the plan commit on top of `c10661d5`). `git diff --quiet c10661d5 HEAD -- extensions tests` exited 0, so the precondition held.
- Node: v26.10.0.
- Before Task 1, the Task 1 resolver probe printed `unavailable malformed hooks.json: hooks.json failed schema validation: /modules/0: must be object` (per the plan's measurement). After Task 1 it printed `partially-available contains mod` and exited 0.

## Commits

| # | Hash | Subject | Pre-commit hook |
|---|------|---------|-----------------|
| 1 | `eb7978aa` | feat(resolver): flag a hooks.json modules array as the mod kind | Passed, including `npm run check:commit` |
| 2 | `ab639a47` | feat(resolver): detect referenced hooks modules and syntax highlighting | First attempt FAILED in `check:commit` (ESLint `import-x/order`: missing blank line between import groups in `domain/hooks-resolution.ts`). The commit did not happen. Fixed the import grouping, restaged, and committed again: Passed, including `npm run check:commit` |
| 3 | `1803b648` | feat(resolver): flag binaries only for official marketplaces | Passed, including `npm run check:commit` (27 files staged) |
| 4 | `a3e0a50e` | docs: list the new unsupported component kinds | Passed; `check:commit` skipped (no build inputs staged) |

The tracer gate after Task 1 re-ran the Task 1 `<verify>` command end to end: exit 0.

## npm run check record

- Command: the Task 3 `<verify>` chain, ending with `npm run check > "${TMPDIR:-/tmp}/261006-a8c-check.log" 2>&1`
- Exit status: **0** (all prechecks printed `PRECHECKS_OK`, then `npm run check` passed)
- Commit: `a3e0a50ee2b4bcb01274a600df27a234821e6515` (clean tree for `extensions tests skills docs CHANGELOG.md`)
- Node: v26.10.0
- Log: `/tmp/261006-a8c-check.log` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding all `passed`; unpaired and integration tests silent-pass; `Merged LCOV: coverage/direct.lcov (258 records)`)

## PR number

- `gh pr list --head features/unsupported-kinds --state all --json number --jq '.[0].number'` printed nothing (no PR yet).
- `gh api 'repos/{owner}/{repo}/issues?state=all&per_page=1&sort=created&direction=desc' --jq '.[0].number'` printed `245`.
- CHANGELOG.md uses `#246`.

## Findings recorded per the plan

- **The resolver read only `hooks/hooks.json` before this change.** `readHooksConfig` joined that one path, and nothing read the entry or manifest `hooks` field. So no existing read of a referenced hooks file could be reused. Task 2 generalized the private `readHooksConfig` to take a file path. `resolveHooks` reads the default file first. Only when it declares no module, it walks the string paths from `entry.hooks` then `manifest.hooks` (a string, or the string elements of an array; inline records name nothing), resolves each through `resolveContainedComponentPath` (absolute, escaping, and symlinked paths are skipped unread), skips the default path and any path already probed, and reads each remaining file once through the same stat/read/`parseHooksConfig` routine. Parse failures and missing files are ignored; read errors propagate. The first module-declaring file ends the probe. Referenced command hooks are never adopted.
- **Schema:** `PLUGIN_ENTRY_VALIDATOR` and `PLUGIN_MANIFEST_VALIDATOR` already accept unknown keys of any type (`binaries`, `syntaxHighlighting`, `experimental`), so `domain/components/plugin.ts` did not change.
- **Rendering:** the new kinds render `{unsupported component}` through the existing `narrowUnsupportedKinds` catch-all; the verify command confirmed `narrowUnsupportedKinds(["mod","syntaxHighlighting","binaries"])` returns `["unsupported component"]`. `UnsupportedComponentKind` is referenced only in its own module.

## Docs left unchanged on purpose

- `README.md`: line 164 gives examples, not a list.
- `docs/output-catalog.md`: it lists no kinds, and it is a build input.
- `docs/competitive-analysis/pi-plugins.md`: a dated comparison whose rows also state a competitor's behavior.
- `docs/workflows-compatibility.md`: it mentions the schema only.
- `.planning/PROJECT.md`: a planning record.

## Upstream items deliberately left out

- `experimental.evals`
- the hooks.json `surface` key
- the binaries feature flag (the official-name and non-empty-map checks apply without it)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESLint import-x/order in hooks-resolution.ts**
- **Found during:** Task 2 commit hook
- **Issue:** a missing blank line between the sibling import group and the `import type` group.
- **Fix:** split the mixed `resolveContainedComponentPath, type ComponentPathResolution` import into a value import and an `import type`, and restored the group separator.
- **Files modified:** `extensions/pi-claude-marketplace/domain/hooks-resolution.ts`
- **Commit:** `ab639a47`

### Minor implementation choices

- `parseHooksConfig` gained two private helpers (`isModuleWrapper`, `hooksCandidate`); `resolveHooks` gained `recordHooksConfig`, `hooksFieldPaths`, `referenceDeclaresModule`, and `referencedFilesDeclareModule` to stay under both complexity gates. The `collectUnsupportedKinds` input type is declared inline (no exported or module-private named interface, which fallow would flag as a private-type leak).
- Two extra parse cases beyond the behavior list pin the modules-wrapper edge: a non-object `hooks` beside a module still fails with `<root>: must be object`.
- `tests/orchestrators/plugin/fetch.test.ts`: renamed the forwarding fake's `marketplaceRoot` parameter to `marketplaceContext` (the plan allowed this), so the file is in commit 3.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` uses `mpRecord.name` as the plan's table specified.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-a8c-01 is mitigated as planned: every referenced hooks path goes through `resolveContainedComponentPath` before any stat or read, and the Task 2 read-log tests prove escaping and absolute references are never read.

## State updates

Not performed by the executor: per the task constraints the orchestrator owns STATE.md, PLAN.md, and SUMMARY.md commits, and ROADMAP.md is not updated for a quick task.

## Self-Check: PASSED

- All 20 modified source/doc files exist; the SUMMARY exists at this path.
- Commits `eb7978aa`, `ab639a47`, `1803b648`, `a3e0a50e` are ancestors of HEAD.
