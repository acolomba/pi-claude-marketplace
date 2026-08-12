---
phase: 97-disabled-state-classification-repair
plan: 03
subsystem: orchestrators
tags: [typescript, enable-disable, partial-gate, install-ledger, byte-exact-pins]

requires:
  - phase: 97-disabled-state-classification-repair
    plan: 01
    provides: "`isRecordedButDisabled` keyed only on `enabled` — the collapse that makes `enable` fall through to `runEnableBranch` for a disabled partial"
  - phase: 97-disabled-state-classification-repair
    plan: 02
    provides: "the frozen disabled-partial render contract the new rows are asserted against"
provides:
  - "a partial-capable enable branch: `runEnableBranch` takes the install record and derives the ledger's `partial` gate from its availability discriminant"
  - "the ENBL-07 re-materialization pin — enable on a disabled partial restores the CURRENT manifest's supported set"
  - "the manifest-absent enable boundary pinned byte-exactly to the existing fail-clean semantics"
  - "disable idempotency on an already-disabled partial pinned in both render modes, proven by unchanged `state.json` bytes"
affects: [97-04, 97-05, enable-disable, install]

actuals:
  tokens: 4353
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Record-derived gate selection: the ledger's admission gate is computed from the persisted availability discriminant, so the record's own truth (not a caller flag) decides which resolver arm is admitted"
    - "Fixture axis extension over fixture duplication: the local seed factories grew one optional axis each (unsupported kind, manifest omission) instead of gaining a parallel disabled-partial twin"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - tests/orchestrators/plugin/enable-disable.test.ts

key-decisions:
  - "The gate is DERIVED (`!installed.compatibility.installable`), not hard-coded to `true`. Passing `partial: true` unconditionally would silently widen admission for a record that was fully installable at install time — a manifest that degraded since then would then re-materialize as a partial instead of surfacing the change. Deriving keeps the strict gate where the record claims full availability."
  - "`runEnableBranch` takes the whole install record rather than a second `partial: boolean` parameter. The function already needed the version pin off that record; passing the record makes the version and the availability axis read from one source and keeps the derivation inside the function, away from the two complexity-suppressed bodies."
  - "The manifest-absent boundary is pinned as a byte assertion in this unit test file and adds NO catalog state. The four-space cause trailer is a general failed-row affordance the renderer already provides; the operator asked for existing semantics, not a new closed-set reason."
  - "The boundary test's staged-artifact check treats an absent target dir and an empty one as the same fact (`readdir(...).catch(() => [])`) — the assertion is about the ledger never reaching its staging phase, not about directory creation order."

patterns-established:
  - "Ledger-gate derivation from persisted state: when a re-materialization path re-enters the install ledger, the gate comes from the record being re-materialized, so the widening is scoped to records that already carry the degraded fact."

requirements-completed: [ENBL-07]

coverage:
  - id: D1
    description: "Enable on a disabled PARTIAL re-materializes through the partial gate rather than reporting idempotent success or failing the strict gate"
    requirement: ENBL-07
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#ENBL-07: enable on a disabled PARTIAL re-materializes through the partial gate, restoring the CURRENT manifest's supported set (D-68-02 repair/promotion stance)"
        status: pass
      - kind: other
        ref: "RED gate observed: the same test failed at `severity === 'error'` on commit 117069a7 (before the source edit) and passed on 8841e699"
        status: pass
    human_judgment: false
  - id: D2
    description: "The widened gate admits the partially-available arm only; the structurally unavailable arm is still rejected (NFR-7)"
    requirement: ENBL-07
    verification:
      - kind: other
        ref: "the derivation selects `runInstallLedger`'s existing `partial` field, which routes to `requirePartialInstallable`; that gate's rejection of the `unavailable` arm is pinned by the install/reinstall D-65-03 / FORCE-05 suites"
        status: pass
    human_judgment: false
  - id: D3
    description: "Enable on a manifest-absent disabled PARTIAL fails clean: nothing staged, record stays disabled with five empty resource arrays, existing byte form at error severity"
    requirement: ENBL-07
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#ENBL-07 / D-97-01: enable on a manifest-absent disabled PARTIAL fails clean -- nothing materialized, record stays disabled"
        status: pass
    human_judgment: false
  - id: D4
    description: "Disable on an already-disabled PARTIAL is idempotent in both render modes, with byte-identical state.json across the call"
    requirement: ENBL-07
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#ENBL-07 / ENBL-04 byte-lock: disable on an already-disabled PARTIAL renders the same skipped row and leaves state.json bytes unchanged"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#ENBL-07 / RECON-03: orchestrated disable on an already-disabled PARTIAL returns { status: 'skipped', reason: 'already disabled' } no notify"
        status: pass
    human_judgment: false
  - id: D5
    description: "No new complexity suppression and no catalog state added"
    verification:
      - kind: other
        ref: "`grep -c sonarjs/cognitive-complexity enable-disable.ts` = 2, unchanged; `git diff --stat -- docs/output-catalog.md` empty for this plan"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-09
