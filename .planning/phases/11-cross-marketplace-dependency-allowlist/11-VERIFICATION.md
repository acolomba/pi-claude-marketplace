---
phase: 11-cross-marketplace-dependency-allowlist
verified: 2026-09-23T18:54:13Z
status: passed
human_verified: 2026-09-23T19:10:57Z
score: 20/20 must-haves verified
covered_files:
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/phases/11-cross-marketplace-dependency-allowlist/11-01-PLAN.md
  - .planning/phases/11-cross-marketplace-dependency-allowlist/11-01-SUMMARY.md
  - .planning/phases/11-cross-marketplace-dependency-allowlist/11-02-PLAN.md
  - .planning/phases/11-cross-marketplace-dependency-allowlist/11-02-SUMMARY.md
  - .planning/phases/11-cross-marketplace-dependency-allowlist/11-03-PLAN.md
  - .planning/phases/11-cross-marketplace-dependency-allowlist/11-03-SUMMARY.md
  - .planning/phases/11-cross-marketplace-dependency-allowlist/11-04-PLAN.md
  - .planning/phases/11-cross-marketplace-dependency-allowlist/11-04-SUMMARY.md
  - .planning/phases/11-cross-marketplace-dependency-allowlist/11-05-PLAN.md
  - .planning/phases/11-cross-marketplace-dependency-allowlist/11-05-SUMMARY.md
  - .planning/phases/11-cross-marketplace-dependency-allowlist/11-06-PLAN.md
  - .planning/phases/11-cross-marketplace-dependency-allowlist/11-06-SUMMARY.md
  - .planning/phases/11-cross-marketplace-dependency-allowlist/11-07-PLAN.md
  - .planning/phases/11-cross-marketplace-dependency-allowlist/11-07-SUMMARY.md
  - .planning/phases/11-cross-marketplace-dependency-allowlist/11-CONTEXT.md
  - .planning/phases/11-cross-marketplace-dependency-allowlist/11-RESEARCH.md
  - .planning/phases/11-cross-marketplace-dependency-allowlist/11-REVIEW.md
  - CHANGELOG.md
  - docs/dependency-resolution.md
  - docs/messaging-style-guide.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/domain/dependency-closure.ts
  - extensions/pi-claude-marketplace/domain/manifest.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - scripts/check-unused-type-members.contracts.json
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/marketplace-info.ts
  - tests/architecture/catalog-uat/fixtures/plugin-install.ts
  - tests/architecture/catalog-uat/fixtures/reconcile-applied.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/dependency-doc-agreement.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/domain/dependency-closure.test.ts
  - tests/domain/manifest.test.ts
  - tests/integration/reconcile-plan-convergence.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/info.test.ts
  - tests/orchestrators/plugin/install-cascade.messaging.test.ts
  - tests/orchestrators/plugin/install-cascade.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/notify.test.ts
  - tests/orchestrators/reconcile/plan.test.ts
  - tests/orchestrators/reconcile/types.test.ts
  - tests/shared/notification-grammar.test.ts
  - tests/shared/notification-types.test.ts
  - tests/shared/notify-reasons.test.ts
covered_digest: "v1:sha256:934b2ab906c40a48c7a9618f91e024b5dff7a87ced1536100a2f95b56b1bd2ec"
behavior_unverified: 0
overrides_applied: 0
prohibitions_flagged: 2
human_verification:
  - test: "Review the refusal text and actual authorization rule for the added-marketplace prohibition."
    expected: "An added marketplace alone grants no automatic dependency permission; the refusal explains the root marketplace's allowlist decision."
    why_human: "11-03-PLAN.md declares this a judgment-tier, unresolved prohibition without a wired enforcement check. Automated evidence supports it, but the plan requires a human disposition."
  - test: "Review the refusal remedies for the manual-install prohibition."
    expected: "The named dependency can be installed manually first; editing the named root marketplace's allowCrossMarketplaceDependenciesOn is presented as a separate option."
    why_human: "11-03-PLAN.md declares this a judgment-tier, unresolved prohibition without a wired enforcement check. Automated evidence supports it, but the plan requires a human disposition."
---

# Phase 11: Cross-marketplace dependency allowlist Verification Report

