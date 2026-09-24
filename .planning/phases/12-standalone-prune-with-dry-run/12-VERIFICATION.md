---
phase: 12-standalone-prune-with-dry-run
verified: 2026-09-24T14:49:15Z
status: passed
score: 27/27 must-haves verified
covered_files:
  - .planning/BACKLOG.md
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-01-PLAN.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-01-SUMMARY.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-02-PLAN.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-02-SUMMARY.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-03-PLAN.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-03-SUMMARY.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-04-PLAN.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-04-SUMMARY.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-05-PLAN.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-05-SUMMARY.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-06-PLAN.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-06-SUMMARY.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-07-PLAN.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-07-SUMMARY.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-08-PLAN.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-08-SUMMARY.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-CONTEXT.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-RESEARCH.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-REVIEW-FIX.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-REVIEW.iter1.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-REVIEW.iter2.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-REVIEW.iter3.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-REVIEW.iter4.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-REVIEW.iter5.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-REVIEW.md
  - .planning/phases/12-standalone-prune-with-dry-run/12-VALIDATION.md
  - README.md
  - docs/dependency-resolution.md
  - docs/messaging-style-guide.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/edge/flag-catalog.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/prune.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-summary.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/transaction/with-state-guard.ts
  - scripts/check-unused-type-members.contracts.json
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-prune.ts
  - tests/architecture/dependency-doc-agreement.test.ts
  - tests/architecture/flag-catalog-drift.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/edge/completions/provider.test.ts
  - tests/edge/flag-catalog.test.ts
  - tests/edge/handlers/plugin/prune.test.ts
  - tests/edge/register.test.ts
  - tests/edge/router.test.ts
  - tests/integration/standalone-prune.test.ts
  - tests/orchestrators/plugin/dependency-index.test.ts
  - tests/orchestrators/plugin/operations.test.ts
  - tests/orchestrators/plugin/prune-rollback.test.ts
  - tests/orchestrators/plugin/prune.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/persistence/state-io.test.ts
  - tests/shared/notification-dispatch.test.ts
  - tests/shared/notification-grammar.test.ts
  - tests/shared/notification-summary.test.ts
  - tests/shared/notification-types.test.ts
  - tests/transaction/with-state-guard.test.ts
covered_digest: "v1:sha256:acee32ddc1717eb5f4e88100bd73eaed7554f2dfa4d74b9aa84a8d6b93ef8ee2"
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 5
  total: 5
  not_honored: []
re_verification:
  previous_status: gaps_found
  previous_score: 26/27
  gaps_closed:
    - "Legacy actual prune now suppresses migration persistence and performs one durable state save."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "In a live Pi session with a disposable marketplace and separate scopes, run project prune preview, actual prune, /reload, and list."
    expected: "Preview changes no file; actual prune removes only project orphans and reports completed rows; held and explicit plugins and user scope remain."
    why_human: "The registered-command tests use a Pi test double and cannot observe live host command entry, notification readability, or reload visibility."
---

# Phase 12: Standalone prune with dry-run Verification Report

**Phase goal:** A user can see and remove the scope's orphaned dependency-installed plugins without uninstalling anything else, through a prune verb whose extra flag surface closes at --dry-run.
**Verified:** 2026-09-24T14:49:15Z
**Status:** passed. All code-level must-haves and the live Pi host flow passed.
**Re-verification:** Yes. The previous 26/27 report found a legacy-state double write; commit d6705259 closes that gap.

## Goal Achievement

### Observable Truths

