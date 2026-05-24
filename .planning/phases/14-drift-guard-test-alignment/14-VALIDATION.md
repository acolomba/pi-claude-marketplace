---
phase: 14
slug: drift-guard-test-alignment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-24
---

# Phase 14 — Validation Strategy

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

> Populated by gsd-planner during plan-phase. Each plan's tasks reference this map's rows. Placeholder rows below reflect the wave breakdown from CONTEXT.md D-14-03.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-* | 01 (CMC-16 closure) | 1 | CMC-16 | — | ManualRecoveryLine emits as separate top-level line on ManualRecoveryError (MSG-MR-1..2 shape) | integration + lint | `npm run check` | ✅ existing | ⬜ pending |
| 14-02-* | 02 (CMC-34 closure) | 2 | CMC-34 | — | 6 edge handlers route usage errors via notifyUsageError (MSG-SR-7); router emits `\n\n` separator (MSG-NC-2) | integration + lint | `npm run check` | ✅ existing | ⬜ pending |
| 14-03-* | 03 (Wave 3 infrastructure: yaml dep + frontmatter loader + grammar-frontmatter.test.ts 2→4-key extension + markers.ts + pattern-classes.ts) | 3 | CMC-38 | — | Loader exposes 4 named exports; in-code literal-unions ↔ frontmatter set-equality for all 4 closed sets | unit + architecture | `node --test tests/architecture/grammar-frontmatter.test.ts tests/lint-rules/lib/` | ❌ W0 | ⬜ pending |
| 14-04-* | 04 (Meta-assertion MSG-* rules + RuleTester companions — 19 rules) | 3 | CMC-38 | — | Each rule file exists with metadata citing the style-guide section it cites for structural enforcement | unit (RuleTester) | `node --test tests/lint-rules/msg-*.test.js` | ❌ W0 | ⬜ pending |
| 14-05-* | 05 (Full-impl MSG-* rules + registry parity test — 15 rules + msg-rule-registry.test.ts) | 3 | CMC-38 | — | Per-rule RuleTester invalid case fails with MSG-* rule ID in message (SC #1, SC #2); registry asserts MSG-* IDs ↔ rule files ↔ eslint.config.js registration | unit (RuleTester) + architecture | `node --test tests/lint-rules/msg-*.test.js tests/architecture/msg-rule-registry.test.ts` | ❌ W0 | ⬜ pending |
| 14-06-* | 06 (WARNING closures: transaction/rollback.ts refactor + MARKETPLACE_LABEL_PROBE dedup + eslint.config.js wiring of 34 rules) | 3 | CMC-38 (+ audit WARNINGs) | — | rollback.ts emits through renderer (no hand-composed literal); single MARKETPLACE_LABEL_PROBE constant module; all 34 rules registered under per-rule `files:` patterns | lint + unit | `npm run check` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Per-rule expansion:** Plan 04 (meta-assertion) and Plan 05 (full-impl) expand to one task-row per MSG-* rule file + one task-row per `.test.js` companion. gsd-planner produces the per-rule expansion; this template reflects the wave-level shape.

---

## Wave 0 Requirements

- [ ] Promote `yaml` (currently transitive `^2.x`) to a direct `devDependencies` entry in `package.json`
- [ ] Add `@typescript-eslint/rule-tester` as a direct `devDependencies` entry (RESEARCH.md verified it is NOT currently installed; `@typescript-eslint/utils` IS)
- [ ] Extend `package.json:test` script glob to include `tests/lint-rules/**/*.test.{js,ts}` (research notes node:test brace-expansion gotcha — may need two globs)
- [ ] Add typecheck-override block to `eslint.config.js` so `parserOptions.projectService` does not refuse the local plugin files under `tests/lint-rules/**/*.{js,ts}` (RESEARCH.md Pitfall 2)
- [ ] Create `tests/lint-rules/lib/frontmatter.js` (shared memoized loader; exports `STATUS_TOKENS_FRONTMATTER`, `REASONS_FRONTMATTER`, `MARKERS_FRONTMATTER`, `PATTERN_CLASSES_FRONTMATTER`)
- [ ] Create `tests/lint-rules/lib/index.js` (plugin entry exporting all 34 rules + meta)
- [ ] Create `extensions/pi-claude-marketplace/shared/grammar/markers.ts` (or extend an existing grammar file — planner picks) with `MARKERS` `as const` literal-union
- [ ] Create `extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts` (or extend) with `PATTERN_CLASSES` `as const` literal-union
- [ ] Migrate `tests/architecture/grammar-frontmatter.test.ts` to consume the shared loader and extend 2→4-key set-equality

*Wave 0 (infrastructure) is internal to Wave 3 — the loader + plugin entry + grammar extensions must land before any rule file can be authored. The planner can order this as the first plan in Wave 3 (Plan 03).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reviewer can map an `npm run check` failure back to a style-guide rule without code archaeology (SC #2) | CMC-38 SC #2 | Subjective reviewer experience — automated test asserts the rule ID is in the message, but readability is human-judged | After Wave 3 completes, plant a violation in a test fixture (re-introduce `notifyError` in one of the 13 closed callsites), run `npm run check`, confirm the failure output contains `MSG-SR-7` (or appropriate rule ID) and the source file:line, and that a reviewer unfamiliar with Phase 14 can resolve the failure by reading the message alone. |
| Milestone close — every CMC-01..38 row in REQUIREMENTS.md marked `Complete` and v1.3 Coverage shows 38/38 (SC #5) | CMC-38 SC #5 | Bulk doc edit verification | After Phase 14 lands green, open REQUIREMENTS.md, confirm each CMC row's Status column reads `Complete` (Phase 12/13/14/14.1 as appropriate per `.planning/ROADMAP.md` §Coverage), and the per-phase distribution table sums to 38. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (yaml dep promotion, rule-tester add, test glob extension, typecheck override, loader, plugin entry, two new grammar files, grammar-frontmatter.test.ts migration)
- [ ] No watch-mode flags
- [ ] Feedback latency < 35s
- [ ] `nyquist_compliant: true` set in frontmatter after gsd-planner verifies coverage

**Approval:** pending
