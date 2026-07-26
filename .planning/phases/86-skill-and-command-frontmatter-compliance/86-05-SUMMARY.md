---
phase: 86-skill-and-command-frontmatter-compliance
plan: 05
subsystem: orchestrators
tags: [frontmatter, degrade, reconcile, notify, warning-severity, redaction]

# Dependency graph
requires:
  - phase: 86-02
    provides: "InstallPluginOutcome.degradedKinds seam + per-component postCommitWarnings detail on the orchestrated channel"
provides:
  - "PluginInstalledOutcome.degradedKinds field (reconcile outcome union)"
  - "Propagation of InstallPluginOutcome.degradedKinds -> PluginInstalledOutcome in apply.ts install arm"
  - "Reconcile (installed) row raised to warning severity with one malformed skill/command token per kind (WARN-01 on the orchestrated surface)"
  - "redactAbsolutePaths applied to post-commit warnings before notifyDiagnostic (T-86-03 / NFR-9)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Outcome-flag propagation through the reconcile install arm mirrors the existing conditional postCommitWarnings spread (omit-when-empty for NREG-01 byte-identity)"
    - "One-token-per-kind-per-plugin reason on the (installed) row (mirrors orphan rewake), with per-component free-text detail on the notifyDiagnostic channel redacted at the emission seam"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - tests/orchestrators/reconcile/notify.test.ts
    - tests/orchestrators/reconcile/apply.test.ts

key-decisions:
  - "A degraded-but-installed component keeps the (installed) row at warning severity, NOT (partially-installed) (D-86-03)"
  - "Row-token construction extracted into installedRowFromOutcome helper to keep applyOutcomeToBlock cognitive complexity under the eslint ceiling"
  - "redactAbsolutePaths applied inside surfacePostCommitWarnings (the emission seam) rather than at the install.ts source, so all post-commit warnings are redacted before notifyDiagnostic and the redaction is directly observable in apply.test.ts"

patterns-established:
  - "installedRowFromOutcome: outcome -> PluginInstalledMessage row builder consolidating the degradedKinds -> reason token + severity mapping"

requirements-completed: [WARN-01, CLASS-01]

coverage:
  - id: D1
    description: "A plugin-installed outcome with degradedKinds=[skill] renders an (installed) row carrying malformed skill at warning severity (NOT partially-installed)"
    requirement: "WARN-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/notify.test.ts#WARN-01 / D-86-03: a plugin-installed outcome with degradedKinds=[skill] renders an (installed) row carrying {malformed skill} at warning severity (NOT partially-installed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "degradedKinds=[skill,command] rides ONE row with BOTH tokens (one per kind)"
    requirement: "CLASS-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/notify.test.ts#WARN-01 / D-86-03: degradedKinds=[skill,command] rides ONE row with BOTH tokens (one per kind)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A plugin-installed outcome with no degradedKinds is unchanged -- info severity, no reasons brace (byte-identity)"
    requirement: "WARN-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/notify.test.ts#WARN-01 / NREG-01: a plugin-installed outcome with no degradedKinds is unchanged -- info severity, no reasons brace"
        status: pass
    human_judgment: false
  - id: D4
    description: "A degraded outcome carries degradedKinds onto the rendered cascade row AND surfaces its per-component detail through notifyDiagnostic with the absolute source path redacted to its basename"
    requirement: "WARN-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#WARN-01 / D-86-03 / T-86-03: a degraded plugin-installed outcome carries degradedKinds onto the rendered cascade row AND surfaces its per-component detail through notifyDiagnostic with the absolute source path redacted to its basename"
        status: pass
    human_judgment: false

# Metrics
duration: 30min
completed: 2026-07-26
status: complete
---

# Phase 86 Plan 05: Orchestrated reason-token wire Summary

**The reconcile `plugin-installed` arm now consumes `InstallPluginOutcome.degradedKinds` (via a new `PluginInstalledOutcome.degradedKinds` field): a skill/command whose source frontmatter could not be parsed renders `(installed) {malformed skill|command}` at warning severity on the orchestrated cascade, with its per-component parse detail surfaced through `notifyDiagnostic` and any absolute source path redacted to its basename — closing WARN-01 on the primary install surface.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-26
- **Completed:** 2026-07-26
- **Tasks:** 1 (tracer)
- **Files modified:** 5

## Accomplishments

- Added `degradedKinds?: readonly ("skill" | "command")[]` to `PluginInstalledOutcome` (apply-outcomes.ts), beside `postCommitWarnings?`, with the D-86-03 contract documented (degraded-but-installed keeps the `(installed)` row, one token per kind, omitted when empty for NREG-01 byte-identity).
- Propagated `result.degradedKinds` from the install orchestrator into the `plugin-installed` outcome in `applyPluginInstalls` (apply.ts), mirroring the adjacent conditional `postCommitWarnings` spread (omit-when-empty).
- Wired the reconcile `plugin-installed` notify arm: the previously reasons-less, `info`-only row now reads `outcome.degradedKinds` and pushes `malformed skill` and/or `malformed command` (one per kind) at `warning` severity. A clean install (no degradedKinds) is byte-identical to today — `info`, no reasons brace. The row stays `status: "installed"`, never `partially-installed` (D-86-03).
- Confirmed and hardened the per-component detail surface: `surfacePostCommitWarnings` now routes every post-commit warning through `redactAbsolutePaths` before `notifyDiagnostic`, so an absolute source path embedded in a parse-error detail collapses to its basename (T-86-03 / NFR-9). This closed a gap — the detail was NOT previously redacted at any point in the chain (see Deviations).
- Added three notify.test.ts cases (skill-only row; skill+command one-per-kind; clean-install byte-identity) and one apply.test.ts case (degradedKinds propagation onto the rendered cascade row + redacted detail via notifyDiagnostic at warning severity).

