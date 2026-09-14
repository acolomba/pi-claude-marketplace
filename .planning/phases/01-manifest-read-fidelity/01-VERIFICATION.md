---
phase: 01-manifest-read-fidelity
verified: 2026-09-14T15:57:28Z
status: human_needed
score: 4/5 must-haves verified
covered_files:
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/phases/01-manifest-read-fidelity/01-01-PLAN.md
  - .planning/phases/01-manifest-read-fidelity/01-01-SUMMARY.md
  - .planning/phases/01-manifest-read-fidelity/01-02-PLAN.md
  - .planning/phases/01-manifest-read-fidelity/01-02-SUMMARY.md
  - .planning/phases/01-manifest-read-fidelity/01-03-PLAN.md
  - .planning/phases/01-manifest-read-fidelity/01-03-SUMMARY.md
  - .planning/phases/01-manifest-read-fidelity/01-04-PLAN.md
  - .planning/phases/01-manifest-read-fidelity/01-04-SUMMARY.md
  - .planning/phases/01-manifest-read-fidelity/01-CONTEXT.md
  - .planning/phases/01-manifest-read-fidelity/01-REVIEW-FIX.md
  - .planning/phases/01-manifest-read-fidelity/01-REVIEW.md
  - .planning/phases/01-manifest-read-fidelity/01-SECURITY.md
  - .planning/phases/01-manifest-read-fidelity/01-UI-REVIEW.md
  - .planning/phases/01-manifest-read-fidelity/01-VALIDATION.md
  - .planning/phases/01-manifest-read-fidelity/deferred-items.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/commands/discover.ts
  - extensions/pi-claude-marketplace/bridges/skills/discover.ts
  - extensions/pi-claude-marketplace/domain/component-paths.ts
  - extensions/pi-claude-marketplace/domain/dependencies.ts
  - extensions/pi-claude-marketplace/domain/manifest-path.ts
  - extensions/pi-claude-marketplace/domain/manifest.ts
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/declared-component-path-overlap.test.ts
  - tests/architecture/manifest-read-agreement.test.ts
  - tests/architecture/no-orchestrator-network.test.ts
  - tests/bridges/commands/discover.test.ts
  - tests/bridges/skills/discover.test.ts
  - tests/domain/component-paths.test.ts
  - tests/domain/dependencies.test.ts
  - tests/domain/manifest-path.test.ts
  - tests/domain/manifest.test.ts
  - tests/domain/plugin-resolver.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/shared.test.ts
covered_digest: "v1:sha256:52c4cd06f78180c264f707eff8b2f36d98292db08d964e27eceafa8a349708e9"
behavior_unverified: 1
overrides_applied: 0
decision_coverage:
  honored: 37
  total: 37
  not_honored: []
behavior_unverified_items:
  - truth: "Installing the actual ui5 and ui-theme-designer plugins emits no duplicate-skill warning and discovers respectively eight and two skills."
    test: "Install each real marketplace plugin in a disposable Pi scope."
    expected: "ui5 installs eight skills and ui-theme-designer installs two skills, with no duplicate-skill warning."
    why_human: "The behavioral gate recreates both manifest shapes locally. No local cache or automated run observes the current upstream plugins themselves."
human_verification:
  - test: "Install the actual ui5 plugin in a disposable Pi scope and capture its output and installed skills."
    expected: "Eight expected skills are installed and no duplicate-skill warning appears."
    why_human: "The repository test recreates ui5's declared shape but does not retrieve the live marketplace plugin."
  - test: "Install the actual ui-theme-designer plugin in a disposable Pi scope and capture its output and installed skills."
    expected: "Both expected skills are installed and no duplicate-skill warning appears."
    why_human: "The repository test recreates its declared paths but does not retrieve the live marketplace plugin."
---

# Phase 1: Manifest read fidelity Verification Report

**Phase Goal:** Everything a plugin's plugin.json declares reaches the user.
**Verified:** 2026-09-14T15:57:28Z
**Status:** human_needed
**Re-verification:** No. This is the initial verification.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A bare plugin-root plugin.json is honored consistently by every manifest reader. | VERIFIED | MANIFEST_CANDIDATES is consumed by plugin-resolver.ts, shared.ts, and info.ts. The real-filesystem three-reader agreement test passed. |
| 2 | The wrapped manifest takes precedence over a bare sibling, while unusable candidates stop the walk and no-manifest plugins remain installable. | VERIFIED | The resolver, version reader, and info reader implement absence-only iteration. The focused run covers wrapped precedence, malformed JSON, non-file candidates, stat failures, and no-manifest behavior. |
| 3 | The actual ui5 and ui-theme-designer installs discover all skills without duplicate warnings. | PRESENT_BEHAVIOR_UNVERIFIED | The local behavioral gate passes for the exact two declaration shapes, including eight and two skills, and the skills and commands bridges deduplicate physical paths. It is not evidence from the live plugins. |
| 4 | info renders every valid dependency declaration, including object entries and constraints, from the authoritative readable plugin.json with the marketplace entry as a fallback. | VERIFIED | parseDeclaredDependencies preserves valid object and string declarations; buildBlock selects the own manifest before passing values to renderDependencyList; catalog contract and info tests passed. |
| 5 | Invalid dependency declarations are rejected as a whole, while valid missing or empty declarations remain valid. | VERIFIED | D-01-35 is implemented in dependencies.ts, applied by plugin-manifest and marketplace-manifest paths, and rendered as invalid manifest by info without a state write. The targeted dependency, manifest, resolver, and info suites passed. |

