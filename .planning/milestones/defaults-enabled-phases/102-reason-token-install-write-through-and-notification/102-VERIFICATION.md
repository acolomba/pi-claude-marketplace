---
phase: 102-reason-token-install-write-through-and-notification
verified: 2026-08-15T03:12:41Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "a user who wrote enabled: false for a defaultEnabled: true plugin stays disabled"
    reason: >-
      DFEN-05's normative content (an existing enabled value wins over
      defaultEnabled and is never overwritten) holds in both directions and
      across both physical config files. Running `install` is itself the user
      asking for the install, so the verb materializes; the declared
      `enabled: false` is preserved untouched and the next reconcile pass
      converges the record to disabled. The asymmetry -- the install verb
      honors an explicit config value only when that value is `true` -- is
      carried into phase 103 as an open question, not closed here.
    accepted_by: "acolomba"
    accepted_at: "2026-08-15T03:30:00Z"
human_verification_resolved:
  - test: >-
      Decide whether success criterion 3's second gloss -- "a user who wrote
      `enabled: false` for a `defaultEnabled: true` plugin stays disabled" --
      is meant to bind the standalone `/claude:plugin install` verb. Today it
      does not: seed `claude-plugins.json` with `{"p@mp": {"enabled": false}}`
      for a plugin whose manifest declares `defaultEnabled: true`, then run
      `/claude:plugin install p@mp`.
    expected: >-
      Observed behavior (asserted by
      `tests/orchestrators/plugin/install.test.ts:1185-1193`): the config entry
      comes back byte-for-byte `{ enabled: false }` -- never overwritten, which
      is what DFEN-05 literally requires -- but the record lands `enabled: true`
      and the artifacts DO materialize. The plugin does not "stay disabled" at
      the install boundary; the next `/reload` plans a disable
      (`orchestrators/reconcile/plan.ts:318-322`) and converges. The reconcile
      surface already satisfies the gloss outright -- a declared-disabled,
      unrecorded plugin is never installed (`plan.ts:304-325`). The phase team
      made this call deliberately and documented the reasoning in the test
      comment ("running `install` IS the user asking for the install").
    why_human: >-
      This is a product-semantics decision, not a defect grep can settle. Both
      readings are internally consistent and neither is a regression -- the
      install verb never read the config `enabled` key before this phase.
      Accept the current contract (add the override block in the report), or
      file the divergence as follow-on work.
---

# Phase 102: Reason token, install write-through and notification — Verification Report

