---
phase: 102-workflow-naming-and-script-admission
verified: 2026-08-15T08:10:00Z
status: passed
score: 6/6 success criteria verified
behavior_unverified: 0
overrides_applied: 0
re_verification: No — initial verification
---

# Phase 102: Workflow naming and script admission Verification Report

**Phase Goal:** Every discovered script either resolves to the command name Claude
itself would give it, or is refused with a stated reason — decided statically,
before anything is written, and never by running the script.

**Verified:** 2026-08-15
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths — scored against the six ROADMAP Success Criteria

| # | Success Criterion | Status | Evidence |
|---|---|---|---|
| 1 | A script exporting `meta` with a string-literal `name` yields `<plugin>:<meta.name>` from `generatedColonName` reused unchanged, including a `meta` 26 lines down behind a comment header, a double-quoted key, and a `<something>.workflow.js` file name | ✓ VERIFIED | `admitWorkflowScript` calls `namedVerdict` → `generateOrRefuse` → `generatedWorkflowName` → unchanged `generatedColonName` (`domain/name.ts:102-106,142-155`). `tests/domain/workflow-script.test.ts` WNAM-01 rows cover: `drafter.workflow.js` with a 20-line header before `meta` at line 26 resolving `paperjury:drafter` (not the stem `paperjury:drafter.workflow`), a double-quoted `"name"` key, a comment decoy, and a string-literal decoy. All 6 WNAM-01 rows pass (`node --test tests/domain/workflow-script.test.ts`, 36/36 green). `git diff 03e50dce -- domain/name.ts` shows the change is purely additive — zero removed lines — confirming `generatedColonName` and `assertSafeName` are byte-unchanged. |
| 2 | The other three extractor outcomes are handled distinctly: no `name`/non-literal `name` fall back to stem with the value never evaluated; no `meta` is skipped with a warning and not installed; unparseable script is refused rather than name-scavenged | ✓ VERIFIED | Four-arm discriminated union `WorkflowVerdict` = `named \| stem-fallback \| skipped \| refused` (`workflow-script.ts:72-73`) — exactly 4 `readonly outcome: "` declarations confirmed by grep. `findMetaObject` returns a 3-arm `MetaLookup` (`object-literal \| no-meta \| meta-not-object-literal`) so "no meta" and "meta not an object literal" are distinct `SkippedCause`s (WNAM-03). `metaStringValue` returns `undefined` for a non-literal `name` without reading its value — WNAM-02 tests assert the identifier/template text is absent from the generated name (`absentFromName` assertions). `parseScript` returns `undefined` on a `SyntaxError`, converted to `refused`/`unparseable` with nothing scavenged — asserted via `!JSON.stringify(verdict).includes("scavengeable-name")`. |
| 3 | Two scripts in one plugin resolving to the same name fail with an explicit collision error naming the offenders, mirroring `assertNoCommandCollisions` | ✓ VERIFIED | `assertNoWorkflowNameCollisions` (`workflow-script.ts:160-186`) groups admitted verdicts by `generatedName` and throws a plain `Error` in the `"gen" <- ["a", "b"]` shape mirroring `bridges/commands/stage.ts::assertNoCommandCollisions`. Takes the **full verdict array** and narrows internally (`isAdmitted` filter) rather than requiring a pre-deduped input — confirmed by reading the function signature and the WNAM-05 test "a name claimed three times is reported whole -- nothing is deduped first". 8 WNAM-05 tests pass, including the RN-1 elision-axis collision (`foo` + `acme-foo` both → `acme:foo`, neither file name reveals it) and confirmation that skipped/refused verdicts are excluded from grouping. |
| 4 | Every generated name passes the engine's `isSafeSavedWorkflowName`, including RN-1 prefix elision, with no `:`-sanitizing step added | ✓ VERIFIED | New private gate `assertSafeSavedWorkflowName` (`domain/name.ts:128-140`) enforces the two clauses `assertSafeName` lacks: `length <= 128` (`name.length > 128` throw) and `name.trim() === name` (trim-equality throw). Called from `generatedWorkflowName` after `generatedColonName` produces the elided, colon-joined name. `tests/domain/name.test.ts` WNAM-06/SC-4 section: `generatedWorkflowName rejects a generated name longer than 128`, `rejects an untrimmed generated name`, `uses COLON separator and does not sanitize it` — all pass. No `:`-sanitizing step exists anywhere in either file (confirmed by reading both files in full — colon only appears in the join template `${plugin}:${elided}`). `git diff 03e50dce -- domain/name.ts` confirms `assertSafeName` and `generatedColonName` are byte-for-byte unchanged (0 removed lines) — the gate genuinely wraps rather than modifying the shared validator. |
| 5 | A script the engine's preprocessor would reject is identified before any write, skipped with the other scripts in the same plugin still admitted, and reported by filename with the real reason, including when a blocklist match sits inside a comment | ✓ VERIFIED | `DETERMINISM_BLOCKLIST` vendored flagless (`workflow-script.ts:314`), matched with a per-call `new RegExp(src, "g")` clone against `source.matchAll(...)` (no retained `lastIndex` — pinned by the "two scans in sequence both refuse" test). Match positions classified against acorn's own `comments` ranges and `stringRanges` token ranges (from the same `parse()` call) into 3 distinct causes: `determinism-code`, `determinism-comment`, `determinism-string`. The comment-cause reason string includes the word "reword" (asserted). WVAL-02 test "one blocklist-hit script among four leaves the other three verdicts untouched" confirms per-file (not per-plugin) refusal — `deepEqual` against the same 3 scripts run alone. Nothing writes to disk anywhere in this module (grepped for `writeFile`/`fs.` — none present); this is a pure decision function per the CONTEXT.md phase boundary. |
| 6 | `acorn` (8.16.0) is a declared runtime dependency, the fourth alongside `isomorphic-git`/`proper-lockfile`/`write-file-atomic`, rather than reached transitively via eslint, and `npm run check` stays green | ✓ VERIFIED | `package.json` `dependencies` now lists `"acorn": "^8.16.0"` as the first (alphabetized) of 4 runtime deps (`git diff 03e50dce -- package.json`). `package-lock.json`'s `node_modules/acorn` entry lost `"dev": true` while `version`/`resolved`/`integrity` are byte-unchanged. `tests/architecture/runtime-deps.test.ts` (3 tests, all pass) pins membership in `dependencies`, absence from `devDependencies`, and absence of `"dev"` in the lock entry. `npm run check` run fresh during this verification (not trusted from SUMMARY) — **exit 0**, full typecheck + ESLint + Prettier + unit (all suites, 18 top-level integration subtests shown plus the full unit tree) + integration all green. |

