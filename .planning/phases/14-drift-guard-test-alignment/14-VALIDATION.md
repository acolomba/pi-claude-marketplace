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

> Populated by gsd-planner 2026-05-24. Each row tracks a non-trivial task across the 6 plans of Phase 14.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-T1 | 01 (CMC-16 closure) | 1 | CMC-16 | T-14-01, T-14-02 | renderManualRecovery is wired into renderReinstallPartitionAndNotify; ManualRecoveryLine emits as a separate top-level line with `\n\n` separator above cascade body | integration + lint | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ✅ existing | ⬜ pending |
| 14-01-T2 | 01 | 1 | CMC-16 | T-14-02 | Dead-code `void renderManualRecovery;` seam removed from orchestrators/marketplace/remove.ts | grep | `grep -c 'void renderManualRecovery' extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` returns 0 | ✅ existing | ⬜ pending |
| 14-01-T3 | 01 | 1 | CMC-16 | T-14-01 | reinstall.test.ts asserts the new anchor line emission path on manual-recovery outcomes | unit | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ✅ existing | ⬜ pending |
| 14-02-T1 | 02 (CMC-34 closure) | 2 | CMC-34 | T-14-04 | parseCommandArgs onError callback contract verified; router.test.ts byte-shape audited and updated if needed | grep + unit | `grep -rn '\\nUsage:' tests/edge/` empty OR `node --test tests/edge/router.test.ts` passes | ✅ existing | ⬜ pending |
| 14-02-T2 | 02 | 2 | CMC-34 | T-14-03 | 4 plugin-handler files (list, reinstall, update, bootstrap) migrate 13 callsites from notifyError to notifyUsageError; no trailing-\n in message strings (Pitfall 4) | integration + lint | `grep -c 'notifyUsageError(' edge/handlers/plugin/{list,reinstall,update,bootstrap}.ts >= 13 total` | ❌ scope | ⬜ pending |
| 14-02-T3 | 02 | 2 | CMC-34 | T-14-03 | 2 marketplace-handler files (list, autoupdate) migrate to notifyUsageError; npm run check green | integration + lint | `npm run check` | ❌ scope | ⬜ pending |
| 14-03-T1 | 03 (Wave 3a infrastructure) | 3 | CMC-38 | T-14-SC | rule-tester + yaml devDeps installed; test glob extended; eslint typecheck-disable override for tests/lint-rules/ added | dep + config | `node -e "const p=require('./package.json'); console.log(p.devDependencies['@typescript-eslint/rule-tester'], p.devDependencies['yaml']);"` shows both | ❌ W0 | ⬜ pending |
| 14-03-T2 | 03 | 3 | CMC-38 | T-14-05 | frontmatter.js loader exists; exports 4 named arrays (15/28/2/12 entries); plugin shell index.js exists with empty RULE_NAMES | unit | `node -e "import('./tests/lint-rules/lib/frontmatter.js').then(m => console.log(m.STATUS_TOKENS_FRONTMATTER.length, m.REASONS_FRONTMATTER.length, m.MARKERS_FRONTMATTER.length, m.PATTERN_CLASSES_FRONTMATTER.length))"` shows 15 28 2 12 | ❌ W0 | ⬜ pending |
| 14-03-T3 | 03 | 3 | CMC-38 | -- | shared/grammar/markers.ts (2 entries) + shared/grammar/pattern-classes.ts (12 entries) exist with as-const literal-union shape | unit (typecheck) | `npm run typecheck` passes | ❌ W0 | ⬜ pending |
| 14-03-T4 | 03 | 3 | CMC-38 | -- | grammar-frontmatter.test.ts migrated to shared loader; extended to 4-key set-equality (STATUS_TOKENS, REASONS, MARKERS, PATTERN_CLASSES) | unit | `node --test tests/architecture/grammar-frontmatter.test.ts` passes | ✅ migrating | ⬜ pending |
| 14-03-T5 | 03 | 3 | CMC-38 (D-14-05 WARNING) | -- | MARKETPLACE_LABEL_PROBE deduped to shared/constants/marketplace-label-probe.ts; 3 historical definitions replaced with imports | grep | `grep -rc 'const MARKETPLACE_LABEL_PROBE' extensions/` reports exactly 1 file | ❌ W0 | ⬜ pending |
| 14-04-T1 | 04 (Meta-assertion rules) | 3 | CMC-38 | -- | 16 (or 19) meta-assertion rule files exist; each has no-op Program visitor + structurallyEnforced messageId citing structural enforcement | lint + grep | `grep -l 'Program: () => {}' tests/lint-rules/msg-*.js \| grep -v '.test.js' \| wc -l` returns 16+ | ❌ W0 | ⬜ pending |
| 14-04-T2 | 04 | 3 | CMC-38 | T-14-06 | 16+ RuleTester companions exist with 4-line node:test shim + smoke `valid:` cases (no `invalid:` cases for meta-assertion); all pass | unit (RuleTester) | `node --test tests/lint-rules/msg-{gr,ic,sd-3,pl,er}-*.test.js` passes | ❌ W0 | ⬜ pending |
| 14-04-T3 | 04 | 3 | CMC-38 | -- | tests/lint-rules/index.js RULE_NAMES + rules populated with 16+ meta-assertion entries | unit | `node -e "import('./tests/lint-rules/index.js').then(m => console.log(m.RULE_NAMES.length))"` shows 16+ | ❌ W0 | ⬜ pending |
| 14-05-T1 | 05 (Full-impl rules + registry) | 3 | CMC-38 | T-14-07 | 15 (or 18) full-impl rule files exist with real AST visitors + MSG-* ID literal embedded in messages | lint + grep | `grep -l 'MSG-SR-' tests/lint-rules/msg-sr-*.js \| grep -v '.test.js' \| wc -l` returns 7; similar for MR/RP/CC/NC/RH/LC/SD families | ❌ W0 | ⬜ pending |
| 14-05-T2 | 05 | 3 | CMC-38 | T-14-07 | 15+ RuleTester companions with ≥1 `invalid:` planted-violation case per rule asserting messageId byte-exactly | unit (RuleTester) | `node --test tests/lint-rules/msg-{sr,mr,rp,cc,nc,rh,lc,sd-{1,2}}-*.test.js` passes | ❌ W0 | ⬜ pending |
| 14-05-T3 | 05 | 3 | CMC-38 | T-14-08 | index.js completed (RULE_NAMES.length === 34); msg-rule-registry.test.ts authored with 4 assertions per D-14-12 (assertion (c) may fail until Plan 06 lands -- Option A) | architecture | `node --test tests/architecture/msg-rule-registry.test.ts` (Option A: 3 of 4 pass; Option B: all 4 pass -- see Plan 05 Task 3 acceptance) | ❌ W0 | ⬜ pending |
| 14-06-T1 | 06 (WARNING closures + eslint wiring) | 3 | CMC-38 (+ audit WARNING) | T-14-09 | transaction/rollback.ts refactored to return RollbackErrorResult; no presentation/ import (BLOCK C); hand-composed literal gone; orchestrators compose body via presentation/rollback-partial.ts; rollback.test.ts updated | unit + grep + integration | `grep -c '(failed) {rollback partial}' extensions/pi-claude-marketplace/transaction/rollback.ts` returns 0 AND `node --test tests/transaction/rollback.test.ts tests/architecture/catalog-uat.test.ts` passes | ❌ refactor | ⬜ pending |
| 14-06-T2 | 06 | 3 | CMC-38 | T-14-10 | All 34 MSG-* rules registered in eslint.config.js with per-rule files: + composer-file ignores; registry test assertion (c) passes | lint + architecture | `grep -oE '"msg/msg-[a-z]+-[0-9]+-[a-z0-9-]+"' eslint.config.js \| sort -u \| wc -l` returns 34 AND `node --test tests/architecture/msg-rule-registry.test.ts` all 4 pass AND `npm run check` GREEN (milestone close) | ❌ wiring | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Per-rule expansion:** Plan 04 (meta-assertion) and Plan 05 (full-impl) each ship one rule file + one RuleTester companion per MSG-* ID. Above row 14-04-T1 / 14-05-T1 are wave-level aggregate rows; per-rule status tracking happens at execution time inside each plan's SUMMARY.md.