**Score:** 4/5 truths verified (1 present, behavior-unverified)

## Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| domain/manifest-path.ts | Ordered immutable shared manifest candidates | VERIFIED | Exists, is substantive, and is imported by all three readers. |
| domain/plugin-resolver.ts and domain/component-paths.ts | Resolver manifest policy and normalized component paths | VERIFIED | These current modules replace the planned resolver.ts; the reader loops candidates and canonicalizes only after containment. |
| domain/dependencies.ts and domain/manifest.ts | Validated dependency parsing and marketplace-boundary rejection | VERIFIED | Parser validates whole declarations; manifest normalization preserves valid siblings while classifying invalid named entries. |
| orchestrators/plugin/info.ts | Authoritative fs-only dependency source and rendered output | VERIFIED | Own manifest is selected only when readable; cold git source uses presence probing, not materialization. |
| bridges/skills/discover.ts and bridges/commands/discover.ts | Physical directory and file deduplication | VERIFIED | seenByDir skips duplicate skill directories; seenByFile skips duplicate command files before generated-name collision handling. |
| tests/architecture/manifest-read-agreement.test.ts | Real-filesystem cross-reader behavioral gate | VERIFIED | All three readers are driven against one planted tree. |
| tests/architecture/declared-component-path-overlap.test.ts | Skill and command overlap gate | VERIFIED | Exercises both named skill shapes and overlapping recursive command roots. |
| docs/output-catalog.md and catalog-contract.test.ts | Catalogued dependency constraint output | VERIFIED | Catalog contract test passed against all documented states. |

The artifact query reported planned domain/resolver.ts links as pending because that module was split into domain/plugin-resolver.ts and domain/component-paths.ts. The live replacements provide the stated behavior and are wired. This is not a missing artifact.

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Manifest readers | domain/manifest-path.ts | MANIFEST_CANDIDATES loop | WIRED | Resolver, version reader, and info reader import the same ordered constant. |
| plugin-resolver.ts | component-paths.ts | collectStrictComponentPaths | WIRED | Normalized componentPaths become bridge inputs after containment validation. |
| component-paths.ts | skills and commands bridges | resolved.componentPaths | WIRED | Both discovery functions consume the resolved path arrays. |
| info.ts | dependencies.ts | renderDependencyList | WIRED | Parsed declarations are marketplace-filled, collapsed, sorted, and rendered. |
| info.ts | git-source-probe.ts | makePresenceProbe | WIRED | The fs-only probe supplies an already-materialized root; no clone occurs in the dependency-read helper. |
| Output catalog | catalog contract | documented fixture state | WIRED | The catalog contract suite passed. |

### Data-Flow Trace

| Artifact | Data variable | Source | Produces real data | Status |
| --- | --- | --- | --- | --- |
| plugin-resolver.ts | manifest | First regular manifest candidate under the real plugin root | Parsed plugin JSON or classified unavailable result | FLOWING |
| info.ts | ownManifest.dependencies | Readable own plugin.json, otherwise marketplace entry | renderDependencyList produces notification dependencies | FLOWING |
| skills bridge | resolved.componentPaths.skills | Resolver's contained, canonical component paths | Real skill directories enumerate once by resolved path | FLOWING |
| commands bridge | resolved.componentPaths.commands | Resolver's contained, canonical component paths | Real command files enumerate once by absolute file path | FLOWING |

### Behavioral Spot-Checks

Ran once from the repository root:

    node --test --test-reporter=spec tests/domain/manifest-path.test.ts tests/domain/dependencies.test.ts tests/domain/plugin-resolver.test.ts tests/domain/component-paths.test.ts tests/domain/manifest.test.ts tests/orchestrators/plugin/shared.test.ts tests/orchestrators/plugin/info.test.ts tests/bridges/skills/discover.test.ts tests/bridges/commands/discover.test.ts tests/architecture/manifest-read-agreement.test.ts tests/architecture/declared-component-path-overlap.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/no-orchestrator-network.test.ts