**Score:** 6/6 success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `extensions/pi-claude-marketplace/domain/workflow-script.ts` | Pure admission decision module: 4-arm verdict union, single `parse()` entry point, determinism classifier, collision assertion | ✓ VERIFIED | 520 lines. No disk I/O, no network, no `eval`/`new Function`/`node:vm`/dynamic `import()` (grepped — none found). Only production consumer of `acorn`. |
| `extensions/pi-claude-marketplace/domain/name.ts` | `generatedWorkflowName` wrapping unchanged `generatedColonName`, plus new private engine-parity gate | ✓ VERIFIED | Diff against pre-phase commit (`03e50dce`) is purely additive (0 removed lines); `assertSafeName` and `generatedColonName` byte-unchanged. |
| `tests/domain/workflow-script.test.ts` | New file, WNAM-01..06 + WVAL-01..03 coverage | ✓ VERIFIED | 36/36 tests pass. All fixtures inline template literals, no on-disk `.js` fixture anywhere under `tests/`. Assertions check values (metaName, generatedName, cause, reason content), not just shapes — not vacuous. |
| `tests/domain/name.test.ts` | New WNAM-06/SC-4 section | ✓ VERIFIED | New section present between existing CM-2 and AG-1 blocks; 40/40 tests pass (existing + new). |
| `tests/architecture/runtime-deps.test.ts` | New file, WDOC-03 dependency-membership pins | ✓ VERIFIED | 3 tests, all pass; asserts membership not version string (future caret bump stays green). |
| `package.json` / `package-lock.json` | `acorn` as 4th runtime dependency | ✓ VERIFIED | See SC 6 above. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `domain/workflow-script.ts::namedVerdict` / `stemFallbackVerdict` | `domain/name.ts::generatedWorkflowName` | `generateOrRefuse` calls it and catches the throw, converting to a per-file `refused` verdict rather than letting it escape | ✓ WIRED | Confirmed by reading `generateOrRefuse` (`workflow-script.ts:278-293`) and the WNAM-06 test suite (5 tests) asserting `assert.doesNotThrow(call)` around the full `admitWorkflowScript` invocation, not just the returned verdict. |
| `generatedWorkflowName` | `generatedColonName` (private, shared) | direct call, unmodified helper | ✓ WIRED | `domain/name.ts:103`. |
| `admitWorkflowScript` | `assertSafeSavedWorkflowName` (new private gate) | via `generatedWorkflowName` | ✓ WIRED | Only `generatedWorkflowName` calls the new gate — `generatedSkillName`/`generatedCommandName`/`generatedAgentName` are untouched (grepped for callers). |
| Determinism classifier | acorn's own `comments`/token output | `findDeterminismViolation` reads `parsed.comments` and `parsed.stringRanges`, both populated by the single `parse()` call in `parseScript` | ✓ WIRED | No second scanner; `containsIndex` tests match position against both range sets. |

