---
phase: 14-drift-guard-test-alignment
plan: 05
type: execute
wave: 3
depends_on:
  - 14-03-drift-guard-infrastructure
files_modified:
  - tests/lint-rules/msg-sr-1-success-routing.js
  - tests/lint-rules/msg-sr-1-success-routing.test.js
  - tests/lint-rules/msg-sr-2-warning-routing.js
  - tests/lint-rules/msg-sr-2-warning-routing.test.js
  - tests/lint-rules/msg-sr-3-error-routing.js
  - tests/lint-rules/msg-sr-3-error-routing.test.js
  - tests/lint-rules/msg-sr-4-cascade-success.js
  - tests/lint-rules/msg-sr-4-cascade-success.test.js
  - tests/lint-rules/msg-sr-5-cascade-warning.js
  - tests/lint-rules/msg-sr-5-cascade-warning.test.js
  - tests/lint-rules/msg-sr-6-no-cascade-error.js
  - tests/lint-rules/msg-sr-6-no-cascade-error.test.js
  - tests/lint-rules/msg-sr-7-usage-error-routing.js
  - tests/lint-rules/msg-sr-7-usage-error-routing.test.js
  - tests/lint-rules/msg-mr-1-manual-recovery-anchor.js
  - tests/lint-rules/msg-mr-1-manual-recovery-anchor.test.js
  - tests/lint-rules/msg-mr-2-manual-recovery-system.js
  - tests/lint-rules/msg-mr-2-manual-recovery-system.test.js
  - tests/lint-rules/msg-rp-1-rollback-partial.js
  - tests/lint-rules/msg-rp-1-rollback-partial.test.js
  - tests/lint-rules/msg-cc-1-cause-chain.js
  - tests/lint-rules/msg-cc-1-cause-chain.test.js
  - tests/lint-rules/msg-nc-1-entity-error.js
  - tests/lint-rules/msg-nc-1-entity-error.test.js
  - tests/lint-rules/msg-nc-2-usage-separator.js
  - tests/lint-rules/msg-nc-2-usage-separator.test.js
  - tests/lint-rules/msg-rh-1-reload-hint.js
  - tests/lint-rules/msg-rh-1-reload-hint.test.js
  - tests/lint-rules/msg-lc-1-console-warn-form.js
  - tests/lint-rules/msg-lc-1-console-warn-form.test.js
  - tests/lint-rules/msg-lc-2-eslint-discipline.js
  - tests/lint-rules/msg-lc-2-eslint-discipline.test.js
  - tests/lint-rules/msg-sd-1-soft-dep-reason.js
  - tests/lint-rules/msg-sd-1-soft-dep-reason.test.js
  - tests/lint-rules/msg-sd-2-soft-dep-predicate.js
  - tests/lint-rules/msg-sd-2-soft-dep-predicate.test.js
  - tests/lint-rules/msg-er-1-empty-token.js
  - tests/lint-rules/index.js
  - tests/architecture/msg-rule-registry.test.ts
autonomous: true
requirements:
  - CMC-38

must_haves:
  truths:
    - "All 15 (or 18) full-impl rule files exist under tests/lint-rules/ -- one per MSG-* ID in the full-impl set per RESEARCH.md §5 (MSG-SR-1..7, MSG-MR-1..2, MSG-RP-1, MSG-CC-1, MSG-NC-1..2, MSG-RH-1, MSG-LC-1..2, MSG-SD-1..2)."
    - "Each full-impl rule has a real AST visitor (CallExpression / TemplateLiteral / Literal / Comment as appropriate) that reports a violation with a messageId whose error message includes the MSG-* rule ID (SC #2)."
    - "Each rule has a RuleTester companion `.test.js` with the 4-line node:test shim + ≥1 `valid:` case + ≥1 `invalid:` case asserting the messageId byte-exactly."
    - "`tests/lint-rules/index.js` now imports + registers all 34 rules (16-19 meta from Plan 04 + 15-18 full-impl from this plan); `RULE_NAMES.length === 34`."
    - "`tests/architecture/msg-rule-registry.test.ts` exists with 4 test cases (D-14-12 registry parity): (a) every MSG-* ID found in `docs/messaging-style-guide.md` has a corresponding rule file name (slug-prefix match); (b) every rule name has a style-guide MSG-* anchor; (c) every rule name is registered in `eslint.config.js`; (d) total rule count equals 34."
    - "All RuleTester companions and the registry test PASS under `node --test`."
    - "`npm run check` is green at the Plan 05 commit (rules exist in the plugin module, but per-rule `files:` registration in eslint.config.js is Plan 06's responsibility -- the registry test's eslint.config.js text-grep assertion (c) WILL FAIL until Plan 06 lands; document this dependency in the must-have comment below)."
    - "DEPENDENCY ON PLAN 06: the registry test's assertion (c) -- 'every rule name is registered in eslint.config.js' -- depends on Plan 06's wiring; this plan's `npm run check` SHOULD pass because the registry test itself is order-sensitive (if Plan 06 hasn't landed yet, the test should NOT yet be run as part of the gate -- see Task 3 sequencing). The Task 3 acceptance criteria below clarify the ordering."
  artifacts:
    - path: tests/lint-rules/msg-sr-7-usage-error-routing.js
      provides: "MSG-SR-7: AST visitor detecting notifyError + USAGE concatenation"
      contains: "useNotifyUsageError"
    - path: tests/lint-rules/msg-rp-1-rollback-partial.js
      provides: "MSG-RP-1: AST visitor detecting hand-composed (failed) {rollback partial} literal outside the composer"
      contains: "rollback partial"
    - path: tests/architecture/msg-rule-registry.test.ts
      provides: "Registry parity test asserting MSG-* ID ↔ rule file ↔ eslint.config.js registration"
      contains: "RULE_NAMES"
  key_links:
    - from: tests/architecture/msg-rule-registry.test.ts
      to: tests/lint-rules/index.js
      via: "import { RULE_NAMES } from '../../tests/lint-rules/index.js'"
      pattern: "RULE_NAMES"
    - from: tests/architecture/msg-rule-registry.test.ts
      to: eslint.config.js
      via: "readFile text + regex match for `\"msg/<name>\":`"
      pattern: "msg/msg-"
