---
phase: 14-drift-guard-test-alignment
plan: 05
subsystem: testing
tags: [eslint, drift-guard, ast, ruletester, msg-rules, registry-parity]

# Dependency graph
requires:
  - phase: 14-drift-guard-test-alignment/03-drift-guard-infrastructure
    provides: "Shared frontmatter loader + empty-shell ESLint plugin module at tests/lint-rules/{lib,index.js}; package.json test glob extended to tests/lint-rules/**/*.test.{js,ts}; eslint.config.js overrides for tests/lint-rules tree"
  - phase: 14-drift-guard-test-alignment/04-meta-assertion-rules
    provides: "16 meta-assertion MSG-* rules (GR-1..5, IC-1..3, SD-3, PL-1..6, ER-1) registered in tests/lint-rules/index.js with RULE_NAMES length 16"
provides:
  - "18 full-impl MSG-* drift-guard rules with real AST visitors (CallExpression / Literal / TemplateLiteral / ObjectExpression / Program) detecting forbidden patterns the style guide §§5-12, §14.1 codify"
  - "18 RuleTester companion tests with planted-violation `invalid:` cases asserting messageId byte-exactly (SC #1 + SC #2)"
  - "Shared severity-class helper at tests/lint-rules/lib/sr-tokens.js classifying the 15 closed-set status tokens into SUCCESS / INFO / WARNING buckets per style-guide §10"
  - "Local ESLint plugin module at tests/lint-rules/index.js now registers all 34 MSG-* rules (16 meta + 18 full-impl) with RULE_NAMES length 34"
  - "Architecture registry parity test at tests/architecture/msg-rule-registry.test.ts with 4 assertions per D-14-12 -- (a)+(b)+(d) ACTIVE, (c) GATED via t.todo() until Plan 06 wires the plugin in eslint.config.js"
  - "TypeScript declaration shim tests/lint-rules/index.d.ts so tsc --noEmit resolves the RULE_NAMES import from the architecture registry test"
affects: ["14-06-eslint-config-wiring", "14-COMPLETE", "v1.3 milestone gate (CMC-38)"]

# Tech tracking
tech-stack:
  added: []  # No new package adds in this plan -- consumes @typescript-eslint/{utils,rule-tester} + yaml + node:test all installed by Plan 14-03
  patterns:
    - "Severity-classified detection helpers (lib/sr-tokens.js) shared across MSG-SR-1..3 rules so the 15-entry STATUS_TOKENS literal-union is pinned to ONE classification source"
    - "Recursive AST helper functions (sourceReferencesUsage, refersToCascade, refersToSuccessCascade) that walk Identifier / BinaryExpression / TemplateLiteral nodes uniformly -- pattern extends Pattern 1's `sourceReferencesUsage`"
    - "Gated architecture-test assertion via t.todo(): the test reports as PENDING (not FAILING) when a Plan-06-detection check is unmet, preserving 'every wave green' invariant per D-14-03"
    - "Allow-list extension for the no-legacy-markers static gate: drift-guard rule files and their planted-violation test cases MUST contain the forbidden literals as detection fixtures -- the rule body IS the gate's evidence"

