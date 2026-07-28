---
phase: 86-skill-and-command-frontmatter-compliance
verified: 2026-07-26T14:42:35Z
status: passed
score: 27/27 must-haves verified (code-level); 3 backstop truths confirmed via live Pi /reload UAT 2026-07-26
behavior_unverified: 0
overrides_applied: 0
human_verified: "2026-07-26 — operator ran the live Pi /reload UAT (fmc-uat marketplace); all 3 backstop truths confirmed PASS: SKILL-01 (/skill: resolves + never auto-invoked), CMD-01 (neutralized command loads name-from-filename + first-body-line), WTU-02/D-86-05 (>1024-combined skill loads with the non-fatal warning, not dropped). WARN-01 warning surface also observed."
human_verification:
  - test: "Install a plugin containing a skill whose SKILL.md frontmatter cannot be parsed (unquoted `: ` mid-scalar, or similar), then run `/reload` in a live Pi session."
    expected: "`/skill:<generated-name>` resolves and runs; the model never auto-invokes it (disable-model-invocation observed); no `skill: null` drop."
    why_human: "Requires Pi's live skill loader + `/reload` cycle; not exercisable by node:test. Unit tests only prove the synthesized frontmatter block's shape and that it re-parses (SKILL-01 backstop, 86-02-SUMMARY.md D5, human_judgment: true)."
  - test: "Install a plugin containing a command whose frontmatter cannot be parsed, then run `/reload`."
    expected: "The command resolves under name-from-filename with a description taken from the first body line (Claude Code's literal malformed-frontmatter behavior); no synthesized description, no disable flag."
    why_human: "Requires Pi's live command loader + `/reload` cycle; not exercisable by node:test. Unit tests only prove the neutralized bytes re-parse to empty frontmatter (CMD-01 backstop, 86-04-SUMMARY.md D5, human_judgment: true)."
  - test: "Install a skill whose combined `description` + `when_to_use` is 1,025-1,536 characters, then run `/reload` and observe Pi's startup diagnostics."
    expected: "The skill loads (Pi returns a `Skill`, not `null`) and Pi emits its known non-fatal >1,024-char warning; the skill is NOT silently dropped or truncated to 1,024."
    why_human: "Requires observing a live Pi startup diagnostic; not exercisable by node:test. The unit test only proves `parseFrontmatter` re-parses the staged >1024 description without throwing and that its length exceeds 1,024 (WTU-02 / D-86-05 backstop, VALIDATION.md manual-only row)."
---

# Phase 86: Skill and command frontmatter compliance Verification Report