### Data-Flow Trace

Not applicable in the conventional sense — this phase produces a pure decision
function with no renderer and no consumer yet (by design; Phase 103 wires it
into discover/stage). The "data flow" verified instead is that every verdict
field traces to real AST evidence (never a hardcoded literal): `metaName`
comes from `p.value.value` on an AST `Literal` node; `generatedName` comes
from the real `generatedWorkflowName` call, not a static string; collision
detection groups on the actual `generatedName` field of each verdict. No
stub/static-fallback pattern found.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full workflow-script suite | `node --test tests/domain/workflow-script.test.ts` | 36/36 pass | ✓ PASS |
| Full name suite + runtime-deps | `node --test tests/domain/name.test.ts tests/architecture/runtime-deps.test.ts` | 40/40 pass | ✓ PASS |
| Typecheck | `npx tsc --noEmit -p tsconfig.json` | exit 0 | ✓ PASS |
| Lint on touched files | `npx eslint <5 files>` | exit 0, no output | ✓ PASS |
| Full quality gate (run fresh, not trusted from SUMMARY) | `npm run check` | exit 0 | ✓ PASS |
| Gate-order pin (adversarial re-check per instructions) | inspected `GATE_ORDER_SOURCE` vs. `CODE_MATCH_SOURCE`/`COMMENT_MATCH_SOURCE`/string/template/mixed/late/early fixtures | Only `GATE_ORDER_SOURCE` declares both a usable string-literal `meta.name` ("clock") AND calls `Date.now()`; every other determinism fixture omits `name` entirely (`description`-only `meta`) | ✓ PASS — exactly one load-bearing fixture, as claimed |

### Probe Execution

