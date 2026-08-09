---
created: 2026-08-09
resolves_phase: 98
source: 97-REVIEW.md WR-02
---

# `enable` gives no remediation affordance when its persisted gate is stale

`runEnableBranch` derives its ledger gate from `installed.compatibility.
installable` (`orchestrators/plugin/enable-disable.ts`), a value persisted at
install/update time. A record that was fully installable when disabled, but
whose manifest entry has since gained an unsupported kind, derives
`partial = false`, so the ledger runs `requireInstallable` and throws
`PluginShapeError`.

`narrowEnableFailure` only recognises `ENOENT`, so that row renders with an
EMPTY reasons array — a bare `⊘ <plugin> (failed)` plus a cause trailer. Both
`install` and `update` surface the resolver's partialable discriminant and
append the `--partial` hint; `enable` has no `--partial` flag and emits no
hint. The only recovery is `update --partial` (which rewrites
`compatibility.installable` through `refreshDisabledRecord`), and it is
undiscoverable from the failed row.

Compounding it: `update --partial` is exactly the command the completion
provider never offers for a disabled record (WR-04, carried separately).

## Why deferred

Both candidate fixes change byte-pinned output on the enable failure path —
new hint text, or a new `--partial` flag on the `enable` verb with its own
catalog states and arg-parsing surface. Phase 97's scope is the disabled-state
classification repair, not the enable verb's flag surface.

## Where it lands

Pick one and document the choice at the gate derivation:

1. Narrow `PluginShapeError` in `narrowEnableFailure` the way
   `composeUpdateDeclineRow` does, and render a hint pointing at
   `update --partial`; or
2. Accept `--partial` on `enable` and widen the gate on request rather than on
   the persisted flag.

Either way: a new catalog state in `docs/output-catalog.md` under
`## /claude:plugin enable`, its fixture in `tests/architecture/
catalog-uat.test.ts`, and a row assertion in
`tests/orchestrators/plugin/enable-disable.test.ts`.