**Phase Goal:** Installing a plugin whose author declared `defaultEnabled: false` leaves it disabled — recorded disabled, written through to config, and reported as such — so the state lands where reconcile already reads desired enablement from.
**Verified:** 2026-08-15T03:12:41Z
**Status:** human_needed
**Re-verification:** No — initial verification
**Tree verified:** `features/defaults-enabled` at HEAD `0c09decc` (post-review-fix), not the plan SUMMARYs' description of it.

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|-----------------------------------|--------|----------|
| 1 | Install of a `defaultEnabled: false` plugin produces a record marked disabled AND `enabled: false` in that scope's `claude-plugins.json` entry | ✓ VERIFIED | Verdict at `orchestrators/plugin/install.ts:1618-1621`; disable half at `:1624-1637`; standalone batched patch gains its first field at `:1700-1707`; orchestrated stamp via `writePluginConfigEntry` at `:1708-1740`. Behavioral: `tests/orchestrators/plugin/install.test.ts:843-876` (record `enabled: false` + `plugins["hello@mp"] === { enabled: false }`) and `tests/orchestrators/reconcile/apply.test.ts:1903-1948` (base file gains exactly `{ enabled: false }`) — both run green by this verifier |
| 2 | Artifacts not materialized; terminal state matches an ordinary disable — record keeps its inventory (ENBL-18), nothing on disk | ✓ VERIFIED | `disableFreshlyInstalledPlugin` composes `cascadeUnstagePlugin` + `toDisabledRecord` (`install.ts:1391-1428`), the same primitives the `disable` verb composes; the cascade covers all five kinds (`orchestrators/marketplace/shared.ts:334-407`). Behavioral: `install.test.ts:848-864` asserts `resources.skills`/`prompts` retained AND both staged paths rejected by `stat`; `install.test.ts:1449-1456` asserts the hooks routing bucket is empty and the staged `hooks.json` is gone, with an enabled-contrast case at `:1462`; `apply.test.ts:1919-1937` repeats record-retains/disk-empty on the reconcile path |
| 3 | An `enabled` value already present wins over `defaultEnabled` and is never overwritten, in either direction | ✓ VERIFIED (with a human decision on the criterion's second gloss — see below) | Precedence gate reads the MERGED per-scope declaration across BOTH physical files (`install.ts:1421-1443` `readDeclaredEnabled`, called at `:1611-1616`); the verdict requires `declaredEnabled === undefined`. All three values of the key plus the cross-file case are pinned by `DFEN_PRECEDENCE_CASES` (`install.test.ts:1167-1240`): `true`+`defaultEnabled:false` → enabled, entry untouched; `false`+`defaultEnabled:true` → entry byte-identical; ABSENT → disabled + stamped; both-`true` control; and `enabled: true` seeded in `claude-plugins.local.json` with the install targeting the base file → enabled, base sibling stays `{}`. Every case deep-equals the WHOLE entry. All green |
| 4 | The install notification states installed-disabled and how to enable it, at informational severity — on BOTH user-reachable surfaces | ✓ VERIFIED | Standalone row at `install.ts:2248-2258` (`reasons: ["installs disabled", ...]`, `enableHint: true`, `severity: "info"`); frozen trailer at `shared/notify.ts:2572-2581` + render gate at `:3875-3881`. Reconcile cascade row at `orchestrators/reconcile/apply.ts:614-645` (token, `enableHint`, `version`, `postCommitWarnings`), forwarded by the projection at `orchestrators/reconcile/notify.ts:713-724` with `severity: "info"`. Behavioral byte assertions: `install.test.ts:881-889` (exact 3-line message, `severity === undefined` i.e. info) and `apply.test.ts:1962-1976` (anchored row regex + trailer + no `(installed)`). Catalog byte-equality gate: `docs/output-catalog.md:530`, `:542`, `:2103` each paired with a `catalog-uat.test.ts` FIXTURES entry (`:1069`, `:1095`, `:4684`); the whole `catalog-uat` suite green |
| 5 | `installs disabled` is one indivisible closed-set amendment — tail-appended to `REASONS`, nothing reordered, with a home in the `notify-reasons.ts` topic partition | ✓ VERIFIED | `shared/notify.ts:175-183` appends at index 38 (the tail) after `"malformed command"`; the diff against `ec7d2e71` touches no existing member. Topic home: `DECLARED_STATE_REASONS` (`shared/notify-reasons.ts:149-161`) folded into `SharedTopicReason` (`:217-218`). The proof is real: `_UncoveredReason = Exclude<Reason, SharedTopicReason \| CommandPrivateReason>` pinned to `never` via `_AssertNever` (`notify-reasons.ts:245-248`) — a homeless member is a TS2344. `npx tsc --noEmit` exits 0 at HEAD. `compat-01-no-expansion.test.ts` (exact enumeration equality) took exactly one `+` line; `notify-closed-set-locks.test.ts` length pin updated to 39. Both green |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/shared/notify.ts` | Tail-appended token, `enableHint` field, frozen trailer, render gate | ✓ VERIFIED | +42/-9; all four sites present and wired |
| `extensions/pi-claude-marketplace/shared/notify-reasons.ts` | `DECLARED_STATE_REASONS` topic group inside the completeness proof | ✓ VERIFIED | +36/-16; proof resolves to `never` under `tsc` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | Verdict, cross-file precedence read, materialize-then-disable, write-back first field, hooks-cache skip, disabled row | ✓ VERIFIED | +411; every branch reached by a green test |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` | `disabled` arm in a total `INSTALL_RENDER` map over `InstallStatus` | ✓ VERIFIED | Mapped-type totality is compiler-enforced |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` | `applyDefaultEnabled` + `local` from `configSource`; install-disabled outcome branch | ✓ VERIFIED | `:589-645`; `surfacePostCommitWarnings` widened at `:1520-1534` |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts` | `reasons` / `enableHint` / `postCommitWarnings` on `PluginDisabledOutcome` | ✓ VERIFIED | All three optional, toggle path omits all three |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` | Conditional forwarding into the `disabled` row | ✓ VERIFIED | `:716-722` |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts` | Standalone opt-in | ✓ VERIFIED | `:95` `applyDefaultEnabled: true` |
| `docs/output-catalog.md` | Catalog blocks for the new bytes + amended status-token row | ✓ VERIFIED | Blocks at `:530`, `:542`, `:2103`; token row at `:156` now names both install surfaces |

### Key Link Verification

| From | To | Via | Status |
|------|-----|-----|--------|
| `edge/handlers/plugin/install.ts` | `orchestrators/plugin/install.ts` | `applyDefaultEnabled: true` on the standalone path | ✓ WIRED |
| `orchestrators/reconcile/apply.ts` | `orchestrators/plugin/install.ts` | `applyDefaultEnabled: true` + `local` derived from `op.configSource` | ✓ WIRED |
| `orchestrators/import/execute.ts` | `orchestrators/plugin/install.ts` | deliberately NOT wired (D-102-03) | ✓ VERIFIED ABSENT — `grep -rn applyDefaultEnabled extensions/` returns exactly 4 hits, none on the import path; `tests/orchestrators/import/execute.test.ts` pins the injected seam's `opts` |
| `orchestrators/plugin/install.ts` | `persistence/config-write-back.ts` | `writeBatchedConfigEntries` (standalone) / `writePluginConfigEntry` (orchestrated) — SPLIT-02's sanctioned writers, no fourth writer added | ✓ WIRED |
| `orchestrators/plugin/install.ts` | `orchestrators/marketplace/shared.ts` | `cascadeUnstagePlugin`, avoiding the `enable-disable.ts` import that would close a cycle | ✓ WIRED |
| `orchestrators/reconcile/apply.ts` | `orchestrators/reconcile/notify.ts` | `PluginDisabledOutcome.reasons` / `.enableHint` → rendered row | ✓ WIRED |
| `orchestrators/reconcile/apply.ts` | `surfacePostCommitWarnings` | `plugin-disabled` arm now accepted | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Rendered value | Source | Status |
|----------------|--------|--------|
| `(disabled)` status token, standalone | `disabledInstall.landed` ← resolver's `defaultEnabled` ∧ merged config read ∧ caller opt-in | ✓ FLOWING |
| `{installs disabled}` reason, reconcile | `InstallPluginOutcome.landedDisabled` ← the same verdict, returned across the orchestrated boundary | ✓ FLOWING |
| `v<version>` on the reconcile disabled row | new `InstallPluginOutcome.version` ← `installCtx.version` | ✓ FLOWING |
| `enabled: false` in `claude-plugins.json` | the verdict → the write-back patch (standalone) / `writePluginConfigEntry` (reconcile) | ✓ FLOWING — asserted against the physical file AND, for the local-declared case, against the merged view |
| enable-hint trailer | `enableHint: boolean` → frozen literal, no interpolation | ✓ FLOWING (asserted non-interpolating with deliberately distinctive names) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Compile-time partition proof holds | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Install-disabled state transition + cascade + write-through + row bytes | `node --test tests/orchestrators/plugin/install.test.ts` | 115/115 pass | ✓ PASS |
| Reconcile install-disabled stamp, write-target, row, and the failed-cascade convergence window | `node --test tests/orchestrators/reconcile/apply.test.ts` | 31/31 pass | ✓ PASS |
| Closed-set enumeration + length locks, catalog byte-equality, notify render, import non-opt-in | `node --test tests/architecture/compat-01-no-expansion.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/architecture/catalog-uat.test.ts tests/shared/notify-v2.test.ts tests/orchestrators/import/execute.test.ts` | 199/199 pass | ✓ PASS |

Full-suite `npm run check` was not re-run: `tsc` is green, all five owning suites are green, and the executor's boundary run is recorded in `102-VALIDATION.md`.

### Probe Execution

Not applicable — no `scripts/*/tests/probe-*.sh` exist in this repo and the phase declares none.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| OUT-01 | `installs disabled` appended at the `REASONS` tail with a topic-partition home | ✓ SATISFIED | Truth 5 |
| DFEN-04 | Install records disabled + writes `enabled: false`; artifacts not materialized | ✓ SATISFIED | Truths 1, 2 |
| DFEN-05 | An existing `enabled` value wins and is never overwritten, in either direction | ✓ SATISFIED (never-overwritten proven in both directions and across files; see the human item on the criterion's "stays disabled" gloss) | Truth 3 |
| OUT-04 | The notification says installed-disabled and how to enable, at info severity | ✓ SATISFIED on both surfaces | Truth 4 |

No orphaned requirements: `REQUIREMENTS.md` maps only OUT-01, DFEN-04, DFEN-05 and OUT-04 to Phase 102, and all four are claimed by the phase plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | none | — | `grep -nE "TBD\|FIXME\|XXX"` over every file changed between `ec7d2e71` and HEAD returns nothing; no `TODO`/`HACK`/`PLACEHOLDER` on any added line |

### Code-Review Closure Audit

All six `102-REVIEW.md` findings were re-checked against the current tree rather than taken on the report's word:

| ID | Claim | Verified in tree |
|----|-------|------------------|
| CR-01 | Precedence read spans both physical files | ✓ `readDeclaredEnabled` (`install.ts:1421-1443`) selects the merged ENTRY by local-file IDENTITY before reading `enabled`; regression case seeded into `configLocalJsonPath` exists (`install.test.ts:1228-1239`) and passes |
| CR-02 | Failed cascade still declares `enabled: false` | ✓ the early `tx.save(); return;` is gone (`install.ts:1638-1653` records the cause and falls through); both write arms are reached; `apply.test.ts` "a reconcile install whose disable cascade fails still declares enabled:false, so the next pass plans and completes the disable" passes |
| WR-01 | Reconcile row carries token, hint, version | ✓ `apply.ts:626-645` |
| WR-04 | Reconcile row forwards `postCommitWarnings` | ✓ `apply.ts:637-643` + `surfacePostCommitWarnings:1523-1534`, pinned by a green test |
| WR-02 | Standalone disabled row keeps degradation facts and raises severity | ✓ `install.ts:2248-2258` composes `malformedReasons` + `droppedKindReasons` and stamps `warning` on frontmatter degrade; pinned byte-exactly at `install.test.ts:1109-1113` |
| WR-03 | Catalog blocks + fixtures | ✓ three blocks, three fixtures, `catalog-uat` green |

### Human Verification Required

#### 1. Criterion 3's second gloss on the standalone `install` verb

**Test:** Seed `claude-plugins.json` with `{"p@mp": {"enabled": false}}` for a plugin whose manifest declares `defaultEnabled: true`, then run `/claude:plugin install p@mp`.

**Expected (observed today):** The config entry comes back byte-for-byte `{ enabled: false }` — never overwritten, which is exactly what DFEN-05's requirement text demands — but the record lands `enabled: true` and the artifacts materialize. The plugin does not "stay disabled" at the install boundary. The next `/reload` plans a disable (`orchestrators/reconcile/plan.ts:318-322`) and converges, so the divergence is transient, not permanent. The reconcile surface already satisfies the gloss outright: a declared-disabled, unrecorded plugin is never installed at all (`plan.ts:304-325`).

**Why human:** A product-semantics call, not a defect. The phase team chose the config-contract reading deliberately and wrote the reasoning into the test (`install.test.ts:1178-1184`: "running `install` IS the user asking for the install"). It is not a regression — the install verb never consulted the config `enabled` key before this phase. Only you can say whether the roadmap wording or the behavior should move.

**This looks intentional.** To accept the deviation, add to this file's frontmatter:

```yaml
overrides:
  - must_have: "a user who wrote enabled: false for a defaultEnabled: true plugin stays disabled"
    reason: >-
      DFEN-05's normative content (an existing enabled value wins over
      defaultEnabled and is never overwritten) holds in both directions and
      across both physical config files. Running `install` is itself the user
      asking for the install, so the verb materializes; the declared
      `enabled: false` is preserved untouched and the next reconcile pass
      converges the record to disabled.
    accepted_by: "acolomba"
    accepted_at: "<ISO timestamp>"
```

Then re-run verification.

### Observations (not gaps)

- **`orchestrators/plugin/install.ts:1638-1653` — standalone retry after a failed disable cascade.** The CR-02 fix closed the reconcile half (a bare entry no longer sits in permanent steady state). The standalone half of that finding is narrower and still open: the record is saved, so an immediate re-run of `install` hits the PI-15 `already-installed` gate and the only escape the user is told about is `uninstall`. A `/reload` does converge, because the config now declares `enabled: false`. Outside all five success criteria; worth a backlog line rather than a gap.
- **Criterion 2's agents/MCP arm is proven by composition, not by a direct assertion on the install-disabled path.** The tests assert skills, commands and hooks are gone from disk; agents and MCP entries rest on `cascadeUnstagePlugin` being the shared primitive (all five kinds, `marketplace/shared.ts:334-407`) with its own coverage in `tests/orchestrators/marketplace/cascade.test.ts`. Sound, but one `stat` on `locations.agentsDir` and one read of `mcpJsonPath` in the existing `install-out04-row-` fixture (which already seeds both kinds) would make it direct.
- **Bookkeeping lag.** `ROADMAP.md` still shows `102-03-PLAN.md` unchecked and "2/3 plans executed"; `REQUIREMENTS.md:35,80` still marks DFEN-05 `[ ] Pending`. The work landed (`4c053805`, `2400872e`, plus the fix pass). The phase-complete step should close both.

### Gaps Summary

No gaps. Every success criterion is met in the current tree, each one traced to the code that makes it true and to a test this verifier ran rather than to a SUMMARY claim. The six code-review findings are genuinely closed, not merely recorded as closed — the two blockers in particular (the single-file precedence read and the record-without-declaration failure window) are gone from the source and are now covered by tests that fail without the fix.

One item needs a human decision: success criterion 3's illustrative clause "a user who wrote `enabled: false` for a `defaultEnabled: true` plugin stays disabled" does not bind the standalone `install` verb in the shipped implementation, by a documented deliberate choice. The requirement it glosses (DFEN-05) is satisfied in full.

---

_Verified: 2026-08-15T03:12:41Z_
_Verifier: Claude (gsd-verifier)_
