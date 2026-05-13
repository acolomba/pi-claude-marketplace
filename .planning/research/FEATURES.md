# Research Pass: v1.1 `/claude:plugin reinstall` Features

## Table stakes

- **Top-level command parity with `update`:** add `/claude:plugin reinstall [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]` to router usage, dispatch, registration, README reference, and completion surfaces. Existing `update` UX is the closest template (`README.md:212-218`, `edge/router.ts:44-50`, `edge/handlers/plugin/update.ts:18-63`).
- **Three target forms:**
  - `reinstall <plugin>@<marketplace>`: reinstall one installed plugin.
  - `reinstall @<marketplace>`: reinstall every installed plugin from one marketplace.
  - bare `reinstall`: reinstall every installed plugin in selected scope(s).
- **Scope semantics match update:** `--scope user|project` accepted anywhere; without `--scope`, bare form should enumerate both scopes like update, and marketplace/plugin forms should resolve scope from state with existing ambiguity/not-found behavior (`edge/args.ts:41-56`, `orchestrators/plugin/update.ts:805-858`).
- **Installed-only operation:** reinstall must not install absent plugins. Empty target sets should succeed with `No plugins installed.` and no reload hint, matching update's empty-set behavior (`orchestrators/plugin/update.ts:159-162`).
- **No network sync:** unlike `update`, reinstall must not call `refreshGitHubClone`/`gitOps`; it should use the cached marketplace manifest already recorded in state. This is explicit milestone scope (`.planning/PROJECT.md:23,44`) and differs from update (`orchestrators/plugin/update.ts:165-193`).
- **Recorded-version preservation:** reinstall should restage from the cached manifest/root but keep the installed record's existing `version`; do not resolve a new version or skip because versions match. This follows milestone wording "cached marketplace manifests and recorded versions" (`.planning/PROJECT.md:23-24,44`).
- **Atomic replacement stronger than current update:** prepare replacement resources before touching old resources, and if reinstall fails, preserve previous state and previous installed resources (`.planning/PROJECT.md:15,24,45`). Current update's state-first phase-3 failure path intentionally can require recovery (`orchestrators/plugin/update.ts:571-658`), so reinstall should not be a thin wrapper around `update`.
- **Post-success plugin data cleanup:** delete the per-plugin data directory only after successful replacement (`.planning/PROJECT.md:25,46`). Cleanup failure should likely be warning-grade and retryable, analogous to uninstall data-dir cleanup (`docs/prd/pi-claude-marketplace-prd.md:267-270`).
- **Resource semantics remain install/update-compatible:** strict resolver/installability checks, generated-name conflict guards, variable substitution, soft-dep warnings, path containment, atomic JSON/rename primitives, and state guard/lock behavior should carry forward from install/update requirements (`docs/prd/...:247-260`, `555-577`).
- **Reload hint:** successful reinstall that changes/replaces generated resources should emit a `refresh` reload hint, same verb family as update (`docs/prd/...:559-563`, `1058-1062`). No resources changed => no hint.
- **Completion behavior:** top-level completion includes `reinstall`; `reinstall <here>` should complete installed plugin refs only and allow bare `@<marketplace>`, exactly like `update` (`edge/completions/provider.ts:43-50`, `197-217`; TC detail `docs/prd/...:530-544`).
- **Testing parity:** add router dispatch/usage tests, completion tests, handler shim tests mirroring `update`, and orchestrator tests for no-network, version-preservation, atomic-failure preservation, data-dir cleanup, and bulk partitions (`tests/edge/handlers/plugin/update.test.ts:1-14`, `tests/orchestrators/plugin/update.test.ts:26-37`).

## Differentiators for v1.1

- **Safer than uninstall+install:** the user should never be left with the plugin absent when reinstall fails.
- **Different from update:** reinstall runs even when the recorded version equals the manifest/plugin version; it does not refresh GitHub sources and does not upgrade the state version.
- **Data reset:** reinstall uniquely clears plugin data after successful replacement; neither install nor update currently removes the data dir.
- **Completion/status UX:** presents only installed plugins, reducing accidental "install" semantics.

## Anti-features / deferred

- No mutating LLM tool for reinstall; current tool surface is read-only list tools only (`edge/handlers/tools.ts:1-12`).
- No `--force`, `--dry-run`, JSON output, interactive selector, multi-ref bulk syntax, semver/lockfile model, enable/disable state, or dependency resolution. These remain out of scope/deferred patterns (`.planning/PROJECT.md:56-67`; `.planning/research/FEATURES.md:101-108`).
- No network refresh, autoupdate cascade, or marketplace update side effects.
- No Claude `local` scope.

## UX syntax

```text
/claude:plugin reinstall pr-review-toolkit@claude-plugins-official
/claude:plugin reinstall @claude-plugins-official
/claude:plugin reinstall
/claude:plugin reinstall --scope project
/claude:plugin reinstall @claude-plugins-official --scope user
```

Likely usage line:

```text
Usage: /claude:plugin reinstall [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]
```

## Likely REQ categories / IDs

- **PRL-1 Routing & usage:** top-level `reinstall` command routed through `/claude:plugin`; usage/docs updated.
- **PRL-2 Target forms:** plugin, marketplace-only, and bare targets.
- **PRL-3 Scope:** `--scope` accepted anywhere; scope resolution mirrors update.
- **PRL-4 Installed-only / empty set:** absent targets skipped or error surfaced; empty sets say `No plugins installed.` without reload hint.
- **PRL-5 Manifest/version policy:** cached manifest only, no sync; preserve recorded version.
- **PRL-6 Atomic replacement:** old state/resources preserved on any pre-commit/commit failure.
- **PRL-7 Data cleanup:** plugin data dir removed only after successful replacement; cleanup leak warning.
- **PRL-8 UX rendering:** success/bulk partitions, soft-dep warnings, `refresh` reload hint.
- **PRL-9 Completion:** top-level keyword plus installed-only plugin refs and `@marketplace` form.
- **PRL-10 Validation/tests:** router, handler, completion, orchestrator, no-network, and atomic-failure coverage.

Cross-cutting inherited IDs: AP-1..4, TC-1/3/4/6/7/8/9, RH-1..5, ST-1/3/7, PS-1/4, AS-1/4/5/6, PI-6/10/11/12/14, PU-2/4, and update target-shape precedent PUP-1.

## Confidence

**High** on UX shape, scope, completion, no-network, installed-only, and data-dir cleanup: all are explicitly stated in `.planning/PROJECT.md` or directly mirrored from update. **Medium** on exact bulk rendering and direct missing-plugin severity: current update partitions skipped/failed outcomes, but v1.1 may choose sharper single-target errors as long as prior installs are preserved.
