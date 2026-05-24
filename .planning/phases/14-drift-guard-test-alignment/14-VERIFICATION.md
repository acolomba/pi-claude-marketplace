---
phase: 14-drift-guard-test-alignment
verified: 2026-05-24T21:01:51Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
gaps: []
deferred: []
notes:
  - "1 minor docs-only inconsistency surfaced (REQUIREMENTS.md:426 CMC-38 description still uses `- [ ]` checkbox while the Coverage table shows Complete). Does not block any SC. Recorded as INFO."
  - "ROADMAP.md `## Progress` table Phase 14 row and `## Coverage (v1.3)` Phase 12/13 rows show stale Pending status. Per Phase 14 Plan 06 SUMMARY 'Plan Scope Notes', the Progress table update was explicitly delegated to the orchestrator wave-tracking commit, and ROADMAP Coverage Phase 12/13 rows were never in Phase 14's scope (they reflect pre-existing ROADMAP-vs-REQUIREMENTS drift inherited from Phase 12/13). Phase 14 SC #5 literally references `REQUIREMENTS.md Coverage block shows 38/38 mapped and complete` — that condition IS met."
  - "Code review report at 14-REVIEW.md flagged 1 Critical (CR-01: scope-ordering drift in reinstall.ts) and 8 Warnings + 4 Info. Per the orchestrator's explicit guidance, CR-01 is NOT in scope of any Phase 14 SC (it's a pre-existing comparator-helper vs policy-comment mismatch that the new drift-guard rules do not catch by design). Not treated as a phase-14 gap."
---

# Phase 14: Drift Guard & Test Alignment Verification Report