| # | Contract and source | Status | Code and behavioral evidence |
|---|---|---|---|
| 1 | ROADMAP SC1 / PRUNE-06: remove every eligible dependency record, and nothing else, in fixpoint order with actual rows | ✓ VERIFIED | dependency-orphans.ts:110-132 filters provenance before declaring, sorts each batch, and repeats; prune.ts:254-299 calls the shared sweep; uninstall.ts:622-652 rechecks holders. Registered-command test at standalone-prune.test.ts:401-471 passed with exact alternating-marketplace rows, complete surviving-key set, and staged-file assertions. |
| 2 | 12-01: actual selection uses one fresh locked snapshot and at most one state save | ✓ VERIFIED | prune.ts:254-305 passes persistMigration:false into the locked transaction, whose loadState call honors it; one explicit tx.save follows the sweep. The named actual-prune legacy-state test and locked-transaction option test both passed. A controlled legacy-scope transaction with one tx.save produced exactly one state.json atomic rename event; the pre-fix control produced two. |
| 3 | 12-01: unreadable declarer fails closed; selected project scope leaves user scope untouched | ✓ VERIFIED | dependency-index.ts:230-256 returns the named failure before candidate selection; prune.ts:255-262 exits before backup/sweep/save. Independently run named project and unreadable registered-command tests both passed and compare both scope trees. |
| 4 | 12-01 / 12-02: named uninstall remains allowed for a depended-on primary and sweeps only after its successful removal | ✓ VERIFIED | uninstall.ts still passes the removed primary as initiallyGone to the same sweep; tests/orchestrators/plugin/uninstall.test.ts has active named allowed-removal and failed-primary cases. Phase 6 supersession is preserved in docs/dependency-resolution.md:182-218. |
| 5 | 12-02: failed member remains a holder while independent removals commit and report | ✓ VERIFIED | uninstall.ts:639-649 adds only successful keys to gone and rechecks isHeldBy. The named registered-command failure-and-retry test passed; it asserts retained dependent state and successful independent removal. |
| 6 | 12-03: registered no-target command reaches the real operation in user or project scope | ✓ VERIFIED | index.ts:207 calls registerClaudePluginCommand; register.ts:93-108 creates the prune handler; handler/prune.ts:24-51 invokes createPruneOperation; operations.ts:137-142 binds createPrunePlugin. Production factory and registration tests are active. |
| 7 | 12-03: existing routes remain, and rejected operands stop before state access | ✓ VERIFIED | router.ts:159-196 routes prune beside the existing switch arms; handler/prune.ts:26-43 returns on scanner or positional error before invoking prune. Handler and register tests assert absent scope roots on rejected inputs. |
| 8 | ROADMAP SC2 / 12-04: dry-run lists the same successful-snapshot fixpoint in pending tense at information severity | ✓ VERIFIED | prune.ts:209-240 and :264-279 use the same buildScopeDeclarationIndex and pruneOrphans; preview sends versionless will-uninstall rows with dependency-pruned reason and needsReload false. The named parity and alternating-marketplace integration tests passed. |
| 9 | 12-04: preview performs no lock, write, migration persistence, config change, artifact removal, or reload hint | ✓ VERIFIED | Preview branches before withLockedStateTransaction; loadState(..., {persistMigration:false}) suppresses state-io.ts:509-510 migration persistence. Named current and legacy preview tests passed and compare bytes, nanosecond mtime, complete trees, config, artifacts, and lock absence; missing-root case is active. |
| 10 | 12-04: actual prune reselects after a stale preview | ✓ VERIFIED | Actual index/selector is inside the later lock, not stored from preview. The independently run stale-preview test passed: a previewed old dependency becomes explicit and a fresh dependency is added; actual removes only fresh. |
| 11 | ROADMAP SC3 / FLAG-02: exactly --dry-run is added beyond shared --scope; no prompt or -y; uninstall flags stay intact | ✓ VERIFIED | flag-catalog.ts:128-132,196-197 has prune: [DRY_RUN_FLAG_ENTRY]; uninstall remains [KEEP_DATA_FLAG_ENTRY, PRUNE_FLAG_ENTRY, WRITE_TARGET_FLAG_ENTRY]. Both named independent drift tests passed. Handler rejects -y and has no confirmation path. |
| 12 | 12-05: both modes give an informational scoped Nothing to prune sentence and reason | ✓ VERIFIED | prune.ts:239, notifyCommitted at :163-166 send kind prune-empty; notification-dispatch.ts:246-248 renders the scoped sentence. Four user/project actual/preview command tests assert exact output. |
| 13 | 12-05: unreadable declaration never becomes ordinary empty output | ✓ VERIFIED | Both preview and actual test snapshot.ok before empty dispatch. Independently run unreadable-declarer integration test passed and checks named failed row plus unchanged scopes. |
| 14 | 12-05: actual empty sweep makes no save; empty preview stays nonpersisting and lock free | ✓ VERIFIED | prune.ts:280-283 gates save on members.length > 0; preview has no transaction call. Direct empty-sweep and missing-state tests assert save count and no lock/root. |
| 15 | 12-06: published output catalog covers actual, pending, empty, committed warning, member failure, and declaration failure | ✓ VERIFIED | docs/output-catalog.md:1208-1340 contains the prune section and exact state examples. The new typed warning and member-specific cleanup rows are also documented. |
| 16 | 12-06: catalog fixtures and full-byte contract agree, including section/state counts | ✓ VERIFIED | plugin-prune.ts supplies literal expected strings; catalog-contract.test.ts includes the fixture map and the named 21-module/244-state test passed in this verification. Its parser separately checks the section/state inventory. |
| 17 | 12-06: prior pending uninstall and uninstall --prune output remain byte-stable | ✓ VERIFIED | notification-grammar.ts:847-848 applies the optional reason only when supplied; plain pending remains bare. notification-grammar.test.ts:305 asserts both forms; the catalog contract includes old uninstall/pending fixtures as independent literals. |
| 18 | 12-07: bare prune defaults to user; either order of --scope project and --dry-run previews project | ✓ VERIFIED | handler/prune.ts:39-51 forwards parsed scope and consumed flag; prune.ts:207 defaults to user. Handler tests exercise both orders and absent scope; integration tests assert project preview trees. |
| 19 | 12-07: -y, --keep-data, --prune, --local, unknown flags, and positional targets fail before state/file access | ✓ VERIFIED | handler/prune.ts:26-43 rejects scanner local/unknown and residual operands before :45 operation call. Direct test matrix at tests/edge/handlers/plugin/prune.test.ts:102 onward compares exact errors and both missing scope roots. |
| 20 | 12-07: help, completion, and registered route expose only the accepted prune syntax; uninstall surface remains | ✓ VERIFIED | router.ts:63-105 includes verb and usage; provider.ts imports router inventory and uses catalog completions. Flag-catalog-drift.test.ts pins both parse and completion exact sets; named prune/uninstall parse-set tests passed. |
| 21 | 12-08: README and dependency guide teach actual, preview, scope default, rows, and empty result | ✓ VERIFIED | README.md:399-415 and docs/dependency-resolution.md:200-218 contain runnable syntax and the exact row phrases; dependency-doc-agreement.test.ts has active requirement anchors. |
| 22 | 12-08: docs retain uninstall --prune, allowed depended-on uninstall, and no automatic reload prune | ✓ VERIFIED | docs/dependency-resolution.md:186-218 distinguishes both commands and states reload does not prune; README.md:415 agrees. Documentation agreement tests anchor these claims. |
| 23 | ROADMAP SC4 / 12-08: PRUNE-CMD-01 closed and list/info orphan marker dropped | ✓ VERIFIED | .planning/BACKLOG.md:3153-3162 marks the item CLOSED and records D-12-03 dropping the marker. The implemented list/info code has no new orphan indicator. |
| 24 | 12-08: focused, direct-pair, full unit/integration, and project gates ran | ✓ VERIFIED | This verifier ran the earlier named behavioral cases plus the new legacy actual-prune and locked-transaction tests; all passed. Parent reports 7,760/7,760 unit tests with 100% aggregate line/branch/function coverage, focused integration 25/25, direct pairs at 100%, typecheck, lint, scoped pre-commit, and Fallow. The global npm check stops only at formatting of untouched operator-owned .planning/config.json; changed-file Prettier passed. |
| 25 | Review fix / user decision: rollback preserves every concurrent artifact or shared-metadata replacement | ✓ VERIFIED | prune-rollback.ts:157-192 uses exclusive link publication and refuses occupied targets; :194-230 never replaces changed metadata. The independently run publication-race test passed; direct tests cover MCP/agents-index collisions and retained originals. |
| 26 | Review fix / user decision: a failed save leaves missing directories absent, restores state, retains mapped backups, and reports partial recovery | ✓ VERIFIED | prune-rollback.ts:136-154,171-173 refuses missing directory publication; :328-379 writes the recovery manifest, restores state last, and retains backup on partial failure. Named missing-directory, two-skill manifest, and failed-save command tests passed; prune.ts:34-43,97-138 produces the partial-recovery notification with backup manifest path. |
| 27 | Review fix: committed removals and later cleanup/release failures are reported accurately per member and scope | ✓ VERIFIED | prune.ts:141-193 stores cleanup failure with its member; :301-334 separates post-commit release warning. The named second-member cleanup test passed and asserts only that member retains data and receives the cause; the 244-state catalog test pins the output. |