**Phase Goal:** The skills and commands bridges reach observable parity with Claude Code's frontmatter-loading behavior — source frontmatter parsed with Pi's own `parseFrontmatter` (re-exported through `platform/pi-api.ts`) before name-rewrite/substitution, staged bytes re-parsed as a Pi-acceptability backstop; unparseable skill → synthesized `disable-model-invocation` block (body verbatim); unparseable command → neutralized (name-from-filename, description-from-first-body-line); description-less skill → first-paragraph fallback; `when_to_use` folded into the description (truncated at 1,536); every degraded/neutralized component surfaces an install-time warning classified under new per-kind `FAILURE_REASONS` tokens (`malformed skill`, `malformed command`) paralleling `malformed mcp`; the ~99% of already-valid components written byte-for-byte unchanged.
**Verified:** 2026-07-26T14:42:35Z
**Status:** passed (code-level verification + operator live Pi /reload UAT)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `parseFrontmatter` re-exported from `platform/pi-api.ts`, sole sanctioned import site | ✓ VERIFIED | `platform/pi-api.ts:38`; every gate (`skills/stage.ts:24`, `commands/stage.ts:28`, `skills/rewrite-frontmatter.ts:10`) imports it only from there |
| 2 | REASONS grows 35→37, `malformed skill`/`malformed command` appended after `malformed mcp`, existing 35 byte-identical | ✓ VERIFIED | `shared/notify.ts` tail three entries in order `malformed mcp`, `malformed skill`, `malformed command`; `tests/architecture/notify-closed-set-locks.test.ts:35` asserts `REASONS.length === 37`; test run: pass |
| 3 | Both new tokens filed under `FAILURE_REASONS`, `_ReasonsCoverageProof` compiles | ✓ VERIFIED | `shared/notify-reasons.ts` `FAILURE_REASONS` includes both after `malformed mcp`; `npm run typecheck` green (compiles the proof) |
| 4 | Gate 1 parses SOURCE before rewrite/substitution (skills + commands) | ✓ VERIFIED | `skills/stage.ts:254` (`parseFrontmatter(content)` before `rewriteFrontmatterName`); `commands/stage.ts:197` (before `substituteClaudeVars`) |
| 5 | Gate-1 throw on a skill synthesizes `disable-model-invocation` block, body verbatim, no hard-fail | ✓ VERIFIED | `skills/stage.ts:256-269` calls `synthesizeUnparseableSkill(extractBodyAfterFrontmatter(content), ...)`; `frontmatter-degrade.ts:46-55`; unit test `stage.test.ts` (SKILL-01/PARSE-01 case) passes |
| 6 | Gate-1 throw on a command neutralizes by stripping the WHOLE `---`...`---` block (not delimiter-only) | ✓ VERIFIED | `commands/stage.ts:116-126` `neutralizeCommandFrontmatter` slices from the closing `\n---` line onward; test asserts staged output has no `---` block and re-parses empty |
| 7 | Gate 2 re-parses STAGED bytes; a throw on the non-degrade/happy arm is our defect and rethrows loudly (never masked as author degradation) | ✓ VERIFIED | `skills/stage.ts:287` and `commands/stage.ts:219` both call `parseFrontmatter(content)` unconditionally after write, outside any degrade branch, so a throw here propagates to the `appendLeakToError`/`cleanupStaging` catch |
| 8 | Description-less well-formed skill gets first-paragraph fallback, skips blanks/headings/fences | ✓ VERIFIED | `frontmatter-degrade.ts:91-114` `firstBodyParagraph`; wired at `skills/stage.ts:155` `augmentSkillDescription`; unit tests pass (SKILL-02 cases) |
| 9 | `when_to_use` folded into `description` with single `\n`, empty → unchanged | ✓ VERIFIED | `frontmatter-degrade.ts:122-128` `foldWhenToUse`; wired at `stage.ts:156`; WTU-01 unit tests pass |
| 10 | Combined text hard-cut at 1,536 UTF-16 code units, no ellipsis, never Pi's 1,024 threshold | ✓ VERIFIED | `frontmatter-degrade.ts:135-137` `truncate1536` (`LISTING_CAP = 1536`); WTU-02 unit tests (1535/1536/1537 boundary) pass |
| 11 | `setDescriptionScalar` replaces the FULL description node span (incl. `>-`/`\|` block scalars), never a lone line replace | ✓ VERIFIED | `frontmatter-degrade.ts:173-242` `descriptionValueEnd` + `setDescriptionScalar`; block-scalar fixture test passes, sibling keys byte-identical |
| 12 | Written skill `name` always equals generated name; folded/multi-line source `name:` cannot corrupt it (verified via re-parse, not blind regex) | ✓ VERIFIED | `rewrite-frontmatter.ts:107-127` `rewriteFrontmatterName` re-parses result and throws on mismatch; `rewrite-frontmatter.test.ts` folded-name + absent-name cases pass |
| 13 | Degrade record `{generatedName, parseError}` collected per bridge, threaded to install orchestrator | ✓ VERIFIED | `skills/stage.ts:220,265-268,309`; `commands/stage.ts:177,205-208,245`; `install.ts:884,907,946` collect into `installCtx.frontmatterDegradations` |
| 14 | Standalone install row carries ONE `malformed skill`/`malformed command` token per plugin regardless of component count, at `warning` severity on `(installed)` (not `partially-installed`) | ✓ VERIFIED | `install.ts:1757-1768` pushes token once per kind via `.some(...)`; `1797-1799` sets `warning` when `frontmatterDegradations.length > 0`; status stays `"installed"` (`1818-1828`); `install.test.ts` case passes |
| 15 | Zero degraded components → no token, no warning stamp (byte-identity) | ✓ VERIFIED | `install.ts:1823` `...(reasons.length > 0 && { reasons })`; severity falls through to `companionSeverity` when `frontmatterDegradations.length === 0`; NREG-01 test in `install.test.ts` / `notify.test.ts` |
| 16 | Valid skill/command written byte-for-byte identical, gates mutate nothing on happy path | ✓ VERIFIED | `stage.test.ts` NREG-01 case builds expected bytes via independent literal replacement (not production helpers) and asserts `assert.equal(staged, expected)`; same pattern in `commands/stage.test.ts`; both pass |
| 17 | `InstallPluginOutcome.degradedKinds` inert seam present for orchestrated row | ✓ VERIFIED | `install.ts:234,1845,1853` |
| 18 | Reconcile `plugin-installed` arm pushes token + raises severity to `warning` when `degradedKinds` non-empty; unchanged (`info`, no reasons) when empty | ✓ VERIFIED | `reconcile/notify.ts:483-525` `degradedKindReasons`/`installedRowFromOutcome`; `reconcile/apply-outcomes.ts:107` field; `reconcile/apply.ts:607-610` propagation; `notify.test.ts`/`apply.test.ts` cases pass |
| 19 | Per-component free-text detail rides existing `postCommitWarnings → notifyDiagnostic` channel, no new notify variant | ✓ VERIFIED | `install.ts:1684-1690` pushes detail into `postCommitWarnings` (orchestrated only, D-19-01); `apply.ts:1380-1397` `surfacePostCommitWarnings` routes it to `notifyDiagnostic` |
| 20 | Detail lines redacted via `redactAbsolutePaths` before `notifyDiagnostic` | ✓ VERIFIED | `apply.ts:1391-1395` applies `redactAbsolutePaths(w)` per line; `apply.test.ts` case asserts an absolute path collapses to its basename |
| 21 | CMD-01 neutralized output has no synthesized description and no disable flag | ✓ VERIFIED | `commands/stage.ts` neutralize path only strips bytes — no description/flag insertion anywhere in the file; `stage.test.ts` case asserts absence of both |
| 22 | REQUIREMENTS.md traceability: all 11 IDs (PARSE-01/02, SKILL-01/02/03, WTU-01/02, CMD-01, WARN-01, CLASS-01, NREG-01) marked complete, mapped to Phase 86, no orphans | ✓ VERIFIED | `.planning/REQUIREMENTS.md` lines 12-40 + 68-78 |
| 23 | SKILL-01 backstop: degraded skill's `/skill:<name>` resolves + never auto-invoked after live `/reload` | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code present + unit-tested at the synthesis-shape level (`disable-model-invocation: true` present in staged bytes, re-parses); the live Pi loader/auto-invocation behavior is not exercisable by `node:test` — see Human Verification |
| 24 | CMD-01 backstop: neutralized command resolves under `/reload` with name-from-filename + first-body-line description | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code present + unit-tested at the neutralize-shape level (block stripped, re-parses to empty frontmatter); live Pi command-loader behavior not exercisable by `node:test` — see Human Verification |
| 25 | WTU-02/D-86-05 backstop: a >1,024-combined-char skill still loads in Pi (non-fatal warning, not `skill: null`) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Unit test proves the staged bytes re-parse to a non-empty >1024-length description (not silently truncated to 1024); the live Pi startup-diagnostic behavior is not exercisable by `node:test` — see Human Verification |

