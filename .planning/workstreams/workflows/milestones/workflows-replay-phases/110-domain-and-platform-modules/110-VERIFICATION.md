---
phase: 110-domain-and-platform-modules
verified: 2026-09-05T12:00:00Z
status: passed
score: 20/20 must-haves verified
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "WNAM-06 (edge, empty): generatedWorkflowName(plugin, \"acme-\") throws (elision-empties-the-head case), so the bare acme: is never silently produced."
    reason: >-
      Superseded by an evidenced, in-scope code-review finding (WR-02, iteration 1) that the original
      gate was stricter than the host engine, which the module's own doc comment forbids
      ("Matching the engine exactly is the goal, never exceeding it"). generatedWorkflowName("acme",
      "acme-") now returns "acme:acme-" via D-141-02's empty-head-elision rule (the same rule
      generatedCommandName already applies), rather than throwing. Verified directly: the empty-source
      half of the clause is unchanged (generatedWorkflowName("acme", "") still throws
      "Workflow name must be a non-empty string." -- tests/domain/name.test.ts:525-530), and the
      clause's stated PURPOSE -- "Neither may silently produce the bare acme:" -- still holds by
      construction: "acme:acme-" is not "acme:". 110-REVIEW.md independently re-verified the safety
      of the loosening against an unpacked @quintinshaw/pi-dynamic-workflows@3.10.1 (31-row
      differential, 1 excess/0 lax, the one excess being the empty-name case the engine's own
      validateMeta also rejects) before accepting it in iteration 2. This is not a regression --
      it is a documented, evidenced correction of an over-strict initial gate, disclosed loudly in
      110-REVIEW-FIX.md's own "READ THIS FIRST" section.
    accepted_by: gsd-verifier (adjudicated per operator's explicit verification instructions)
    accepted_at: 2026-09-05T12:00:00Z
gaps: []
human_verification: []
human_verification_resolved:
  - test: >-
      Remove the bare "Phase 111" planning-artifact token from the doc comment on
      extensions/pi-claude-marketplace/domain/workflow-script.ts, per
      .claude/rules/typescript-comments.md.
    resolution: fixed
    resolved_by: orchestrator (autonomous run)
    resolved_at: 2026-09-05T12:30:00Z
    commit: e2e99b83
    detail: >-
      Not waived -- fixed. The sentence now reads "Tracked there as a roadmap criterion so the arm
      does not stay a silent dead-command factory", which keeps the substance (the obligation belongs
      to the bridge that owns the warnings[] channel, and it is tracked) while dropping the bare
      planning token the policy bans. The obligation itself is unchanged and still carried as a
      Phase 111 success criterion in ROADMAP.md, which is the right home for a phase number.
      Re-checked after the edit: tsc 0 errors, Prettier clean, tests/domain/workflow-script.test.ts
      62/62, and a repo-wide scan of extensions/**/*.ts for bare Phase/Plan/Wave/Pitfall/Pattern
      tokens returns only bridges/agents/stage.ts:314, which is a two-phase-commit ALGORITHM step
      ("Phase 2: remove old target files"), not a GSD planning reference -- pre-existing and
      deliberately left alone.
---

# Phase 110: Domain and platform modules Verification Report