key-files:
  created:
    - tests/lint-rules/lib/sr-tokens.js
    - tests/lint-rules/msg-sr-1-success-routing.js
    - tests/lint-rules/msg-sr-2-warning-routing.js
    - tests/lint-rules/msg-sr-3-error-routing.js
    - tests/lint-rules/msg-sr-4-cascade-success.js
    - tests/lint-rules/msg-sr-5-cascade-warning.js
    - tests/lint-rules/msg-sr-6-no-cascade-error.js
    - tests/lint-rules/msg-sr-7-usage-error-routing.js
    - tests/lint-rules/msg-mr-1-manual-recovery-anchor.js
    - tests/lint-rules/msg-mr-2-manual-recovery-system.js
    - tests/lint-rules/msg-rp-1-rollback-partial.js
    - tests/lint-rules/msg-cc-1-cause-chain.js
    - tests/lint-rules/msg-nc-1-entity-error.js
    - tests/lint-rules/msg-nc-2-usage-separator.js
    - tests/lint-rules/msg-rh-1-reload-hint.js
    - tests/lint-rules/msg-lc-1-console-warn-form.js
    - tests/lint-rules/msg-lc-2-eslint-discipline.js
    - tests/lint-rules/msg-sd-1-soft-dep-reason.js
    - tests/lint-rules/msg-sd-2-soft-dep-predicate.js
    - tests/lint-rules/msg-sr-1-success-routing.test.js
    - tests/lint-rules/msg-sr-2-warning-routing.test.js
    - tests/lint-rules/msg-sr-3-error-routing.test.js
    - tests/lint-rules/msg-sr-4-cascade-success.test.js
    - tests/lint-rules/msg-sr-5-cascade-warning.test.js
    - tests/lint-rules/msg-sr-6-no-cascade-error.test.js
    - tests/lint-rules/msg-sr-7-usage-error-routing.test.js
    - tests/lint-rules/msg-mr-1-manual-recovery-anchor.test.js
    - tests/lint-rules/msg-mr-2-manual-recovery-system.test.js
    - tests/lint-rules/msg-rp-1-rollback-partial.test.js
    - tests/lint-rules/msg-cc-1-cause-chain.test.js
    - tests/lint-rules/msg-nc-1-entity-error.test.js
    - tests/lint-rules/msg-nc-2-usage-separator.test.js
    - tests/lint-rules/msg-rh-1-reload-hint.test.js
    - tests/lint-rules/msg-lc-1-console-warn-form.test.js
    - tests/lint-rules/msg-lc-2-eslint-discipline.test.js
    - tests/lint-rules/msg-sd-1-soft-dep-reason.test.js
    - tests/lint-rules/msg-sd-2-soft-dep-predicate.test.js
    - tests/lint-rules/index.d.ts
    - tests/architecture/msg-rule-registry.test.ts
  modified:
    - tests/lint-rules/index.js
    - tests/architecture/no-legacy-markers.test.ts

key-decisions:
  - "Severity-class detection bands pinned in shared lib/sr-tokens.js: SUCCESS = installed/updated/reinstalled/uninstalled/added/removed/available/upgradable; INFO = skipped/no marketplaces/no plugins; WARNING = failed/rollback failed/manual recovery/unavailable. Source: style-guide §10 + shared/grammar/status-tokens.ts 15-entry literal-union."
  - "MSG-SR-2 'INFO-class' routes via notifySuccess (NOT a separate notifyInfo wrapper) per D-CMC-11..D-CMC-13 four-wrapper minimalism in shared/notify.ts. The rule's messageId text cites the §10 + four-wrapper convention together."
  - "MSG-SR-4..6 cascade rules use identifier-name heuristics (cascadeSummary / cascadeBody / composeCascade) + literal severity-tag arg detection (`success` / `warning`) -- the cascade composer surface is small enough that this dual detection covers all current callsites without false positives."
  - "MSG-LC-2 RuleTester uses linterOptions.reportUnusedDisableDirectives=false so ESLint does not auto-strip the planted disable comments before the rule runs against them. The drift guard cares about the COMMENT existing, not about whether ESLint considers the directive active."
  - "Registry assertion (c) is GATED via t.todo() until Plan 06 -- detection via `eslintConfigText.includes('\"msg/msg-')`. Per D-14-03 + NFR-6 the 'sanctioned RED commit' Option A is forbidden; the gated-pending posture is the only path that keeps Plan 05's commit green while binding the contract Plan 06 must satisfy."
  - "no-legacy-markers.test.ts allow-list extended with 3 Plan 05 files: msg-mr-1-manual-recovery-anchor.test.js (contains 'MANUAL RECOVERY REQUIRED: ' in planted invalid: code), msg-rh-1-reload-hint.js + .test.js (contain 'Run /reload to ' as the detection literal). The two gates are complementary: legacy-markers is a byte-grep static-audit; MSG-* rules are AST-aware. Allow-listing preserves both without overlap."