**Score:** 27/27 truths verified; 0 behavior-unverified. No override or flagged prohibition was needed.

### Decision Coverage

The independent check.decision-coverage-verify query reported 5/5 trackable CONTEXT.md decisions honored, none missing. This warning-only heuristic was cross-checked against code and tests above.

### Required Artifacts

The GSD artifact query found all 21 declarations across eight plans present and substantive (18 distinct paths). Manual wiring and data checks add the following:

| Artifact group | Level 1/2 | Wiring and Level 4 |
|---|---|---|
| prune.ts, prune-rollback.ts, dependency-index.ts, uninstall.ts | ✓ Substantive | ✓ Invoked through the production operation; state and declarations flow to selector, sweep, backup, save, and notifications. |
| handler/prune.ts, flag-catalog.ts, router.ts, register.ts, operations.ts | ✓ Substantive | ✓ Live extension factory registers the handler; parsed flags and scope reach the operation. |
| state-io.ts, with-state-guard.ts, and shared notification modules | ✓ Substantive | ✓ Preview and actual prune load real scoped state without migration persistence; actual uses one locked save; typed messages reach dispatcher and ctx.ui.notify. |
| integration and direct test pairs, flag drift and catalog fixtures | ✓ Substantive | ✓ Executed or included in parent full gates; literal expected values are independent of renderer/selector. |
| README.md, dependency guide, output catalog, BACKLOG.md | ✓ Substantive | ✓ User instructions and backlog match command behavior and independent doc/catalog tests. |