**Phase goal:** A plugin may only pull a dependency from another marketplace when its own marketplace permits it, while an already-installed dependency still satisfies the declaration.
**Status:** passed. Functional goal and XMKT-01/02 are verified; both judgment-tier prohibitions passed human review in `11-UAT.md`.
**Re-verification:** No previous Phase 11 VERIFICATION.md existed.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Code and behavioral evidence |
|---|---|---|---|
| 1 | ROADMAP SC1: an unlisted new foreign dependency is refused with `cross-marketplace`, the field remedy, and no partial install | ✓ VERIFIED | `dependency-closure.ts:383-421` checks permission before lookup; `install-cascade.ts:1177-1191` returns before phases; named direct-install denial test passed and compares state, config, tree, and exact error output (`install-flow.test.ts:3241-3314`). |
| 2 | ROADMAP SC2: an already-installed dependency satisfies regardless of the allowlist | ✓ VERIFIED | `dependency-closure.ts:383-390` records the edge and returns before policy; named `XMKT-02 recorded foreign edges retain every range before the installed check` test passed, including absent marketplace (`dependency-closure.test.ts:556-580`). |
| 3 | ROADMAP SC3: absent field means empty permission; info and cascade use the same parsed value | ✓ VERIFIED | Optional schema field at `manifest.ts:33`; info projects the cached loader's value at `info.ts:89-101`; direct policy loader reads the same parser at `install-flow.ts:493-510`. Named manifest, info, and direct-install tests passed. |
| 4 | A present non-string-array field fails validation and marketplace add records nothing | ✓ VERIFIED | TypeBox `Check` and field-path error in `manifest.ts:125-131`; add uses `loadMarketplaceManifest` (`add.ts:695,881`). The malformed matrix in `manifest.test.ts:117-142` and add command tracer in `add.test.ts:530-566` are active. |
| 5 | Valid allowlist strings retain order and bytes, including duplicates, empty strings, Unicode, and controls | ✓ VERIFIED | No normalization between `manifest.ts:33` and `install-flow.ts:510`; complete-array assertions in `manifest.test.ts:57-67` and exact membership cases in `dependency-closure.test.ts:493-518`. |
| 6 | Info displays only a nonempty scope-specific list, preserving source order and duplicates | ✓ VERIFIED | `info.ts:100-101` projects each record; `notification-grammar.ts:1198-1200` gates the line. Named both-scope info test passed; `info.test.ts:229,306` pins exact bytes. |
| 7 | Info escapes unsafe controls without changing policy and rejects malformed manifests via its existing path | ✓ VERIFIED | Display-only encoding at `notification-grammar.ts:1134-1138`; info uses the validated loader at `info.ts:89`. Info/renderer tests compare single-line output and source data; malformed info case is active at `info.test.ts:329`. |
| 8 | The reason is a typed closed-set token and both remedies reach error-severity failed rows | ✓ VERIFIED | `notification-types.ts:191`, `notify-reasons.ts:355`, and `install-cascade.messaging.ts:304-312,488-510`; catalog fixture/output byte test passed at 230 states. The cause names dependency, declarer, target, and policy root. |
| 9 | An added marketplace alone grants no permission; unlisted targets are rejected before catalog lookup and nothing auto-adds them | ✓ VERIFIED | Guard order at `dependency-closure.ts:393-421`; named pre-lookup test passed and asserts only the root lookup ran (`dependency-closure.test.ts:356-379`). An allowlisted but absent marketplace retains `marketplace-not-added` (`:520-553`). |
| 10 | Edge recording, range merging, and installed version checks survive the permission guard | ✓ VERIFIED | `recordEdge` appends range at `dependency-closure.ts:265-282` before the installed/policy guards. The named diamond/range test passed; cascade's post-closure constraint check remains at `install-cascade.ts:1194-1200`. |
| 11 | Recorded disabled foreign dependencies are exempt, but their new children still answer to the direct root; enabled records remain walls | ✓ VERIFIED | `install-cascade.ts:1170-1188` separates traversal stops from all recorded keys; closure tests at `dependency-closure.test.ts:417-436,582-603` and cascade test at `install-cascade.test.ts:2577` exercise both paths. |
| 12 | Every direct transitive edge uses the original root marketplace's list, with exact case-sensitive membership | ✓ VERIFIED | `dependency-closure.ts:398-407` compares the parsed root to each edge; named real A@alpha → B@beta → C@gamma denial test passed, comparing full tree/state/output (`install-flow.test.ts:3322-3406`). Exact strings are tested at `dependency-closure.test.ts:493-518`. |
| 13 | Reload checks the original declarer-to-missing edge before starting the missing root's cascade | ✓ VERIFIED | `install-flow.ts:2187-2234` orders recorded check, target availability, authorization, then cascade. Named refusal test passed and proves no state/config/tree change (`install-flow.test.ts:11736-11812`). |
| 14 | Any eligible original declarer can authorize; grouping keeps distinct declarers, all ranges, and stable first `requiredBy` | ✓ VERIFIED | `plan.ts:768-845` filters before grouping and retains all sources; `apply.ts:696-707` passes them unchanged; `install-flow.ts:513-575` checks same-marketplace first then foreign policies. Named plan, second-policy, and later-grant tests passed. |
| 15 | Once A authorizes missing B, B's own list governs B-to-C | ✓ VERIFIED | Reload supplies B's policy to `runInstallCascade` at `install-flow.ts:2234-2249`. Named nested-policy test passed, including refusal when A allows C but B does not (`install-flow.test.ts:11916-11985`). |
| 16 | A recorded missing key skips authorization and manifest reads, including disabled and removed-source cases | ✓ VERIFIED | The locked transaction returns at `install-flow.ts:2183-2189`, before target/source/policy reads. Active recorded-key scenarios are in `install-flow.test.ts:11823-11909`; SC2's direct installed test passed independently. |
| 17 | Reload refusal retains `cross-marketplace` and is fail-clean and retryable after policy correction | ✓ VERIFIED | `install-flow.ts:2218-2231,2310-2342` preserves the structured reason; `apply.ts:746-754` uses it in the row. Named refusal/retry test passed with byte-equal state/tree checks and a second successful call (`install-flow.test.ts:11736-11812`). |
| 18 | Startup does not install the bucket; project/user source precedence and target scope remain intact | ✓ VERIFIED | `apply.ts:687-707` gates on `reason === "reload"`; `resolveInstallMarketplaceSource` receives target scope and state at `install-flow.ts:499-504,552-557`. Named project-precedence test passed; `apply.test.ts:5699` exercises user-source/project-target behavior. |
| 19 | Documentation and catalog describe direct and reload authority, strict field validation, installed-first, both remedies, and the info line | ✓ VERIFIED | `docs/dependency-resolution.md`, `docs/messaging-style-guide.md:86`, and `docs/output-catalog.md` carry the rules; production-composer document agreement and 230-state catalog contract are active, and the named catalog test passed. |
| 20 | Phase checks are recorded honestly, including the local format baseline | ✓ VERIFIED | Isolated Wave 7 check is recorded as exit 0: 7,646 unit tests at 100% and 38 integration. Parent run results supplied by orchestrator are 7,646/7,646 unit, 38/38 integration, 7/7 type-member, and 3/3 prior-phase E2E; the chained parent check exits 1 at formatting. This verifier independently reproduced only `.planning/config.json` failing `npx prettier --check`; the file is user-owned and was not edited. |