status: complete
---

# Phase 97 Plan 03: Partial-capable enable branch Summary

**`runEnableBranch` now derives the install ledger's admission gate from the record it is re-materializing, so a plugin that was disabled while soft-degraded comes back through the partially-available arm instead of dying on `requireInstallable` — and the two adjacent boundaries, a manifest-absent enable and a repeat disable, are pinned byte-exactly to the semantics they already had.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 (Task 1 ran the TDD cycle: RED then GREEN)
- **Files modified:** 2 (1 source, 1 test)
- **Diff:** +282 / -16

## Accomplishments

- **The one-line-of-behavior edit, in the right place.** `runEnableBranch` takes the install record instead of a bare `recordedVersion` string and computes `partial = !installed.compatibility.installable` immediately, inside its own body. Neither `setPluginEnabled` nor its locked closure — the two bodies already carrying `sonarjs/cognitive-complexity` suppressions — grew a branch, and the file's suppression count is unchanged at 2.
- **The gate is derived, not asserted.** A record whose `compatibility.installable` is `true` still resolves through `requireInstallable`; only a record that already records the degraded fact widens to `requirePartialInstallable`. Both gates reject the structurally `unavailable` arm, so the widening never reaches a hard structural failure (NFR-7).
- **The RED gate was real.** On the test-only commit the re-materialization test failed at `severity === "error"` — the strict gate rejecting the partially-available resolve, which is exactly the `(failed)` row 97-01's summary predicted would ship behind a green predicate test. The source commit turned it green.
- **The manifest-absent arm needed no code.** The PI-3 lookup throws before the first ledger phase, so the record and the disk were already untouched; the plan's job was to freeze that. The byte form is the brace-suppressed failed row plus the four-space cause trailer, under the renderer's existing `A plugin operation has failed.` preamble.
- **Disable idempotency now names the partial shape.** Both new disable tests seed `compatibility.installable: false` with `unsupported: ["lspServers"]`; the standalone one asserts `state.json` is byte-identical across the call, which is the strongest available proof the unstage cascade never ran.
- **Two fixtures grew one axis each.** `seedRealDisabledMarketplace` gained `unsupportedKind` (writes the resolver's `.lsp.json` convention marker into the plugin root, and seeds the matching compatibility block) and `omitFromManifest`; `writeUserState` gained `unsupported`, with availability derived from the list's emptiness the way the list and info fixtures do it. No existing call site of either factory changed.

## Task Commits

1. **Task 1 (TDD RED): fixture axes plus the two enable tests** — `117069a7` (test)
2. **Task 1 (TDD GREEN): the partial-capable enable branch** — `8841e699` (fix)
3. **Task 2: disable idempotency byte-locks on the partial shape** — `fa46e3d5` (test)

No REFACTOR commit — the GREEN edit is twelve lines and needed no cleanup pass.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` — `runEnableBranch`'s parameter change, the derived `partial` gate with its ENBL-07 / NFR-7 rationale citing the reinstall D-68-02 precedent, and the single call site inside the locked closure
- `tests/orchestrators/plugin/enable-disable.test.ts` — both factory axes plus four new tests (re-materialization, manifest-absent boundary, standalone disable byte-lock, orchestrated disable sibling)

## Decisions Made

See `key-decisions` in the frontmatter.

One detail worth recording about the byte pin: the expected form initially omitted the renderer's `A plugin operation has failed.` preamble, and the first RED run surfaced that as the sole delta on an otherwise exact match. The row, the version slot, the suppressed brace, and the trailer indent were all correct on the first derivation — the preamble is a cascade-level affordance, not a row-level one, and pinning the whole notification (rather than the row) is what caught it.

## Deviations from Plan

**None.** The plan's line-level inventory matched the worktree, and both `<action>` blocks were executable as written.

## Issues Encountered

Task 2's two tests were green on first run. That is the expected outcome rather than a stalled RED gate: 97-01's predicate collapse already inverted the idempotency equality test for the disabled partial, and this plan's stated job for that half is to freeze bytes that are correct but unpinned — the same situation 97-02 documented for the `list` half of ENBL-06.

The `pre-commit` trufflehog hook fails structurally in a linked worktree (git-mode scan cannot read `.git/index`). Per CLAUDE.md, each commit was preceded by a filesystem-mode scan over the changed paths — all clean (`verified_secrets: 0`, `unverified_secrets: 0`) — and committed with `SKIP=trufflehog`. No other hook was skipped.

## Verification

- `node --test tests/orchestrators/plugin/enable-disable.test.ts` — exit 0, 30/30, including the untouched ENBL-02 disable-preserves-availability test and the canonical ENBL-04 byte-lock
- `node --test tests/architecture/no-orchestrator-network.test.ts` — exit 0 (the enable path stays offline; NFR-5)
- `npm run typecheck`, `npm run lint`, `npm run format:check` — all exit 0
- `PI_SUBAGENTS_ROOT=… npm run check` — exit 0; 3315 unit tests (3314 pass, 0 fail) plus 18 integration tests
- `grep -c "sonarjs/cognitive-complexity" enable-disable.ts` — 2, the two pre-existing suppressions; none added
- `git diff --stat -- docs/output-catalog.md` — empty for this plan; no catalog state added
- RED-gate confirmation: the re-materialization test failed on `117069a7` (test-only) and passed on `8841e699` (source edit), which is the plan's "fails when the `partial` field is removed" criterion observed in the forward direction

## Requirement Accounting

**ENBL-07 — Complete.** Both halves land: `enable` on a disabled partial re-materializes through the derived partial gate (with the manifest-absent boundary pinned to the existing fail-clean semantics), and `disable` on an already-disabled partial is idempotent in standalone and orchestrated modes with unchanged `state.json` bytes.

The plan's `<flagged_assumptions>` question — whether ENBL-07 implies a boundary beyond the three pinned here — stays answered as it was at planning: nothing further surfaced during execution. The enable path's other two arms (`marketplace-absent`, `not-recorded`) are unaffected by the gate change and keep their existing tests.

## Known Stubs

None.

## Out-of-Scope Discoveries (not fixed)

Nothing new. The items carried in `deferred-items.md` from 97-01 and 97-02 are untouched and still owned by the reconcile plans or the Phase 98 DOC-08 carrier:

- `orchestrators/reconcile/apply.ts:1057-1063` — the test-seam JSDoc claiming a partially-installed plugin cannot reach the planner's enable bucket. The collapse already falsified it; today's edit makes that reachable path actually work, which sharpens rather than resolves the stale comment.
- `orchestrators/reconcile/README.md:34` — the stale two-axis marker description with a dangling `plan.ts` predicate reference.

## Next Phase Readiness

The enable half of the reconcile story is now correct at the orchestrator level, which is the precondition `97-04` needs: a reconcile-driven enable of a disabled partial routes through the same `runEnableBranch` and therefore through the same derived gate, so the remaining work there is the planner's `enabled` guard (ENBL-08) and `refreshDisabledRecord`'s hard-coded `installable: true` (ENBL-09), not the materialization path itself.

## Self-Check: PASSED

All three commit hashes resolve in `git log`; both files claimed as modified exist on disk and appear in `git diff --stat 0b490f6e..HEAD`.

---
*Phase: 97-disabled-state-classification-repair*
*Completed: 2026-08-09*
