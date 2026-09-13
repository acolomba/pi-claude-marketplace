---
phase: 02-containment-and-input-safety
verified: 2026-09-05T23:59:59Z
status: passed
score: 3/3 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 02: Containment and Input Safety Verification Report

**Phase Goal:** Correct confirmed defects in path containment, MCP input, and lifecycle recovery.
**Verified:** 2026-09-05T23:59:59Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Direct owner regressions prove that each terminal manifest- and state-derived path flow preserves its allowed root and rejects traversal, symlink escape, and lenient-read escape. | ✓ VERIFIED | `assertPathInside` rejects raw `..` before normalization or `lstat`, checks normalized containment, then walks every existing child component with `lstat` and refuses symlinks. It remains called by all live consumers. Owner and consumer cases assert exact errors and unchanged outside trees/bytes. Direct coverage: `path-safety.ts` 179/179 lines, 32/32 branches, 10/10 functions. |
| 2 | The terminal malformed-MCP input case returns its typed stable failure without an unexpected throw or configuration write. | ✓ VERIFIED | `RawMcpDoc.mcpServers` is `unknown`; shared `classifyMcpServers` is invoked immediately after each reader's existing top-level policy and before enumeration, collision work, or write. Stage and unstage each test null, string, array, boolean, and number, asserting `MalformedMcpServersError` fields and byte/metadata preservation. Direct coverage: types 100%; stage 431/431 lines, 89/89 branches, 19/19 functions; unstage 106/106 lines, 22/22 branches, 1/1 functions. |
| 3 | Terminal resource-discovery and lifecycle-mutation failures preserve exact partial state, and `/reload` restores a usable plugin without restarting Pi. | ✓ VERIFIED | The registered `resources_discover` callback completes hydrate, reconcile, and PATH work before a narrow `aggregateDiscoveredResources` catch returns only `{ skillPaths: [], promptPaths: [] }`. The named non-concurrent owner case patches only the exact case-owned project skills `readdir`, proves it was reached, asserts exact state/config/PATH preservation, restores and synchronizes the builtin before invoking the same callback successfully, and has `t.after()` restoration. It passed independently. Direct coverage: `index.ts` 166/166 lines, 17/17 branches, 3/3 functions. |

**Score:** 3/3 truths verified (0 present, behavior-unverified)

### Plan Must-Have Detail

