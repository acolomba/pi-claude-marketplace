---
phase: 114-degradation-and-documentation
verified: 2026-09-09T21:00:00Z
status: passed
score: 7/7 must-haves verified
covered_files:
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
  - "tests/architecture/workflows-doc-pins.test.ts"
  - "tests/architecture/workflows-marker-coverage.test.ts"
  - "tests/domain/resolver.test.ts"
  - "tests/orchestrators/plugin/install.test.ts"
covered_digest: "v1:sha256:d9394440ee18b3e4efc0233c194241b1b8b3ae7f28dd7c5d696d475c8c6caa67"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 7/7
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 114: Degradation and documentation Verification Report

**Phase Goal:** The host engine becomes the third soft dependency, and the
contract of the one bridge that installs executable code is written down.
**Verified:** 2026-09-09T21:00:00Z
**Status:** passed
**Re-verification:** Yes — the 2026-09-08 report covered a tree that ten
files have since moved under: `docs/output-catalog.md`,
`docs/workflows-compatibility.md`,
`extensions/pi-claude-marketplace/orchestrators/plugin/{install,shared,reinstall}.ts`,
`extensions/pi-claude-marketplace/orchestrators/reconcile/{apply-outcomes,notify}.ts`,
`extensions/pi-claude-marketplace/shared/{notify,notify-reasons}.ts`,
`tests/architecture/catalog-uat.test.ts`, and
`tests/orchestrators/plugin/install.test.ts`, all touched by Phases 115, 116
and 117. This report re-derives every Phase 114 conclusion directly against
HEAD (commit `f0581b7`) rather than reusing the prior report's readings. It
does not re-grade Phases 115/116/117's own work — only whether their changes
left Phase 114's goal standing. `reinstall.ts` itself carries no `Dependency[]`
derivation (the derivation site is `reinstall.messaging.ts`, confirmed by the
tree-bound coverage gate below), so its inclusion in the changed-file list
does not add a new must-have to check.

## What changed underneath Phase 114, and what was re-established

1. **`shared/notify.ts` / `shared/notify-reasons.ts`** — Phase 116 appended an
   unrelated 46th `REASONS` member (`"components now supported"`,
   WCONV-03) *after* `"requires pi-dynamic-workflows"` (the 45th, Phase 114's
   own addition). Re-read the array at HEAD: `requires pi-dynamic-workflows`
   still sits immediately after `stale workflow command`, at the same index
   it held at Phase 114 close; the new member is appended, not inserted.
   `tests/architecture/notify-closed-set-locks.test.ts`'s
   `REASONS.length === 46` assertion (updated by Phase 116) now pins the new
   count and passed when run directly. Phase 114's WDEP-04 ordering claim
   ("no existing member's index moves") still holds.
2. **`docs/output-catalog.md` / `tests/architecture/catalog-uat.test.ts`** —
   Phases 115 and 116 raised the pinned example count from 195 to 197. Both
   of Phase 114's own catalog states
   (`success-with-workflow-engine-absent`,
   `success-with-agents-and-workflows-soft-dep`) are still present, still
   byte-pinned, and the full `catalog-uat` suite (6 tests, including the
   197-example lock and the inverse fixture walk) passed when run directly.