Not applicable — no `scripts/*/tests/probe-*.sh` exist for this phase; this is
a pure-domain TypeScript change with no CLI/migration surface.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| WNAM-01 | 102-01 | `meta.name` via static acorn AST walk, never regex, never evaluated | ✓ SATISFIED | SC 1 above. |
| WNAM-02 | 102-02 | No/non-literal `name` falls back to stem, value never evaluated | ✓ SATISFIED | SC 2 above. |
| WNAM-03 | 102-02 | No `meta` declaration is skipped with a warning, not installed | ✓ SATISFIED | SC 2 above (skip carries a `reason` string; wiring the warning into `warnings[]` is Phase 103's job per CONTEXT.md, out of this phase's scope). |
| WNAM-04 | 102-02 | Unparseable script refused, not name-scavenged | ✓ SATISFIED | SC 2 above; gate-order pin confirms unparseable settles before blocklist/meta walk. |
| WNAM-05 | 102-02 | Collision detection, explicit error naming offenders | ✓ SATISFIED | SC 3 above. |
| WNAM-06 | 102-01/102-02 | `<plugin>:<name>` via `generatedColonName`, passes engine's `isSafeSavedWorkflowName`, no `:`-sanitizing | ✓ SATISFIED | SC 4 above. |
| WVAL-01 | 102-02 | Text-level preprocessor pre-validation before install commits | ✓ SATISFIED | SC 5 above. |
| WVAL-02 | 102-02 | Rejected script skipped/reported; other workflows and plugin still install | ✓ SATISFIED | SC 5 above (per-file refusal verified at the decision-function level; ledger-level "still installs" wiring is Phase 103). |
| WVAL-03 | 102-02 | Rejection names script and real reason, including comment-only match | ✓ SATISFIED | SC 5 above. |
| WDOC-03 | 102-01 | `acorn` declared as 4th runtime dependency | ✓ SATISFIED | SC 6 above. |

No orphaned requirements — REQUIREMENTS.md maps exactly these 10 IDs to Phase
102 and all 10 appear in the two plans' `requirements` fields.

### Anti-Patterns Found

None. Grepped `workflow-script.ts`, `name.ts`, and all three new/modified test
files for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|placeholder|coming soon|not yet
implemented|Phase [0-9]|Plan [0-9]|Wave [0-9]` — zero matches. No `eval`, `new
Function`, `node:vm`, or dynamic `import()`. No hardcoded-empty-return stub
patterns (`return null`/`return {}`/`return []`/`=> {}`) found outside of
legitimate `MetaLookup`/verdict object construction that reads real AST data.
The one WINDOWS.md-tracked stub from plan 102-01 (a provisional single
`skipped` return) is marked `fixed` in the ledger and confirmed closed by
reading the current `admitWorkflowScript` body — all four arms are reachable
and independently tested.

### Human Verification Required

None. This phase writes no artifact and touches no user-visible surface (per
102-VALIDATION.md's own "Manual-Only Verifications" table, which is empty by
design). Every truth in this report is either a state-transition/invariant
covered by a passing named test (gate-order pin, per-file-refusal-not-throw,
lastIndex-retention) or a static presence/wiring check.

### Gaps Summary

No gaps. All six ROADMAP success criteria are verified against the actual
code (not SUMMARY.md claims), the pre-phase diff confirms the shared
`assertSafeName`/`generatedColonName` helpers are genuinely untouched, the
gate-order pin fixture set is exactly as narrow as claimed (one load-bearing
fixture, not eight), `npm run check` was re-run fresh in this verification
session and passed, and the scope fence holds — the only files touched since
the pre-phase commit are the two production files, three test files, the two
package files, and planning artifacts (WINDOWS.md, the two SUMMARY.md files).
No `bridges/workflows/`, no `domain/resolver.ts` change, no
`orchestrators/plugin/info.ts` change, no `shared/notify.ts` change, no
`docs/output-catalog.md` change — consistent with this phase's stated "pure
decision layer, writes nothing, reads no directory" boundary.

The two known-and-accepted deferrals (the `info` command still showing file
stems; the six further engine gates not replicated) are correctly not
implemented here and are carried forward with explicit ROADMAP/REQUIREMENTS
homes (Phase 103 SC 7, WDOC-01 on Phase 105) rather than silently dropped.

---

*Verified: 2026-08-15*
*Verifier: Claude (gsd-verifier)*