**Score:** 20/20 truths verified; 0 present-but-behavior-unverified. The two separate prohibition review items passed in `11-UAT.md`.

### Decision Coverage

`check.decision-coverage-verify` reports 6/6 CONTEXT decisions honored; no unhonored IDs. The query is warning-only, and the implementation evidence above was checked separately.

### Required Artifacts and Key Links

| Plan | Artifact check | Key-link check | Manual wiring and substance |
|---|---:|---:|---|
| 11-01 | 3/3 | 1/1 | Cached TypeBox validator → marketplace add. |
| 11-02 | 4/4 | 2/2 | Manifest → per-scope info projection → renderer. |
| 11-03 | 4/4 | 1/1 | Typed reason → notify fixture → byte-equal catalog. |
| 11-04 | 4/4 | 3/3 | Root manifest → required cascade input → closure failure composer. |
| 11-05 | 4/4 | 3/3 | Same production path with transitive and installed regression tests. |
| 11-06 | 4/4 | 3/3 | Planner declarers → apply → original-edge authorization → missing-root cascade. |
| 11-07 | 4/4 | 2/2 | Production-composer docs test and reload catalog fixture. |

The `verify.artifacts` and `verify.key-links` queries found no missing/stub artifacts or broken declared links. Manual reads confirmed that each production artifact contains executable logic and that the values reach their consumers, beyond pattern presence.

### Data-Flow Trace (Level 4)

| Value | Source → consumer | Status |
|---|---|---|
| Allowlist for direct install | Scoped marketplace record → cached validated `marketplace.json` → `loadInstallRootAllowlist` → required `rootAllowedMarketplaces` → closure guard | ✓ FLOWING |
| Allowlist for info | Same cached validated manifest → `MarketplaceInfoMessage.allowedMarketplaces` → display-only escaped `allowed_marketplaces:` line | ✓ FLOWING |
| Reload original-edge policies | Eligible installed declarers in verdict → grouped plan → apply operation → each declarer's scoped cached manifest → authorization | ✓ FLOWING |
| Refusal text and reason | Structured closure failure → shared composer → typed failed row → `notify`; reload carries typed reason through apply | ✓ FLOWING |