---

<objective>
Land the remaining 15 (or 18) MSG-* drift-guard rules -- the full-impl subset that requires real AST coverage -- plus the registry parity test that ties the four moving parts together (style-guide body, rule files, eslint.config.js wiring, plugin module). Per D-14-09 (LOCKED), these rules implement AST visitors detecting specific code patterns the style guide forbids; their RuleTester companions include ≥1 planted-violation `invalid:` case per rule that asserts the messageId byte-exactly (SC #1 + SC #2).

Per RESEARCH.md §5 "Which MSG-* IDs are full-impl?":
- MSG-SR-1..7: notifySuccess / notifyWarning / notifyError / notifyUsageError callsite routing -- AST `CallExpression` visitor inspecting callee identifier + arguments.
- MSG-MR-1..2: manual-recovery anchor emission -- detect any string literal matching `MANUAL RECOVERY REQUIRED:` outside the renderer.
- MSG-RP-1: rollback-partial composition -- detect hand-composed `(failed) {rollback partial}` strings outside `presentation/rollback-partial.ts`. After Wave 3's `transaction/rollback.ts` refactor in Plan 06, this rule passes.
- MSG-CC-1: cause-chain trailer -- detect manual `Cause:` / `cause:` string composition outside `presentation/cause-chain.ts`.
- MSG-NC-1: entity-shaped non-cascade errors -- detect literal `unicode-block-icon <name>` patterns outside the renderer.
- MSG-NC-2: blank-line separator between message and USAGE block -- detect `notifyError(ctx, msg + "\n" + USAGE)` patterns (overlaps MSG-SR-7's detection; MSG-SR-7 is the canonical implementation, MSG-NC-2 cites it via a near-identical visitor or shares the AST visitor logic via a small helper).
- MSG-RH-1: reload-hint trailer -- detect literal `Run /reload` and `/reload to <verb>` strings outside `presentation/reload-hint.ts`.
- MSG-LC-1: console.warn sentence form -- detect any `console.warn` outside `persistence/migrate.ts:178`.
- MSG-LC-2: eslint discipline -- detect any `eslint-disable*` comment touching `no-restricted-syntax` or `no-console` outside the single migrate.ts callsite.
- MSG-SD-1..2: soft-dep emission predicate -- detect hand-composed `{requires pi-subagents}` / `{requires pi-mcp}` strings outside `presentation/compact-line.ts::composeReasons`.

Purpose: Closes the remaining 15 (or 18) of 34 MSG-* drift-guard rules; ships the registry parity test asserting 1:1:1 across style-guide body ↔ rule files ↔ plugin registration (D-14-12 LOCKED). Failure of any rule produces the MSG-* ID embedded in the message -- satisfies SC #1 ("intentional planted violation makes npm run check fail with clear, locatable error") + SC #2 ("failure includes MSG-* rule ID"). Per D-14-09 (LOCKED meta vs. full split) + D-14-12 (LOCKED body-scan registry test).
Output: All 34 rules exist; registry test exists; per-rule planted-violation tests pass.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/14-drift-guard-test-alignment/14-CONTEXT.md
@.planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md
@docs/messaging-style-guide.md
@docs/output-catalog.md
@tests/lint-rules/lib/frontmatter.js
@tests/lint-rules/index.js
@extensions/pi-claude-marketplace/shared/notify.ts
@extensions/pi-claude-marketplace/presentation/compact-line.ts
@extensions/pi-claude-marketplace/presentation/reload-hint.ts
@extensions/pi-claude-marketplace/persistence/migrate.ts

<interfaces>
<!-- Key templates the executor consumes verbatim. -->

From RESEARCH.md Pattern 1 (Custom ESLint rule template -- msg-sr-7-usage-error-routing.js, canonical):
- ESM imports: `import { ESLintUtils } from "@typescript-eslint/utils";`
- `const createRule = ESLintUtils.RuleCreator(...);`
- Default export: `createRule({ name, meta: { type: "problem", docs, messages: { <messageId>: "MSG-X-N: <message text with rule ID embedded>" }, schema: [] }, defaultOptions: [], create(context) { return { <ESTree node>: (node) => { /* detect; if violation, context.report({ node, messageId }); */ } }; } });`
- The `messageId` text is the user-visible failure message; per SC #2 it MUST contain the MSG-* rule ID literal (e.g., "MSG-SR-7: ...").

From RESEARCH.md Pattern 5 (RuleTester full-impl template -- has both `valid:` and `invalid:`):
- 4-line node:test shim (same as Plan 04).
- `ruleTester.run("<name>", rule, { valid: [...], invalid: [{ code: <planted violation source>, errors: [{ messageId: "<messageId from rule>" }] }] });`
- The `invalid:` case's `code` field is the planted violation -- assert the AST visitor produces a report with the expected messageId.

From RESEARCH.md Pattern 6 (Registry parity test template -- full code in research file):
- ESM TypeScript test (`.ts`) under `tests/architecture/`.
- Imports `RULE_NAMES` from `../../tests/lint-rules/index.js` (the plugin entry).
- Reads `docs/messaging-style-guide.md` via `node:fs/promises::readFile`.
- Extracts MSG-* IDs via `/MSG-[A-Z]+-[0-9]+/g`; dedupes; expects 34 unique IDs.
- 4 assertions: (a) every style-guide MSG-* ID has a rule file (slug-prefix match in RULE_NAMES); (b) every rule name has a style-guide anchor; (c) every rule name is registered in eslint.config.js (text-grep for `"msg/<name>":`); (d) total count is 34 on both sides.

From extensions/pi-claude-marketplace/shared/notify.ts:
- 4 wrappers: notifySuccess, notifyWarning, notifyError, notifyUsageError (lines 48-97 -- already verified above)
- MSG-SR-1..7 rules detect callsite routing patterns: e.g., MSG-SR-7 detects `notifyError(ctx, msg)` where `msg` references `USAGE` (template literal or binary `+` operator with USAGE on either side).

From extensions/pi-claude-marketplace/presentation/compact-line.ts (the renderer):
- File-private icon constants at lines 62-64; the icon dispatch function is the single emission point.
- MSG-MR-1..2 / MSG-NC-1 / MSG-RH-1 detect literal text patterns OUTSIDE the canonical composer files; rules use ESLint `ignores:` arrays in Plan 06 to exclude the composer files themselves.

From RESEARCH.md Pattern 4 (eslint.config.js block -- for context only; this plan does NOT modify eslint.config.js):
- Plan 06 adds per-rule `files:` blocks with appropriate `ignores:` for composer files.
- Registry test assertion (c) text-greps `"msg/<name>":` literal in eslint.config.js; until Plan 06 lands, that assertion will FAIL. Handle by sequencing: this plan's milestone gate `npm run check` runs the registry test, which exposes the failure -- Plan 06 MUST land immediately after to restore green. Alternative: gate the (c) assertion behind a "Plan 06 has landed" check (e.g., short-circuit if `eslint.config.js` contains no `msg/` literal) -- but RESEARCH.md doesn't recommend this hedge.

PER D-14-03 SEQUENCING (LOCKED): the milestone gate is `npm run check` green at every wave. Wave 3's ordering inside this plan: 04 + 05 + 06 land sequentially. The acceptance criteria for THIS plan accept that assertion (c) of the registry test fails BEFORE Plan 06 lands; Plan 06's success criteria restore green by registering all 34 rules in eslint.config.js. See Task 3 acceptance criteria for the ordering detail.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author 15 (or 18) full-impl rule files with real AST visitors</name>
  <files>
    tests/lint-rules/msg-sr-{1,2,3,4,5,6,7}-*.js,
    tests/lint-rules/msg-mr-{1,2}-*.js,
    tests/lint-rules/msg-rp-1-rollback-partial.js,
    tests/lint-rules/msg-cc-1-cause-chain.js,
    tests/lint-rules/msg-nc-{1,2}-*.js,
    tests/lint-rules/msg-rh-1-reload-hint.js,
    tests/lint-rules/msg-lc-{1,2}-*.js,
    tests/lint-rules/msg-sd-{1,2}-*.js
  </files>
  <read_first>
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pattern 1 (canonical full-impl rule template -- msg-sr-7-usage-error-routing.js is the worked example with `sourceReferencesUsage` recursive helper for BinaryExpression + TemplateLiteral)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md §5 "Which MSG-* IDs are full-impl?" (per-rule detection target)
    - docs/messaging-style-guide.md (relevant §section per rule -- used in `meta.docs.description` and `messages.<id>` text)
    - extensions/pi-claude-marketplace/shared/notify.ts (the four wrappers -- the surface MSG-SR-1..7 rules visit)
    - extensions/pi-claude-marketplace/persistence/migrate.ts (the single sanctioned console.warn callsite -- MSG-LC-1/MSG-LC-2 rules narrow to this file via `files:` + `ignores:` in Plan 06)
    - extensions/pi-claude-marketplace/presentation/reload-hint.ts (the canonical reload-hint composer -- MSG-RH-1 detects literal `Run /reload` patterns OUTSIDE this file)
    - extensions/pi-claude-marketplace/presentation/manual-recovery.ts, rollback-partial.ts, cause-chain.ts (the canonical composer files; the rules detect their characteristic literals OUTSIDE these files via Plan 06's `ignores:` lists)
  </read_first>
  <action>
    Create 15 (or 18) `.js` rule files under `tests/lint-rules/` -- one per MSG-* ID in the full-impl set. Each follows RESEARCH.md Pattern 1 with a real AST visitor that detects the specific code pattern the rule's style-guide §section forbids.

    **Per-rule detection targets:**

    **MSG-SR-1 (msg-sr-1-success-routing.js)** -- Style guide §10: rules out non-cascade success emissions through any wrapper EXCEPT `notifySuccess`. Visit `CallExpression` whose callee is `notifyWarning` / `notifyError` AND the message argument shape resembles a success outcome (closed-set status tokens like "installed", "updated"). This is harder to detect statically -- the conservative implementation is a narrow trigger: if the call's first text arg contains BOTH a closed-set "success" status token (from STATUS_TOKENS_FRONTMATTER) AND the wrapper isn't notifySuccess, report. Use the frontmatter loader for the closed-set check. Implementation may opt to be very narrow and only assert structurally enforced cases (which makes this effectively close to meta-assertion); document this in the rule's `meta.docs.description`.

    **MSG-SR-2 (msg-sr-2-warning-routing.js)** -- Symmetrical: detects "warning" semantics emitted via `notifySuccess` or `notifyError`.

    **MSG-SR-3 (msg-sr-3-error-routing.js)** -- Detects error-class outcomes emitted via `notifySuccess` or `notifyWarning`. May overlap meta-assertion if all non-cascade error routing is already structurally enforced; if so, narrow the rule to the specific drift patterns the style guide §10 calls out (e.g., raw `ctx.ui.notify(msg, "error")` calls -- bypassing the wrappers).

    **MSG-SR-4..6 (cascade-success / cascade-warning / no-cascade-error)** -- Detect cascade-summary emissions through the wrong wrapper. The cascade composer (`presentation/cascade-summary.ts`) returns a string + severity tag; orchestrators dispatch via `notifySuccess` (when severity=success) or `notifyWarning` (when severity=warning), NEVER `notifyError` (per MSG-SR-6). Detection: visit `CallExpression` of `notifyError` whose first arg is a TemplateLiteral / string that contains text identifying a cascade body (e.g., presence of `\n\n` joiner + multiple `(status)` tokens). MSG-SR-6 is the canonical "never notifyError for cascades" rule.

    **MSG-SR-7 (msg-sr-7-usage-error-routing.js)** -- VERBATIM from RESEARCH.md Pattern 1. Visit `CallExpression` whose callee is `notifyError` and check whether the message argument (BinaryExpression / TemplateLiteral) references `USAGE`. Report with messageId `useNotifyUsageError` and message text including "MSG-SR-7:". The `sourceReferencesUsage` recursive helper handles Identifier / TemplateLiteral / BinaryExpression node shapes.

    **MSG-MR-1 (msg-mr-1-manual-recovery-anchor.js)** -- Style guide §7: manual-recovery anchor is a separate top-level compact line. Detect any string literal in the codebase containing `MANUAL RECOVERY REQUIRED:` (the legacy prefix). Visit `Literal` and `TemplateLiteral` nodes; check the value/quasi for the legacy prefix. The canonical composer `presentation/manual-recovery.ts` is excluded via Plan 06's `ignores:`.

    **MSG-MR-2 (msg-mr-2-manual-recovery-system.js)** -- Style guide §7: system-level manual-recovery (e.g., agent index, state.json) goes in the name slot -- no `@<marketplace>` or `[<scope>]`. This is structurally enforced (ManualRecoveryLine has no marketplace/scope fields per compact-line.ts:212-217). The rule's real-impl is a defensive AST check: detect `kind: "manual-recovery"` literal RowSpec construction where `resource` looks like `<name>@<marketplace>` (contains `@`) but only as a sanity check -- the type system already enforces the schema. If implementation is genuinely meta-assertion-like for MSG-MR-2, document the cross-reference; treat as a meta-assertion-equivalent (this is acceptable per D-14-09's "structural enforcement" carve-out).

    **MSG-RP-1 (msg-rp-1-rollback-partial.js)** -- Style guide §8: rollback-partial uses the `(failed) {rollback partial}` parent + indented children form via `presentation/rollback-partial.ts`. Detect any string literal containing the substring `(failed) {rollback partial}` outside `presentation/rollback-partial.ts`. After Plan 06's transaction/rollback.ts refactor, this rule passes; before Plan 06, this rule would report transaction/rollback.ts:57 as a violation -- Plan 06 sequencing fixes that.

    **MSG-CC-1 (msg-cc-1-cause-chain.js)** -- Style guide §9: cause-chain trailer renders as `cause: <link1> -> <link2> -> ...` via `presentation/cause-chain.ts` and `shared/errors.ts::causeChainTrailer`. Detect manual `Cause:` / `cause:` string composition outside those canonical files. Visit `Literal` and `TemplateLiteral`; flag any literal matching `/\bcause:\s/i` outside `presentation/cause-chain.ts` and `shared/errors.ts`.

    **MSG-NC-1 (msg-nc-1-entity-error.js)** -- Style guide §12: entity-shaped non-cascade errors render via the renderer (`RowSpec` `EntityErrorRow` variant) not via hand-composed strings. Detect hand-composed compact-line patterns: visit `Literal` / `TemplateLiteral`; flag any text matching `/(?:⊘|⊕|✓)\s+\S+@/` (icon + entity + `@`) outside `presentation/compact-line.ts`.

    **MSG-NC-2 (msg-nc-2-usage-separator.js)** -- Style guide §12: blank-line separator between message and USAGE block is `\n\n`. Detect `notifyError(ctx, msg + "\n" + USAGE)` -- overlaps MSG-SR-7. May SHARE the AST visitor with MSG-SR-7 via a small helper module under `tests/lint-rules/lib/`. Alternative: independent detection -- visit `CallExpression` of `notifyError` and check the message arg for a `BinaryExpression` containing `"\n"` followed by USAGE. The two rules can produce overlapping reports; Plan 06's `files:` scopes them to the same surface so the overlap is acceptable.

    **MSG-RH-1 (msg-rh-1-reload-hint.js)** -- Style guide §5: reload-hint trailer renders via `presentation/reload-hint.ts::reloadHint`. Detect literal `Run /reload` or `/reload to <verb>` strings in source outside `presentation/reload-hint.ts`. Visit `Literal` / `TemplateLiteral`; flag any text matching `/\/reload(?:\s+to\b)?/`.

    **MSG-LC-1 (msg-lc-1-console-warn-form.js)** -- Style guide §14.1: the sanctioned `console.warn` at `persistence/migrate.ts:178` uses sentence-form wording (terminal period, no compact-grammar tokens). The rule's job is to detect any OTHER `console.warn` callsite (Plan 06's `files:` scope is narrowed to `persistence/migrate.ts` for this rule, so it actually fires only there; but the AST visitor is generic -- visit `CallExpression` of `console.warn` and report). Plan 06 wires `files: ["extensions/pi-claude-marketplace/persistence/migrate.ts"]` for this rule.

    **MSG-LC-2 (msg-lc-2-eslint-discipline.js)** -- Style guide §14.1: the single sanctioned `eslint-disable-next-line` comment for `no-restricted-syntax, no-console` lives at `persistence/migrate.ts:178`. Detect any OTHER `eslint-disable*` comment in the codebase that mentions `no-restricted-syntax` or `no-console`. Visit `Program` for the comment array; visit comments via `sourceCode.getAllComments()`; flag matches outside the single sanctioned line. Plan 06 wires `files: ["extensions/pi-claude-marketplace/persistence/migrate.ts"]` (or excludes via `ignores:`) to scope appropriately.

    **MSG-SD-1 (msg-sd-1-soft-dep-reason.js)** -- Style guide §6: `{requires pi-subagents}` and `{requires pi-mcp}` reasons live in the closed REASONS set and are emitted via the renderer's per-row predicate. Detect hand-composed string literals matching `/\{requires pi-(?:subagents|mcp)\}/` outside `presentation/compact-line.ts::composeReasons`.

    **MSG-SD-2 (msg-sd-2-soft-dep-predicate.js)** -- Style guide §6: soft-dep predicate emission is governed by `declaresAgents` / `declaresMcp` fields on the row spec. Largely structural -- the AST visitor's real-impl is similar to MSG-SD-1 (detect hand-composed literals).

    **General per-rule notes:**

    1. Each rule's `messages.<messageId>` text starts with the MSG-* ID literal (e.g., `"MSG-SR-7: ..."`) to satisfy SC #2.
    2. Each rule's `meta.docs.description` cites the style-guide §section and (when applicable) the canonical composer file.
    3. Use `ESLintUtils.RuleCreator` per RESEARCH.md Pattern 1.
    4. If a rule cannot be productively detected at AST level (e.g., MSG-MR-2 -- the schema enforcement is at the TypeScript type level, not at AST emission), document the cross-reference in the rule's `meta.docs.description` and use a defensive AST check + a Program visitor (similar to meta-assertion rules but with at least one real check).
    5. Avoid sharing AST visitor code across rules unless duplication exceeds ~10 lines; if shared, factor a small helper module under `tests/lint-rules/lib/ast-helpers.js`.

    NEVER place fenced code blocks in this action; RESEARCH.md Pattern 1 contains the canonical worked example (msg-sr-7).
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      # File count:
      ls tests/lint-rules/msg-sr-*.js tests/lint-rules/msg-mr-*.js tests/lint-rules/msg-rp-*.js tests/lint-rules/msg-cc-*.js tests/lint-rules/msg-nc-*.js tests/lint-rules/msg-rh-*.js tests/lint-rules/msg-lc-*.js tests/lint-rules/msg-sd-1*.js tests/lint-rules/msg-sd-2*.js 2>/dev/null | grep -v '.test.js' | wc -l
      # Expect: 15 (or 18)
      # Each has a messageId containing the MSG-* ID literal:
      grep -l 'MSG-SR-' tests/lint-rules/msg-sr-*.js | grep -v '.test.js' | wc -l
      # Expect: 7
      # Real AST visitor (not just `Program: () => {}`):
      grep -lE 'CallExpression|Literal|TemplateLiteral|BinaryExpression' tests/lint-rules/msg-sr-*.js tests/lint-rules/msg-mr-*.js tests/lint-rules/msg-rp-*.js tests/lint-rules/msg-cc-*.js tests/lint-rules/msg-nc-*.js tests/lint-rules/msg-rh-*.js tests/lint-rules/msg-lc-*.js tests/lint-rules/msg-sd-1*.js tests/lint-rules/msg-sd-2*.js 2>/dev/null | grep -v '.test.js' | wc -l
      # Expect: ≥12 (most have at least one of these visitors -- MSG-MR-2 may be the exception per the "structural-enforcement" note)
      # ESLint still green (rules exist but unregistered):
      npm run lint 2>&1 | tail -3
    </automated>
  </verify>
  <done>
    1. 15 (or 18) full-impl rule files exist under `tests/lint-rules/` matching the family/number split per RESEARCH.md §5.
    2. Each rule's `messages.<messageId>` text contains the MSG-* ID literal (e.g., "MSG-SR-7:") per SC #2.
    3. Each rule's `create()` returns a real ESTree visitor (`CallExpression`, `Literal`, `TemplateLiteral`, `BinaryExpression`, or `Program`-with-source-code-walk) -- not a bare no-op.
    4. `npm run lint` green (rules exist as JS source but are not yet registered in eslint.config.js -- that's Plan 06).
  </done>
</task>

<task type="auto">
  <name>Task 2: Author 15 (or 18) RuleTester companions with planted-violation `invalid:` cases</name>
  <files>
    tests/lint-rules/msg-sr-{1,2,3,4,5,6,7}-*.test.js,
    tests/lint-rules/msg-mr-{1,2}-*.test.js,
    tests/lint-rules/msg-rp-1-rollback-partial.test.js,
    tests/lint-rules/msg-cc-1-cause-chain.test.js,
    tests/lint-rules/msg-nc-{1,2}-*.test.js,
    tests/lint-rules/msg-rh-1-reload-hint.test.js,
    tests/lint-rules/msg-lc-{1,2}-*.test.js,
    tests/lint-rules/msg-sd-{1,2}-*.test.js
  </files>
  <read_first>
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pattern 5 (RuleTester full-impl template with the canonical msg-sr-7 `invalid:` example covering two planted violation shapes)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pitfall 1 (the 4-line node:test shim)
    - tests/lint-rules/msg-sr-7-usage-error-routing.js (from Task 1 -- the rule under test for the canonical worked example)
  </read_first>
  <action>
    For each full-impl rule from Task 1, create a sibling `*.test.js` file with the 4-line node:test shim + `valid:` cases + `invalid:` planted-violation cases.

    Per-test structure (verbatim from RESEARCH.md Pattern 5):
    1. 4-line node:test shim (REQUIRED -- Pitfall 1).
    2. `new RuleTester()` then `ruleTester.run("<rule-name>", rule, { valid: [...], invalid: [...] })`.
    3. `valid:` cases: ≥1 example showing code that does NOT violate the rule. Conservative: include the canonical correct usage (e.g., for msg-sr-7, `notifyUsageError(ctx, msg, USAGE)` is canonical valid).
    4. `invalid:` cases: ≥1 (preferably ≥2) per rule -- the planted violation cases. Each case has:
       - `code:` the planted source.
       - `errors:` an array of `{ messageId: "<exact messageId from rule's meta.messages>" }`.

    **Per-rule planted violations (canonical):**

    - **msg-sr-7**: per RESEARCH.md Pattern 5 -- 2 invalid cases (BinaryExpression `msg + "\n" + USAGE`; TemplateLiteral `\`${msg}\\n${USAGE}\``). Both expect messageId `useNotifyUsageError`.
    - **msg-sr-1..6**: invalid cases plant `notifyWarning(ctx, "(installed) success body")` (MSG-SR-1 detection target), `notifyError(ctx, "(skipped) warning body")` (MSG-SR-2), `notifySuccess(ctx, "(failed) error body")` (MSG-SR-3), and cascade-style messages routed through the wrong wrapper for MSG-SR-4..6.
    - **msg-mr-1**: plant a string literal `const msg = "MANUAL RECOVERY REQUIRED: /path/to/file";` -- expect a `legacyManualRecoveryPrefix` (or equivalent) messageId.
    - **msg-mr-2**: defensive -- plant a `ManualRecoveryLine` literal where `resource` contains `@`; if the rule is meta-assertion-only, the test is smoke-only.
    - **msg-rp-1**: plant `const body = "(failed) {rollback partial}";` -- expect `handComposedRollbackPartial` (or equivalent).
    - **msg-cc-1**: plant `const trailer = "cause: " + err.message;` -- expect `handComposedCauseChain`.
    - **msg-nc-1**: plant `const line = "⊘ name@mp [scope] (failed) {not found}";` -- expect `handComposedEntityError`.
    - **msg-nc-2**: plant `notifyError(ctx, msg + "\n" + USAGE);` -- expect `missingBlankLineSeparator`. May share the RuleTester `code` shape with msg-sr-7 but with msg-nc-2's messageId.
    - **msg-rh-1**: plant `const trailer = "Run /reload to refresh extensions";` -- expect `handComposedReloadHint`.
    - **msg-lc-1**: plant `console.warn("some warning");` -- expect `extraConsoleWarn` (the rule scoped via `files:` to migrate.ts in Plan 06; RuleTester's planted code IS the violation regardless of file path).
    - **msg-lc-2**: plant `// eslint-disable-next-line no-restricted-syntax` outside the sanctioned callsite -- expect `extraEslintDisable`.
    - **msg-sd-1**: plant `const r = "{requires pi-subagents}";` -- expect `handComposedSoftDepReason`.
    - **msg-sd-2**: plant similar pattern; tailor to the rule's actual detection target.

    Each test asserts the messageId byte-exactly (SC #2 enforcement). The `errors:` array can also include `line` / `column` if precision is desired (not required for SC #2 -- messageId alone suffices).

    All test files MUST include the 4-line shim. Tests under `tests/lint-rules/**/*.test.js` are picked up by the extended `package.json:test` glob from Plan 03.

    NEVER place fenced code blocks; RESEARCH.md Pattern 5 contains the canonical worked example.
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      # 1:1 pairing rule ↔ test for full-impl rules:
      RULE_COUNT=$(ls tests/lint-rules/msg-sr-*.js tests/lint-rules/msg-mr-*.js tests/lint-rules/msg-rp-*.js tests/lint-rules/msg-cc-*.js tests/lint-rules/msg-nc-*.js tests/lint-rules/msg-rh-*.js tests/lint-rules/msg-lc-*.js tests/lint-rules/msg-sd-1*.js tests/lint-rules/msg-sd-2*.js 2>/dev/null | grep -v '.test.js' | wc -l)
      TEST_COUNT=$(ls tests/lint-rules/msg-sr-*.test.js tests/lint-rules/msg-mr-*.test.js tests/lint-rules/msg-rp-*.test.js tests/lint-rules/msg-cc-*.test.js tests/lint-rules/msg-nc-*.test.js tests/lint-rules/msg-rh-*.test.js tests/lint-rules/msg-lc-*.test.js tests/lint-rules/msg-sd-1*.test.js tests/lint-rules/msg-sd-2*.test.js 2>/dev/null | wc -l)
      echo "rules: $RULE_COUNT; tests: $TEST_COUNT"
      # Expect: equal
      # Every test has the node:test shim and ≥1 invalid case:
      grep -c 'RuleTester.afterAll = test.after' tests/lint-rules/msg-sr-*.test.js tests/lint-rules/msg-mr-*.test.js tests/lint-rules/msg-rp-*.test.js tests/lint-rules/msg-cc-*.test.js tests/lint-rules/msg-nc-*.test.js tests/lint-rules/msg-rh-*.test.js tests/lint-rules/msg-lc-*.test.js tests/lint-rules/msg-sd-1*.test.js tests/lint-rules/msg-sd-2*.test.js
      # All non-zero
      grep -c 'invalid:' tests/lint-rules/msg-sr-*.test.js tests/lint-rules/msg-mr-*.test.js tests/lint-rules/msg-rp-*.test.js tests/lint-rules/msg-cc-*.test.js tests/lint-rules/msg-nc-*.test.js tests/lint-rules/msg-rh-*.test.js tests/lint-rules/msg-lc-*.test.js tests/lint-rules/msg-sd-1*.test.js tests/lint-rules/msg-sd-2*.test.js
      # All non-zero
      # Run all the full-impl tests:
      node --test tests/lint-rules/msg-sr-*.test.js tests/lint-rules/msg-mr-*.test.js tests/lint-rules/msg-rp-*.test.js tests/lint-rules/msg-cc-*.test.js tests/lint-rules/msg-nc-*.test.js tests/lint-rules/msg-rh-*.test.js tests/lint-rules/msg-lc-*.test.js tests/lint-rules/msg-sd-1*.test.js tests/lint-rules/msg-sd-2*.test.js 2>&1 | tail -15
      # Expect: all pass; invalid case planted source produces the expected messageId
    </automated>
  </verify>
  <done>
    1. Each full-impl rule has a sibling `*.test.js`.
    2. Each test file has the 4-line node:test shim and ≥1 `invalid:` case with a `messageId` assertion containing the MSG-* ID literal.
    3. All full-impl RuleTester tests pass under `node --test`.
  </done>
</task>

<task type="auto">
  <name>Task 3: Populate index.js with full-impl rules + author msg-rule-registry.test.ts + sequence with Plan 06</name>
  <files>tests/lint-rules/index.js, tests/architecture/msg-rule-registry.test.ts</files>
  <read_first>
    - tests/lint-rules/index.js (after Plan 04 -- 16/19 meta-assertion rules registered; this plan adds the remaining 15/18 to reach 34 total)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pattern 6 (registry parity test -- full code template)
    - .planning/phases/14-drift-guard-test-alignment/14-CONTEXT.md D-14-12 (LOCKED body-scan + 34-rule count assertion)
    - tests/lint-rules/lib/frontmatter.js (consumed indirectly -- the registry test scans docs/messaging-style-guide.md directly via readFile, not via the loader; but the loader's existence is a sibling pattern for context)
    - docs/messaging-style-guide.md (the body that the registry test scans for `/MSG-[A-Z]+-[0-9]+/g`)
  </read_first>
  <action>
    Two operations in this task:

    **A. Extend `tests/lint-rules/index.js`** to import + register the 15 (or 18) full-impl rule modules from Task 1:
    1. Add ESM named imports at the top -- one per full-impl rule file.
    2. Append to `RULE_NAMES`: extend the existing meta-assertion list (from Plan 04) with the 15/18 full-impl names. Final array length: 34.
    3. Append to `default.rules` dict: each full-impl rule's name → its imported default.
    4. Re-freeze `RULE_NAMES` so the new list is immutable.

    Final shape: `RULE_NAMES.length === 34`, `Object.keys(default.rules).length === 34`. The plugin is now complete; Plan 06 wires the per-rule `files:` patterns in eslint.config.js to make the rules actually run during `npm run lint`.

    **B. Create `tests/architecture/msg-rule-registry.test.ts`** per RESEARCH.md Pattern 6 (the worked example contains the full code; the executor copies it verbatim and adjusts identifiers if needed):

    1. ESM TypeScript test (`.ts` so it joins the existing `tests/architecture/*.test.ts` family + runs under the original `package.json:test` glob without needing the lint-rules glob extension).
    2. Imports `RULE_NAMES` from `../../tests/lint-rules/index.js`. (NOTE: `.ts` test importing from `.js` plugin module -- this works under ESM because `.js` files are first-class modules; verify the import resolution by running the test once after authoring.)
    3. Reads `docs/messaging-style-guide.md` and `eslint.config.js` via `node:fs/promises::readFile`.
    4. Extracts MSG-* IDs from the markdown body via `/MSG-[A-Z]+-[0-9]+/g`.
    5. Four assertions (RESEARCH.md Pattern 6):
       (a) Every style-guide MSG-* ID has a corresponding rule file (slug-prefix match in `RULE_NAMES`).
       (b) Every rule name in `RULE_NAMES` has a style-guide MSG-* anchor.
       (c) Every rule name is registered in `eslint.config.js` via the literal `"msg/<name>":` (text-grep). **THIS ASSERTION WILL FAIL UNTIL PLAN 06 LANDS**. To avoid breaking `npm run check` between Plan 05 and Plan 06, the test file MUST land in this plan but the assertion (c) should be conditional:
       - **Option A** (preferred per D-14-03 wave-sequence-must-be-green): land the registry test in this plan with all 4 assertions ACTIVE. Plan 06 lands IMMEDIATELY after this plan and restores green by adding the 34 `"msg/<name>":` registrations.
       - **Option B** (defensive): land the registry test in this plan with assertion (c) GATED behind a "is eslint.config.js already wired" check (e.g., `if config contains any 'msg/' literal, run (c); else SKIP with a "Plan 06 wiring pending" note`). Plan 06 removes the gate.
       - Per RESEARCH.md and per D-14-03's "every wave green" property, choose Option A only if Plans 05 and 06 can land in a single atomic commit OR the executor is confident Plan 06 immediately follows. Otherwise Option B is safer.
       - **EXECUTOR DECISION** (default): use Option A; if the executor cannot land Plan 06 in the same plan-execute session, fall back to Option B with the gate removed in Plan 06's commit. Document the decision in the SUMMARY.
       (d) Total count assertion: `RULE_NAMES.length === 34` AND `styleGuideIds.length === 34`.

    6. Tests use the `node:test` + `node:assert/strict` style matching the existing `tests/architecture/*.test.ts` family.

    NEVER place fenced code blocks; RESEARCH.md Pattern 6 contains the canonical worked example.
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      # index.js complete (34 rules):
      node -e "import('./tests/lint-rules/index.js').then(m => { console.log('RULE_NAMES count:', m.RULE_NAMES.length); console.log('rules keys count:', Object.keys(m.default.rules).length); });"
      # Expect: 34, 34
      # Registry test exists:
      ls -la tests/architecture/msg-rule-registry.test.ts
      # Run the registry test:
      node --test tests/architecture/msg-rule-registry.test.ts 2>&1 | tail -10
      # Expected behavior depends on the executor's Option A / Option B decision:
      # - Option A: assertion (c) fails (Plan 06 not yet landed); other 3 assertions pass; LOG the failure as expected for sequencing into Plan 06.
      # - Option B: all 4 assertions pass (assertion (c) is gated and currently inactive).
      # In either case, the test file EXISTS and has 4 assertions.
      grep -c 'test(' tests/architecture/msg-rule-registry.test.ts
      # Expect: ≥4 (4 assertions)
      # All Plan 05 individual rule tests pass:
      node --test tests/lint-rules/msg-sr-*.test.js tests/lint-rules/msg-mr-*.test.js tests/lint-rules/msg-rp-*.test.js tests/lint-rules/msg-cc-*.test.js tests/lint-rules/msg-nc-*.test.js tests/lint-rules/msg-rh-*.test.js tests/lint-rules/msg-lc-*.test.js tests/lint-rules/msg-sd-1*.test.js tests/lint-rules/msg-sd-2*.test.js 2>&1 | tail -10
      # Expect: all pass
    </automated>
  </verify>
  <done>
    1. `tests/lint-rules/index.js` now imports + registers all 34 rules (16-19 meta + 15-18 full-impl); `RULE_NAMES.length === 34`.
    2. `tests/architecture/msg-rule-registry.test.ts` exists with 4 assertions per D-14-12: (a) every style-guide MSG-* has a rule file, (b) every rule name has a style-guide anchor, (c) every rule name is registered in eslint.config.js (Option A: assertion ACTIVE -- fails until Plan 06 / Option B: gated until Plan 06), (d) count is 34.
    3. All full-impl RuleTester tests pass.
    4. `npm run check` either GREEN (Option B) or RED-on-assertion-(c)-only (Option A) -- both are acceptable for this plan's acceptance, with the explicit sequencing requirement that Plan 06 lands immediately to restore green if Option A was chosen.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| ESLint AST visitor input (project source code) | Input is the project's own committed source code; no untrusted-input attack surface |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14-07 | Tampering | RuleTester planted-violation `invalid:` cases | mitigate | Each invalid case asserts the messageId byte-exactly; the rule's messages dict embeds the MSG-* ID literal -- a typo in either side fails the RuleTester test (caught at Plan 05 verify). |
| T-14-08 | Repudiation | msg-rule-registry.test.ts text-grep on eslint.config.js | accept | Text-grep is brittle to format reflow; mitigated by keeping rule registrations in stable double-quoted form per RESEARCH.md Pattern 6 recommendation. If Prettier reflows registrations, registry test fails and prompts re-grep adjustment. |
</threat_model>

<verification>
- 15 (or 18) full-impl rule files exist; each has a real AST visitor; each has a messageId containing the MSG-* ID literal.
- 15 (or 18) RuleTester companions exist; each has the node:test shim + ≥1 invalid case with byte-exact messageId assertion.
- `tests/lint-rules/index.js` registers all 34 rules.
- `tests/architecture/msg-rule-registry.test.ts` exists with 4 assertions.
- `node --test tests/lint-rules/msg-*.test.js` passes for all full-impl rules.
- `npm run check`: green under Option B; assertion (c) RED under Option A (sequencing with Plan 06 mandatory).
</verification>

<success_criteria>
1. Final 15 (or 18) MSG-* drift-guard rules ship with real AST coverage per D-14-09.
2. Every MSG-* rule's failure carries the MSG-* ID literal in its message -- SC #2 satisfied across all 34 rules.
3. Registry parity test exists; ties style-guide body ↔ rule files ↔ plugin module ↔ eslint.config.js wiring (D-14-12).
4. Per-rule planted-violation RuleTester tests pass -- SC #1 ("intentional planted violation makes `npm run check` fail with clear, locatable error") satisfied structurally for every rule.
5. Plugin module is complete; Plan 06 owns the eslint.config.js per-rule `files:` wiring + WARNING-level closures.
</success_criteria>

<output>
Create `.planning/phases/14-drift-guard-test-alignment/14-05-SUMMARY.md` when done. The SUMMARY MUST record the executor's Option A vs. Option B decision for assertion (c) sequencing.
</output>