**Score:** 22/25 truths verified at the code level (3 present, behavior-unverified — all pre-flagged by the phase's own plans/SUMMARYs as backstop truths requiring a live Pi session)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/platform/pi-api.ts` | `parseFrontmatter` re-export + semantics doc | ✓ VERIFIED | Lines 17-38, doc comment pins throw/return semantics |
| `extensions/pi-claude-marketplace/shared/notify.ts` | REASONS 35→37 | ✓ VERIFIED | Tail three: `malformed mcp`, `malformed skill`, `malformed command` |
| `extensions/pi-claude-marketplace/shared/notify-reasons.ts` | Both tokens in `FAILURE_REASONS` | ✓ VERIFIED | Lines ~110-121; `_ReasonsCoverageProof` compiles |
| `extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts` | NEW module, 5 exports | ✓ VERIFIED | `synthesizeUnparseableSkill`, `firstBodyParagraph`, `foldWhenToUse`, `truncate1536`, `setDescriptionScalar` all present |
| `extensions/pi-claude-marketplace/bridges/skills/stage.ts` | Gate 1 + gate 2 + augment arm | ✓ VERIFIED | Lines 247-288 |
| `extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts` | SKILL-03 name verification | ✓ VERIFIED | Lines 107-127 |
| `extensions/pi-claude-marketplace/bridges/commands/stage.ts` | Gate 1 + gate 2 + neutralize arm | ✓ VERIFIED | Lines 116-126, 191-219 |
| `extensions/pi-claude-marketplace/bridges/skills/types.ts` / `commands/types.ts` | `degraded` field | ✓ VERIFIED | Both files line ~65-66 |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | `frontmatterDegradations`, standalone tokens, `degradedKinds` seam | ✓ VERIFIED | Lines 231-234, 385-388, 884-946, 1684-1690, 1757-1853 |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts` | `PluginInstalledOutcome.degradedKinds` | ✓ VERIFIED | Line 107 |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` | propagation + redaction | ✓ VERIFIED | Lines 607-610, 1380-1397 |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` | token push + severity raise | ✓ VERIFIED | Lines 475-525 |
| Fixtures (`tests/bridges/_fixtures/...`) | unparseable/block-scalar/heading fixtures | ✓ VERIFIED | `skill-no-description`, `skill-block-scalar-description`, `skill-heading-codeblock-body`, `unparseable-skill-plugin`, `unparseable-command-plugin` all present on disk |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `platform/pi-api.ts` re-export | all gates | sole import site | ✓ WIRED | grep confirms only `platform/pi-api.ts` imports the peer symbol; all bridge files import from there |
| `REASONS` (notify.ts) | `FAILURE_REASONS` (notify-reasons.ts) | lockstep compile guard | ✓ WIRED | `_ReasonsCoverageProof` compiles (`npm run typecheck` green) |
| skills/stage.ts gate seam | degrade record | `result.degraded` | ✓ WIRED | Returned from `prepareStageSkills`, consumed by `install.ts:907` |
| commands/stage.ts gate seam | degrade record | `result.degraded` | ✓ WIRED | Returned from `prepareStageCommands`, consumed by `install.ts:946` |
| `installCtx.frontmatterDegradations` | standalone `reasons[]` + `postCommitWarnings` + `InstallPluginOutcome.degradedKinds` | install.ts surfacing site | ✓ WIRED | Lines 1684-1690 (detail), 1757-1768 (token), 1845-1853 (outcome seam) |
| `InstallPluginOutcome.degradedKinds` | `PluginInstalledOutcome.degradedKinds` | apply.ts propagation | ✓ WIRED | Lines 607-610 |
| `PluginInstalledOutcome.degradedKinds` | reconcile notify composer | `installedRowFromOutcome` | ✓ WIRED | notify.ts lines 483-525 |
| `postCommitWarnings` | `notifyDiagnostic` | `surfacePostCommitWarnings` + `redactAbsolutePaths` | ✓ WIRED | apply.ts lines 1380-1397 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Targeted phase test files (10 files) | `node --test "tests/bridges/skills/stage.test.ts" "tests/bridges/skills/rewrite-frontmatter.test.ts" "tests/bridges/skills/frontmatter-degrade.test.ts" "tests/bridges/commands/stage.test.ts" "tests/orchestrators/plugin/install.test.ts" "tests/orchestrators/reconcile/notify.test.ts" "tests/orchestrators/reconcile/apply.test.ts" "tests/platform/pi-api.test.ts" "tests/architecture/notify-closed-set-locks.test.ts" "tests/shared/notify-v2.test.ts"` | 385 pass / 0 fail | ✓ PASS |
| Typecheck (proves `_ReasonsCoverageProof` compiles at 37 entries) | `npm run typecheck` | clean, no TS2344 | ✓ PASS |
| Working tree clean (no uncommitted phase changes) | `git status --short` | empty | ✓ PASS |
| Debt-marker scan on all 11 touched source files | `grep -n -E "TBD|FIXME|XXX|TODO|HACK"` | no matches | ✓ PASS |

Full unit/integration suite reused from the authoritative test-state context supplied to this verification (not re-run): unit 3049/3050 pass (1 pre-existing platform skip); integration 16/18 pass (2 pre-existing, out-of-scope failures documented in `deferred-items.md`, reproduced against `HEAD~2` by the executor).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PARSE-01 | 86-02, 86-04 | Source parsed before rewrite/substitution, both seams | ✓ SATISFIED | `stage.ts:254` (skills), `commands/stage.ts:197` |
| PARSE-02 | 86-02, 86-04 | Staged bytes re-parsed; self-defect throws loudly | ✓ SATISFIED | `stage.ts:287`, `commands/stage.ts:219` |
| SKILL-01 | 86-02 | Unparseable skill synthesizes `disable-model-invocation` block | ✓ SATISFIED (code) / backstop truth flagged | `frontmatter-degrade.ts:46-55`; live-reload confirmation is human_needed |
| SKILL-02 | 86-01, 86-03 | First-paragraph fallback for description-less skill | ✓ SATISFIED | `frontmatter-degrade.ts:91-114`, `stage.ts:145-166` |
| SKILL-03 | 86-03 | Written name equals generated name, corruption-proof | ✓ SATISFIED | `rewrite-frontmatter.ts:107-127` |
| WTU-01 | 86-01, 86-03 | `when_to_use` folded into description | ✓ SATISFIED | `frontmatter-degrade.ts:122-128` |
| WTU-02 | 86-01, 86-03 | 1,536 truncation cap | ✓ SATISFIED (code) / backstop truth flagged | `frontmatter-degrade.ts:135-137`; live >1024-load confirmation is human_needed |
| CMD-01 | 86-04 | Unparseable command neutralized (strip whole block) | ✓ SATISFIED (code) / backstop truth flagged | `commands/stage.ts:116-126`; live-reload confirmation is human_needed |
| WARN-01 | 86-02, 86-05 | Degrade → warning row + `notifyDiagnostic` detail | ✓ SATISFIED | `install.ts:1757-1768`, `reconcile/notify.ts:483-525`, `apply.ts:1380-1397` |
| CLASS-01 | 86-01, 86-05 | Failure-class classification, byte-stable catalog | ✓ SATISFIED | `notify.ts` REASONS tail, `notify-reasons.ts` FAILURE_REASONS |
| NREG-01 | 86-02, 86-03, 86-04 | Byte-for-byte unchanged happy path | ✓ SATISFIED | `stage.test.ts` / `commands/stage.test.ts` NREG-01 cases (independent-literal-replacement assertions) |

No orphaned requirements: `.planning/REQUIREMENTS.md` lists exactly these 11 IDs against Phase 86, all mapped to a plan's `requirements:` frontmatter field.

### Anti-Patterns Found

None. Debt-marker scan (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`) across all 11 touched source files returned zero matches. No empty-implementation stubs, no hardcoded-empty-data patterns, no console.log-only handlers. The `placeholder`-named constants (`UNPARSEABLE_SKILL_DESCRIPTION`, `MISSING_DESCRIPTION_PLACEHOLDER`) are intentional, design-mandated fixed strings (D-86-02/A4, SKILL-02 empty-body fallback), not incomplete-work markers — both are documented in-code with their rationale and covered by unit tests.

