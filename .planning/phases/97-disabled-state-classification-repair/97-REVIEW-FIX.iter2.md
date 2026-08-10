---
phase: 97-disabled-state-classification-repair
fixed_at: 2026-08-09T23:30:00Z
review_path: .planning/phases/97-disabled-state-classification-repair/97-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 5
skipped: 3
status: partial
---

# Phase 97: Code Review Fix Report

**Fixed at:** 2026-08-09T23:30:00Z
**Source review:** `.planning/phases/97-disabled-state-classification-repair/97-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope (Critical + Warning): 8
- Fixed: 5 (CR-01, CR-02, WR-01, WR-03, WR-05 — WR-05 as a test-only pin, see below)
- Deferred with carrier: 3 (WR-02, WR-04, WR-06)
- Info findings (IN-01..03): out of scope, listed under Deferred

**Verification:** `PI_SUBAGENTS_ROOT=... npm run check` — **CHECK_EXIT=0**
(typecheck + ESLint + Prettier + 3327 tests, 0 failures, 1 skipped). Re-run
after the CR-01 severity revision below; log at
`97-fix2-check.log`. Run in the worktree
`/home/acolomba/pi-claude-marketplace/.worktrees/manifest-independent-plugin-info`
(the checkout the agent was handed, which carries `node_modules`) — not in a
separate throwaway worktree, so the numbers reproduce from the tree under
review.

## Disposition

| ID | Severity | Disposition | Commit |
|----|----------|-------------|--------|
| CR-01 | BLOCKER | fixed | `b94684c8`, revised `96a05a9` |
| CR-02 | BLOCKER | fixed | `e755bc92` |
| WR-01 | WARNING | fixed | `9d4431b4` |
| WR-02 | WARNING | deferred + carrier | `d601e0fb` |
| WR-03 | WARNING | fixed (signalling half by CR-01; decision recorded) | `93bd994d` |
| WR-04 | WARNING | deferred + carrier | `d601e0fb` |
| WR-05 | WARNING | skipped — premise not reproducible; pinned instead | `ad794396` |
| WR-06 | WARNING | deferred + carrier | `d601e0fb` |
| IN-01..03 | INFO | out of scope (not attempted) | — |

## Fixed Issues

### CR-01: a partial re-enable rendered `(installed)`

**Files modified:** `orchestrators/plugin/enable-disable.ts`,
`orchestrators/plugin/enable-disable.messaging.ts`,
`orchestrators/reconcile/apply.ts`, `orchestrators/reconcile/apply-outcomes.ts`,
`orchestrators/reconcile/notify.ts`, `docs/output-catalog.md`,
`tests/architecture/catalog-uat.test.ts`,
`tests/orchestrators/plugin/enable-disable.test.ts`,
`tests/orchestrators/reconcile/notify.test.ts`
**Commits:** `b94684c8` (fix), `96a05a9` (severity revision)

`runEnableBranch` now reads the ledger's LIVE resolution
(`installCtx.resolved`) and carries the dropped-component kinds on the `fresh`
outcome. Both consumers branch on it: the standalone `composeOutcomeRow` (via a
new `freshEnableRow` helper) and the typed `EnableDisablePluginOutcome`, which
threads the kinds through `PluginEnabledOutcome` into the reconcile projection.
`ENABLE_STATUSES` / `EnableMsg` / `ENABLE_RENDER` gained the
`partially-installed` arm, which CALLS the shared `partiallyInstalledRow`
composition site rather than duplicating bytes. A clean re-enable is unchanged
on both arms.

Catalog: added the `enable-partial` state to `docs/output-catalog.md` with its
fixture in `catalog-uat.test.ts` (the byte-equality runner passes). The
byte-pinned ENBL-07 test was repinned from the wrong `(installed)` form to the
full corrected cascade; two projection tests were added for the reconcile arm.

**Severity revised warning → info per operator decision (2026-08-09).** The
review's snippet stamped `severity: "warning"`, which the initial fix kept on
the opt-in-axis reading (`enable` has no `--partial` flag, so a dropped-kind
enable is "carried out but short of what was asked for"). The operator ruled
for **row-level consistency** instead: the degraded enable row stamps `info`,
matching `install --partial`'s success row and the `plugin-backfilled` partial
arm per SEV-03 — the partial shortfall predates the enable (the record was
already degraded when it was disabled), so the requested enable was fully
carried out, and the dropped kinds ride the `{reasons}` brace rather than the
severity channel.

Applied in `96a05a9` across both arms (`freshEnableRow` in
`enable-disable.ts`, `enabledRowFromOutcome` in `reconcile/notify.ts`), with
the opt-in-axis rationale removed from both comment blocks and replaced by the
SEV-03 parity reasoning. Downstream byte effects: the `enable-partial` catalog
block loses its `A plugin operation needs attention.` summary line (an `info`
cascade emits none), its `catalog-uat.test.ts` fixture drops
`expectedSeverity`, the ENBL-07 byte pin now asserts `severity === undefined`
against the summary-less cascade, and the reconcile projection test asserts
`info`. The per-row bytes are otherwise unchanged — only the summary line and
the severity channel moved.

### CR-02: `refreshDisabledRecord` bumped a sha-derived version without the pin

**Files modified:** `orchestrators/plugin/update.ts`,
`tests/orchestrators/plugin/update.test.ts`
**Commit:** `e755bc92`

Destructured `resolvedSha` from the preflight and wrote it inside the same
state guard, mirroring `finalizeUpdateRecord`'s all-success arm. Added a
git-source test that seeds a DISABLED record at `SHA_OLD` against a manifest
pinned at `SHA_NEW` and asserts `version === shaVersion(resolvedSha)` after the
refresh. Confirmed the test fails against the pre-fix source (stash + rerun),
so it is a genuine regression pin, not a tautology.

### WR-01: fifth inline predicate copy the drift gate could not see

**Files modified:** `orchestrators/reconcile/apply.ts`,
`orchestrators/plugin-path.ts`, `persistence/state-io.ts`,
`tests/orchestrators/reconcile/plan.test.ts`
**Commit:** `9d4431b4`

Both inline twins now call `isRecordedButDisabled`: the ENBL-08 backfill scan
gate, and the pre-existing `collectBinDirs` copy the review noted (fixed too,
because leaving it would have forced an allowlist entry and kept the
`state-io.ts` claim false).

The gate itself was rewritten from an allowlist of four former definition sites
into a WALK of `extensions/pi-claude-marketplace/**/*.ts`: comments stripped,
then the two-axis conjunction plus three single-axis rederivation spellings
(`!x.enabled`, `.enabled === false`, `.enabled !== true`) must be absent
everywhere except `persistence/state-io.ts`, which defines the rule. Verified
the new regexes flag the exact pre-fix `apply.ts` source. The former-site import
assertion was split into its own test so both halves of the collapse stay
pinned. The `state-io.ts` doc claim was updated to state the walk, so it is now
true rather than aspirational.

The config axis (`entry.enabled !== false`, `persistence/config-io.ts`) is
deliberately not matched — it is a different fact about a different object,
with the opposite default.

### WR-03: automatic partial opt-in on the enable path

**Files modified:** `orchestrators/plugin/enable-disable.ts`
**Commit:** `93bd994d`

The signalling half is covered by CR-01 (the reconcile row now names the
degrade). The remaining half was the missing rationale: the derivation site now
cites the autoupdate-cascade precedent (SEV-03 / D-69-01) for taking the
partial path with no user flag, notes that `requirePartialInstallable` still
blocks a structurally unavailable candidate, and records that the precedent
also REQUIRES the degrade be signalled.

### WR-05: refresh rewrites while rendering `(skipped) {up-to-date}` — not reproducible

**Files modified:** `tests/orchestrators/plugin/update.test.ts`
**Commit:** `ad794396`
**Status:** fixed as a pin; the reported defect does not occur.

I implemented the suggested deep-equal short-circuit first, then found it was
unreachable. `preflightUpdate` returns the `unchanged` outcome on
`toVersion === fromVersion` BEFORE the disabled-record branch runs
(`update.ts`, the `toVersion === fromVersion` guard), so `refreshDisabledRecord`
executes only when the pin genuinely moved — in which case the write is
warranted, and the short-circuit could never fire. The finding's claim that
"every repeated `update --partial` on an already-current disabled record
rewrites state.json" does not hold.

I reverted the source change rather than ship an unreachable branch and a new
lock-primitive usage, and instead strengthened the ENBL-09 idempotency test the
finding correctly identified as blind: it excluded `updatedAt` from its
comparison, so it could not have seen a rewrite landing identical values. It
now asserts `state.json`'s mtime and the record's `updatedAt` directly across
two identical calls. Both hold today.

Residual, NOT fixed but now CARRIED: when the version is unchanged but
`resolvedSource` (or the `compatibility` block) moved, the same preflight
short-circuit means the disabled record keeps stale values — the mirror image
of WR-05's claim (a MISSING write, not a spurious one), and outside the
review's scope entirely. Carrier:
`.planning/todos/pending/2026-08-09-disabled-record-stale-resolvedsource-on-unchanged-version.md`
(`276122a`), with no `resolves_phase` — post-milestone backlog, not Phase 98
doc scope. The deep-equal guard drafted and reverted here becomes load-bearing
under that carrier's option 1, so the carrier records it.

## Deferred (carrier todos created)

Each carrier records the problem, why Phase 97 is the wrong place, the options,
and the fixtures the fix will need. All three land in Phase 98.

### WR-02: no `--partial` affordance when the enable gate's persisted flag is stale

**Carrier:** `.planning/todos/pending/2026-08-09-enable-partial-remediation-affordance.md`
**Why deferred:** both candidate fixes change byte-pinned output on the enable
failure path — new hint text, or a new `--partial` flag on `enable` with its own
catalog states and arg-parsing surface.

### WR-04: `update --partial` completion excludes disabled records

**Carrier:** `.planning/todos/pending/2026-08-09-update-partial-completion-excludes-disabled-records.md`
**Why deferred:** the fix is a contract decision about the classifier's closed
set (a new `disabled` classification) or about which commands may mutate a
disabled record — wider than the predicate collapse this phase scoped.

### WR-06: fresh-enable row hard-codes `dependencies: []`

**Carrier:** `.planning/todos/pending/2026-08-09-enable-row-suppresses-soft-dep-markers.md`
**Why deferred:** threading the staged-name counts is small (CR-01 already
opened the seam on both arms), but the result adds `{requires pi-...}` markers
and a warning summary to byte-pinned enable rows, needing new catalog states.

### Info findings (not attempted, per fix scope)

- **IN-01** — retired `force-*` vocabulary in touched test titles/comments
  (`plugin-state-classifier.test.ts`, `edge-deps.test.ts`); consider adding the
  spellings to the vocabulary guard's reserved set.
- **IN-02** — the planner's disable-branch comment (`reconcile/plan.ts`) still
  describes the retired empty-resources marker.
- **IN-03** — the completion fixture (`edge-deps.test.ts`) seeds disabled
  records with populated `resources.skills`, a shape `DisabledPluginRecord`
  forbids.

IN-01 and IN-02 are one-line comment/title edits that would fold cleanly into
the Phase 98 documentation sweep already carried by
`2026-08-08-notify-stale-comments-doc08-reconciliation.md`.

## Commits

| Commit | Subject |
|--------|---------|
| `b94684c8` | `fix(97): CR-01 render a degraded re-enable as partially-installed` |
| `e755bc92` | `fix(97): CR-02 move resolvedSha with the sha-derived version` |
| `9d4431b4` | `fix(97): WR-01 route every disabled-state read through one predicate` |
| `93bd994d` | `docs(97): WR-03 record the automatic partial opt-in for enable` |
| `ad794396` | `test(97): WR-05 pin state.json mtime stability on a no-op refresh` |
| `d601e0fb` | `docs(97): carry three enable-path affordance gaps forward` |
| `96a05a9` | `fix(97): CR-01 stamp the degraded enable row info per SEV-03` |
| `276122a` | `docs(97): carry the stale disabled-record resolvedSource gap forward` |

---

_Fixed: 2026-08-09T23:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
