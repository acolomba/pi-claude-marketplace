---
phase: 04-install-provenance
verified: 2026-09-16T19:40:00Z
status: passed
score: 9/9 must-haves verified
covered_files: [".planning/REQUIREMENTS.md", ".planning/phases/04-install-provenance/04-01-PLAN.md", ".planning/phases/04-install-provenance/04-01-SUMMARY.md", ".planning/phases/04-install-provenance/04-02-PLAN.md", ".planning/phases/04-install-provenance/04-02-SUMMARY.md", ".planning/phases/04-install-provenance/04-03-PLAN.md", ".planning/phases/04-install-provenance/04-03-SUMMARY.md", ".planning/phases/04-install-provenance/04-04-PLAN.md", ".planning/phases/04-install-provenance/04-04-SUMMARY.md", ".planning/phases/04-install-provenance/04-05-PLAN.md", ".planning/phases/04-install-provenance/04-05-SUMMARY.md", ".planning/phases/04-install-provenance/04-06-PLAN.md", ".planning/phases/04-install-provenance/04-06-SUMMARY.md", ".planning/phases/04-install-provenance/04-CONTEXT.md", ".planning/phases/04-install-provenance/04-REVIEW-FIX.md", ".planning/phases/04-install-provenance/04-REVIEW.md", "extensions/pi-claude-marketplace/orchestrators/import/execute.ts", "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts", "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts", "extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts", "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts", "extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts", "extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts", "extensions/pi-claude-marketplace/orchestrators/types.ts", "extensions/pi-claude-marketplace/persistence/migrate.ts", "extensions/pi-claude-marketplace/persistence/state-io.ts", "extensions/pi-claude-marketplace/shared/notification-types.ts", "extensions/pi-claude-marketplace/shared/notify-reasons.ts"]
covered_digest: "v1:sha256:e25a48cca410b553a4e9d7059c4f6fd67767177b45fe4b8e95e06ee8391137d2"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "In a live Pi session, install a plugin as a dependency of another plugin (so its record carries `provenance: \"dependency\"`), then run `install <that plugin>` by name."
    expected: "The command reports one `installed` row carrying `{already installed, dependency promoted}` at info severity (no reload hint unless the record was disabled and got re-materialized), and the plugin's key now appears in `claude-plugins.json`."
    why_human: "The catalog contract test pins the exact byte rendering of the row and an automated install-flow test proves the state-document effect, but whether the row reads sensibly to a person inside a real Pi session is the judgment 04-VALIDATION.md's own 'Manual-Only Verifications' section defers to phase UAT (coverage item D6 in 04-06-SUMMARY.md is explicitly `human_judgment: true`)."
---

# Phase 4: Install provenance Verification Report