### Behavioral Spot-Checks

This verifier ran one named test per behavior, not the full suite. Each command exited 0 and reported one passing test: pre-lookup refusal; recorded range merging; direct transitive refusal; reload refusal and retry; malformed manifest; scoped info; second foreign declarer; 230-state catalog; later-source grant; nested B policy; declarer grouping; and project source precedence. Representative commands:

| Behavior | Command | Result |
|---|---|---|
| Direct transitive refusal and fail-clean state | `node --test --test-name-pattern='XMKT-01 direct install refuses a transitive foreign marketplace using the original root policy' tests/orchestrators/plugin/install-flow.test.ts` | 1/1 pass |
| Installed range merging | `node --test --test-name-pattern='XMKT-02 recorded foreign edges retain every range before the installed check' tests/domain/dependency-closure.test.ts` | 1/1 pass |
| Reload denial and correction retry | `node --test --test-name-pattern='XMKT-01 reload refuses an unlisted original declarer before installing the missing root' tests/orchestrators/plugin/install-flow.test.ts` | 1/1 pass |
| Any eligible declarer | `node --test --test-name-pattern='XMKT-01 reload evaluates second foreign policy' tests/orchestrators/reconcile/apply.test.ts` | 1/1 pass |
| Exact public catalog | `node --test --test-name-pattern='catalog contract matches all 20 fixture modules to 230 exact documented states' tests/architecture/catalog-uat/catalog-contract.test.ts` | 1/1 pass |

**Probe execution:** No Phase 11 plan or summary declares a probe script; no `scripts/*/tests/probe-*.sh` exists. The runnable evidence is the named tests and the reported project gates.

### Test Quality Audit

| Linked tests | Active | Disabled | Oracle and assertion quality | Verdict |
|---|---:|---:|---|---|
| Manifest/add/info owner tests | Yes | 0 | Literal malformed field diagnostics and exact parsed/output arrays | ✓ Strong |
| Closure/cascade/install-flow owner tests | Yes | 0 | Literal structured failures, full state/tree comparisons, lookup noncalls, and retry result | ✓ Strong |
| Reconcile plan/apply tests | Yes | 0 | Complete grouped payload and observable state/notification outcomes | ✓ Strong |
| Catalog/documentation agreement tests | Yes | 0 | Independently written expected bytes are compared with real `notify` and production composer | ✓ Strong |

No linked `.skip`, `.todo`, or `.only` test was found. Temporary-file seed writes construct inputs; no expected fixture is generated from the system under test. No circular oracle or insufficient assertion was found.

### Requirements Coverage

| Requirement | Source plans | Status | Evidence |
|---|---|---|---|
| XMKT-01 | 11-01 through 11-07 | ✓ SATISFIED | Validated field, direct/reload root authorization, transitive denial, exact reason/remedies, and fail-clean tests above. |
| XMKT-02 | 11-04 through 11-07 | ✓ SATISFIED | Installed check precedes permission; named recorded-range test and disabled-record cases pass. |

Both IDs are mapped to Phase 11 in `.planning/REQUIREMENTS.md` and occur in PLAN frontmatter; no orphaned Phase 11 requirement exists. The tracker still labels both `Pending`; updating planning status belongs to the orchestrator after verification, and does not contradict the tested implementation.

### Anti-Patterns and Local Gate

No unreferenced `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, or `PLACEHOLDER` marker was found in the phase's changed production or linked test files. `11-REVIEW.md` is clean. The parent checkout's `npx prettier --check .planning/config.json` exits 1 on pre-existing user-owned formatting drift; the isolated Wave 7 `npm run check` passed. The local chained check's nonzero status is reported accurately and is not evidence of a feature failure.

### Human Verification Completed

The following items originated from judgment-tier `must_haves.prohibitions` in `11-03-PLAN.md`, with no wired enforcement descriptor. The user reviewed both wording decisions in `11-UAT.md` and marked each `pass` on 2026-09-23.

1. **Added marketplace is not automatic permission.** The user confirmed that the refusal explains the root marketplace's allowlist decision for a dependency in an added but unlisted marketplace.
2. **Manual installation remains an explicit remedy.** The user confirmed that the refusal names the dependency to install manually first and separately offers the root `marketplace.json` edit.

### Gaps Summary

No observable truth, required artifact, key link, requirement, or human review item failed. No item is deferred to Phase 12; that phase concerns `prune`.

---

_Verified: 2026-09-23T18:54:13Z_
_Verifier: the agent (gsd-verifier)_