### Human Verification Required

See the `human_verification` frontmatter block above (3 items). All three are pre-identified by the phase's own plans (`86-VALIDATION.md` Manual-Only Verifications table; `86-02-SUMMARY.md`/`86-04-SUMMARY.md` D5 rows marked `human_judgment: true`) as requiring a live Pi `/reload` session, not fabricated by this verification. Each has a code-level unit-test approximation that passes, but the actual runtime behavior (skill/command resolution after reload, non-auto-invocation, Pi's >1024 startup diagnostic) cannot be observed by `node:test`.

### Gaps Summary

No code-level gaps found. All 11 requirement IDs trace cleanly from PLAN frontmatter through REQUIREMENTS.md to implemented, tested, wired code across all 5 plans (01-05). Every must-have truth, artifact, and key link declared across the 5 PLAN.md files was independently verified against the current source (not the SUMMARY narrative) by reading the actual gate/wiring code and running the 10 relevant test files (385/385 pass). The only open item is the three backstop truths that require a live Pi `/reload` session to observe — these were correctly and honestly flagged by the executing plans themselves rather than silently claimed as passed, so this verification routes them to human_needed rather than fabricating a live-session result.

---

_Verified: 2026-07-26T14:42:35Z_
_Verifier: Claude (gsd-verifier)_
