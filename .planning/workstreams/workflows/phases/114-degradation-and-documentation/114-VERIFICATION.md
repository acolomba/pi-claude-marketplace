---
phase: 114-degradation-and-documentation
verified: 2026-09-08T08:45:00Z
status: passed
score: 7/7 must-haves verified
covered_files:
  - ".planning/workstreams/workflows/milestones/workflows-REQUIREMENTS.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-01-PLAN.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-01-SUMMARY.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-02-PLAN.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-02-SUMMARY.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-03-PLAN.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-03-SUMMARY.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-04-PLAN.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-04-SUMMARY.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-05-PLAN.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-05-SUMMARY.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-CONTEXT.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-REVIEW-FIX.md"
  - ".planning/workstreams/workflows/phases/114-degradation-and-documentation/114-REVIEW.md"
  - "README.es.md"
  - "README.md"
  - "docs/messaging-style-guide.md"
  - "docs/output-catalog.md"
  - "docs/workflows-compatibility.md"
  - "extensions/pi-claude-marketplace/domain/resolver.ts"
  - "extensions/pi-claude-marketplace/orchestrators/import/execute.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/list.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts"
  - "extensions/pi-claude-marketplace/orchestrators/types.ts"
  - "extensions/pi-claude-marketplace/platform/pi-api.ts"
  - "extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts"
  - "extensions/pi-claude-marketplace/shared/notify-reasons.ts"
  - "extensions/pi-claude-marketplace/shared/notify.ts"
  - "tests/architecture/catalog-uat.test.ts"
  - "tests/architecture/no-probe-in-workflows-bridge.test.ts"
  - "tests/architecture/source-scan.ts"
  - "tests/architecture/workflows-marker-coverage.test.ts"
  - "tests/domain/resolver.test.ts"
  - "tests/orchestrators/plugin/install.test.ts"
covered_digest: "v1:sha256:ed32eb2d470cfec0cdfa170c17b3b257fd92fa943cff03613331d698f2c664d1"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 114: Degradation and documentation Verification Report