### Key Link Verification

| Link | Status | Evidence |
|---|---|---|
| Extension factory → registered slash command → router → prune handler → operation | ✓ WIRED | index.ts:207; register.ts:96,107,134; router.ts:169-170; handler/prune.ts:45-51; operations.ts:137-142. |
| Operation → full declaration index → pure fixpoint → guarded shared sweep | ✓ WIRED | prune.ts:211-218,254-279; uninstall.ts:622-652; dependency-orphans.ts:110-132. |
| Preview → nonpersisting state read → pending rows | ✓ WIRED | prune.ts:209-240; state-io.ts:408-410,509-510; notification grammar renders the optional reason. |
| Actual sweep → nonpersisting locked load → rollback snapshot → one save → post-commit cleanup and rows | ✓ WIRED | prune.ts:254-338 passes persistMigration:false through with-state-guard.ts to loadState, then tx.save; prune-rollback.ts:291-379 protects staged artifacts. |
| Both empty branches → typed notification dispatcher | ✓ WIRED | prune.ts:239 and :163-166 send kind prune-empty; notification-types.ts:822-826 and notification-dispatch.ts:246-248 define and render it. The automated key-link query's 12-05 literal-pattern check reports false because it searches for the type name PruneEmptyMessage, which the producer need not spell; the semantic link works and is exercised by four command tests. |
| Catalog fixture → dispatcher → exact documented bytes | ✓ WIRED | catalog-contract.test.ts imports PLUGIN_PRUNE_FIXTURES; named 244-state contract passed. |
| Router/catalog → help and completion | ✓ WIRED | TOP_LEVEL_SUBCOMMANDS and flagCompletions feed provider.ts; independent drift guard passed. |
| Dependency guide → agreement test | ✓ WIRED | requirement anchors are active in dependency-doc-agreement.test.ts. |