patterns-established:
  - "AST-visitor full-impl rule shape: ESLintUtils.RuleCreator(...).default-export with messageId text embedding the MSG-* ID literal as the first token; meta.docs.description cites the style-guide §section and (when applicable) the canonical composer file"
  - "RuleTester per-file 4-line node:test shim (Pitfall 1): bind RuleTester.afterAll/.describe/.it/.itOnly to node:test's `test.after`/`test.describe`/`test.it`/`test.it.only` before constructing the RuleTester instance"
  - "Severity-classification source-of-truth helper module pattern: when N rules share a closed-set classification (here 3 SR rules × 15 tokens), pin the classification in one .js file and import it everywhere -- keeps re-classification a one-edit operation"

requirements-completed: [CMC-38]

# Metrics
duration: 75min
completed: 2026-05-24
---

# Phase 14 Plan 05: full-impl-rules-and-registry Summary

**Land the 18 MSG-* drift-guard rules that need real AST coverage + the registry parity test that ties style-guide body ↔ rule files ↔ plugin module ↔ (pending) eslint.config.js wiring.**

## Performance

- **Duration:** ~75 min (single session)
- **Completed:** 2026-05-24T19:59:30Z
- **Tasks:** 3/3
- **Files created:** 39
- **Files modified:** 2

## Accomplishments

- 18 full-impl MSG-* rules implemented with real AST visitors and messageId text embedding the MSG-* rule ID literal per SC #2 (rules detect callsite routing for `notify*` wrappers, hand-composed legacy literals for `MANUAL RECOVERY REQUIRED:` / `(failed) {rollback partial}` / `cause:` / `Run /reload`, bare `console.warn` outside the IL-3 callsite, `eslint-disable*` discipline, and `{requires pi-subagents/mcp}` braced + bare-predicate emissions).
- 18 RuleTester companion tests with planted-violation `invalid:` cases that assert the messageId byte-exactly -- SC #1 ("intentional planted violation makes `npm run check` fail with a clear, locatable error") is structurally satisfied for every rule.
- Local ESLint plugin at `tests/lint-rules/index.js` now exposes all 34 MSG-* rules (16 meta-assertion + 18 full-impl) with `RULE_NAMES.length === 34`.
- Architecture registry parity test at `tests/architecture/msg-rule-registry.test.ts` with the 4-assertion D-14-12 contract -- (a)+(b)+(d) ACTIVE and passing, (c) GATED via `test.todo()` pending Plan 06 wiring. The gate detection greps `eslint.config.js` for the literal `"msg/msg-` and flips automatically when Plan 06 adds the per-rule registrations.
- `npm run check` is GREEN at the Plan 05 commit: 1241 tests pass, 1 todo (the gated assertion (c)), 0 fail -- D-14-03 "every wave green" invariant honored.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author 18 full-impl rule files with real AST visitors** -- `d42d55d` (feat)
2. **Task 2: Author 18 RuleTester companions with planted invalid cases** -- `2af5877` (test)
3. **Task 3: Populate index.js with full-impl rules + author msg-rule-registry.test.ts** -- `6d148b6` (feat)

## Files Created/Modified

### Rule files (18 new)

