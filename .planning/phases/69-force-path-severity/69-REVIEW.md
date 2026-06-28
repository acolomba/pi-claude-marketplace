---
phase: 69-force-path-severity
reviewed: 2026-06-28T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 69: Code Review Report

**Reviewed:** 2026-06-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the SEV-01..05 severity-stamping work against diff base `2bbbcfc4`.
The structural correctness of the change set is sound:

- The `cascadeSeverity` / `computeSeverity` MAX-reduce model (`shared/notify.ts`
  lines 2181-2221, 2223-2268) is **unmodified** and byte-stable. The notify.ts
  diff only adds the optional `forceHint?: boolean` field on
  `PluginUnavailableMessage`, the `FORCE_INSTALL_HINT_TRAILER` constant, and a
  single render-time append in `composePluginLinesWith`. No change to the reduce
  logic itself — the READ-ONLY requirement holds.
- The new `forceable` discriminant threads correctly through
  `PluginShapeErrorShape` -> `classifyEntityShapeError` (narrowed only on the
  two arms that declare it) -> `EntityErrorRow` -> `composeUnavailableMessage`.
  No unsafe field access on a shape that lacks `forceable`.
- `newlyDegraded` read-timing is correct: `preflight.record` is the state loaded
  in `preflightUpdate` (`loadState`) BEFORE `markUpdateInProgress` runs, and
  `markUpdateInProgress` mutates a freshly re-loaded state object inside its own
  `withStateGuard` closure, so `preflight.record.compatibility.unsupported`
  retains the genuine pre-update value.
- `PluginBackfilledOutcome.unsupported` (new REQUIRED field) has exactly one
  construction site (`maybeBackfillPlugin`), which sets it; `narrowUnsupportedKinds`
  is fed `[]` on the `installable` arm so the brace collapses byte-for-byte.
- The autoupdate `force: true` path is fail-clean: a structural `unavailable`
  candidate is blocked by `requireForceInstallable` and captured into a
  `partition: "failed"` outcome by the catch in `updateSinglePlugin` — no
  uncaught throw escapes the cascade.

Two severity-model inconsistencies and one shipped placeholder string are below.

## Warnings

### WR-01: Companion-missing severity (SEV-01) is not applied on the marketplace autoupdate cascade

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:632-690`
**Issue:** The SEV-01 work threads `companionSeverity(...)` into the `installed`
/ `force-installed` / `updated` success rows in `plugin/install.ts` and
`plugin/update.ts`, raising a silently-degraded operation (declared soft-dep
companion unloaded) from `info` to `warning`. The marketplace autoupdate
cascade's own `outcomeToCascadePluginMessage(outcome, scope)` was NOT given the
same treatment: its `(updated)` arm hard-stamps `severity: "info"` and its new
`(force-installed)` arm stamps only `outcome.newlyDegraded === true ? "warning"
: "info"`. Neither factors in the companion probe. Consequently, the same plugin
that warns on a manual `update foo@mp` (missing `pi-subagents` / `pi-mcp-adapter`)
renders silently at `info` when the identical degradation occurs through the
autoupdate cascade. The function also has no `pi`/`SoftDepStatus` parameter, so
the probe is structurally unavailable at the mapping site — this looks like an
omission rather than a deliberate suppression (the design narrative documents
that the SEV-03 `newlyDegraded` warning is autoupdate-only, but says nothing
about suppressing the SEV-01 companion warning there).
**Fix:** If autoupdate is meant to mirror SEV-01, thread the single notify-time
`softDepStatus(pi)` probe into `outcomeToCascadePluginMessage` and combine it
with `newlyDegraded`, e.g.:
```ts
function outcomeToCascadePluginMessage(
  outcome: PluginUpdateOutcome,
  scope: Scope,
  probe: SoftDepStatus,
): UpdateRowMsg {
  // ...
  const companion = companionSeverity(outcome.declaresAgents, outcome.declaresMcp, probe);
  // updated arm:        severity: companion,
  // force-installed arm: severity: maxSeverity(companion, outcome.newlyDegraded === true ? "warning" : "info"),
}
```
If the suppression is intentional (autoupdate is background, the warning would
be noise), add an explicit comment recording that SEV-01 is deliberately not
applied on the autoupdate surface so the asymmetry is not read as a bug later.

### WR-02: Install-failure severity asymmetry — recoverable failure is louder than the unrecoverable one

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1517-1525`
**Issue:** `composeUnavailableMessage` stamps `severity: "error"` (plus the
`--force` hint) only when `entityErrorRow.forceable === true`; the structural
(non-forceable) `unavailable` install failure omits `severity` entirely, which
defaults to `info` (rank 0) in `cascadeSeverity`. The result: an install the
user explicitly requested that fails because the plugin is **force-degradable**
surfaces at `error`, while one that fails because the plugin is **structurally
unavailable** (force cannot help — the harder failure) surfaces at `info` with
no error/warning summary line. The change newly introduces this asymmetry
(before the phase both arms defaulted to `info`). A genuine, unrecoverable
install failure rendering at info under-signals to the operator.
**Fix:** Stamp an error-bearing severity on the structural arm as well so a
failed install is never reported as info:
```ts
return {
  status: "unavailable",
  name: plugin,
  reasons: entityErrorRow.reasons,
  ...(version !== undefined && version !== "" && { version }),
  severity: "error",
  ...(entityErrorRow.forceable === true && { forceHint: true }),
};
```
If the structural-info behavior must stay byte-frozen for catalog reasons,
record that constraint in a comment; otherwise the recoverable-louder-than-
unrecoverable inversion should be corrected.

## Info

### IN-01: User-facing `--force` hint string ships as an explicit placeholder

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:2160-2167`
**Issue:** `FORCE_INSTALL_HINT_TRAILER = "Re-run with --force to install the
supported components."` is rendered to end users now, but its own doc comment
states "Placeholder wording; the byte-exact form is frozen in the DOC reconcile
(DOC-01..03)." A placeholder user-contract string is shipping in this phase.
**Fix:** Acceptable as staged work if DOC-01..03 lands before release; ensure
the DOC reconcile is tracked so the placeholder does not escape to a release.

---

_Reviewed: 2026-06-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