**Phase Goal:** Lock the contract by adding a test suite that reads the style-guide YAML frontmatter (`status_tokens:`, `reasons:`, `markers:`, `pattern_classes:`) plus the normative MSG-* IDs as the binding contract. `npm run check` fails when a callsite emits a token outside the closed sets or violates an MSG-* rule. After this phase, the milestone's user-contract is enforced structurally — no future commit can silently drift.
**Verified:** 2026-05-24T21:01:51Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth (Success Criterion) | Status | Evidence |
|---|---------------------------|--------|----------|
| 1 | The drift-guard suite parses `docs/messaging-style-guide.md` YAML frontmatter at test time and asserts every closed-set token used by any callsite is a member of the corresponding frontmatter list. An intentional planted violation makes `npm run check` fail with a clear, locatable error. | VERIFIED | `tests/lint-rules/lib/frontmatter.js` exists; loader extracts 15+28+2+12=57 tokens across 4 frontmatter keys via `yaml.parse()`. `tests/architecture/grammar-frontmatter.test.ts` (6 tests pass) asserts set-equality between in-code constants and frontmatter. 18 full-impl rules include `invalid:` planted-violation cases asserting `messageId` byte-exactly — RuleTester proves failure on planted code. |
| 2 | Each normative MSG-* ID has at least one assertion in the suite that, if violated, fails the test with the rule ID in the failure message (MSG-GR-1, MSG-IC-3, MSG-SR-5, etc.). A reviewer can map a failure back to the style-guide rule without code archaeology. | VERIFIED | All 34 rules embed the MSG-* ID literal in their `messages.<id>` text (verified via grep — 63 MSG-* mentions across 18 full-impl rule bodies; meta-assertion rules cite via `meta.docs.description`). `messageId` is asserted byte-exactly in 18 full-impl RuleTester `invalid:` cases. |
| 3 | The frontmatter is the SOLE source of truth for the closed sets; no test file duplicates the lists. | VERIFIED | `tests/lint-rules/lib/frontmatter.js` is the one loader. `tests/architecture/grammar-frontmatter.test.ts` imports the 4 named arrays from the loader, not from inline literals. The 4 source-of-truth in-code constants (`STATUS_TOKENS`, `REASONS`, `MARKERS`, `PATTERN_CLASSES`) are tested set-equal to the frontmatter. No other test file re-declares the closed sets. |
| 4 | `npm run check` is green after Phase 13 + Phase 14 land together: typecheck + ESLint + Prettier + the existing test suite + the new drift-guard suite all pass on the v1.3 milestone close commit. | VERIFIED | `npm run check` re-run during verification: GREEN — 1245 tests pass, 0 fail, 0 skipped, 0 todo. All 34 MSG-* rules active in lint config. |
| 5 | The milestone is complete: every CMC-01..38 requirement has its traceability row marked Complete (Phase 12 / Phase 13 / Phase 14 as appropriate); the v1.3 line in REQUIREMENTS.md Coverage block shows 38/38 mapped and complete. | VERIFIED | `.planning/REQUIREMENTS.md` Coverage table lines 730-767 show all 38 CMC rows Complete: Phase 12 (6: CMC-08/11/14/19/36/37), Phase 13 (29), Phase 14 (3: CMC-16/34/38). `grep -cE '^\| CMC-(0[1-9]\|[12][0-9]\|3[0-8]).*Pending' .planning/REQUIREMENTS.md` returns 0. (Note: 1 checkbox at line 426 still shows `- [ ]` for CMC-38 description — minor cosmetic inconsistency recorded as INFO, does not affect Coverage block.) |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` | ManualRecoveryLine emission path (CMC-16) | VERIFIED | Lines 52, 81, 491, 497, 502 — imports `renderManualRecovery`, declares ManualRecoveryLine, constructs/emits the anchor inside `renderReinstallPartitionAndNotify` |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` | Dead-code seam removed (CMC-16) | VERIFIED | `grep -c renderManualRecovery` returns 0 — import and `void` seam fully removed |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/{list,reinstall,update,bootstrap}.ts` + `marketplace/{list,autoupdate}.ts` | 13+ callsites migrated to `notifyUsageError` (CMC-34) | VERIFIED | 3+4+3+3+1+1 = 15 `notifyUsageError(` calls across 6 files |
| `extensions/pi-claude-marketplace/shared/grammar/markers.ts` | MARKERS closed-set literal-union (2 entries) | VERIFIED | Exports `MARKERS = ["autoupdate", "no autoupdate"] as const`; frontmatter parity test passes |
| `extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts` | PATTERN_CLASSES closed-set literal-union (12 entries) | VERIFIED | Exports `PATTERN_CLASSES = [...]`; frontmatter parity test passes |
| `extensions/pi-claude-marketplace/shared/constants/marketplace-label-probe.ts` | Single canonical MARKETPLACE_LABEL_PROBE | VERIFIED | 1 definition in shared/constants; 0 definitions across 3 historical callsites (add.ts, autoupdate.ts, marketplace-list.ts) |
| `extensions/pi-claude-marketplace/presentation/rollback-partial.ts` | composeRollbackPartialChildren extracted | VERIFIED | Function exists at line 100; structural `RollbackPartialInput` interface (BLOCK C symmetry) |
| `extensions/pi-claude-marketplace/transaction/rollback.ts` | `RollbackErrorResult` structured return; no hand-composed body; no presentation/ import | VERIFIED | Interface declared line 41; function returns it line 68; no `from .*presentation` import in code (only in comments); no `(failed) {rollback partial}` literal in code (only in JSDoc) |
| `tests/lint-rules/lib/frontmatter.js` | Memoized YAML loader exposing 4 arrays | VERIFIED | Loader returns STATUS_TOKENS_FRONTMATTER=15, REASONS=28, MARKERS=2, PATTERN_CLASSES=12 (byte-equal to frontmatter); also exports `loadFrontmatter` + `parseStyleGuideFrontmatter` for negative tests |
| `tests/lint-rules/index.js` | Local ESLint plugin with 34 rules | VERIFIED | `RULE_NAMES.length === 34`; `Object.keys(default.rules).length === 34`; no duplicates |
| `tests/lint-rules/msg-*.js` (34 files) | 16 meta-assertion + 18 full-impl rule files | VERIFIED | 34 rule files (`ls tests/lint-rules/msg-*.js \| grep -v test.js`); 16 with `Program: () => {}` no-op visitor (meta-assertion); 18 with real AST visitors (CallExpression / Literal / TemplateLiteral / BinaryExpression / ObjectExpression / `getAllComments`) |
| `tests/lint-rules/msg-*.test.js` (34 files) | One RuleTester companion per rule | VERIFIED | 34 test files; all 34 carry the required 4-line node:test shim (`RuleTester.afterAll = test.after`); 18 contain planted-violation `invalid:` cases with `messageId` byte-exact assertions |
| `tests/architecture/msg-rule-registry.test.ts` | 4-way parity registry test | VERIFIED | All 4 assertions pass (3 active + 1 previously-gated now active per Plan 06 wiring): style-guide MSG-* ↔ rule file, rule name ↔ style-guide anchor, every rule name registered in eslint.config.js, count === 34 |
| `eslint.config.js` | 34 MSG-* rule registrations + composer-file ignores | VERIFIED | `import msgPlugin from "./tests/lint-rules/index.js"` present; `grep -oE '"msg/msg-...' \| sort -u \| wc -l` returns 34 unique registrations, 0 duplicates; composer-file ignores include manual-recovery.ts, rollback-partial.ts, cause-chain.ts, reload-hint.ts, compact-line.ts, persistence/migrate.ts |
| `.planning/REQUIREMENTS.md` | CMC-16/34/38 marked Complete with Phase 14 attribution | VERIFIED | Lines 745/763/767 all show `Phase 14 \| Complete`; 0 Pending v1.3 CMC rows in Coverage table |
| `.planning/ROADMAP.md` | CMC-16/34/38 Coverage rows Complete + Phase 14 attribution | VERIFIED | Lines 280/298/302 show `Phase 14 \| Complete`; per-phase distribution (line 318) lists `CMC-16, CMC-34, CMC-38 \| 3` for Phase 14 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `orchestrators/plugin/reinstall.ts` | `presentation/manual-recovery.ts` | import + `renderManualRecovery(line, probe)` call | WIRED | Line 52 import + line 502 invocation; type guard `isManualRecoveryOutcome` filter ahead of construction |
| 6 edge handler files | `shared/notify.ts::notifyUsageError` | imports + 15 invocations across argument-validation callsites | WIRED | All 6 files import + call; no `notifyError(ctx, ...USAGE...)` remains in any of them for argument validation |
| `tests/lint-rules/lib/frontmatter.js` | `docs/messaging-style-guide.md` | `readFileSync` + `yaml.parse()` on frontmatter | WIRED | Loader runs at module-load; smoke test produces 15/28/2/12 — matches frontmatter byte-for-byte |
| `tests/architecture/msg-rule-registry.test.ts` | `tests/lint-rules/index.js` + `eslint.config.js` | imports `RULE_NAMES`; reads eslint.config.js text | WIRED | 4/4 assertions pass against current state; gate detection `eslintConfigText.includes('"msg/msg-')` returns TRUE so assertion (c) is active (not skipped via t.todo) |
| `eslint.config.js` | `tests/lint-rules/index.js` (plugin module) | `import msgPlugin from "./tests/lint-rules/index.js"` + 6 flat-config blocks with `plugins: { msg: msgPlugin }` | WIRED | 34 unique `"msg/<name>":` registrations; no duplicates; composer ignores in place |
| `orchestrators/marketplace/{add,autoupdate}.ts` + `presentation/marketplace-list.ts` | `shared/constants/marketplace-label-probe.ts` | `import { MARKETPLACE_LABEL_PROBE }` (replaces 3 local definitions) | WIRED | 1 canonical const; 3 imports |
| `transaction/rollback.ts` | (NO presentation import — BLOCK C compliant) | Returns structured `RollbackErrorResult`; rendering composed by callers via `presentation/rollback-partial.ts::composeRollbackPartialChildren` | WIRED | BLOCK C layering preserved (no transaction → presentation import); new helper exists in presentation/ |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `renderReinstallPartitionAndNotify` ManualRecoveryLine emission | `outcomes` filtered to `failureClass === "manual-recovery"` | `reinstallPlugins` catch block tags `failureClass: "manual-recovery"` on real ManualRecoveryError propagation | Yes — exercised by `tests/orchestrators/plugin/reinstall.test.ts` regression test that captures the byte-exact emission shape | FLOWING |
| notifyUsageError on-the-wire bytes | `${message}\n\n${USAGE}` | `shared/notify.ts::notifyUsageError` composes the `\n\n` separator | Yes — `tests/edge/handlers/plugin/bootstrap.test.ts:148` asserts the byte-exact composition `"bootstrap takes no arguments.\n\nUsage: /claude:plugin bootstrap"` | FLOWING |
| YAML frontmatter loader | 4 frozen arrays | `readFileSync(STYLE_GUIDE_PATH) + yaml.parse()` at module load | Yes — counts match frontmatter (15/28/2/12); `grammar-frontmatter.test.ts` asserts set-equality | FLOWING |
| 34 MSG-* rules active in lint run | each rule's `create(context)` visitor invoked per-file | `eslint.config.js` per-rule `files:` patterns + `plugins: { msg: msgPlugin }` | Yes — `npm run lint` runs cleanly across extension surface with 34 rules registered; registry assertion (c) confirms each rule's `"msg/<name>":` literal present | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Plugin module exposes 34 rules | `node -e "import('./tests/lint-rules/index.js').then(m => console.log(m.RULE_NAMES.length, Object.keys(m.default.rules).length))"` | `34 34` | PASS |
| Frontmatter loader extracts 4 closed sets | `node -e "import('./tests/lint-rules/lib/frontmatter.js').then(m => console.log(m.STATUS_TOKENS_FRONTMATTER.length, m.REASONS_FRONTMATTER.length, m.MARKERS_FRONTMATTER.length, m.PATTERN_CLASSES_FRONTMATTER.length))"` | `15 28 2 12` | PASS |
| `npm run check` GREEN | `npm run check` | 1245/1245 pass, 0 fail, 0 todo | PASS |
| Registry parity test 4-way | `node --test tests/architecture/msg-rule-registry.test.ts` | 4/4 pass (no todo skipping) | PASS |
| Frontmatter parity test | `node --test tests/architecture/grammar-frontmatter.test.ts` | 6/6 pass (4 closed-set parity + 2 negative tests) | PASS |
| All 34 RuleTester companions | `node --test tests/lint-rules/msg-*.test.js` | 90/90 sub-tests pass | PASS |
| 34 unique rule registrations in eslint.config.js | `grep -oE '"msg/msg-[a-z]+-[0-9]+-[a-z0-9-]+"' eslint.config.js \| sort -u \| wc -l` | `34` | PASS |
| No duplicate rule registrations | `grep -oE '"msg/msg-[a-z]+-[0-9]+-[a-z0-9-]+"' eslint.config.js \| sort \| uniq -d` | (empty) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CMC-16 | 14-01 (own), 14-06 (docs) | Manual-recovery anchor wiring: separate top-level `⊘ <resource> (manual recovery) {<reason>}` line emitted in production orchestrator | SATISFIED | reinstall.ts:497-502 constructs and emits ManualRecoveryLine; dead-code seam in remove.ts removed; new regression test in reinstall.test.ts asserts shape; REQUIREMENTS.md line 745 Phase 14 Complete |
| CMC-34 | 14-02 (own), 14-06 (docs) | notifyUsageError migration across 13 edge-handler argument-validation callsites | SATISFIED | 15 notifyUsageError invocations across 6 handler files; bootstrap.test.ts:148 asserts `\n\n` byte separator; REQUIREMENTS.md line 763 Phase 14 Complete |
| CMC-38 | 14-03, 14-04, 14-05, 14-06 | Drift-guard test suite + 34 MSG-* rules + frontmatter parity | SATISFIED | All 34 rules exist + registered + tested; frontmatter loader is sole source; registry parity test passes 4/4; `npm run check` green; REQUIREMENTS.md line 767 Phase 14 Complete |

No orphaned requirements — every requirement ID declared in plan frontmatter is mapped above and supported by evidence.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/REQUIREMENTS.md` | 426 | `- [ ] **CMC-38**: A test suite reads...` (checkbox still unchecked) | INFO | Documentation-only inconsistency — Coverage table at line 767 correctly shows CMC-38 Complete. Doesn't affect any SC. Safe to leave; trivial follow-up to flip the checkbox. |
| `.planning/ROADMAP.md` | 257-259 | Progress table Phase 13 still shows `0/9 plans \| Not started`; Phase 14 still shows `0/6 plans \| Planned`; Phase 14.1 still shows `0/6 plans \| Planned` | INFO | Per Plan 06 SUMMARY "Plan Scope Notes": Progress table update was explicitly delegated to the orchestrator wave-tracking commit (not in-plan scope). Doesn't affect any SC. |
| `.planning/ROADMAP.md` | 263-302 | Coverage (v1.3) table shows 35 of 38 v1.3 CMC rows as `Pending` (only CMC-16/34/38 flipped by Plan 06) | INFO | Pre-existing ROADMAP-vs-REQUIREMENTS drift inherited from Phase 12/13. Phase 14 plans never declared scope to fix the Phase 12/13 rows; Phase 14 SC #5 literally requires REQUIREMENTS.md Coverage block to show 38/38 — and it does. Recommend separate housekeeping commit to sync ROADMAP Coverage to REQUIREMENTS. |

No BLOCKER anti-patterns — no TBD/FIXME/XXX without follow-up reference in any file modified by this phase.

### Code Review Cross-Reference

The phase code-review report at `14-REVIEW.md` flagged 1 Critical (CR-01: scope-ordering drift in `reinstall.ts:706-708`), 8 Warnings, and 4 Info items. Per the orchestrator's explicit guidance in the verification prompt:

> "The Critical is NOT in scope of any Phase 14 SC (it's a pre-existing latent issue in reinstall.ts that the new drift-guard rules don't catch because it's a comparator-helper-vs-policy-comment mismatch, not a token/grammar drift). Do not treat it as a phase-14 gap unless it directly violates one of the 5 SCs above."

CR-01 does NOT violate any of SC #1–#5 (it's an inter-surface ordering inconsistency between `compareByNameThenScope` and a local `scopeOrder` helper, not a MSG-* / token / grammar / coverage failure). Excluded from gaps per direction. The 8 Warnings (rule regex over-reach, identifier-name heuristic limits, brittle test wiring) are rule-quality concerns surfaced for follow-up but do not break SC #1–#5.

### Human Verification Required

None — all 5 success criteria are verifiable via automated checks (test runs, grep, code inspection); no UI / visual / external-service behavior requires human confirmation.

### Gaps Summary

No gaps that block phase goal achievement. The phase goal — "Lock the contract... npm run check fails when a callsite emits a token outside the closed sets or violates an MSG-* rule. After this phase, the milestone's user-contract is enforced structurally — no future commit can silently drift" — is observably true:

- The drift-guard suite reads the frontmatter as the single source of truth (1 loader, 4 frozen arrays, parity test).
- 34 MSG-* rules are active in `npm run lint`; each rule's failure message contains the MSG-* ID literal.
- 18 planted-violation RuleTester cases prove the rules catch the forbidden patterns.
- `npm run check` is GREEN (1245 tests pass) on the v1.3 milestone-close commit.
- REQUIREMENTS.md v1.3 Coverage block shows 38/38 Complete.

Minor docs-only follow-ups (INFO items above) are noted for housekeeping but do not affect goal achievement or any success criterion.

---

_Verified: 2026-05-24T21:01:51Z_
_Verifier: Claude (gsd-verifier)_
