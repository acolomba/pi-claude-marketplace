---
phase: 14
slug: drift-guard-test-alignment
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-24
last_updated: 2026-05-24
---

# Phase 14 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in Node 22+ runner) + ESLint v10 `RuleTester` (via `@typescript-eslint/rule-tester`) |
| **Config file** | `package.json:test` script glob; `eslint.config.js` flat config |
| **Quick run command** | `npm test -- --test-name-pattern="msg-"` (for drift-guard tests during execution) |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + tests) |
| **Estimated runtime** | ~25-35 seconds full; ~3-5 seconds quick |

---

## Sampling Rate

- **After every task commit:** Run `npm run check` (the milestone gate is `npm run check`-green; every wave must keep it green per NFR-6 + D-14-03)
- **After every plan wave:** `npm run check` MUST be green. Wave 1 / Wave 2 do not depend on drift-guard infrastructure; Wave 3 introduces it.
- **Before `/gsd:verify-work`:** `npm run check` must be green AND every CMC-01..38 row in REQUIREMENTS.md is marked `Complete` (SC #5)
- **Max feedback latency:** ~35 seconds

---

## Per-Task Verification Map

> Populated by gsd-planner 2026-05-24; revised 2026-05-24 to reflect locked 16+18=34 split + Plan 06 Task 3 (REQUIREMENTS.md/ROADMAP.md updates per BLOCKER-2 resolution).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-T1 | 01 (CMC-16 closure) | 1 | CMC-16 | T-14-01, T-14-02 | renderManualRecovery is wired into renderReinstallPartitionAndNotify; ManualRecoveryLine emits as a separate top-level line with `\n\n` separator above cascade body | integration + lint | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ✅ existing | ⬜ pending |
| 14-01-T2 | 01 | 1 | CMC-16 | T-14-02 | Dead-code `void renderManualRecovery;` seam removed from orchestrators/marketplace/remove.ts | grep | `grep -c 'void renderManualRecovery' extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` returns 0 | ✅ existing | ⬜ pending |
| 14-01-T3 | 01 | 1 | CMC-16 | T-14-01 | reinstall.test.ts asserts the new anchor line emission path on manual-recovery outcomes | unit | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ✅ existing | ⬜ pending |
| 14-02-T1 | 02 (CMC-34 closure) | 2 | CMC-34 | T-14-04 | Case A pinned at planning time (args-schema.ts:71-84 -- callback receives plain string); router.test.ts byte-shape audited and updated if needed | grep + unit | `grep -rn '\\nUsage:' tests/edge/` empty OR `node --test tests/edge/router.test.ts` passes; `git diff --stat extensions/pi-claude-marketplace/edge/args-schema.ts` empty | ✅ existing | ⬜ pending |
| 14-02-T2 | 02 | 2 | CMC-34 | T-14-03 | 4 plugin-handler files (list, reinstall, update, bootstrap) migrate 13 callsites from notifyError to notifyUsageError; no trailing-\n in message strings (Pitfall 4) | integration + lint | `grep -c 'notifyUsageError(' edge/handlers/plugin/{list,reinstall,update,bootstrap}.ts >= 13 total` | ❌ scope | ⬜ pending |
| 14-02-T3 | 02 | 2 | CMC-34 | T-14-03 | 2 marketplace-handler files (list, autoupdate) migrate to notifyUsageError per Case A; args-schema.ts unchanged; npm run check green | integration + lint | `npm run check` AND `git diff --stat extensions/pi-claude-marketplace/edge/args-schema.ts` empty | ❌ scope | ⬜ pending |
| 14-03-T1 | 03 (Wave 3a infrastructure) | 3 | CMC-38 | T-14-SC | rule-tester + yaml devDeps installed; test glob extended; eslint typecheck-disable override for tests/lint-rules/ added | dep + config | `node -e "const p=require('./package.json'); console.log(p.devDependencies['@typescript-eslint/rule-tester'], p.devDependencies['yaml']);"` shows both | ❌ W0 | ⬜ pending |
| 14-03-T2 | 03 | 3 | CMC-38 | T-14-05 | frontmatter.js loader exists; exports 4 named arrays (15/28/2/12 entries); plugin shell index.js exists with empty RULE_NAMES | unit | `node -e "import('./tests/lint-rules/lib/frontmatter.js').then(m => console.log(m.STATUS_TOKENS_FRONTMATTER.length, m.REASONS_FRONTMATTER.length, m.MARKERS_FRONTMATTER.length, m.PATTERN_CLASSES_FRONTMATTER.length))"` shows 15 28 2 12 | ❌ W0 | ⬜ pending |
| 14-03-T3 | 03 | 3 | CMC-38 | -- | shared/grammar/markers.ts (2 entries) + shared/grammar/pattern-classes.ts (12 entries) exist with as-const literal-union shape | unit (typecheck) | `npm run typecheck` passes | ❌ W0 | ⬜ pending |
| 14-03-T4 | 03 | 3 | CMC-38 | -- | grammar-frontmatter.test.ts migrated to shared loader; extended to 4-key set-equality (STATUS_TOKENS, REASONS, MARKERS, PATTERN_CLASSES) | unit | `node --test tests/architecture/grammar-frontmatter.test.ts` passes | ✅ migrating | ⬜ pending |
| 14-03-T5 | 03 | 3 | CMC-38 (D-14-05 WARNING) | -- | MARKETPLACE_LABEL_PROBE deduped to shared/constants/marketplace-label-probe.ts; 3 historical definitions replaced with imports | grep | `grep -rc 'const MARKETPLACE_LABEL_PROBE' extensions/` reports exactly 1 file | ❌ W0 | ⬜ pending |
| 14-04-T1 | 04 (Meta-assertion rules) | 3 | CMC-38 | -- | Exactly 16 meta-assertion rule files exist; each has no-op Program visitor + structurallyEnforced messageId citing structural enforcement (MSG-GR-1..5, MSG-IC-1..3, MSG-SD-3, MSG-PL-1..6, MSG-ER-1) | lint + grep | `ls tests/lint-rules/msg-{gr,ic,sd-3,pl,er-1}-*.js \| grep -v '.test.js' \| wc -l` returns exactly 16 AND `grep -l 'Program: () => {}' tests/lint-rules/msg-*.js \| grep -v '.test.js' \| wc -l` returns 16 | ❌ W0 | ⬜ pending |
| 14-04-T2 | 04 | 3 | CMC-38 | T-14-06 | Exactly 16 RuleTester companions exist with 4-line node:test shim + smoke `valid:` cases (no `invalid:` cases for meta-assertion); all pass | unit (RuleTester) | `ls tests/lint-rules/msg-{gr,ic,sd-3,pl,er-1}-*.test.js \| wc -l` returns 16 AND `node --test tests/lint-rules/msg-{gr,ic,sd-3,pl,er-1}-*.test.js` passes | ❌ W0 | ⬜ pending |
| 14-04-T3 | 04 | 3 | CMC-38 | -- | tests/lint-rules/index.js RULE_NAMES + rules populated with exactly 16 meta-assertion entries | unit | `node -e "import('./tests/lint-rules/index.js').then(m => console.log(m.RULE_NAMES.length))"` shows 16 | ❌ W0 | ⬜ pending |
| 14-05-T1 | 05 (Full-impl rules + registry) | 3 | CMC-38 | T-14-07 | Exactly 18 full-impl rule files exist with real AST visitors + MSG-* ID literal embedded in messages (MSG-SR-1..7, MSG-MR-1..2, MSG-RP-1, MSG-CC-1, MSG-NC-1..2, MSG-RH-1, MSG-LC-1..2, MSG-SD-1..2); MSG-ER-1 is NOT in this plan | lint + grep | `ls tests/lint-rules/msg-{sr,mr,rp,cc,nc,rh,lc,sd-{1,2}}-*.js \| grep -v '.test.js' \| wc -l` returns exactly 18 AND `grep -l 'MSG-SR-' tests/lint-rules/msg-sr-*.js \| grep -v '.test.js' \| wc -l` returns 7 | ❌ W0 | ⬜ pending |
| 14-05-T2 | 05 | 3 | CMC-38 | T-14-07 | 18 RuleTester companions with ≥1 `invalid:` planted-violation case per rule asserting messageId byte-exactly | unit (RuleTester) | `node --test tests/lint-rules/msg-{sr,mr,rp,cc,nc,rh,lc,sd-{1,2}}-*.test.js` passes | ❌ W0 | ⬜ pending |
| 14-05-T3 | 05 | 3 | CMC-38 | T-14-08 | index.js completed (RULE_NAMES.length === 34); msg-rule-registry.test.ts authored with 4 assertions per D-14-12; assertion (c) GATED via t.todo() pending Plan 06 wiring (Option B mandated per D-14-03 + NFR-6; Option A forbidden) | architecture | `node --test tests/architecture/msg-rule-registry.test.ts` passes (assertions a/b/d active; c is todo) AND `npm run check` GREEN at the Plan 05 commit | ❌ W0 | ⬜ pending |
| 14-06-T1 | 06 (WARNING closures + eslint wiring + milestone-close docs) | 3 | CMC-38 (+ audit WARNING) | T-14-09 | transaction/rollback.ts refactored to return RollbackErrorResult; no presentation/ import (BLOCK C); hand-composed literal gone; orchestrators compose body via presentation/rollback-partial.ts; rollback.test.ts updated | unit + grep + integration | `grep -c '(failed) {rollback partial}' extensions/pi-claude-marketplace/transaction/rollback.ts` returns 0 AND `node --test tests/transaction/rollback.test.ts tests/architecture/catalog-uat.test.ts` passes | ❌ refactor | ⬜ pending |
| 14-06-T2 | 06 | 3 | CMC-38 | T-14-10 | All 34 MSG-* rules registered in eslint.config.js with per-rule files: + composer-file ignores; exactly 34 unique `"msg/<name>":` strings; no slug appears in two blocks; registry test assertion (c) gate flipped from t.todo to ACTIVE+PASSING | lint + architecture | `grep -oE '"msg/msg-[a-z]+-[0-9]+-[a-z0-9-]+"' eslint.config.js \| sort -u \| wc -l` returns exactly 34 AND `grep -oE '"msg/msg-[a-z]+-[0-9]+-[a-z0-9-]+"' eslint.config.js \| sort \| uniq -d` returns empty AND `node --test tests/architecture/msg-rule-registry.test.ts` all 4 assertions pass AND `npm run check` GREEN | ❌ wiring | ⬜ pending |
| 14-06-T3 | 06 | 3 | CMC-16 + CMC-34 + CMC-38 (SC #5) | T-14-12 | REQUIREMENTS.md + ROADMAP.md updated: CMC-16/CMC-34/CMC-38 reattributed to Phase 14 with Status=Complete; v1.3 Coverage shows 38/38; cross-file consistency confirmed | doc + grep | `grep -c "^\| CMC-(16\|34\|38).*Phase 14.*Complete" .planning/REQUIREMENTS.md` returns 3 AND `grep -c "^\| CMC-(16\|34\|38).*Phase 14.*Complete" .planning/ROADMAP.md` returns 3 AND `grep -cE "^\| CMC-(0[1-9]\|[12][0-9]\|3[0-8]).*Pending" .planning/{REQUIREMENTS,ROADMAP}.md` returns 0 in both | ❌ docs | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Per-rule expansion:** Plan 04 (meta-assertion) and Plan 05 (full-impl) each ship one rule file + one RuleTester companion per MSG-* ID. Above row 14-04-T1 / 14-05-T1 are wave-level aggregate rows; per-rule status tracking happens at execution time inside each plan's SUMMARY.md.

---

## Wave 0 Requirements

- [ ] Promote `yaml` (currently transitive `^2.x`) to a direct `devDependencies` entry in `package.json` (Plan 03 Task 1)
- [ ] Add `@typescript-eslint/rule-tester` as a direct `devDependencies` entry (Plan 03 Task 1)
- [ ] Extend `package.json:test` script glob to include `tests/lint-rules/**/*.test.{js,ts}` (Plan 03 Task 1)
- [ ] Add typecheck-override block to `eslint.config.js` so `parserOptions.projectService` does not refuse the local plugin files under `tests/lint-rules/**/*.{js,ts}` (Plan 03 Task 1 / RESEARCH.md Pitfall 2)
- [ ] Create `tests/lint-rules/lib/frontmatter.js` (Plan 03 Task 2; shared memoized loader)
- [ ] Create `tests/lint-rules/index.js` (Plan 03 Task 2; plugin entry; populated by Plans 04+05 to reach exactly 34 rules)
- [ ] Create `extensions/pi-claude-marketplace/shared/grammar/markers.ts` (Plan 03 Task 3)
- [ ] Create `extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts` (Plan 03 Task 3)
- [ ] Migrate `tests/architecture/grammar-frontmatter.test.ts` to consume the shared loader and extend 2→4-key set-equality (Plan 03 Task 4)

*Wave 0 (infrastructure) lives inside Wave 3 as Plan 03 -- the loader + plugin entry + grammar extensions land before Plans 04, 05, 06 can author rules / wire eslint.config.js.*

---

## Locked Counts (per RESEARCH.md Pattern 2 enumeration)

| Family | Plan 04 (meta) | Plan 05 (full-impl) | Source |
|--------|----------------|---------------------|--------|
| MSG-GR-1..5 | 5 | -- | RESEARCH.md Pattern 2 §meta |
| MSG-IC-1..3 | 3 | -- | RESEARCH.md Pattern 2 §meta |
| MSG-SD-3 | 1 | -- | RESEARCH.md Pattern 2 §meta |
| MSG-PL-1..6 | 6 | -- | RESEARCH.md Pattern 2 §meta |
| MSG-ER-1 | 1 | -- | RESEARCH.md Pattern 2 §meta |
| MSG-SR-1..7 | -- | 7 | RESEARCH.md Pattern 2 §full-impl |
| MSG-MR-1..2 | -- | 2 | RESEARCH.md Pattern 2 §full-impl |
| MSG-RP-1 | -- | 1 | RESEARCH.md Pattern 2 §full-impl |
| MSG-CC-1 | -- | 1 | RESEARCH.md Pattern 2 §full-impl |
| MSG-NC-1..2 | -- | 2 | RESEARCH.md Pattern 2 §full-impl |
| MSG-RH-1 | -- | 1 | RESEARCH.md Pattern 2 §full-impl |
| MSG-LC-1..2 | -- | 2 | RESEARCH.md Pattern 2 §full-impl |
| MSG-SD-1..2 | -- | 2 | RESEARCH.md Pattern 2 §full-impl |
| **Total** | **16** | **18** | **34** |

`msg-er-1-empty-token.js` is in Plan 04 ONLY (meta-assertion family). It must NOT appear in Plan 05's `files_modified`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reviewer can map an `npm run check` failure back to a style-guide rule without code archaeology (SC #2) | CMC-38 SC #2 | Subjective reviewer experience -- automated test asserts the rule ID is in the message, but readability is human-judged | After Plan 06 completes, plant a violation in a test fixture (re-introduce `notifyError(ctx, msg + "\n" + USAGE)` in one of the 13 closed callsites -- e.g., a copy of `edge/handlers/plugin/list.ts:40` as a fixture file), run `npm run check`, confirm the failure output contains `MSG-SR-7` and the source file:line, and that a reviewer unfamiliar with Phase 14 can resolve the failure by reading the message alone. |
| Milestone close -- every CMC-01..38 row in REQUIREMENTS.md marked `Complete` and v1.3 Coverage shows 38/38 (SC #5) | CMC-38 SC #5 | Bulk doc edit verification | Plan 06 Task 3 lands the bulk doc edit. Post-execution: open REQUIREMENTS.md, confirm each CMC row's Status column reads `Complete` (Phase 12/13/14/14.1 as appropriate per `.planning/ROADMAP.md` §Coverage), and the per-phase distribution table sums to 38. CMC-16 / CMC-34 / CMC-38 specifically must move from Pending to Complete with Phase 14 attribution. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (yaml dep promotion, rule-tester add, test glob extension, typecheck override, loader, plugin entry, two new grammar files, grammar-frontmatter.test.ts migration)
- [x] No watch-mode flags
- [x] Feedback latency < 35s
- [x] `nyquist_compliant: true` set in frontmatter after gsd-planner verifies coverage
- [x] Plan 06 Task 3 covers SC #5 (REQUIREMENTS.md + ROADMAP.md milestone-close doc edits)
- [x] Locked split (16 meta + 18 full-impl = 34) reflected in Task 14-04-T1 + Task 14-05-T1 grep counts

**Approval:** approved (planning-time, revised 2026-05-24 per checker feedback)
</content>
</invoke>