| MSG-* ID  | File                                          | Detection target                                                                              |
| --------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| MSG-SR-1  | `tests/lint-rules/msg-sr-1-success-routing.js`        | `notifyWarning` / `notifyError` carrying SUCCESS-class status token (`(installed)` etc.)      |
| MSG-SR-2  | `tests/lint-rules/msg-sr-2-warning-routing.js`        | `notifyWarning` / `notifyError` carrying INFO-class status token (`(skipped)` etc.)           |
| MSG-SR-3  | `tests/lint-rules/msg-sr-3-error-routing.js`          | `notifySuccess` carrying WARNING-class status token (`(failed)` etc.)                         |
| MSG-SR-4  | `tests/lint-rules/msg-sr-4-cascade-success.js`        | `notifyWarning` carrying success-tagged cascade summary                                       |
| MSG-SR-5  | `tests/lint-rules/msg-sr-5-cascade-warning.js`        | `notifySuccess` carrying warning-tagged cascade summary                                       |
| MSG-SR-6  | `tests/lint-rules/msg-sr-6-no-cascade-error.js`       | `notifyError` carrying any cascade summary                                                    |
| MSG-SR-7  | `tests/lint-rules/msg-sr-7-usage-error-routing.js`    | `notifyError(ctx, msg + USAGE)` / `notifyError(ctx, ` `${msg}${USAGE}` `)`                    |
| MSG-MR-1  | `tests/lint-rules/msg-mr-1-manual-recovery-anchor.js` | Literal `MANUAL RECOVERY REQUIRED:` outside the composer                                      |
| MSG-MR-2  | `tests/lint-rules/msg-mr-2-manual-recovery-system.js` | ObjectExpression `{ kind: "manual-recovery", resource: ... }` with `@` or `[` in resource     |
| MSG-RP-1  | `tests/lint-rules/msg-rp-1-rollback-partial.js`       | Literal `(failed) {rollback partial}` outside `presentation/rollback-partial.ts`              |
| MSG-CC-1  | `tests/lint-rules/msg-cc-1-cause-chain.js`            | Literal `cause:` / `Cause:` outside `presentation/cause-chain.ts` + `shared/errors.ts`        |
| MSG-NC-1  | `tests/lint-rules/msg-nc-1-entity-error.js`           | Literal `<icon> <name>@<marketplace>` shape outside `presentation/compact-line.ts`            |
| MSG-NC-2  | `tests/lint-rules/msg-nc-2-usage-separator.js`        | `notifyError` callsite with single-newline separator before USAGE (overlaps MSG-SR-7)         |
| MSG-RH-1  | `tests/lint-rules/msg-rh-1-reload-hint.js`            | Literal `/reload` / `Run /reload to` outside `presentation/reload-hint.ts`                    |
| MSG-LC-1  | `tests/lint-rules/msg-lc-1-console-warn-form.js`      | Any `console.warn` callsite (Plan 06 narrows to the extension surface ex-`migrate.ts`)        |
| MSG-LC-2  | `tests/lint-rules/msg-lc-2-eslint-discipline.js`      | `eslint-disable*` comment mentioning `no-restricted-syntax` / `no-console` outside migrate.ts |
| MSG-SD-1  | `tests/lint-rules/msg-sd-1-soft-dep-reason.js`        | Literal `{requires pi-subagents}` / `{requires pi-mcp}` outside the renderer                  |
| MSG-SD-2  | `tests/lint-rules/msg-sd-2-soft-dep-predicate.js`     | Bare-predicate `requires pi-subagents/mcp` (no braces) outside the renderer                   |

### Test files (18 new)