**Wiring:** 12/12 plan-declared links verified semantically; one literal pattern in the automated query was too specific.

### Data-Flow Trace (Level 4)

| User-visible value or effect | Real source | Flow and result |
|---|---|---|
| Preview rows | loadState(selected extension root) plus cached marketplace/plugin manifests | buildScopeDeclarationIndex reads every installed record offline; pruneOrphans returns ordered keys; each indexed record supplies marketplace/name; dispatcher renders pending rows. No static list. |
| Actual removed rows | Fresh locked tx.state and same manifest index | sweepOrphans attempts each member; its result rows flow through notifyCommitted. Failed members stay installed; successful ones are saved once. |
| Empty and failure output | Empty selector result or structured index/operation failure | Typed notification kinds carry selected scope or named declarer, then ctx.ui.notify renders exact grammar. |

### Behavioral Spot-Checks

| Behavior | Named test command | Result |
|---|---|---|
| Preview/actual order, held neighbors, stale preview | node --test-isolation=none --test --test-name-pattern='preview and actual preserve alternating marketplaces and held neighbors|actual prune reselects after a stale preview changes on disk' tests/integration/standalone-prune.test.ts | 2/2 passed |
| Project isolation, unreadable declarer, failed-member retry | node --test-isolation=none --test --test-name-pattern='project prune removes only the project orphan|an unreadable declarer refuses prune without changing either scope|failed actual member holds its dependency until a later retry' tests/integration/standalone-prune.test.ts | 3/3 passed |
| Current/legacy preview makes no write | node --test-isolation=none --test --test-name-pattern='prune --dry-run previews the orphan without writing current state|repeated legacy previews normalize in memory without writing the scope' tests/integration/standalone-prune.test.ts | 2/2 passed |
| Exact prune and retained uninstall flag sets | node --test-isolation=none --test --test-name-pattern='catalog parse flags for prune match the independent handler contract|catalog parse flags for uninstall match the independent handler contract' tests/architecture/flag-catalog-drift.test.ts | 2/2 passed |
| Missing directories, mapped backups, replacement race | node --test-isolation=none --test with named patterns in tests/orchestrators/plugin/prune-rollback.test.ts | 3/3 passed |
| Failed save and cleanup attribution | node --test-isolation=none --test with named patterns in tests/orchestrators/plugin/prune.test.ts | 2/2 passed |
| Legacy actual prune uses one durable save | node --test-isolation=none --test --test-name-pattern='prunes legacy state with one durable save' tests/orchestrators/plugin/prune.test.ts | 1/1 passed; verifies final state and one save call |
| Locked transaction suppresses migration persistence when requested | node --test-isolation=none --test --test-name-pattern='keeps a legacy state read in memory when migration persistence is disabled' tests/transaction/with-state-guard.test.ts | 1/1 passed; verifies unchanged legacy bytes before explicit save |
| Full output catalog bytes | node --test-isolation=none --test --test-name-pattern='catalog contract matches all 21 fixture modules to 244 exact documented states' tests/architecture/catalog-uat/catalog-contract.test.ts | 1/1 passed |

Node 26's default isolated file-level TAP reports one file as a subtest even when a name pattern matches zero cases. All evidence above uses --test-isolation=none and shows the named subtests and nonzero counts.