3. **`docs/workflows-compatibility.md`** — Phase 115 touched the
   admit-versus-run gate table; Phase 117 rewrote the `agent()`
   failure-semantics section, replacing a source-read-only claim ("every
   failure branch throws") with a runtime-measured recoverable/non-recoverable
   split, and states in its own prose that this supersedes what the document
   "previously said." That correction does not touch anything Phase 114
   established (the nine-check/six-warning admit-versus-run figures, the two
   host-engine peer floors, the upstream-stability version count, the
   severity-raise-on-three-surfaces rule) — all re-read at HEAD and unchanged
   from what the prior report recorded. `tests/architecture/workflows-doc-pins.test.ts`
   (not present at Phase 114 close; a later hardening addition) independently
   gates the doc's WDOC-01 figures against the source counts and against the
   retired "seven gates" wording, and passed when run directly.
4. **`orchestrators/plugin/{install,shared}.ts`,
   `orchestrators/reconcile/{apply-outcomes,notify}.ts`,
   `orchestrators/plugin/reinstall.messaging.ts`,
   `tests/orchestrators/plugin/install.test.ts`** — all five of the
   `Dependency[]` derivation sites among the ten changed files
   (`install.ts`, `shared.ts`, `apply-outcomes.ts`, plus the untouched
   `list.ts`, `update-row.ts`, `import/execute.ts`,
   `reinstall.messaging.ts`) are covered by
   `tests/architecture/workflows-marker-coverage.test.ts`'s tree-bound
   coverage gate (a regex scan of `orchestrators/` re-derives the 7-site set
   and asserts it equals the hardcoded case list, in both directions) — run
   directly at HEAD, both of its tests passed, confirming no 8th untracked
   derivation exists and none of the 7 lost its marker. The byte-equality
   test in `tests/orchestrators/plugin/install.test.ts`
   ("WDEP-02 / WDEP-03: the envelope bytes do not depend on whether the host
   engine is loaded") and `tests/architecture/no-probe-in-workflows-bridge.test.ts`
   were both run directly at HEAD and passed unchanged.

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP success criterion) | Status | Evidence |
|---|---|---|---|
| 1 | `Dependency` carries a third member and every surface that can render a soft-dependency marker renders `requires pi-dynamic-workflows` | ✓ VERIFIED | `shared/concerns/soft-dep.ts:30` at HEAD: `type Dependency = "agents" \| "mcp" \| "workflows"` — still exactly 3 members. `shared/notify.ts` `REASONS` array read in full (lines 93-278 at HEAD): 46 members (up from 45, Phase 116 addition), `"requires pi-dynamic-workflows"` still present at its original relative position, immediately after `"stale workflow command"`. `docs/output-catalog.md`'s two Phase 114 catalog states re-read and still byte-pinned. |
| 2 | The envelopes are written whether or not the engine is loaded, and two installs differing only in the session's tool list write the same bytes | ✓ VERIFIED | `tests/orchestrators/plugin/install.test.ts` "WDEP-02 / WDEP-03: the envelope bytes do not depend on whether the host engine is loaded" run directly at HEAD: 1 test, 1 pass. |
| 3 | A gate, not a grep, proves the marker coverage: reverting any one `Dependency[]` derivation turns exactly one case red | ✓ VERIFIED | `tests/architecture/workflows-marker-coverage.test.ts` run directly at HEAD: both tests pass — the 7-case coverage assertion and the tree-bound `DERIVATION_SHAPE` re-enumeration confirming the case list still equals the discovered site set on the current tree (which now includes the post-Phase-115/116/117 versions of `install.ts`, `shared.ts`, and `apply-outcomes.ts`). |
| 4 | `docs/workflows-compatibility.md` states which engine runs third-party JavaScript, how it is sandboxed, which script shapes install and then refuse to run, and which claims were measured versus read. Engine claims cite 3.10.1 and Spike 027 | ✓ VERIFIED | Doc re-read in full at HEAD (258 lines, up from 244 — Phase 117 grew the `agent()` section). Still states the engine by name, still quotes the "vm is not a security sandbox" caveat verbatim, still tabulates "nine distinct checks" / "Six of those seven" warned, still carries per-claim evidence grades, still cites 3.10.1 and Spike 027 throughout. `tests/architecture/workflows-doc-pins.test.ts::"WDOC-01: the refusal-check counts agree with the enumerations beneath them"` and `::"the compatibility doc states this project's peer floor as package.json declares it"` both run directly and passed, mechanically re-proving these two figures against the source at HEAD rather than trusting a re-read. |
| 5 | The engine's own peer floor (`pi-coding-agent >=0.80.8`) is documented as distinct from this project's (`>=0.80.5`) | ✓ VERIFIED | Doc's "Host engine requirements" section (line 181-188) unchanged in substance; cross-checked `package.json` at HEAD: `peerDependencies["@earendil-works/pi-coding-agent"] === ">=0.80.5"`. `workflows-doc-pins.test.ts` mechanically asserts this pairing and passed. |
| 6 | The path-bearing premise is confirmed against Claude Code's own documentation, or the behavior resting on it is changed | ✓ VERIFIED | `tests/domain/resolver.test.ts` untouched by the ten-file diff; re-read the cited test and the doc's matching citation (line 46) — both still present, unchanged. `SUPPORTED_COMPONENT_PATH_KINDS` still includes `workflows` (behavior unchanged, matching the confirmed premise). |
| 7 | `npm run check` is green | ✓ VERIFIED (by measurement, not re-run) | Per this re-verification's constraints, `npm run check` was not re-run — it completed at exit 0 during Phase 117's fix pass (5654 unit / 35 integration). Confirmed by measurement that no source has moved since: `git status --short` at HEAD shows a clean tree (only pre-existing operator-owned files: `.claude/settings.json`, `.codex/config.toml`, and untracked non-source paths), and `git log -1` shows HEAD is `f0581b7`, the Phase 117 close commit, with no intervening commits. Additionally ran the specific targeted suites this re-verification depends on directly (`workflows-marker-coverage.test.ts`, `catalog-uat.test.ts`, `no-probe-in-workflows-bridge.test.ts`, `notify-closed-set-locks.test.ts`, `compat-01-no-expansion.test.ts`, `workflows-doc-pins.test.ts`, and the byte-equality test in `install.test.ts`) — all green, 0 failures. |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `platform/pi-api.ts::hasLoadedWorkflowEngine` | Probes `workflow_control` exactly, catch → false | ✓ VERIFIED | Untouched by the ten-file diff; unchanged from the prior report's reading. |
| `shared/concerns/soft-dep.ts::Dependency` | 3-member literal union, no runtime tuple | ✓ VERIFIED | Re-read at HEAD, unchanged: `type Dependency = "agents" \| "mcp" \| "workflows"`. |
| `shared/notify.ts::REASONS` | Closed set, `requires pi-dynamic-workflows` present and correctly ordered | ✓ VERIFIED | Now 46 members (Phase 116 added `"components now supported"` after it); Phase 114's member and its relative position unchanged. Pinned by `notify-closed-set-locks.test.ts` (`REASONS.length === 46`), run directly, passed. |
| `tests/architecture/workflows-marker-coverage.test.ts` | Coverage gate over 7 derivation sites, bound to tree | ✓ VERIFIED | Run directly at HEAD against the post-Phase-115/116/117 versions of the three touched derivation sites; both tests pass; tree-bound re-enumeration confirms no 8th site exists. |
| `tests/architecture/no-probe-in-workflows-bridge.test.ts` | Bridge files carry zero probe surface | ✓ VERIFIED | Run directly at HEAD, 1 test, passed. |
| `docs/workflows-compatibility.md` | Executable-code contract, evidence-graded | ✓ VERIFIED | Re-read in full at HEAD (258 lines); Phase 114's sections all present and internally consistent with Phase 117's `agent()` rewrite (the rewrite states its own supersession explicitly, in keeping with the evidence-grading discipline Phase 114 established, rather than silently contradicting it). |
| `README.md` / `README.es.md` | Workflows in Features, host engine in Prerequisites, tagline updated, doc linked | ✓ VERIFIED | Untouched by the ten-file diff; re-confirmed present by `workflows-doc-pins.test.ts::"WDOC-01: both READMEs carry the workflows entry..."`, run directly, passed. |
| `tests/domain/resolver.test.ts` | Upstream citation replaces open-premise paragraph | ✓ VERIFIED | Untouched by the ten-file diff; unchanged from the prior report's reading. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `platform/pi-api.ts::hasLoadedWorkflowEngine` | `shared/notify.ts` row rendering | `softDepStatus` → `softDepMarkers` → `composeReasons` → `notify()` | ✓ WIRED | Re-confirmed: `install.ts:1867` still the sole probe-consuming call among the 3 `companionSeverity` production call sites re-grepped at HEAD (`install.ts:1867`, `update.ts:2844`, `enable-disable.ts:1273`), matching the doc's "three surfaces raise" claim exactly. |
| 7 `Dependency[]` derivation sites | Rendered plugin row | `orchestrators/*` → `shared/notify.ts::notify()` | ✓ WIRED | `workflows-marker-coverage.test.ts` drives all 7 (including the 3 post-Phase-115/116/117 versions) through their public surfaces and passed. |
| `bridges/workflows/stage.ts` | Envelope write | `prepareStageWorkflows` (no `pi` parameter) | ✓ WIRED (isolated from the probe) | `no-probe-in-workflows-bridge.test.ts` re-run at HEAD, passed. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| `Dependency` union still exactly 3 members | `grep -n "^export type Dependency"` | `"agents" \| "mcp" \| "workflows"` | ✓ PASS |
| `REASONS` closed-set count and marker position at HEAD | direct test run: `notify-closed-set-locks.test.ts` | `REASONS.length === 46`; marker unmoved | ✓ PASS |
| 7-site marker-coverage gate on the post-Phase-115/116/117 tree | direct test run: `workflows-marker-coverage.test.ts` | 2/2 pass | ✓ PASS |
| Envelope byte-equality (engine loaded vs. absent) | direct test run: `install.test.ts -t "envelope bytes do not depend"` | 1/1 pass | ✓ PASS |
| Catalog corpus lock and Phase 114's two catalog states | direct test run: `catalog-uat.test.ts` | 6/6 pass, 197-example lock holds | ✓ PASS |
| Compatibility-doc figures (9 checks / 6 warnings / 3 severity-raising surfaces / peer floors) mechanically re-checked against source | direct test run: `workflows-doc-pins.test.ts` | 4/4 pass | ✓ PASS |
| No debt markers (`TBD`/`FIXME`/`XXX`) in the 10 changed files | `grep -n -E "TBD\|FIXME\|XXX"` over all 10 | no matches | ✓ PASS |
| No stale wrong-package or retired-figure wording reintroduced | `grep -rn "requires pi-workflows\b"` / `"seven gates"` (only in the test's own guard string) | no unguarded stale text | ✓ PASS |
| Working tree clean since Phase 117's `npm run check` run | `git status --short` / `git log -1` | clean (operator files only); HEAD is the Phase 117 close commit | ✓ PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| WDEP-01 | Probe via `workflow_control`, not bare `workflow` | ✓ SATISFIED | Unchanged file; unaffected by the ten-file diff. |
| WDEP-02 | Workflow artifacts written with engine absent, install still succeeds, degradation reason carried | ✓ SATISFIED | Byte-equality test re-run at HEAD, passed. |
| WDEP-03 | Install-engine-and-reload recovers with no reinstall | ✓ SATISFIED (mechanical proof, unchanged grade) | Same bridge-isolation + byte-equality mechanism, re-run at HEAD. |
| WDEP-04 | `workflows` becomes 3rd `Dependency` member with marker, new REASONS token | ✓ SATISFIED | Truth #1; `Dependency` still 3 members, marker still present and correctly ordered inside a now-46-member set. |
| WDOC-01 | Docs state executable-code framing, engine name/trust grounds, guaranteed-vs-divergent semantics, evidence grading | ✓ SATISFIED | Truth #4; figures mechanically re-verified by `workflows-doc-pins.test.ts` against the current source, not just re-read. |
| WDOC-02 | `docs/output-catalog.md` carries new token and rendered states under the byte gate | ✓ SATISFIED | Two Phase 114 states re-confirmed present and byte-pinned under the now-197-example corpus. |
| WDOC-03 | `acorn` declared as a runtime dependency | ✓ SATISFIED | `package.json` unchanged by the ten-file diff; re-confirmed present. |

`.planning/workstreams/workflows/REQUIREMENTS.md` lines 131-137 confirm all 7 IDs (WDEP-01..04, WDOC-01..03) mapped to Phase 114 and marked `Complete`. No orphaned requirements found for this phase.

### Anti-Patterns Found

None blocking. Debt-marker scan (`TBD`/`FIXME`/`XXX`) on all ten changed files at HEAD: no matches. Broken Windows #34 (the pinned-line-number staleness risk in `docs/workflows-compatibility.md`, tracked as `WPIN-01`) remains open and unaffected by this re-verification — it was already documented, intentional, future-tracked debt at Phase 114 close and none of the ten changes altered that disposition.

## Gaps Summary

None. All ten files that moved underneath the prior verification were individually re-checked against Phase 114's specific claims at HEAD, and every check that exists to enforce those claims (`workflows-marker-coverage.test.ts`, `catalog-uat.test.ts`, `no-probe-in-workflows-bridge.test.ts`, `notify-closed-set-locks.test.ts`, `compat-01-no-expansion.test.ts`, `workflows-doc-pins.test.ts`, and the install-test byte-equality assertion) was run directly by this verifier — not cited from a SUMMARY — and passed. Phase 117's `agent()`-semantics rewrite in `docs/workflows-compatibility.md` corrects a source-read-only claim with a runtime-measured one and states its own supersession in-document; this is the evidence-grading discipline Phase 114 established operating as designed, not a regression of anything Phase 114 claimed. Phase 116's `REASONS` 46th member and Phase 115/116's catalog-count increase to 197 both land strictly additively relative to Phase 114's markers, confirmed by direct index/position checks rather than by trusting the count alone. The host engine remains the third and only additional `Dependency` union member (still exactly 3), and the workflows bridge's executable-code contract in `docs/workflows-compatibility.md` still stands, fully cross-referenced and internally consistent, at HEAD (`f0581b7`).

---

_Verified: 2026-09-09T21:00:00Z_
_Verifier: Claude (gsd-verifier, re-verification)_