Sibling `.test.js` for each rule file above. Each includes the 4-line node:test shim (Pitfall 1), at least one `valid:` case (canonical correct usage), and ≥1 `invalid:` case asserting the rule's messageId byte-exactly. MSG-LC-2's RuleTester instance disables `reportUnusedDisableDirectives` so ESLint does not auto-strip the planted disable comments before the rule fires (decision recorded in the file's top docstring).

### Shared helpers (1 new)

- `tests/lint-rules/lib/sr-tokens.js` -- severity classification of the 15 closed-set status tokens into SUCCESS / INFO / WARNING buckets per style-guide §10 + the `collectLiteralText` AST-walker helper consumed by MSG-SR-1..3.

### Plugin module (modified)

- `tests/lint-rules/index.js` -- extended with 18 new ESM imports + 18 new entries appended to `RULE_NAMES` (final length 34) + 18 new entries appended to `default.rules` (final keys count 34). Order: family-then-numeric, meta-assertion first (16) then full-impl (18) per the inline header comment.

### TypeScript declarations (1 new)

- `tests/lint-rules/index.d.ts` -- typed shim for the `RULE_NAMES` export + a loose `default` plugin shape (rules typed as `Record<string, unknown>` since the registry test only consumes `RULE_NAMES`). Mirrors the sibling `tests/lint-rules/lib/frontmatter.d.ts` pattern Plan 03 established.

### Architecture test (1 new)

- `tests/architecture/msg-rule-registry.test.ts` -- registry parity test per D-14-12 LOCKED. 4 `test(...)` blocks, one per assertion (a)/(b)/(c)/(d). Assertion (c) uses `t.todo()` when the Plan-06-detection check (`eslintConfigText.includes('"msg/msg-')`) returns false; the gate flips automatically when Plan 06 wires the plugin.

### Architecture test (modified)

- `tests/architecture/no-legacy-markers.test.ts` -- `ALLOW_LIST` extended with 3 entries (`tests/lint-rules/msg-mr-1-manual-recovery-anchor.test.js`, `tests/lint-rules/msg-rh-1-reload-hint.js`, `tests/lint-rules/msg-rh-1-reload-hint.test.js`) that legitimately contain the legacy ES-5 marker literals as drift-guard detection fixtures -- the rule body IS the gate evidence. The rationale comment inside the file documents the Rule-3 auto-fix and the two gates' complementarity (byte-grep static-audit vs. AST-aware MSG-* rules).

## Decisions Made

See `key-decisions` in the frontmatter above. Six implementation decisions made -- none required user input (all were Rule 1/2/3 in-scope auto-fixes per the agent guidance).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Extend `no-legacy-markers.test.ts` ALLOW_LIST**

- **Found during:** Task 3 verify step (`npm run check`)
- **Issue:** The pre-existing CMC-35 static-audit gate (`tests/architecture/no-legacy-markers.test.ts`) flagged 3 Plan 05 files as containing the legacy ES-5 marker strings `MANUAL RECOVERY REQUIRED: ` and `Run /reload to `. Those strings are NECESSARY in the drift-guard rule files and their planted-violation tests -- the rule fires on those literals; the literals ARE the detection fixtures.
- **Fix:** Added 3 paths to `ALLOW_LIST` with a multi-line rationale comment explaining the complementarity of the byte-grep legacy-markers gate (lifetime CMC-35 gate per D-13-12) and the AST-aware MSG-* rules. Both gates stay; the allow-list prevents overlap without weakening either.
- **Files modified:** `tests/architecture/no-legacy-markers.test.ts`
- **Verification:** `npm run check` GREEN after the change.
- **Committed in:** `6d148b6` (Task 3 commit)

**2. [Rule 3 - Blocking issue] Add `tests/lint-rules/index.d.ts`**

- **Found during:** Task 3 verify step (`npm run typecheck`)
- **Issue:** The new architecture test (`tests/architecture/msg-rule-registry.test.ts`) is a `.ts` file that imports `RULE_NAMES` from `../lint-rules/index.js`. Under the project's strict `tsc --noEmit`, the implicit `any` from the `.js` import triggers TS7016 and TS7006 errors that block the typecheck step.
- **Fix:** Created `tests/lint-rules/index.d.ts` with typed declarations for `RULE_NAMES` (`readonly string[]`) and a loose `default` plugin shape (`Record<string, unknown>` for rules -- the test only consumes `RULE_NAMES`). Mirrors the existing `tests/lint-rules/lib/frontmatter.d.ts` sibling pattern Plan 14-03 established.
- **Files modified:** `tests/lint-rules/index.d.ts` (created)
- **Verification:** `npm run typecheck` GREEN after the change.
- **Committed in:** `6d148b6` (Task 3 commit)

**3. [Rule 3 - Blocking issue] MSG-LC-2 RuleTester disables `reportUnusedDisableDirectives`**

- **Found during:** Task 2 (running the MSG-LC-2 companion test)
- **Issue:** The planted `// eslint-disable-next-line no-restricted-syntax` invalid case produced 2 errors from RuleTester: the expected `extraEslintDisable` from msg-lc-2 AND ESLint's built-in "Unused eslint-disable directive" warning (a non-rule directive whose `ruleId === null`). The latter also carries an auto-fix that strips the comment, causing RuleTester to demand an `output:` property.
- **Fix:** Construct the RuleTester instance with `{ linterOptions: { reportUnusedDisableDirectives: false } }` so ESLint stops auto-flagging unused directives in the planted test fixtures. The drift guard cares about the COMMENT existing, not about whether ESLint considers the directive active -- the rule operates on raw comment text via `sourceCode.getAllComments()`. The decision is documented in the test file's docstring.
- **Files modified:** `tests/lint-rules/msg-lc-2-eslint-discipline.test.js`
- **Verification:** All 4 sub-tests of msg-lc-2 pass under `node --test`.
- **Committed in:** `2af5877` (Task 2 commit)

**4. [Rule 3 - Blocking issue] Import-order auto-fixes after Task 3**

- **Found during:** Task 3 verify step (`npm run lint`)
- **Issue:** The plan-prescribed import order (meta-assertion-first, then full-impl) violated `import-x/order` (alphabetical import sort). Running `npm run lint:fix` reordered the imports alphabetically while the `RULE_NAMES` array kept the family-then-numeric documented order.
- **Fix:** Accepted the lint-fix reorder for the import statements; the `RULE_NAMES` array preserves the documented family-then-numeric order. The plugin's `default.rules` dict similarly keeps the documented order -- the dict's key order is irrelevant to ESLint but matches `RULE_NAMES` for diffability.
- **Files modified:** `tests/lint-rules/index.js`
- **Verification:** `npm run lint` GREEN after the auto-fix.
- **Committed in:** `6d148b6` (Task 3 commit)

**5. [Rule 3 - Blocking issue] Prettier reformat of generated rule files**

- **Found during:** Task 1 pre-commit hook
- **Issue:** Prettier's `--write` step in the pre-commit hook reformatted a handful of the new rule files (whitespace between statements). Identical to the standard Prettier auto-fix pattern.
- **Fix:** Re-staged the prettified files and re-ran pre-commit. Trufflehog separately failed with the known worktree `failed to read index file: ... not a directory` error; per project CLAUDE.md the commit was issued with `SKIP=trufflehog`.
- **Files modified:** Multiple Plan 05 rule files (whitespace only).
- **Verification:** `pre-commit run --files <changed files>` passed all hooks except trufflehog (known issue).
- **Committed in:** `d42d55d` (Task 1 commit)

## Authentication Gates

None.

## Known Stubs

None. All 18 full-impl rules have real, exercised AST visitors backed by planted-violation tests. The 3 cascade rules (MSG-SR-4..6) use identifier-name heuristics + literal severity-tag detection -- this is intentional, not a stub; the cascade composer surface is small enough that this dual detection is precise.

## Threat Flags

None. This plan is purely test-infrastructure additive -- no new network endpoints, auth paths, file-access surfaces, or schema changes at trust boundaries.

## Self-Check: PASSED

- **18 rule files created:** verified (`ls tests/lint-rules/msg-{sr,mr,rp,cc,nc,rh,lc,sd-1,sd-2}-*.js | grep -v test.js | wc -l == 18`).
- **18 test files created:** verified (matching count).
- **Total 34 rules + 34 tests:** verified (`ls tests/lint-rules/msg-*.js | grep -v test.js | wc -l == 34`).
- **Plugin RULE_NAMES + rules length 34:** verified (`node -e "import('./tests/lint-rules/index.js')..."` returns `34, 34`).
- **Registry test exists:** verified (`tests/architecture/msg-rule-registry.test.ts`).
- **Registry test passes with 1 todo:** verified (`node --test tests/architecture/msg-rule-registry.test.ts` returns `pass 3, todo 1, fail 0`).
- **npm run check is GREEN:** verified (1241 pass, 1 todo, 0 fail).
- **Commits exist:** d42d55d, 2af5877, 6d148b6 all present in `git log --oneline -5`.
