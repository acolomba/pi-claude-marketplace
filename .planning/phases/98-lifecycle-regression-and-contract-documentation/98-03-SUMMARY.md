---
phase: 98-lifecycle-regression-and-contract-documentation
plan: 03
subsystem: orchestrators
tags: [notify, enable-disable, update, output-catalog, partial-gate, resolver]

# Dependency graph
requires:
  - phase: 98-lifecycle-regression-and-contract-documentation
    provides: the wave-1 enable-arm signal threading (98-01) this plan composes its failure-row narrowing beside
provides:
  - optional partialHint field on PluginFailedMessage, set only by the enable-failure narrowing
  - a widened XSURF-03 trailer gate that admits the failed status without minting a trailer literal
  - a record-derived partial argument on preflightUpdate's candidate gate (WR-04, direction 2)
  - two catalog states with byte-equality fixtures (enable-failed-stale-gate, disabled-record-refresh)
affects: [COMPAT-01 no-expansion gate, DOC-08 documentation reconciliation]

actuals:
  tokens: 7400
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A remediation affordance rides an existing frozen trailer constant plus one optional message field, never a new emit site or a new literal"
    - "A gate that must widen for one record shape derives its argument from the record, not from a new classification consumed downstream"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/update.test.ts

key-decisions:
  - "WR-04 lands via direction 2 (widen the gate) rather than direction 1 (a distinct `disabled` classification). It touches `classifyInstalledRecord` zero times, so the classification union, both completion status buckets, the parity drift-guard and five classifier pins stay byte-stable by construction, and it dissolves the discoverability problem instead of patching it: plain `update` already spans the installed inventory."
  - "The enable-failure narrowing keys on shape kind `not-installable`, NOT `no-longer-installable` as the plan and RESEARCH both wrote. `runInstallLedger` calls `requireInstallable(resolved, \"install\")`, and the op argument is what selects the kind literal; a `no-longer-installable` arm on this path would have been dead code that shipped green."
  - "The stale-gate narrowing is skipped when the ledger recorded rollback partials. A rollback-partial failure got far enough to commit and unwind, which is a different fact than the pre-ledger gate rejection, and `{rollback partial}` plus the MSG-RP-1 child rows stay the truthful row."
  - "The trailer reuses the frozen `PARTIAL_UPDATE_HINT_TRAILER`: `update --partial` is the real remedy for a stale gate, so the update wording is truthful and no new byte form enters the contract (D-98-05)."
  - "The disabled-record refresh row got a NEW catalog state rather than an amendment: the empirically determined byte form (`● mp [project]` + `  ⊘ hello (skipped) {up-to-date}`) was pinned by no existing state under the `## /claude:plugin update` H2 -- `all-up-to-date-noop` pins the bulk headline instead. The neighbouring `decline-partially-upgradable-targeted` prose gained the disabled-record carve-out so the two states read against each other."

patterns-established:
  - "Cause narrowing on a failure row mirrors `composeUpdateDeclineRow`: one small predicate helper returning `readonly ContentReason[] | undefined`, with `undefined` meaning `leave the row exactly as it was`."
  - "A widened render gate ships with an explicit byte-identity assertion for a row it must NOT affect, so an accidental widening fails a test rather than shipping."

requirements-completed: [WR-02, WR-04]