**Phase Goal:** Each install record states how the plugin got there — the user asked for it by name, or another plugin declared it — together with the rules that keep the two from overwriting each other, and a truthful answer for a record written before the field existed. This is the record `--prune` reads.
**Verified:** 2026-09-16T19:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PROV-01: a cascade install marks the named plugin `"explicit"` and each dependency `"dependency"`, and this decision is per-closure-member (root wins on adjacency, no-dependency plugins are `"explicit"`, decision is order-independent) | ✓ VERIFIED | `install-flow.ts:1455` `provenance: isRoot ? "explicit" : "dependency"`; `tests/orchestrators/plugin/install-flow.test.ts` cases `D-04-01: a cascade records its root as explicit and its dependency as a dependency` and `D-04-01: a plugin declaring no dependencies records its single member as explicit`, run directly: pass |
| 2 | PROV-02: a plugin the user installed directly stays directly-installed, with its ENTIRE record byte-identical, after a later install declares it as a dependency | ✓ VERIFIED | `tests/orchestrators/plugin/install-flow.test.ts#D-04-01: a direct install stays a direct install when a later plugin declares it` — whole-record `deepStrictEqual` against a `clonePluginRecord` snapshot; observed red only after three independent guards (RESV-05 closure partition, PI-5 entry refusal, PI-15 commit refusal) were simultaneously relaxed (04-03-SUMMARY.md); run directly: pass |
| 3 | PROV-03: `install <plugin>` on a dependency-installed record promotes it (`provenance` → `"explicit"`, key written to config, distinct `{already installed, dependency promoted}` row), and changes nothing else in the record | ✓ VERIFIED | `install-flow.ts:886-919` `promoteDependencyRecord`; `tests/orchestrators/plugin/install-flow.test.ts#D-04-07: installing a dependency by name flips its provenance and nothing else in the state document` — whole-document `deepStrictEqual` with only `provenance` changed; run directly: pass (16/16 across all `D-04-07` cases) |
| 4 | PROV-04: a pre-milestone record loads, fills `"explicit"` silently, persists at schemaVersion 3, and no record is misreported as a dependency; a present-but-wrong value is rejected at its JSON pointer; schemaVersion 4 is still rejected | ✓ VERIFIED | `persistence/migrate.ts:205-226` `ensurePluginProvenance` (only-absent fill); `persistence/state-io.ts:408-421` `loadState` version guard `[1,2,3]`; `tests/persistence/state-io.test.ts` + `tests/persistence/migrate.test.ts` `D-04-03` cases (fill-and-persist, non-coercion, multi-marketplace no-misreport, v4 rejection); run directly: pass (6/6 targeted) |
| 5a | D-04-02/04-05: a cascade-installed dependency survives `/reload` with NO declaration in `claude-plugins.json` (same-marketplace shape) | ✓ VERIFIED | `install-flow.ts` — config write arms retired (`grep dependencyPluginPatches\|dependencyKeys\|writeBatchedConfigEntries` → 0 hits in `install-flow.ts`); `reconcile/plan.ts:503-505` provenance exemption; `tests/orchestrators/plugin/install-flow.test.ts#RESV-01 / D-04-04: an orchestrated install records its cascade dependency undeclared, and the next reload keeps it` drives `applyReconcile` twice; observed red when the wave-4 exemption was reverted (04-05-SUMMARY.md); run directly: pass |
| 5b | D-04-02/04-05, CR-01 shape (a): the same survival holds when the dependency is adopted from a DIFFERENT (undeclared) marketplace via the CMP-3 fallback | ✓ VERIFIED | `tests/orchestrators/plugin/install-flow.test.ts#D-04-05 / CMP-3: a dependency adopted from a user-scope marketplace survives the project reload that follows the install` — full `applyReconcile` pass, asserts empty `marketplacesToRemove`/`pluginsToUninstall`, no notifications, state unchanged; run directly: pass |
| 6 | D-04-01: provenance is a one-way ratchet — `dependency → explicit` only; nothing downgrades an explicit record | ✓ VERIFIED | statePhase (`install-outcome.ts:994`): `existing?.provenance ?? opts.provenance ?? "explicit"` carries a kept record's value through; PROV-02 case (above) is the direct proof; no code path sets `provenance = "dependency"` on an existing record |
| 7 | D-04-08: no source comment or test title introduced by this phase cites a bare `PROV-NN`; all new anchors are `D-04-NN` or pre-existing in-tree anchors | ✓ VERIFIED | `grep -rn "PROV-0[1-4]" extensions/ tests/ docs/` over the phase's changed files returns only pre-existing git-auth-provider citations (`install-flow.ts:217/223/252`, `install.messaging.ts:201/301`) that predate this phase and are outside its scope |
| 8 | CR-01 fix (review iteration 4): a promotion of a `--local`-disabled record stamps `{ enabled: true }` in the file that DECLARES the key (base or local), never the file that merely doesn't | ✓ VERIFIED | `orchestrators/import/execute.ts:1057-1080` `stampReenabledWhereLocalDeclares`; review report (`04-REVIEW.md`) confirms this at source against the two committed test cases; `tests/orchestrators/import/execute.test.ts` run directly: 54/54 pass |
| 9 | IN-01 fix: the promotion reason brace (`{already installed, dependency promoted}`) is spelled once and shared by both the standalone and import surfaces | ✓ VERIFIED | `install.messaging.ts:326-329` exports `PROMOTED_ROW_REASONS`; `execute.ts:462` reads the same binding; `tests/orchestrators/plugin/install.messaging.test.ts` run directly: 51/51 pass |