| Behavior | Result | Status |
| --- | --- | --- |
| Manifest precedence, malformed/non-file handling, and three-reader agreement | 13 file-level tests passed | PASS |
| Dependency parsing, rendering, rejection, bounds, and catalog bytes | 13 file-level tests passed | PASS |
| Skill and command overlap deduplication | 13 file-level tests passed | PASS |
| No-network info dependency read | 13 file-level tests passed | PASS |

The run finished in 5.72 seconds with 13 passes and zero failures, cancellations, skips, or todo tests.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| MANF-01 | 01-01 | Bare manifest is read and honored | SATISFIED | Three-reader planted-tree test and resolver/version tests passed. |
| MANF-02 | 01-01 | Wrapped manifest wins | SATISFIED | Wrapped-sibling and non-file/stat-failure cases passed. |
| MANF-03 | 01-03 plus D-01-34 | No duplicate component discovery | NEEDS HUMAN | Fixture behavior is verified for skills and commands. The roadmap names two live plugins, which remain unobserved. |
| MANF-04 | 01-01 | Malformed bare manifest is unavailable, not skipped | SATISFIED | Resolver and cross-reader tests cover malformed, invalid, and stat-failure paths. |
| MANF-05 | 01-01 | No manifest remains installable | SATISFIED | No-manifest agreement and resolver cases passed. |
| DEPS-01 | 01-02, 01-04 | Object dependencies and constraints render on info | SATISFIED | Parser, info rendering, own-manifest authority, and catalog tests passed. |
| DEPS-02 | 01-02, 01-04 | Mixed valid dependency arrays render completely | SATISFIED | Mixed-array rendering and declaration-wide rejection cases passed. |

### Test Quality Audit

| Test File | Linked Requirement | Active | Skipped | Circular | Assertion Level | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| manifest-read-agreement.test.ts | MANF-01, MANF-02, MANF-04, MANF-05, DEPS-01 | Yes | 0 | No | Behavioral | PASS |
| declared-component-path-overlap.test.ts | MANF-03, D-01-34 | Yes | 0 | No | Behavioral | PASS, fixture evidence only for the two live plugins |
| dependencies.test.ts, manifest.test.ts, info.test.ts | DEPS-01, DEPS-02, D-01-35, D-01-36 | Yes | 0 | No | Value and behavioral | PASS |
| component-paths.test.ts, skills and commands discovery tests | MANF-03, D-01-34 | Yes | 0 | No | Whole-value behavioral | PASS |

Fixture writers supply independent manifest and directory inputs. They do not derive expected output by calling the implementation under test. The corresponding test pairing and recent full check were supplied as current gate evidence; this verification did not repeat the full workspace suite.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| None | — | No untracked TBD, FIXME, XXX, placeholder, empty implementation, or disabled test was found in the Phase 1 implementation and requirement-linked tests. | — | No blocker or warning. |

The TypeScript quick scan found one pre-existing JSON.parse.bind compatibility seam in info.ts:664, introduced before Phase 1 by 697d68124. It is unrelated to the phase's manifest and dependency path and has no adverse finding.

### Decision Coverage

Source-backed decision coverage is 37/37. The automated text-matching query initially reported 33/37 because it did not recognize the renamed resolver modules or the expanded review-fix artifacts. Manual code and behavioral checks resolved all four heuristic misses:

| Decision | Live evidence |
| --- | --- |
| D-01-34 | discoverPluginCommands uses seenByFile; the overlap test installs each source file once. |
| D-01-35 | parseDeclaredDependencies rejects a non-array or any invalid element; callers classify the whole declaration. |
| D-01-36 | Parser bounds are 256 characters for identity tokens, 64 for versions, and 7–40 hexadecimal characters for SHA. |
| D-01-37 | All three readers treat non-files, ENOENT, and ENOTDIR as absent while stopping on other failures; real-filesystem agreement cases passed. |

The only supplemental evidence gap is external, not a decision-coverage gap: the two live marketplace plugins named by MANF-03 have not been observed. That gap is preserved under Human Verification.

### Human Verification Required

### 1. Live ui5 installation

**Test:** Install ui5 from its marketplace in a disposable Pi scope.

**Expected:** Eight expected skills are installed with no duplicate-skill warning.

**Why human:** The local test has the same declaration shape and eight directories, but it cannot prove the current marketplace artifact has that shape.

### 2. Live ui-theme-designer installation

**Test:** Install ui-theme-designer from its marketplace in a disposable Pi scope.

**Expected:** Both expected skills are installed with no duplicate-skill warning.

**Why human:** The local test has its two declared subdirectories, but it cannot prove the current marketplace artifact has them.

### Gaps Summary

No code gap blocks the phase. The status is human_needed because ROADMAP criterion 3 explicitly names two live marketplace plugins and the available evidence only recreates their shapes locally.

---

_Verified: 2026-09-14T15:57:28Z_
_Verifier: the agent (gsd-verifier)_