| Requirement | Verified plan-specific behavior |
| --- | --- |
| PDEF-02 | Contained absolute paths with redundant dots are accepted; lexical traversal is refused with `LexicalTraversalError`; intermediate and leaf symlinks are refused before I/O; missing future leaves remain valid. Plugin info converts a refusal to its established unavailable/unreadable row, while command staging and persisted location builders preserve outside state. |
| PDEF-03 | Missing `mcpServers` remains a no-op; an object map continues normally; null/string/array/boolean/number share one fail-closed classifier in both bridges. Existing malformed JSON/top-level policies remain distinct. |
| PDEF-04 | The lower-level aggregator remains fail-loud; only the root callback contains its aggregate failure. No persistent failure flag exists. Warning notification handling is per skipped scope, and the owner test proves every attempt still occurs when every notification throws. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- |
| `extensions/pi-claude-marketplace/bridges/mcp/types.ts` | Truthful raw MCP boundary type | ✓ VERIFIED | `mcpServers?: unknown`; paired type-only owner test and direct coverage pass. |
| `extensions/pi-claude-marketplace/bridges/mcp/stage.ts` | Shared classifier and typed fail-closed staging path | ✓ VERIFIED | Classifier is substantive, throws the stable typed error, and is reached before partition/collision/next-document construction. |
| `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts` | Identical malformed-field policy for removal | ✓ VERIFIED | Imports and calls the shared classifier before `Object.entries` or `atomicWriteJson`. |
| `extensions/pi-claude-marketplace/shared/path-safety.ts` | Normalized lexical and filesystem containment policy | ✓ VERIFIED | Raw lexical gate, normalized containment check, and component-by-component `lstat` walk are substantive and exercised. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`, `bridges/commands/stage.ts`, `persistence/locations.ts` | Live consumers of the shared containment policy | ✓ VERIFIED | Call graph identifies 42 live `assertPathInside` callers; affected consumer suites prove their distinct outcomes rather than duplicating the policy. |
| `extensions/pi-claude-marketplace/index.ts` | Narrow discovery-failure containment boundary | ✓ VERIFIED | The `resources_discover` callback is registered and returns the aggregate result or exact empty fallback per invocation. |
| `tests/index.test.ts` | Aggregate-failure partial state and recovery proof | ✓ VERIFIED | Exact-path, explicitly non-concurrent filesystem replacement is reached, restored before recovery and in cleanup; it does not introduce a production seam. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `RawMcpDoc` | `classifyMcpServers` | Stage and unstage after their readers | ✓ WIRED | Both production paths call the same exported classifier; no malformed field reaches enumeration or write. |
| `prepareStageMcpServers` | staging commit | Prepared staging result | ✓ WIRED | Refusal occurs before partition, collision detection, and `_nextDoc`; the commit path is unreachable on malformed input. |
| live path consumers | `assertPathInside` | Awaited containment gate before I/O | ✓ WIRED | CodeGraph found 42 callers; relevant plugin-info, command-stage, and locations flows retain the gate. |
| `resources_discover` callback | `aggregateDiscoveredResources` | narrow awaited `try`/`catch` after hydrate/reconcile/PATH work | ✓ WIRED | Only aggregation/result projection is contained; underlying `aggregateDiscoveredResources` still rejects in its owner test. |
| skipped-scope loop | host notifier | individual inner `try`/`catch` | ✓ WIRED | A throw records debug context and the loop continues to later scopes. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `stage.ts` / `unstage.ts` | `doc.mcpServers` | Parsed scoped `mcp.json` | Accepted object map only; malformed values fail closed | ✓ FLOWING |
| `path-safety.ts` consumers | target paths | Manifest/state-derived paths and location builders | Checked path reaches real read/write/returned-path consumers only after containment | ✓ FLOWING |
| `index.ts` | discovered skill/prompt paths | `aggregateDiscoveredResources` over user/project locations | Real aggregate output is projected on success; exact empty fallback only on aggregate failure | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| All Phase 2 owner and affected-consumer regressions | `node --test` over the 9 Phase 2 source-owner/consumer test files | 9 files passed; 0 failed, skipped, or todo; 5.26 s | ✓ PASS |
| Aggregate discovery failure preserves state and same-callback recovery works | `node --test --test-name-pattern='contains one aggregate discovery failure and recovers through the same callback' tests/index.test.ts` | 1 passed; 0 failed/skipped/todo; 2.92 s | ✓ PASS |
| TypeScript and modified-file linting | `npm run typecheck`; targeted `npx eslint ... --max-warnings=0` | Both passed | ✓ PASS |
| Modified-file formatting | targeted `npx prettier --check ...` | All 13 files formatted | ✓ PASS |
| Direct owner coverage | `npm run test:coverage:direct -- <each of five changed owners>` | All five passed at 100% direct line/branch/function coverage | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- |
| PDEF-02 | 02-02 | Root-preserving terminal path flows reject traversal, symlink escape, and lenient-read escape. | ✓ SATISFIED | Shared policy plus owner, plugin-info, command-stage, and locations tests; direct owner coverage is complete. |
| PDEF-03 | 02-01 | Malformed MCP input has a stable typed failure and cannot write configuration. | ✓ SATISFIED | Shared classifier and stage/unstage matrices assert exact error and unchanged bytes. |
| PDEF-04 | 02-03 | Discovery/lifecycle failure preserves partial state and recovers through reload. | ✓ SATISFIED | Root-only catch, independent warning loop, fail-loud aggregator owner test, and named first-failure/second-success callback test. |

No Phase 2 requirements are orphaned from the plans.

### Prohibition and Anti-Pattern Audit

| Check | Result | Evidence |
| --- | --- | --- |
| Malformed MCP handling must not mutate configuration or masquerade as success | ✓ VERIFIED | Both bridges reject all five malformed value kinds with exact typed errors and unchanged bytes/metadata. |
| Containment must not reject contained absolute paths or access outside the root | ✓ VERIFIED | Accepted absolute-child test and traversal/symlink/consumer non-mutation tests pass. |
| Discovery containment must not replay/rollback state, return partial data, poison reload, or suppress warnings | ✓ VERIFIED | Named recovery case asserts state/config/PATH stability and same-callback success; warning case asserts all attempts. |
| Tests must not use developer state, live network, test-only exports, dead branches, or uncontained globals | ✓ VERIFIED | Tests use case-owned temp roots, fail-fast network boundary, contextual mocks, exact-path `readdir` replacement, non-concurrent global mutation, restoration before retry, and `t.after()` cleanup. No test-only production export or phase-introduced dead branch found. |
| Debt markers / disabled requirement tests / circular expected values | ✓ VERIFIED | No `TBD`/`FIXME`/`XXX`, disabled/only/todo test, coverage-ignore, or circular fixture-generation pattern in the Phase 2 scope. The two `placeholder` hits are a documented internal extension-context bridge setup and an unrelated fixture path, not rendered/stub behavior. |

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `tests/bridges/mcp/stage.test.ts` / `unstage.test.ts` | PDEF-03 | Yes | 0 | No | Value + behavioral (exact structured errors and byte/metadata state) | ✓ PASS |
| `tests/shared/path-safety.test.ts` and consumer owners | PDEF-02 | Yes | 0 | No | Value + behavioral (ordered filesystem gates and unchanged outside state) | ✓ PASS |
| `tests/index.test.ts` / `orchestrators/discover.test.ts` | PDEF-04 | Yes | 0 | No | Behavioral (first failure, exact partial state, restoration, second success) | ✓ PASS |

**Disabled tests on requirements:** 0
**Circular patterns detected:** 0
**Insufficient assertions:** 0

### Decision Coverage

The automated decision-coverage query reported no trackable machine-readable decisions in `02-CONTEXT.md`. Manual verification found the shipped behavior honors the applicable decisions: one shared MCP classifier, a single shared containment chokepoint, raw traversal before filesystem work, and root-only discovery containment with same-callback recovery.

### Human Verification Required

N/A — this is an infrastructure/foundation safety phase with no user-facing acceptance criterion left without automated behavioral evidence.

### Gaps Summary

No gaps found. The observable roadmap contract, every plan-specific safety behavior, all artifact/wiring/data-flow checks, and each stated prohibition are supported by live source inspection and passing targeted behavioral evidence.

---

_Verified: 2026-09-05T23:59:59Z_
_Verifier: the agent (gsd-verifier)_