## Task Commits

1. **Task 1 (tracer): Orchestrated reason-token wire on the reconcile installed row** - `b91ba2ca` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts` - `degradedKinds` field on `PluginInstalledOutcome`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` - propagate `degradedKinds` into the `plugin-installed` outcome; redact post-commit warnings before `notifyDiagnostic`; export `surfacePostCommitWarnings` for direct unit testing
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` - `degradedKindReasons` + `installedRowFromOutcome` helpers; the `plugin-installed` arm now pushes the built row (token + severity)
- `tests/orchestrators/reconcile/notify.test.ts` - three orchestrated-row cases (WARN-01 / CLASS-01 / NREG-01)
- `tests/orchestrators/reconcile/apply.test.ts` - degradedKinds propagation + redacted-detail case (WARN-01 / D-86-03 / T-86-03)

## Decisions Made

- **Redaction seam location.** The plan's `<action>` assumed the detail already routed through `redactAbsolutePaths` ("confirm" only). Investigation showed it did NOT — the detail is built raw in `install.ts` (`errorMessage(parseErr)`), passed through `postCommitWarnings` raw, and `surfacePostCommitWarnings`/`notifyDiagnostic` emitted it raw. The plan's `must_haves` and `acceptance_criteria` both REQUIRE redaction (T-86-03 threat-register `mitigate` disposition, NFR-9). I applied `redactAbsolutePaths` inside `surfacePostCommitWarnings` at the emission seam (the file the plan lists as modifiable) rather than at the `install.ts` source, because (a) it is the single point every post-commit warning crosses before the operator-facing surface, and (b) it makes the redaction directly observable in an apply.test.ts unit test as the acceptance criterion demands. See Deviations (Rule 2).
- **Helper extraction.** Adding the token/severity branch inline pushed `applyOutcomeToBlock` cognitive complexity to 18 (> 15 eslint ceiling). Extracted `installedRowFromOutcome` (returns a `PluginInstalledMessage`) so the case arm is a single push and complexity stays under the ceiling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added the missing `redactAbsolutePaths` mitigation on the post-commit-warning detail surface**
- **Found during:** Task 1 (verifying the plan's "detail already routes through redactAbsolutePaths" claim).
- **Issue:** The threat register assigns T-86-03 (Info Disclosure, medium) a `mitigate` disposition: the per-component parse-error detail (which may embed an absolute source path) must be redacted before emission (NFR-9). No redaction existed anywhere in the chain — `install.ts` builds the detail from raw `errorMessage(parseErr)`, and `surfacePostCommitWarnings` -> `notifyDiagnostic` emitted it verbatim. A malformed skill whose parse error embedded an absolute path would have leaked that path to the operator.
- **Fix:** Applied `redactAbsolutePaths(w)` to each line inside `surfacePostCommitWarnings` before pushing to `notifyDiagnostic`. Redaction is idempotent and desirable for all post-commit warnings (consistent with the established T-53-02-02 / T-55-02-01 diagnostic-redaction norm). Added an apply.test.ts assertion proving an absolute path collapses to its basename.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`
- **Commit:** `b91ba2ca`

**2. [Rule 3 - Blocking issue] Exported `surfacePostCommitWarnings`; extracted `installedRowFromOutcome` to clear the eslint cognitive-complexity ceiling**
- **Found during:** Task 1 pre-commit lint.
- **Issue:** (a) `surfacePostCommitWarnings` was module-private, so the acceptance-criteria redaction assertion could not observe it directly. (b) The inline token/severity branch raised `applyOutcomeToBlock` cognitive complexity to 18 (> 15), failing `eslint .` (the whole-repo `npm-lint` hook) and blocking any hook-respecting commit.
- **Fix:** Exported `surfacePostCommitWarnings` (read-only helper, no behavior change); extracted `installedRowFromOutcome`/`degradedKindReasons` so the case arm is a single push.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`
- **Commit:** `b91ba2ca`

## Issues Encountered

- The `pre-commit run --files` invocation exceeded a 2-minute tool timeout on the first attempt (whole-repo `eslint .` + TruffleHog + typecheck). Re-ran with an extended timeout; all hooks passed.

## User Setup Required

None.

## Threat Flags

None — no new security surface beyond the T-86-03 mitigation this plan closes.

## Next Phase Readiness

- WARN-01 is now closed on both the standalone (Plan 02) and the orchestrated/reconcile (this plan) install surfaces. The full phase gate (`npm run check`) should be run before `/gsd-verify-work`.

## Self-Check: PASSED

- Commit `b91ba2ca` present in git history.
- `node --test` on both reconcile test files: notify 31 pass / 0 fail, apply 25 pass / 0 fail (includes the 4 new WARN-01/CLASS-01/NREG-01/T-86-03 cases).
- `npm run typecheck` green; `eslint` + `prettier --check` clean on all touched files; full pre-commit hook suite passed.

---
*Phase: 86-skill-and-command-frontmatter-compliance*
*Completed: 2026-07-26*