---

## Wave 0 Requirements

- [ ] Promote `yaml` (currently transitive `^2.x`) to a direct `devDependencies` entry in `package.json` (Plan 03 Task 1)
- [ ] Add `@typescript-eslint/rule-tester` as a direct `devDependencies` entry (Plan 03 Task 1)
- [ ] Extend `package.json:test` script glob to include `tests/lint-rules/**/*.test.{js,ts}` (Plan 03 Task 1)
- [ ] Add typecheck-override block to `eslint.config.js` so `parserOptions.projectService` does not refuse the local plugin files under `tests/lint-rules/**/*.{js,ts}` (Plan 03 Task 1 / RESEARCH.md Pitfall 2)
- [ ] Create `tests/lint-rules/lib/frontmatter.js` (Plan 03 Task 2; shared memoized loader)
- [ ] Create `tests/lint-rules/index.js` (Plan 03 Task 2; plugin entry; populated by Plans 04+05)
- [ ] Create `extensions/pi-claude-marketplace/shared/grammar/markers.ts` (Plan 03 Task 3)
- [ ] Create `extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts` (Plan 03 Task 3)
- [ ] Migrate `tests/architecture/grammar-frontmatter.test.ts` to consume the shared loader and extend 2→4-key set-equality (Plan 03 Task 4)

*Wave 0 (infrastructure) lives inside Wave 3 as Plan 03 -- the loader + plugin entry + grammar extensions land before Plans 04, 05, 06 can author rules / wire eslint.config.js.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reviewer can map an `npm run check` failure back to a style-guide rule without code archaeology (SC #2) | CMC-38 SC #2 | Subjective reviewer experience -- automated test asserts the rule ID is in the message, but readability is human-judged | After Plan 06 completes, plant a violation in a test fixture (re-introduce `notifyError(ctx, msg + "\n" + USAGE)` in one of the 13 closed callsites -- e.g., a copy of `edge/handlers/plugin/list.ts:40` as a fixture file), run `npm run check`, confirm the failure output contains `MSG-SR-7` and the source file:line, and that a reviewer unfamiliar with Phase 14 can resolve the failure by reading the message alone. |
| Milestone close -- every CMC-01..38 row in REQUIREMENTS.md marked `Complete` and v1.3 Coverage shows 38/38 (SC #5) | CMC-38 SC #5 | Bulk doc edit verification | After Phase 14 lands green, open REQUIREMENTS.md, confirm each CMC row's Status column reads `Complete` (Phase 12/13/14/14.1 as appropriate per `.planning/ROADMAP.md` §Coverage), and the per-phase distribution table sums to 38. CMC-16 / CMC-34 / CMC-38 specifically must move from Pending to Complete with Phase 14 attribution. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (yaml dep promotion, rule-tester add, test glob extension, typecheck override, loader, plugin entry, two new grammar files, grammar-frontmatter.test.ts migration)
- [x] No watch-mode flags
- [x] Feedback latency < 35s
- [x] `nyquist_compliant: true` set in frontmatter after gsd-planner verifies coverage

**Approval:** approved (planning-time)