**Phase Goal:** The host engine becomes the third soft dependency, and the
contract of the one bridge that installs executable code is written down.
**Verified:** 2026-09-08T08:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP success criterion) | Status | Evidence |
|---|---|---|---|
| 1 | `Dependency` carries a third member and every surface that can render a soft-dependency marker renders `requires pi-dynamic-workflows`, per the CONTEXT-authorized wording caveat (union member, not tuple; byte-order guarantee delivered via two catalog states, not an order-and-length lock) | ✓ VERIFIED | `shared/concerns/soft-dep.ts` declares `type Dependency = "agents" \| "mcp" \| "workflows"` with header explicitly stating "nothing iterates the members at runtime, so the union type alone is the sole declaration site" (matches D-114-01/02 of CONTEXT). All 7 `Dependency[]` derivation sites (`install.ts`, `list.ts`, `shared.ts`, `reinstall.messaging.ts`, `update-row.ts`, `import/execute.ts`, `reconcile/apply-outcomes.ts`) independently grepped and confirmed to push `"workflows"` last. `docs/output-catalog.md` pins two byte-exact rendered states (`success-with-workflow-engine-absent`, `success-with-agents-and-workflows-soft-dep`) showing marker order `agents, mcp, workflows`. `REASONS` array confirmed 45 members with `"requires pi-dynamic-workflows"` last, pinned by `notify-closed-set-locks.test.ts` (`REASONS.length === 45`). |
| 2 | The envelopes are written whether or not the engine is loaded, and two installs differing only in the session's tool list write the same bytes | ✓ VERIFIED | `tests/orchestrators/plugin/install.test.ts:9793` (`WDEP-02 / WDEP-03: the envelope bytes do not depend on whether the host engine is loaded`) pins an independently-hand-written envelope literal FIRST (`assert.equal(withoutEngine.envelopeBytes, workflowEnvelopeBytes)`), then compares the two runs' raw bytes with `assert.equal` (no `JSON.parse`), plus inventory equality and marker-presence assertions in BOTH directions. Read verbatim; confirmed non-vacuous — "no bytes at all, twice" would fail the literal-pin assertion before the pairwise comparison runs. `tests/architecture/no-probe-in-workflows-bridge.test.ts` (post-review-fix) structurally forbids the probe surface (`softDepStatus`, `SoftDepStatus`, `hasLoadedWorkflowEngine`, `workflowEngineLoaded`, plus the WR-03 capability patterns `getAllTools`, `ExtensionAPI`) from all 5 files in `bridges/workflows/`, with the roster derived from `readdir` rather than hardcoded (closes the WR-03 addition hole). Test ran green as part of the `npm run check` I executed myself (exit 0). |
| 3 | A gate, not a grep, proves the marker coverage: reverting any one `Dependency[]` derivation turns exactly one case red | ✓ VERIFIED | `tests/architecture/workflows-marker-coverage.test.ts` holds 7 `SITE_CASES` records driving each site through its public surface (2 direct exported functions, 2 exported row composers, 3 full-orchestrator drives with a plugin carrying a NAMED `meta` export so a stub can't pass vacuously), asserted via one `assert.deepEqual` over a projection — reverting one arm turns exactly one row red (verified in SUMMARY's negative-control transcript for all 7, not just the required 1). Independently confirmed the forcing construct: a second test scans `orchestrators/` for the `DERIVATION_SHAPE` regex and asserts set equality against `SITE_CASES` in both directions. I independently re-grepped `orchestrators/` for the same shape and got exactly the same 7 files the case list names — no eighth site exists on this tree. I also ran the regex against a real non-derivation type annotation (`readonly dependencies: readonly Dependency[];` in `apply-outcomes.ts`) and confirmed it does NOT match (verifying the anchoring claim that a pure type annotation cannot false-red the gate), while confirming it DOES match both real derivation shapes present in the tree. This is the exact WR-04 hole the code review found and the fix (`9f255745`) closed — I verified the closed state, not the pre-fix state. |
| 4 | `docs/workflows-compatibility.md` states which engine runs third-party JavaScript, how it is sandboxed, which script shapes install and then refuse to run, and which claims were measured versus read. Engine claims cite 3.10.1 and Spike 027 | ✓ VERIFIED | Read the full 244-line document. States the engine by name (`@quintinshaw/pi-dynamic-workflows`) and why it was chosen over the rejected `@nicknisi/pi-workflows`; quotes the engine's own "vm is not a security sandbox" caveat verbatim; tabulates 8 admit-versus-run divergence rows plus a 9-check refusal classification table (nine checks, six `validateMeta` messages — matches the corrected D-114-03 figures, not the stale "seven gates" figure inherited from the archived requirement); every claim carries an explicit evidence-grade tag (`source-read at 3.10.1`, `runtime-measured at 3.10.1`, `measured at 3.5.1`, `read from the 2.1.251 binary`, `documented upstream`); cites 3.10.1 throughout and Spike 027 by name multiple times, including for the sandbox `process.env` measurement and the `agent()` failure-semantics section. Both the WR-01 (0.x → correct "past 1.0, 57 versions across 3 majors" wording) and WR-05 (severity-raise qualification: 3 of 7 surfaces raise `warning`, stated explicitly) review fixes confirmed landed in the current text. |
| 5 | The engine's own peer floor (`pi-coding-agent >=0.80.8`) is documented as distinct from this project's (`>=0.80.5`) | ✓ VERIFIED | `docs/workflows-compatibility.md` "Host engine requirements" section states both floors as two bullet points naming two different packages: `pi-claude-marketplace peers on @earendil-works/pi-coding-agent >=0.80.5. This project has not raised its own floor...` / `@quintinshaw/pi-dynamic-workflows 3.10.1 peers on @earendil-works/pi-coding-agent >=0.80.8...`. Cross-checked `package.json`: `peerDependencies["@earendil-works/pi-coding-agent"] === ">=0.80.5"`, confirming the doc's claim about this project's own floor is accurate and unchanged (D-114-07: no `package.json` edit in this phase). |
| 6 | The path-bearing premise is confirmed against Claude Code's own documentation, or the behavior resting on it is changed | ✓ VERIFIED | `tests/domain/resolver.test.ts:1795-1811` (the `WINV-01 strict: a non-string workflows declaration resolves unavailable` test) carries a header comment stating the confirmed citation: Claude Code 2.1.251's manifest schema declares `workflows` as `string \| array`, described identically to `themes`/`outputStyles`, corroborated by the published plugins reference. No "premise has lineage but no upstream citation" language remains (grepped, no match). `docs/workflows-compatibility.md` line 46 carries the same citation with explicit HIGH/MEDIUM grading (binary read HIGH, published page MEDIUM). Behavior did NOT change — `SUPPORTED_COMPONENT_PATH_KINDS` still includes `workflows`, matching D-114-01's disposition (confirmed, not falsified). |
| 7 | `npm run check` is green | ✓ VERIFIED | Ran `npm run check` myself in the main checkout (not trusting the 4 independent SUMMARY/REVIEW-FIX claims). Completed with exit code 0. Final stages: `npm test` → 5564 tests, 313 suites, 0 failures; `npm run test:integration` → 34 tests, 0 failures. Full chain (`typecheck && lint && fallow && format:check && test:corresponding && test:corresponding:negative && test:coverage:direct:negative && test && test:integration`) ran to completion with no early exit. |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `platform/pi-api.ts::hasLoadedWorkflowEngine` | Probes `workflow_control` exactly, catch → false | ✓ VERIFIED | Read verbatim: `pi.getAllTools().some((tool) => tool.name === "workflow_control")`, `catch { return false; }`. No case folding, no substring, no `sourceInfo` fallback. |
| `shared/concerns/soft-dep.ts::Dependency` | 3-member literal union, no runtime tuple | ✓ VERIFIED | `type Dependency = "agents" \| "mcp" \| "workflows"`, module header explains why no tuple. `softDepMarkers` takes a required 3rd positional boolean, appends the marker last. |
| `shared/notify.ts::REASONS` | 45 members, new token last | ✓ VERIFIED | Pinned by `notify-closed-set-locks.test.ts` (`REASONS.length === 45`) and `compat-01-no-expansion.test.ts`. |
| `tests/architecture/workflows-marker-coverage.test.ts` | Coverage gate over 7 derivation sites, bound to tree | ✓ VERIFIED | Both the site-driving test and the WR-04 forcing-construct test present; independently re-derived the 7-site set via grep and confirmed it matches. |
| `tests/architecture/no-probe-in-workflows-bridge.test.ts` | Bridge files carry zero probe surface | ✓ VERIFIED | Post-fix version scans all `.ts` files in `bridges/workflows/` via `readdir` (not hardcoded), 6 forbidden patterns including WR-03's `getAllTools`/`ExtensionAPI` additions. |
| `docs/workflows-compatibility.md` | New 200+ line executable-code contract | ✓ VERIFIED | 244 lines, all required sections present (manifest/discovery, admit-vs-run divergence, refusal classification, script semantics, sandbox, `agent()` semantics, naming, host engine requirements, when absent, upstream stability, install-time disposition). |
| `README.md` / `README.es.md` | Workflows in Features, host engine in Prerequisites, tagline updated, doc linked | ✓ VERIFIED | All three additions present on identical line numbers in both files. Tagline fix (WR-02) confirmed landed: "...hooks, MCP servers and workflows." / "...hooks, servidores MCP y workflows de Claude." |
| `tests/domain/resolver.test.ts` | Upstream citation replaces open-premise paragraph | ✓ VERIFIED | Citation present, byte-identical assertions (comment-only diff per SUMMARY, confirmed by reading current state). |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `platform/pi-api.ts::hasLoadedWorkflowEngine` | `shared/notify.ts` row rendering | `softDepStatus` → `softDepMarkers` → `composeReasons` → `notify()` | ✓ WIRED | Full chain confirmed by reading each hop; `install.ts:1854` is the sole legitimate probe consumer among orchestrators, exempted by name in the no-probe gate's own header comment. |
| 7 `Dependency[]` derivation sites | Rendered plugin row | `orchestrators/*` → `shared/notify.ts::notify()` | ✓ WIRED | `workflows-marker-coverage.test.ts` drives all 7 through their public surfaces and asserts on rendered bytes, not intermediate arrays (D-114-05). |
| `bridges/workflows/stage.ts` | Envelope write | `prepareStageWorkflows` (no `pi` parameter) | ✓ WIRED (and structurally isolated from the probe) | `StageWorkflowsInput` carries no `pi`; `no-probe-in-workflows-bridge.test.ts` proves the isolation by scan, byte-equality pair proves it behaviorally. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| DERIVATION_SHAPE regex correctly distinguishes derivations from type annotations | `node -e` regex test against 3 real lines from the tree | Function return type: matches (true). Accumulator: matches (true). Pure type annotation: does not match (false) | ✓ PASS |
| 7-site enumeration matches SITE_CASES | `grep -rnE` for both derivation shapes across `orchestrators/` | Exactly 7 files: `update-row.ts`, `import/execute.ts`, `install.ts`, `reinstall.messaging.ts`, `list.ts`, `shared.ts`, `apply-outcomes.ts` | ✓ PASS |
| `companionSeverity` production call sites | `grep -rn "companionSeverity("` | Exactly 3: `install.ts:1854`, `update.ts:2844`, `enable-disable.ts:1273` — matches WR-05 fix's stated claim | ✓ PASS |
| `requires pi-workflows` (unscoped, wrong package) does not appear anywhere reachable | `grep -rn` across `docs/`, `tests/`, `extensions/`, both READMEs | No match | ✓ PASS |
| `npm run check` | full chain | exit 0, 5564+34 tests pass | ✓ PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| WDEP-01 | Probe via `workflow_control`, not bare `workflow` | ✓ SATISFIED | `hasLoadedWorkflowEngine` verified above. |
| WDEP-02 | Workflow artifacts written with engine absent, install still succeeds, degradation reason carried | ✓ SATISFIED | Byte-equality test truth #2. |
| WDEP-03 | Install-engine-and-reload recovers with no reinstall | ✓ SATISFIED (mechanical proof) | Bridge-probe isolation gate + byte-equality pair prove the mechanism; the live end-to-end claim itself rests on Spike 027 (pre-existing evidence base, explicitly out of scope for a new canary per D-114-08) and is stated at that grade in the doc, not overclaimed. |
| WDEP-04 | `workflows` becomes 3rd `Dependency` member with marker, new REASONS token | ✓ SATISFIED | Truth #1. Note: delivered as a union member per D-114-01/02, not a re-introduced tuple — this is the CONTEXT-authorized reading of the requirement text, not a deviation. |
| WDOC-01 | Docs state executable-code framing, engine name/trust grounds, guaranteed-vs-divergent semantics, evidence grading | ✓ SATISFIED | Truth #4. Uses corrected 3.10.1 figures (9 checks / 6 messages), not the stale "seven gates" figure the archived requirement text itself carries — correct per D-114-03. |
| WDOC-02 | `docs/output-catalog.md` carries new token and rendered states under the byte gate | ✓ SATISFIED | Two states confirmed present and byte-pinned. |
| WDOC-03 | `acorn` declared as a runtime dependency | ✓ SATISFIED | Verified `package.json` declares `acorn ^8.16.0` in `dependencies`; per D-114-07 this phase only verifies, does not change it. |