coverage:
  - id: D1
    description: "A failed enable whose persisted installable gate is stale renders the dropped-kind reasons plus the frozen update-worded --partial remediation trailer, at error severity"
    requirement: "WR-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WR-02: an enable whose persisted installable gate is stale names the dropped kinds and points at update --partial"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT byte-equality (enable-failed-stale-gate)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every other failed plugin row renders byte-identically — the widened trailer gate is inert without the hint field"
    requirement: "WR-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WR-02: an enable that fails for an unrelated reason keeps its bare failed row -- no remediation trailer"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WR-02: a failed plugin row from another surface renders byte-identically -- the widened trailer gate is inert without the hint"
        status: pass
    human_judgment: false
  - id: D3
    description: "A targeted update with NO partial flag reaches the disabled-record short-circuit: the version pin and compatibility block refresh, all five resources arrays stay empty, and the record stays disabled"
    requirement: "WR-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#WR-04: a targeted update with NO partial flag reaches the disabled-record short-circuit and refreshes the pin"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT byte-equality (disabled-record-refresh)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The pre-existing --partial disabled-record cases still pass unchanged, and the classifier plus every completion consumer stay byte-stable"
    requirement: "WR-04"
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/update.test.ts (79/79 pass)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/edge-deps.test.ts + tests/orchestrators/plugin/plugin-state-classifier.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "No member was added to REASONS, STATUS_TOKENS, PLUGIN_STATUSES, MARKETPLACE_STATUSES or the glyph exports, and no new trailer literal was minted (D-98-05)"
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts"
        status: pass
      - kind: other
        ref: "grep -c 'PARTIAL_UPDATE_HINT_TRAILER' extensions/pi-claude-marketplace/shared/notify.ts == 2"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-08-09
status: complete
---

# Phase 98 Plan 03: Lifecycle regression and contract documentation Summary

**A stale-gate enable failure now names the kinds it dropped and points at `update --partial`, and `update` will actually take that call — a disabled record reaches its refresh short-circuit with no flag typed.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-09T22:55Z (approx.)
- **Completed:** 2026-08-09T23:50Z (approx.)
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- **WR-02 closed.** The enable branch derives its ledger gate from the persisted record, so a record that was installable when the user disabled it runs the strict gate even after the manifest entry gains an unsupported kind. That rejection is now narrowed in `composeOutcomeRow`'s enable-failure arm: the row names the dropped kinds through the shared `narrowUnsupportedKinds` seam and stamps the optional hint field, so the renderer appends the frozen update-worded `--partial` trailer. Before, the operator got a bare `⊘ foo (failed)` and a cause chain with no way forward.
- **WR-04 closed via direction 2.** `preflightUpdate` derives the candidate gate's partial argument from the record as well as the caller flag, so a disabled record whose candidate resolves `partially-available` reaches the D-UPD short-circuit under plain `update`. The two carriers compose: WR-02's trailer names a remedy that WR-04 makes reachable.
- **The two remedies now form a closed loop.** `update` re-pins the disabled record against the current manifest entry and rewrites its compatibility block; the next `enable` reads a record with `installable: false`, takes the partial gate, and re-materializes the supported components. Neither half was usable without the other.
- **Both byte changes shipped with their catalog state and fixture in the same commit** (D-98-03): `enable-failed-stale-gate` under `## /claude:plugin enable`, `disabled-record-refresh` under `## /claude:plugin update`.
- **Nothing was minted.** No `REASONS`, `STATUS_TOKENS`, `PLUGIN_STATUSES`, `MARKETPLACE_STATUSES` or glyph member was added, and `PARTIAL_UPDATE_HINT_TRAILER` still appears exactly twice in `notify.ts` (the frozen declaration and the single render site).

## Task Commits

1. **Task 1 (tracer): end-to-end remediation trailer on a stale-gate enable failure** — `85b9dd4` (feat)
2. **Task 2: disabled records reach the update short-circuit without the flag** — `73aa78f` (feat)

Each task committed its RED tests, its behavior change, its catalog amendment and the matching fixture together.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify.ts` — optional `partialHint` on `PluginFailedMessage`; the XSURF-03 trailer gate's status disjunction admits `failed`
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` — new `staleGateDropped` cause predicate; the enable-failure arm stamps its reasons and the hint; the gate derivation in `runEnableBranch` documents its staleness
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — the `resolveUpdateCandidate` call ORs the disabled-record predicate into its partial argument
- `docs/output-catalog.md` — two new states plus the disabled-record carve-out folded into the neighbouring decline state's prose
- `tests/architecture/catalog-uat.test.ts` — two `FIXTURES` entries
- `tests/orchestrators/plugin/enable-disable.test.ts` — three `WR-02:` tests plus a `staleInstallableGate` seeder option
- `tests/orchestrators/plugin/update.test.ts` — one `WR-04:` test plus the rewritten suite-header prose

## Verification