**Score:** 9/9 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/persistence/state-io.ts` | `provenance` field, schemaVersion `[1,2,3]`, `DEFAULT_STATE` at 3, `loadState` guard, `clonePluginRecord` enumeration | ✓ VERIFIED | Confirmed at source: `Type.Union([Type.Literal("explicit"), Type.Literal("dependency")])` (line 136), `DEFAULT_STATE.schemaVersion: 3`, guard rejects 4 |
| `extensions/pi-claude-marketplace/persistence/migrate.ts` | `ensurePluginProvenance` silent-fill twin of `ensurePluginEnabled` | ✓ VERIFIED | Lines 193-226; only-absent fill, called from `migrateLegacyMarketplaceRecords` before validation |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` | `InstallLedgerOptions.provenance`; statePhase 3-way fallback | ✓ VERIFIED | Lines 177, 988-994 |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` | per-member decision, config-write retirement, promotion path | ✓ VERIFIED | Lines 1455 (decision), 860-1090 (promotion), no `dependencyPluginPatches`/`dependencyKeys`/`writeBatchedConfigEntries` remaining |
| `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts` | provenance carry-forward | ✓ VERIFIED | Line 148: `provenance: input.oldRecord.provenance` |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` | `buildUninstallBucket` dependency exemption | ✓ VERIFIED | Lines 500-513: single `continue` on `record.provenance === "dependency"` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` | `writeAdoptingConfigEntries` without dependency-patches property | ✓ VERIFIED | `dependencyPluginPatches`/`dependencyKeys` absent from file |
| `extensions/pi-claude-marketplace/shared/notification-types.ts` / `notify-reasons.ts` | `"dependency promoted"` closed-set member, 54-entry set | ✓ VERIFIED | `REASONS.length === 54` pinned and passing (`notify-closed-set-locks.test.ts`) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` | `composePromotedRow` / `PROMOTED_ROW_REASONS` | ✓ VERIFIED | Lines 300-368 |
| `docs/output-catalog.md` | "Dependency promoted to a direct install (D-04-07)" section, byte-length lock | ✓ VERIFIED | `EXPECTED_STATE_COUNT=206`, `EXPECTED_UTF8_BYTES=27_385`, section present at line 990 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `install-flow.ts` `ledgerOptionsFor` | `install-outcome.ts` statePhase | `InstallLedgerOptions.provenance` | ✓ WIRED | `isRoot ? "explicit" : "dependency"` flows to `core.provenance` (line 298) to statePhase's write |
| `migrate.ts::ensurePluginProvenance` | `state-io.ts::STATE_VALIDATOR.Check` | runs before validation inside `migrateLegacyMarketplaceRecords` | ✓ WIRED | Called at line 295 of `migrate.ts`, before `STATE_VALIDATOR.Check` in `loadState` |
| `reconcile/plan.ts::buildUninstallBucket` | persisted `provenance` field | reads `record.provenance` off the record already in scope | ✓ WIRED | No new import; purity gate (`reconcile-planner-purity.test.ts`) unamended and green |
| `install-flow.ts::promoteDependencyRecord` | `orchestrators/plugin/shared.ts::writeAdoptingConfigEntries` | config write on promotion | ✓ WIRED | Line 950-960; skipped in orchestrated mode (import's own write path takes over) |
| `orchestrators/import/execute.ts` | `install.messaging.ts::PROMOTED_ROW_REASONS` | shared constant import | ✓ WIRED | `execute.ts:462` reads the export by reference (pinned by identity assertion in `install.messaging.test.ts:628`) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| PROV-01/02/03/04/promotion cases in `install-flow.test.ts` | `node --test --test-name-pattern "D-04-01\|D-04-07\|D-04-05\|D-04-02\|D-04-03\|D-04-04" tests/orchestrators/plugin/install-flow.test.ts` | 16 tests, 16 pass | ✓ PASS |
| Reconcile provenance exemption (positive + negative control) | `node --test --test-name-pattern "D-04-05" tests/orchestrators/reconcile/plan.test.ts` | 5 tests, 5 pass | ✓ PASS |
| Persistence PROV-04 fill/non-coercion | `node --test --test-name-pattern "D-04-03" tests/persistence/state-io.test.ts tests/persistence/migrate.test.ts` | 6 tests, 6 pass | ✓ PASS |
| Import promotion surface (CR-01/IN-01 fixes) | `node --test tests/orchestrators/import/execute.test.ts` | 54 tests, 54 pass | ✓ PASS |
| Promotion row composer | `node --test tests/orchestrators/plugin/install.messaging.test.ts` | 51 tests, 51 pass | ✓ PASS |
| Catalog/closed-set/COMPAT-01 pins | `node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/shared/notification-types.test.ts tests/architecture/hooks-foundation.test.ts` | 33 tests, 33 pass | ✓ PASS |
| Debt-marker scan on all 12 phase-touched production files | `grep -n "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` | 0 hits | ✓ PASS |
| Bare `PROV-NN` scan | `grep -rn "PROV-0[1-4]" extensions/ tests/ docs/` | only pre-existing git-auth-provider citations outside phase scope | ✓ PASS |

Full `npm run check` was not re-run per the task's instruction (already green on this tree per the last fixer/orchestrator: unit 6399/6399, integration 32/32, fallow clean); the targeted runs above are direct evidence over this session's own process, not a re-narration of that claim.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| PROV-01 | 04-01, 04-02, 04-03, 04-04, 04-05 | Each install record states whether the user asked for the plugin directly or it arrived as a dependency | ✓ SATISFIED | Truths 1, 5a, 5b, 6 above |
| PROV-02 | 04-03, 04-05 | A directly-installed plugin stays marked as such when later declared as a dependency | ✓ SATISFIED | Truth 2 above |
| PROV-03 | 04-06 | A dependency-installed plugin becomes directly-installed when the user installs it by name | ✓ SATISFIED | Truth 3 above; human verification item for the live-session row legibility |
| PROV-04 | 04-01, 04-02 | A pre-milestone record upgrades to the current schema with a truthful default, no record misreported as a dependency | ✓ SATISFIED | Truth 4 above |

No orphaned requirements: `.planning/REQUIREMENTS.md` maps only PROV-01..04 to Phase 4, and all four are claimed by at least one plan's `requirements:` field.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers, no empty-implementation stubs, and no bare `PROV-NN` citations in any of the 12 production files this phase touched.

### Deferred Items

Two findings from the code review were deliberately backlogged by the operator, per `04-REVIEW-FIX.md`'s binding decisions, and are NOT counted as gaps:

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | A cascade enabling an already-installed, disabled dependency (today RESV-05 leaves it disabled) | Backlog `ENBL-DEP-01` | `.planning/BACKLOG.md:2969-2986`: "Surfaced by the v1.20 Phase 4 code review... Scope when picked up: the cascade's RESV-05 arm enables the disabled member..." |
| 2 | A plugin's status propagating from a partially-supported dependency's status | Backlog `DEPS-STATUS-01` | `.planning/BACKLOG.md:2988-2995`: "Surfaced in the same review... Needs: a walk from a record to its declared dependencies' records at render time..." |

Also carried forward, not a gap: development trees that ran a cascade install between plan 04-01 and plan 04-05 landed development-tree config entries and mislabelled `"explicit"` records that Phase 5's `--prune` will decline to prune (04-05-SUMMARY.md, 04-06-SUMMARY.md "The two items the phase owes its successor"). This is explicitly scoped as dev-tree residue carried into Phase 5 UAT, not a Phase 4 defect.

### Human Verification Required

1. **Live-session row legibility for PROV-03's promotion**
   - **Test:** In a live Pi session, install a plugin as a dependency of another plugin (so its record carries `provenance: "dependency"`), then run `install <that plugin>` by name.
   - **Expected:** The command reports one `installed` row carrying `{already installed, dependency promoted}` at info severity (no reload hint unless the record was disabled and got re-materialized), and the plugin's key appears in `claude-plugins.json`.
   - **Why human:** The catalog contract test pins the exact byte rendering and an automated `install-flow.test.ts` case proves the state-document effect, but whether the rendered row reads sensibly to a person is the judgment `04-VALIDATION.md`'s "Manual-Only Verifications" section explicitly defers to phase/milestone UAT (coverage item D6 in `04-06-SUMMARY.md` is marked `human_judgment: true` with no automated verification listed).

### Gaps Summary

None. All five ROADMAP success criteria and all four PROV requirement IDs are backed by passing tests run directly in this session, by source-level confirmation of the claimed production changes, and by a clean debt-marker/anti-pattern scan. The two backlogged review findings (cascade auto-enable, dependency status propagation) were explicit, operator-ruled out-of-scope decisions, not gaps this phase left behind. The single open item is the one the phase's own validation plan already flagged as requiring a human in a live session — the row's legibility, not its correctness.

---

_Verified: 2026-09-16T19:40:00Z_
_Verifier: Claude (gsd-verifier)_