All 7 requirement IDs (WDEP-01..04, WDOC-01..03) traced to `.planning/workstreams/workflows/milestones/workflows-REQUIREMENTS.md` lines ~133-149 (archived file, per this milestone's re-land structure) and cross-checked `[x]` complete in that source. No orphaned requirements found for this phase.

### Anti-Patterns Found

None blocking. Debt-marker scan (`TBD`/`FIXME`/`XXX`) on the phase's changed files: none found. One legitimately-open, explicitly-referenced debt item exists (Broken Windows #34, `docs/workflows-compatibility.md:23`, `unmet-truth`, `status: open`) — this records that the doc's ~15 engine source line-number citations are pinned to 3.10.1 and unguarded against a future engine upgrade (WR-06 finding). The review-fix explicitly chose to keep the citations (with a stated staleness contract) over dropping them, and filed the ledger entry naming `WPIN-01` as the subject of the eventual re-read. This is documented, intentional, future-tracked debt — not a phase-114 gap. Broken Windows #32 (marker gap on enable/update rows) and #33 (README taglines) are both `status: fixed`, confirmed by reading the current source.

Three code-review Info findings (IN-01, IN-02, IN-04) were deliberately left unfixed with recorded rationale in `114-REVIEW-FIX.md` — all pre-existing or genuinely out-of-scope-and-non-free per the review-fix's own analysis, none blocking the phase goal.

## Gaps Summary

None. All 7 ROADMAP success criteria verified directly against the codebase (not inferred from SUMMARY claims): the union-based `Dependency` reading was cross-checked against `114-CONTEXT.md`'s explicit D-114-01/02 authorization before being accepted, all 7 marker-coverage derivation sites were independently re-enumerated by grep and matched the gate's case list exactly, the byte-equality and no-probe gates were read post-review-fix (not the pre-fix state the SUMMARY narrates), the compatibility doc was read in full and its evidence-grade discipline confirmed, both peer floors were cross-checked against `package.json`, the resolver citation was read directly, and `npm run check` was executed by the verifier (not merely cited) and returned exit 0 with 5598 total tests passing (5564 unit + 34 integration).

The code review (6 warnings, 4 info) and its fix report were both read; all 6 warnings were independently spot-checked in the current source and confirmed fixed, not merely claimed fixed.

---

_Verified: 2026-09-08T08:45:00Z_
_Verifier: Claude (gsd-verifier)_