| Command | Result |
|---------|--------|
| `node --test tests/orchestrators/plugin/enable-disable.test.ts "tests/architecture/*.test.ts"` | exit 0 — 369 pass, 1 skip |
| `node --test tests/orchestrators/plugin/update.test.ts tests/orchestrators/edge-deps.test.ts tests/orchestrators/plugin/plugin-state-classifier.test.ts "tests/architecture/*.test.ts"` | exit 0 — 441 pass, 1 skip |
| `npm test` (full unit suite) | exit 0 — 3350 pass, 1 skip |
| `npm run typecheck` / `npm run lint` / `npm run format:check` | exit 0 / 0 / 0 |
| `git diff` on `plugin-state-classifier.ts`, `edge/completions/data.ts`, `shared/completion-cache.ts` | empty — direction 2 touched none of them |
| `pre-commit run --files <changed>` | all hooks pass (trufflehog run in filesystem mode per the worktree protocol: 0 verified, 0 unverified) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The narrowing keys on `not-installable`, not `no-longer-installable`**

- **Found during:** Task 1
- **Issue:** The plan's action text and RESEARCH's recommended shape both said to narrow on `cause.shape.kind === "no-longer-installable"`, copying `composeUpdateDeclineRow` verbatim. That kind literal is selected by the gate's `op` argument: `requireInstallable(r, "update")` throws `no-longer-installable`, `requireInstallable(r, "install")` throws `not-installable`. The enable branch runs `runInstallLedger`, which calls the gate with `"install"`, so the copied predicate would never have matched. The arm would have been dead code and the three WR-02 tests would have stayed red.
- **Fix:** Narrow on `not-installable` and document at the helper why that kind — not the update-path one — is what this surface produces.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`
- **Commit:** `85b9dd4`

**2. [Rule 2 - Missing critical behavior] Rollback-partial failures excluded from the narrowing**

- **Found during:** Task 1
- **Issue:** The plan said to leave the rollback branch untouched but the narrowing sits on the same arm. Applied unconditionally it would have overwritten `{rollback partial}` — and dropped the MSG-RP-1 child-row anchor — on a failure that did reach the ledger.
- **Fix:** The predicate is consulted only when the rollback-partial capture is empty.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`
- **Commit:** `85b9dd4`

### Open Question Resolved Empirically

**RESEARCH Q2 — does the disabled arm's rendered byte form already have a catalog state?** No. The flagless targeted call renders `● mp [project]` + `  ⊘ hello (skipped) {up-to-date}`, and no state under the `## /claude:plugin update` H2 pinned those bytes: `all-up-to-date-noop` pins the BULK headline (`Plugin update: nothing to update`) instead. The plan's preference for amending over adding was honoured as far as it goes — the neighbouring `decline-partially-upgradable-targeted` prose gained the disabled-record carve-out — but the row itself needed a new state, `disabled-record-refresh`, with its own fixture.

### Observation (no action taken)

`tests/orchestrators/plugin/update.test.ts` already carried a `WR-04:` test title from an earlier milestone's requirement numbering (`WR-04: successful update populates stagedAgents + stagedMcpServers`). The acceptance grep still passes and the new title is unambiguous in context, but the ID collision is real and worth knowing before anyone greps `WR-04` expecting this phase's carrier.

## Carrier List

- WR-02 — landed (`85b9dd4`)
- WR-04 — landed (`73aa78f`), direction 2, rationale recorded in the plan objective and the key-decisions above

Both remaining Phase-97 review carriers are now in the tree, so the D-98-05 precondition for authoring the COMPAT-01 gate is satisfied.

## Known Stubs

None.

## Threat Flags

None. The two changes are the ones the plan's threat register already covers: T-98-07 (the trailer carries no interpolation — the frozen constant was reused), T-98-08 (the hint field has exactly one producer, and the byte-identity assertion is in the suite), T-98-09 (the widened gate applies only when the disabled predicate matches, and the new case asserts all five resources arrays stay empty).

## Self-Check: PASSED

Every file this summary names exists on disk and both task commits (`85b9dd4`, `73aa78f`) resolve in `git log`.