**Isolated legacy transaction reproduction:** Seeded a temporary project scope with schemaVersion 1 and a marketplace lacking migrated paths, watched state.json in the extension root, and invoked withLockedStateTransaction with one tx.save. Before the fix, the default legacy load plus save produced two atomic rename events. With `{persistMigration:false}`, the same controlled legacy transaction produced `{"events":["rename"],"finalVersion":3,"stamp":"after"}`. This independently confirms one durable state-file publication and the expected normalized final document.

### Probe Execution

No PLAN or SUMMARY declares a probe script or PASS/stage-marker gate; Step 7c is not applicable. The planned Phase 12 edge probes are named tests in the behavioral spot-check table.

### Requirements Coverage

| Requirement | Plans | Status | Evidence |
|---|---|---|---|
| PRUNE-06 | 01, 02, 03, 05, 06, 07, 08 | ✓ SATISFIED | ROADMAP SC1; full-scope selector, real operation, scope isolation, failure handling, actual output, and named integration tests. |
| PRUNE-07 | 04, 05, 06, 08 | ✓ SATISFIED | ROADMAP SC2; same-snapshot pending rows, nonpersisting state read, current/legacy/absent no-write tests, stale-preview reselect. |
| FLAG-02 | 04, 07, 08 | ✓ SATISFIED | ROADMAP SC3; exact catalog parse/completion sets, reject-before-state tests, no prompt/-y, retained uninstall set. |

REQUIREMENTS.md maps exactly PRUNE-06, PRUNE-07, and FLAG-02 to Phase 12. Every mapped ID appears in at least one PLAN; none is orphaned.

### Test Quality Audit

| Requirement-linked tests | Active | Disabled | Circular expected values | Strongest assertion |
|---|---:|---:|---|---|
| 23 changed TypeScript test/fixture files | Over 600 active test calls (some loops add cases) | 0 | None found | Behavioral: complete notification strings, full state and tree snapshots, bytes/mode/mtime, one-save legacy regression, and negative side effects. |

The filesystem writes in the tests seed fresh hermetic temporary scopes. Catalog expected strings are literal fixtures, and integration expected order is written independently of pruneOrphans. No skipped/only/todo case or fixture generator that captures the renderer's own output was found.

### Anti-Patterns Found

No unreferenced TBD, FIXME, XXX, TODO, HACK, or PLACEHOLDER marker appeared in the 15 phase-changed production TypeScript files. The relevant source paths have real selector, state, and notification flows rather than empty return stubs. The final 12-REVIEW.md reports zero findings; this verification relies on the source and named tests above, not that review claim.

### Human Verification Completed

#### 1. Real Pi scratch-scope command flow

**Test:** In a live Pi session using a disposable marketplace with one orphaned dependency, one held dependency, and one explicit plugin, run /claude:plugin prune --scope project --dry-run. Inspect the listed rows and project files. Then run /claude:plugin prune --scope project, /reload, and list; compare the user scope.
**Expected:** The preview shows only the project orphan as (will uninstall) {dependency pruned} and changes no file. Actual prune shows its (uninstalled) {dependency pruned} row, removes only that orphan's record and staged resources, leaves the held/explicit plugins and user scope untouched, and Pi shows the result after /reload.
**Why human:** The registered-command integration uses a Pi API test double. It proves the command-to-disk behavior and exact notification bytes but cannot prove live Pi command entry, rendering readability, or reload visibility.
**Result:** Passed by the user on 2026-09-24. `12-UAT.md` records the live Pi scratch run, preview and actual rows, `/reload`, and scope results.

### Gaps Summary

No code or UAT gaps remain. The legacy double-write gap is closed by the nonpersisting locked load and a new actual-prune regression test. The post-UAT validation audit found 3/3 requirements covered, and the security audit closed all 12 planned threats.

The repository-wide npm run check cannot clear format:check while untouched operator-owned .planning/config.json is dirty; all changed-file formatting and unaffected downstream gates passed according to the parent run. That baseline is not a Phase 12 code gap.

---

_Verified: 2026-09-24T14:49:15Z_
_Verifier: the agent (gsd-verifier)_