**Phase Goal:** The three leaf modules the bridge needs — script admission, project-key derivation,
and the engine home directory — are on this branch with owner tests and no test-only seams.
**Verified:** 2026-09-05T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All items below are drawn from the merged must_haves of `110-01-PLAN.md`, `110-02-PLAN.md`,
`110-03-PLAN.md`, and the ROADMAP's six success criteria (which the plans' `<success_criteria>`
sections restate verbatim as criteria 1–6). Every truth was checked directly against the current
tree at `HEAD` (`d1975cc1`), not inferred from SUMMARY.md prose.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `workflowHomeDir()` derives the storage root from the home directory alone; reads no `cwd`, no env override (WPTH-02 provable half) | ✓ VERIFIED | `platform/workflow-home.ts` is 4 lines of logic, `path.join(os.homedir(), ".pi", "workflows")`, no `process.env`/`process.cwd()` reference (`grep -cE 'process\.env|PI_CODING_AGENT_DIR'` on non-comment lines = 0). `tests/platform/workflow-home.test.ts`'s "WPTH-02" case relocates `HOME` and a *distinct* cwd and asserts the root tracks home only, is not under cwd, and is not the legacy `<cwd>/.pi/workflows/saved` path. Test run green. |
| 2 | No test-only relocation seam survives in `platform/workflow-home.ts` (criterion 4) | ✓ VERIFIED | `grep -cE 'ForTesting|__test_|let override'` on non-comment lines = 0. Module has exactly one export (`grep -cE '^export '` = 1). `HOME` relocation with `t.after()` registered *before* mutation is the sole replacement mechanism, confirmed by reading the test source directly (`hermeticHome` saves, registers `t.after`, then assigns). |
| 3 | The seam-free module reaches 100% direct coverage from its own owner test alone | ✓ VERIFIED | `npm run test:coverage:direct -- platform/workflow-home.ts` → branches 2/2, functions 1/1, lines 32/32, run live during this verification (not taken from SUMMARY). |
| 4 | `workflowProjectKey` reproduces the engine's derivation across the Spike 025 case set, mutation-sensitively (criterion 6) | ✓ VERIFIED | 13 transcribed literal rows + normalization pair + cwd-pinned relative case, all present in `tests/domain/workflow-project-key.test.ts`. **Directly tested the mutation-sensitivity claim**: changed `.slice(0, 12)` to `.slice(0, 11)` in `domain/workflow-project-key.ts`, re-ran the suite — it went red (`actual: 'some-project-e4c31526a11'`, `expected: '...e4c31526a114'`). Reverted; `git diff` confirms clean. |
| 5 | Dash strip runs before the 48-char slice (the `"a".repeat(47) + "-b"` row) | ✓ VERIFIED | Row present at `tests/domain/workflow-project-key.test.ts:75-76`, built with `.repeat()`, expecting the doubled-dash literal `"a".repeat(47) + "--79e41bdb3cef"`. |
| 6 | `path.resolve()` runs before `path.basename()` (two spellings collapse to one key) | ✓ VERIFIED | Rows at lines 94 (`/` fallback), 107 (`..`-normalization, matching row 1's key), and the cwd-pinned relative case at line 161 (`process.chdir("/")`, asserted against the same literal `some-project-e4c31526a114`). |
| 7 | V12: `.`, `..`, and both path separators are unreachable outputs of the sanitizer | ✓ VERIFIED | The `/` row (line 94, `project-8a5edab28263`) and the `..`-normalization row (line 107) are both present and pass, standing proof per the plan's own framing. |
| 8 | Both new modules pass the whole-tree gate with no dead-code suppression, despite no production consumer until Phase 111 | ✓ VERIFIED | `npm run fallow` (dead-code sub-gate) run live: "✓ No issues found". No `fallow-ignore` marker anywhere in the phase's five production files (`grep -c` = 0 each). |
| 9 | Phase 109's five inverted files are untouched | ✓ VERIFIED | `git status --porcelain` and `git diff 0c951c6b..HEAD` over all five files, run live: both empty. |
| 10 | `generatedWorkflowName(plugin, source)` produces `<plugin>:<elided>` with RN-1 prefix elision | ✓ VERIFIED | `domain/name.ts:207-252`; `tests/domain/name.test.ts` happy-path rows including `acme-audit` → `acme:audit`. Test run green. |
| 11 | Every name `generatedWorkflowName` returns passes the engine's real `isSafeSavedWorkflowName`, including the `\s/\\\0` and `\p{Cc}\p{Cf}` clauses | ✓ VERIFIED | `assertSafeSavedWorkflowName` (`domain/name.ts:286-`) carries both added clauses (`grep -c 'p{Cc}'` ≥1, `grep -c 'p{Cf}'` ≥1). 110-REVIEW.md iteration 2 independently re-verified this against an unpacked engine 3.10.1 (31-row differential, 0 lax). Test run green. |
| 12 | WNAM-06 empty edge: `generatedWorkflowName(plugin, "")` throws | ✓ VERIFIED | `domain/name.ts:218-220`; `tests/domain/name.test.ts:525-530` pins the throw with message "Workflow name must be a non-empty string." |
| 12b | WNAM-06 empty edge: elision-empties-the-head (`acme` + `acme-`) also throws, never silently producing bare `acme:` | **PASSED (override)** | See `overrides` in frontmatter. `generatedWorkflowName("acme", "acme-")` now returns `"acme:acme-"` (verified directly at `domain/name.ts:210-213` and pinned at `tests/domain/name.test.ts:448`), not a throw — a deliberate, evidenced correction (WR-02) that keeps the clause's *stated purpose* (never the bare `acme:`) intact by construction rather than by refusal. Independently re-verified safe by 110-REVIEW.md iteration 2 against the real engine. |
| 13 | Length measured in UTF-16 code units (`String.prototype.length`), never grapheme clusters or bytes | ✓ VERIFIED | `assertSafeSavedWorkflowName`'s cap check is `name.length > 128` (plain JS string length = UTF-16 code units); 128/129-unit boundary rows present in `tests/domain/name.test.ts`, built with `repeat()` arithmetic. |
| 14 | `WorkflowNameCollisionError` carries offenders as structured `collisions` data, never message-parsed; each entry has `generatedName` and `readonly fileNames` | ✓ VERIFIED | `shared/errors.ts:641-675`. `tests/shared/errors.test.ts` `describe("WorkflowNameCollisionError")` asserts structured fields via `deepStrictEqual` projections, never message substring. Test run green. |
| 15 | `WorkflowNameCollisionError` defensively copies (`Object.freeze([...collisions])`), unlike `CrossPluginConflictError`; owner test asserts the copy and frozen state, not reference identity | ✓ VERIFIED | `shared/errors.ts:673`: `this.collisions = Object.freeze([...collisions])`. Test asserts `notStrictEqual`, `Object.isFrozen`, and a post-construction push-into-caller's-array-does-not-leak case (the strongest form of the assertion). |
| 16 | Both `domain/name.ts` and `shared/errors.ts` return to complete direct coverage | ✓ VERIFIED | Measured live: `name.ts` branches 52/52, functions 6/6, lines 314/314; `errors.ts` branches 104/104, functions 48/48, lines 675/675. |
| 17 | `meta.name` extraction survives the comment decoy, the string decoy, and the double-quoted key, all resolving to the AST-declared name (WNAM-01, criterion 5) | ✓ VERIFIED | `tests/domain/workflow-script.test.ts:106-146`, three decoy rows, all pinned as `named` with the AST-declared name (not the decoy text). Test run green. |
| 18 | The nine distinct non-admission causes (3 skip + 6 refusal) are all reachable and distinctly reported | ✓ VERIFIED | `grep -o` over the test file confirms all 3 skip causes (`no-meta`, `meta-not-object-literal`, `meta-spread`) and all 6 refusal causes (`unparseable`, `determinism-code/comment/string/split`, `unsafe-name`) are named and asserted with `describe`/`test` cases. `meta-computed-key` (a 4th skip-family cause added by WR-11) is also present and reachable, strictly widening the coverage the plan asked for. |
| 19 | The module parses and never evaluates untrusted script text (SECURITY) | ✓ VERIFIED | `grep -v '^\s*[/*]' workflow-script.ts \| grep -cE '\beval\(\|new Function\(\|node:vm\|import\('` = 0, run live. |
| 20 | `acorn` declared at `^8.16.0` under `dependencies`, actually imported (criterion 2) | ✓ VERIFIED | `node -e` check on `package.json`: `^8.16.0|undefined` (in `dependencies`, absent from `devDependencies`). `fallow dead-code` reports no unused dependency. |

**Score:** 20/20 truths verified (0 present-but-behavior-unverified; 1 accepted override per the
adjudication instructions).

### Post-review fixes: verified landed, not merely claimed

`110-REVIEW.md` (iteration 2) found three Warnings against the code as it stood after iteration 1's
fixes (WR-10, WR-11, WR-12). All three were independently confirmed present in the current tree,
not taken on the fix report's word:

| Finding | Fix | Verified in code |
|---|---|---|
| WR-10: `var meta = {…}; var meta;` mis-reported as `meta-not-object-literal` | `bindMeta` helper distinguishes rebinding from a no-op redeclaration | `domain/workflow-script.ts:601,619-626` — `bindMeta` present, correctly returns `found` unchanged when `declarator.init` is nullish and `found.kind !== "no-meta"` |
| WR-11: a computed `meta` key could silently overwrite `name` | Computed keys now treated as `opaque`, same as spreads, with a distinct `meta-computed-key` cause | `domain/workflow-script.ts:693-694` (`if (element.computed) { read = { kind: "opaque", cause: "meta-computed-key" }; }`); cause reachable in `tests/domain/workflow-script.test.ts` |
| WR-12: a lone surrogate in a generated name could collapse two distinct names onto one file at the filesystem-encoding layer | `generatedWorkflowName` refuses `/\p{Cs}/u` | `domain/name.ts:244-249`, confirmed present with the documented rationale |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/platform/workflow-home.ts` | `workflowHomeDir()`, seam-free | ✓ VERIFIED | Exists, 1 export, no seam tokens, 100% direct coverage |
| `extensions/pi-claude-marketplace/domain/workflow-project-key.ts` | `workflowProjectKey(cwd)` | ✓ VERIFIED | Exists, unedited from port, 100% direct coverage |
| `extensions/pi-claude-marketplace/domain/name.ts` (extended) | `generatedWorkflowName` + private `assertSafeSavedWorkflowName` | ✓ VERIFIED | Present, all six engine clauses, 100% direct coverage |
| `extensions/pi-claude-marketplace/shared/errors.ts` (extended) | `WorkflowNameCollision` + `WorkflowNameCollisionError` + `UnsafeGeneratedNameError` | ✓ VERIFIED | Present, 100% direct coverage |
| `extensions/pi-claude-marketplace/domain/workflow-script.ts` | `admitWorkflowScript`, `assertNoWorkflowNameCollisions`, `WORKFLOW_SCRIPT_EXTENSIONS`, `fileStem`, 8+ verdict types | ✓ VERIFIED | Present, 116/116 br, 38/38 fn, 816/816 ln |
| `package.json` / `package-lock.json` | `acorn` at `^8.16.0` under `dependencies` | ✓ VERIFIED | Confirmed via `node -e` read of the manifest |
| `tests/platform/workflow-home.test.ts` | owner test, direct import | ✓ VERIFIED | 3 top-level cases, direct relative `.ts` import |
| `tests/domain/workflow-project-key.test.ts` | owner test | ✓ VERIFIED | 15 cases, literal-only expectations |
| `tests/domain/workflow-script.test.ts` | owner test, every export imported by name | ✓ VERIFIED | 51+ cases across 3 `describe` blocks; all runtime and type exports imported |
| `tests/domain/name.test.ts` (extended) | `describe("generatedWorkflowName")` | ✓ VERIFIED | 18+ cases, ordered after `describe("generatedAgentName")` |
| `tests/shared/errors.test.ts` (extended) | `describe("WorkflowNameCollisionError")`, `describe("UnsafeGeneratedNameError")` | ✓ VERIFIED | Both present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `tests/platform/workflow-home.test.ts` | `platform/workflow-home.ts` | direct relative import | ✓ WIRED | `import { workflowHomeDir } from "../../extensions/.../workflow-home.ts"` |
| `tests/domain/workflow-project-key.test.ts` | `domain/workflow-project-key.ts` | direct relative import | ✓ WIRED | Confirmed and the owner test is the module's only consumer (fallow clean) |
| `domain/workflow-script.ts` | `acorn` | `parse()` call with `onComment`/`onToken` | ✓ WIRED | `acorn` genuinely imported and used; not a lone dependency declaration |
| `domain/workflow-script.ts` | `domain/name.ts` (`generatedWorkflowName`) | wrapped call converting its throw into a per-file refusal | ✓ WIRED | Confirmed via `generateOrRefuse` / `declaredName` parameter (WR-08 rename) |
| `domain/workflow-script.ts` | `shared/errors.ts` (`WorkflowNameCollisionError`) | thrown for set-level defects | ✓ WIRED | `assertNoWorkflowNameCollisions` throws the typed class, structured `collisions` field |

### Data-Flow Trace (Level 4)

Not applicable in the conventional sense — this phase produces no rendered UI or API response. The
relevant "data flow" is that every owner test genuinely exercises production code (not a mock), and
that was confirmed directly: `node --test` on all five owner test files passed 238/238 live during
this verification, and direct-coverage figures were re-measured (not read from SUMMARY.md) at
`hit === found` for all five pairs.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Criterion 6 mutation-sensitivity (the load-bearing claim from `<verification_context>`) | Mutated `.slice(0, 12)` → `.slice(0, 11)` in `workflow-project-key.ts`, re-ran `node --test tests/domain/workflow-project-key.test.ts`, reverted | Test went red as expected (`e4c31526a11` ≠ `e4c31526a114`); file restored, `git status`/`git diff` clean | ✓ PASS |
| Criterion 4 no test-only export | `grep -c 'ForTesting\|__test_'` across all five phase production files | `0` for every file | ✓ PASS |
| SECURITY: no dynamic evaluation in `workflow-script.ts` | `grep -cE '\beval\(\|new Function\(\|node:vm\|import\('` on non-comment lines | `0` | ✓ PASS |
| Whole `npm run check` chain | `typecheck`, `lint`, `fallow`, `format:check`, `test:corresponding[:negative]`, `test:coverage:direct[:negative]` per pair, `npm test`, `npm run test:integration` | All exit 0; `npm test` 5303/0; `npm run test:integration` 32/0 | ✓ PASS |
| Phase 109 / Phase 111 blast radius | `git status --porcelain` + `git diff 0c951c6b..HEAD` over the 5 Phase-109 files and the Phase-111 territory (`bridges/`, `persistence/locations.ts`, `shared/errors-bridges.ts`) | Both empty | ✓ PASS |

### Probe Execution

Not applicable — this phase declares no `scripts/*/tests/probe-*.sh` and the PLAN/SUMMARY files
name no probe convention. Skipped.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| WNAM-01 | 110-03 | `meta.name` from acorn AST, decoys defeated | ✓ SATISFIED | Truth #17 above |
| WNAM-02 | 110-03 | Non-literal/absent `name` falls back to file stem, never evaluated | ✓ SATISFIED | Stem-fallback describe block, template/concat/numeric/identifier rows all present |
| WNAM-03 | 110-03 (Phase 110→111 split) | Skip-with-warning, not installed | **Partial, honestly disclosed** | Classification half (`skipped`/`no-meta`) done here; warning-render and not-installed halves explicitly named as Phase 111's in `110-03-SUMMARY.md`, and `REQUIREMENTS.md:102` records the same split with the owed half named. Judged honest per `<verification_context>` instructions. |
| WNAM-04 | 110-03 | acorn `SyntaxError` → `refused/unparseable`, settled first | ✓ SATISFIED | Truth #18 + the two ordering-divergence cases (`settles unparseable before the determinism scan`, `settles the meta lookup before...`) |
| WNAM-05 | 110-02, 110-03 | Collision → `WorkflowNameCollisionError` with structured offenders | ✓ SATISFIED | Truths #14–15, #18 |
| WNAM-06 | 110-02 | `<plugin>:<elided>` shape, full engine parity | ✓ SATISFIED (with 1 accepted override) | Truths #10–13 |
| WPTH-02 | 110-01 (Phase 110→111 split) | Legacy `<cwd>/.pi/workflows/saved/` never written | **Partial, honestly disclosed** | Home-derivation half proved here (Truth #1); "never written" (a writing guarantee) explicitly deferred to Phase 111's `persistence/locations.ts`/`bridges/workflows/stage.ts`, and named as such in `110-01-SUMMARY.md` and `REQUIREMENTS.md:103`. Judged honest per `<verification_context>` instructions. |

**Cross-reference against `workflows-REQUIREMENTS.md` and `REQUIREMENTS.md`:** all seven requirement
IDs in scope for this phase (WNAM-01..06, WPTH-02) are accounted for. No orphaned requirement was
found mapped to Phase 110 that is absent from all three plans' `requirements:` frontmatter fields.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `extensions/pi-claude-marketplace/domain/workflow-script.ts` | 279 | Bare `Phase 111` planning-artifact token in a production doc comment ("Carried as a Phase 111 success criterion so the arm does not stay a silent dead-command factory.") | ⚠️ Warning | Violates `.claude/rules/typescript-comments.md` (binding project convention, explicitly forbids `Phase NN` references in comments) and contradicts the phase's own repeated task-level acceptance criterion ("no comment or test title contains a Phase, Plan, Wave or Pitfall planning token"). Introduced by the WR-09 review-fix (iteration 1), which post-dates the original tasks' acceptance-criteria checks for this exact rule, so it was never re-verified against it. Does not affect any ROADMAP success criterion, any gate, or any functional behavior — style/convention only. |

No `TBD`/`FIXME`/`XXX` debt markers, no `TODO`/`HACK`/`PLACEHOLDER` markers, no stub returns, and no
hardcoded-empty-data patterns were found in any of the phase's five production files or five test
files.

### Human Verification Required

### 1. Bare "Phase 111" reference in a production comment

**Test:** Decide whether to fix `extensions/pi-claude-marketplace/domain/workflow-script.ts:279`
(replace the "Phase 111" token with a requirement/decision-ID anchor per the project's own comment
policy) or explicitly accept it as a disclosed, low-impact deviation before the phase closes.
**Expected:** Either the comment is corrected, or the deviation is explicitly accepted and recorded.
**Why human:** Pure style/convention judgment call with no functional consequence; a verifier should
not silently rewrite source comments in someone else's shipped commit.

### Gaps Summary

No gaps. All 20 observable truths derived from the merged must_haves of the three plans and the
ROADMAP's six success criteria are VERIFIED against the current codebase (one via an explicit,
evidenced override per the operator's own adjudication instructions for the known WNAM-06 deviation).
The whole `npm run check` chain was re-run live during this verification (not taken from SUMMARY.md
claims) and is green: `typecheck` 0 errors, `lint` exit 0, `fallow` exit 0 (dead-code clean), Prettier
clean, both corresponding-test gates pass, the coverage negative control passes, `npm test` 5303/0,
`npm run test:integration` 32/0. All five source/test pairs the phase touched are at `hit === found`
direct coverage, re-measured live. Phase 109's five inverted files and all Phase 111 territory are
confirmed untouched by direct `git diff` against the phase's base commit. The mutation-sensitivity
claim for the project-key hash width (criterion 6) was independently exercised, not just read, and
behaved exactly as documented, with the working tree confirmed clean afterward.

The only open item is a single cosmetic comment-policy violation (a bare "Phase 111" token) that does
not affect any must-have truth, gate, or success criterion, and is routed to human verification rather
than treated as a gap.

---

_Verified: 2026-09-05T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
